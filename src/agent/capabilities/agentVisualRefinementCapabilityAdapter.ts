import {
  type AgentChatCommand,
  type AgentStructuredToolCandidateEvidence,
  type AgentStructuredToolEvidence,
} from '../agentChatCommand';
import { hasAgentDirectActionIntent } from '../runtime/agentActionCoverage';
import { evaluateAgentVisualTargetVerification } from '../agentVisualTargetVerification';
import { type AgentRuntimeToolResultEntry } from '../runtime/agentRuntimeContract';
import { createAgentToolCommand } from '../runtime/agentToolCommandFactory';
import {
  getAgentStructuredEvidence,
  hasAgentCandidateLocationEvidence,
} from '../runtime/agentToolEvidence';

export const AGENT_VISUAL_REFINEMENT_MARKER = 'AgentSessionV2 visual refinement';
export const AGENT_FAILED_VISUAL_UIA_RECOVERY_MARKER = 'AgentSessionV2 failed visual UIA recovery';
export const AGENT_WINDOW_UI_VISUAL_FALLBACK_MARKER = 'AgentSessionV2 window UI visual fallback';
// Initial observation plus two forced-refresh refinements gives the Runtime a
// bounded two-of-three visual consensus without turning uncertainty into an
// unbounded observation loop.
const AGENT_VISUAL_REFINEMENT_MAX_RUNS = 2;

function normalizeAction(command: AgentChatCommand) {
  const action = command.toolCall?.input.action;
  return typeof action === 'string'
    ? action.trim().toLowerCase().replace(/[-\s]+/gu, '_')
    : '';
}

function isVisualObservationCommand(command: AgentChatCommand) {
  const toolName = command.toolCall?.name ?? '';
  const action = normalizeAction(command);
  return toolName === 'locate_screen_elements'
    || toolName === 'summarize_visual_snapshot'
    || (
      toolName === 'execute_desktop_observation'
      && ['summarize_visual_snapshot', 'inspect_window_ui'].includes(action)
    );
}

function isFailedVisualRecoverySourceCommand(command: AgentChatCommand) {
  const toolName = command.toolCall?.name ?? '';
  const action = normalizeAction(command);
  return toolName === 'locate_screen_elements'
    || toolName === 'summarize_visual_snapshot'
    || (
      toolName === 'execute_desktop_observation'
      && action === 'summarize_visual_snapshot'
    );
}

function isRefinementCommand(command: AgentChatCommand) {
  const question = command.toolCall?.input.question;
  return command.toolCall?.name === 'locate_screen_elements'
    && typeof question === 'string'
    && (
      question.includes(AGENT_VISUAL_REFINEMENT_MARKER)
      || question.includes(AGENT_WINDOW_UI_VISUAL_FALLBACK_MARKER)
    );
}

function findPreviousVisualEvidence(
  latestEntry: AgentRuntimeToolResultEntry,
  toolResults: AgentRuntimeToolResultEntry[],
) {
  return [...toolResults]
    .reverse()
    .find((entry) => (
      entry !== latestEntry
      && entry.result.ok !== false
      && (
        entry.command.toolCall?.name === 'locate_screen_elements'
        || isVisualObservationCommand(entry.command)
        || isWindowUiInspectionCommand(entry.command)
      )
    ));
}

function isWindowUiInspectionCommand(command: AgentChatCommand) {
  const action = normalizeAction(command);
  return command.toolCall?.name === 'execute_desktop_observation'
    && action === 'inspect_window_ui';
}

function createWindowUiVisualFallback(options: {
  latestEntry: AgentRuntimeToolResultEntry;
  sourceText: string;
  userGoal: string;
}) {
  if (!isWindowUiInspectionCommand(options.latestEntry.command)) {
    return null;
  }

  const input = options.latestEntry.command.toolCall?.input ?? {};
  const evidence = getAgentStructuredEvidence(options.latestEntry);
  const recovery = evidence?.postActionRecovery;
  if (
    recovery?.nextTool === 'locate_screen_elements'
    && recovery.nextArgs
    && typeof recovery.nextArgs === 'object'
    && !Array.isArray(recovery.nextArgs)
  ) {
    return createAgentToolCommand({
      args: recovery.nextArgs as Record<string, unknown>,
      sourceText: options.sourceText,
      toolName: 'locate_screen_elements',
      userGoal: options.userGoal,
    });
  }
  const hasLocatedCandidate = [
    ...(evidence?.targetCandidates ?? []),
    ...(evidence?.actionCandidates ?? []),
  ].some((candidate) => candidate.enabled !== false && candidate.offscreen !== true && hasAgentCandidateLocationEvidence(candidate));
  if (hasLocatedCandidate || options.latestEntry.result.ok === false) {
    return null;
  }
  const observationText = [
    options.latestEntry.result.responseText,
    options.latestEntry.result.verification,
    ...(options.latestEntry.result.observations ?? []),
    ...(options.latestEntry.result.stateSummary?.observedState ?? []),
    ...(options.latestEntry.result.stateSummary?.missingEvidence ?? []),
  ].filter(Boolean).join('\n').normalize('NFKC');
  const authenticationGate = /(?:login\s+(?:page|screen|overlay|panel|required)|sign\s*in\s+(?:page|screen|overlay|panel|required)|\u767b\u5f55(?:\u754c\u9762|\u9875|\u9762\u677f|\u8986\u76d6|\u5165\u53e3|\u6309\u94ae)|\u5feb\u901f\s*安全\s*登录|\u8d26\u53f7\s*(?:选择|下拉)|\u767b\u5f55\s*面板)/iu.test(observationText);

  const sourceQuery = [
    input.sourceQuery,
    input.query,
    input.windowTitle,
    input.title,
    evidence?.finalWindow?.title,
    evidence?.finalWindow?.processName,
    options.userGoal,
  ].find((value) => typeof value === 'string' && value.trim())?.toString().trim() ?? '';
  const targetText = [
    authenticationGate ? '登录或继续控件' : '',
    input.targetText,
    evidence?.targetMatched,
    input.targetDescription,
    options.userGoal,
  ].find((value) => typeof value === 'string' && value.trim())?.toString().trim() ?? options.userGoal;
  const hwnd = Number(input.hwnd ?? evidence?.finalWindow?.hwnd);

  return createAgentToolCommand({
    args: {
      action: 'locate_element',
      allowScreenFallback: false,
      forceRefresh: true,
      ...(Number.isFinite(hwnd) && hwnd > 0 ? { hwnd: Math.round(hwnd) } : {}),
      ...(sourceQuery ? { sourceQuery } : {}),
      sourceType: 'window',
      targetDescription: targetText,
      targetText,
      question: [
        AGENT_WINDOW_UI_VISUAL_FALLBACK_MARKER,
        'UI Automation returned no located actionable control; use a fresh window-level visual observation instead.',
        sourceQuery ? `Source app/window: ${sourceQuery}.` : '',
        authenticationGate
          ? 'The current window appears to be at an authentication gate. Locate the safe login/continue control only if credentials are already present; otherwise report the missing credential or manual verification gate.'
          : `Locate the requested visible control or action: ${targetText}.`,
        'Return target/action relation, native-screen or source-ratio coordinates, confidence, and visualActionReadiness. Do not click.',
      ].filter(Boolean).join(' '),
    },
    sourceText: options.sourceText,
    toolName: 'locate_screen_elements',
    userGoal: options.userGoal,
  });
}

function isFailedVisualRecoveryCommand(command: AgentChatCommand) {
  const question = command.toolCall?.input.question;
  return command.toolCall?.name === 'execute_desktop_observation'
    && typeof question === 'string'
    && question.includes(AGENT_FAILED_VISUAL_UIA_RECOVERY_MARKER);
}

function hasTopLevelActionPoint(evidence: AgentStructuredToolEvidence | null) {
  return Boolean(
    Number.isFinite(Number(evidence?.elementCenter?.x))
      && Number.isFinite(Number(evidence?.elementCenter?.y))
    || Number.isFinite(Number(evidence?.elementCenterRatio?.x))
      && Number.isFinite(Number(evidence?.elementCenterRatio?.y))
    || Number.isFinite(Number(evidence?.elementBounds?.x))
      && Number.isFinite(Number(evidence?.elementBounds?.y))
      && Number.isFinite(Number(evidence?.elementBounds?.width))
      && Number.isFinite(Number(evidence?.elementBounds?.height))
  );
}

function hasDirectInvokableUiCandidate(evidence: AgentStructuredToolEvidence | null) {
  return (evidence?.actionCandidates ?? []).some((candidate) => (
    candidate.source === 'ui-automation'
    && candidate.enabled !== false
    && candidate.offscreen !== true
    && (candidate.actions ?? []).some((action) => /^(?:invoke|select|toggle|expand|collapse|set_value)$/iu.test(action))
  ));
}

function hasUnresolvedActionRelation(evidence: AgentStructuredToolEvidence | null) {
  const verification = evidence?.targetInteractionVerification ?? evidence?.launcherVerification;
  const relationText = [
    evidence?.relation,
    ...(evidence?.actionCandidates ?? []).flatMap((candidate) => [candidate.relation, candidate.description]),
  ].filter((value): value is string => typeof value === 'string' && Boolean(value.trim())).join('\n');
  const hasExplicitRelation = Boolean(
    evidence?.targetMatched
      && evidence?.primaryAction
      && /(?:belongs\s+to|associated\s+with|for\s+(?:the\s+)?(?:selected|current)|owned\s+by|对应|属于|关联|当前详情|已选中)/iu.test(relationText),
  );
  return verification?.status === 'needs-relation'
    || verification?.primaryActionMatchesTarget === false
    || !hasExplicitRelation
      && verification?.primaryActionMatchesTarget == null
      && Boolean(evidence?.targetMatched && evidence?.primaryAction);
}

function createSyntheticCandidate(
  evidence: AgentStructuredToolEvidence | null,
): AgentStructuredToolCandidateEvidence | null {
  if (!evidence) return null;
  const candidate: AgentStructuredToolCandidateEvidence = {
    bounds: evidence.elementBounds ?? null,
    center: evidence.elementCenter ?? null,
    centerRatio: evidence.elementCenterRatio ?? null,
    confidence: evidence.coordinateConfidence === 'low' ? 'low' : evidence.confidence ?? null,
    description: evidence.elementDescription ?? null,
    label: [evidence.primaryAction, evidence.targetMatched]
      .filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
      .join(' for ') || null,
    region: evidence.elementRegion ?? null,
    relation: evidence.relation ?? null,
    source: 'structuredEvidence',
  };
  return hasAgentCandidateLocationEvidence(candidate) ? candidate : null;
}

function candidateBounds(candidate: AgentStructuredToolCandidateEvidence) {
  const bounds = candidate.bounds;
  const x = Number(bounds?.x);
  const y = Number(bounds?.y);
  const width = Number(bounds?.width);
  const height = Number(bounds?.height);
  if ([x, y, width, height].every(Number.isFinite) && width > 0 && height > 0) {
    const space = bounds?.coordinateSpace?.trim().toLowerCase() ?? '';
    const ratio = space.includes('ratio') || (width <= 1 && height <= 1);
    return {
      coordinateSpace: ratio ? 'source-ratio' as const : 'native-screen' as const,
      height,
      width,
      x,
      y,
    };
  }
  const ratioX = Number(candidate.centerRatio?.x);
  const ratioY = Number(candidate.centerRatio?.y);
  if (Number.isFinite(ratioX) && Number.isFinite(ratioY)) {
    return {
      coordinateSpace: 'source-ratio' as const,
      height: 0.16,
      width: 0.22,
      x: Math.max(0, ratioX - 0.11),
      y: Math.max(0, ratioY - 0.08),
    };
  }
  const centerX = Number(candidate.center?.x);
  const centerY = Number(candidate.center?.y);
  if (Number.isFinite(centerX) && Number.isFinite(centerY)) {
    return {
      coordinateSpace: 'native-screen' as const,
      height: 140,
      width: 220,
      x: Math.max(0, centerX - 110),
      y: Math.max(0, centerY - 70),
    };
  }
  return null;
}

function createRelationCandidate(
  evidence: AgentStructuredToolEvidence | null,
): AgentStructuredToolCandidateEvidence | null {
  const target = evidence?.targetCandidates?.find((candidate) => (
    candidate.enabled !== false && candidate.offscreen !== true && hasAgentCandidateLocationEvidence(candidate)
  ));
  const action = evidence?.actionCandidates?.find((candidate) => (
    candidate.enabled !== false && candidate.offscreen !== true && hasAgentCandidateLocationEvidence(candidate)
  ));
  if (!target || !action) return null;
  const targetBounds = candidateBounds(target);
  const actionBounds = candidateBounds(action);
  if (!targetBounds || !actionBounds || targetBounds.coordinateSpace !== actionBounds.coordinateSpace) {
    return null;
  }
  const x = Math.min(targetBounds.x, actionBounds.x);
  const y = Math.min(targetBounds.y, actionBounds.y);
  const right = Math.max(targetBounds.x + targetBounds.width, actionBounds.x + actionBounds.width);
  const bottom = Math.max(targetBounds.y + targetBounds.height, actionBounds.y + actionBounds.height);
  const bounds = {
    coordinateSpace: targetBounds.coordinateSpace,
    height: bottom - y,
    source: 'uia-visual-fusion',
    width: right - x,
    x,
    y,
  };
  const targetLabel = target.label?.trim() || target.name?.trim() || evidence?.targetMatched?.trim() || 'target candidate';
  const actionLabel = action.label?.trim() || action.name?.trim() || evidence?.primaryAction?.trim() || 'action candidate';
  return {
    bounds,
    center: bounds.coordinateSpace === 'native-screen'
      ? { coordinateSpace: 'native-screen', source: 'uia-visual-fusion', x: Math.round(x + bounds.width / 2), y: Math.round(y + bounds.height / 2) }
      : null,
    centerRatio: bounds.coordinateSpace === 'source-ratio'
      ? { coordinateSpace: 'source-ratio', source: 'uia-visual-fusion', x: Math.min(1, x + bounds.width / 2), y: Math.min(1, y + bounds.height / 2) }
      : null,
    confidence: 'high',
    description: `Combined target/action area: ${targetLabel} + ${actionLabel}`,
    label: `${targetLabel} + ${actionLabel}`,
    region: 'combined target/action relation area',
    relation: 'Crop includes both target and action candidates so vision can verify their relation.',
    source: 'uia-visual-fusion',
  };
}

function textTokens(value: string) {
  return value.normalize('NFKC').toLowerCase().split(/[^\p{L}\p{N}]+/gu).filter((token) => token.length > 1);
}

function scoreCandidate(options: {
  candidate: AgentStructuredToolCandidateEvidence;
  candidateKind: 'action' | 'target';
  evidence: AgentStructuredToolEvidence | null;
  index: number;
  sourceText: string;
  userGoal: string;
}) {
  const { candidate, evidence } = options;
  const reasons: string[] = [];
  let score = candidate.confidence === 'high' ? 30 : candidate.confidence === 'medium' ? 20 : 5;
  score -= options.index;
  if (candidate.centerRatio) { score += 35; reasons.push('has centerRatio'); }
  if (candidate.bounds) { score += 30; reasons.push('has bounds'); }
  if (candidate.center) { score += 25; reasons.push('has screen center'); }
  if (candidate.relation?.trim()) { score += 10; reasons.push('has relation'); }
  if (candidate.source === 'uia-visual-fusion') { score += 35; reasons.push('combined UIA target/action relation crop'); }
  const readiness = evidence?.visualActionReadiness;
  if (
    options.candidateKind === 'target' && ['needs-target-selection', 'low-confidence'].includes(readiness ?? '')
    || options.candidateKind === 'action' && ['needs-primary-action', 'needs-coordinate', 'needs-relation'].includes(readiness ?? '')
  ) {
    score += 14;
    reasons.push(`${options.candidateKind} matches readiness`);
  }
  const requestedTokens = new Set(textTokens(`${options.sourceText} ${options.userGoal}`));
  const candidateText = `${candidate.label ?? ''} ${candidate.name ?? ''} ${candidate.description ?? ''} ${candidate.relation ?? ''}`.toLowerCase();
  const relevance = [...requestedTokens].filter((token) => candidateText.includes(token)).length * 7;
  if (relevance) { score += relevance; reasons.push(`text relevance +${relevance}`); }
  const width = Number(candidate.bounds?.width);
  const height = Number(candidate.bounds?.height);
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
    const ratio = candidate.bounds?.coordinateSpace?.includes('ratio') || (width <= 1 && height <= 1);
    if (ratio ? width * height <= 0.018 || Math.max(width, height) <= 0.16 : width <= 260 || height <= 150) {
      score += 8;
      reasons.push('small target needs close crop');
    }
  }
  return { reason: reasons.join(', ') || 'candidate has usable location evidence', score };
}

function isLoginContinuationContext(evidence: AgentStructuredToolEvidence | null) {
  const text = [
    evidence?.postActionState,
    evidence?.targetMatched,
    evidence?.primaryAction,
    evidence?.elementDescription,
    evidence?.relation,
    ...(evidence?.visibleTextCandidates ?? []),
  ].filter(Boolean).join('\n').normalize('NFKC');
  return evidence?.postActionState === 'login_required'
    || /(?:login|log\s*in|sign\s*in|continue|confirm|submit|\u767b\u5f55|\u767b\u9646|\u7ee7\u7eed|\u786e\u8ba4|\u63d0\u4ea4)/iu.test(text);
}

function selectCandidate(options: {
  evidence: AgentStructuredToolEvidence | null;
  sourceText: string;
  userGoal: string;
}) {
  const readiness = options.evidence?.visualActionReadiness ?? '';
  const targetCandidates = options.evidence?.targetCandidates ?? [];
  const actionCandidates = options.evidence?.actionCandidates ?? [];
  const relationCandidate = createRelationCandidate(options.evidence);
  // On an authentication/account gate the actionable control is the useful
  // refinement target; the visible app content is often just a background or
  // remembered-account card and must not displace the login action candidate.
  const preferAction = isLoginContinuationContext(options.evidence)
    || ['needs-primary-action', 'needs-coordinate', 'needs-relation'].includes(readiness);
  const candidates: Array<{ candidate: AgentStructuredToolCandidateEvidence; candidateKind: 'action' | 'target' }> = preferAction
    ? [
        ...(relationCandidate ? [{ candidate: relationCandidate, candidateKind: 'action' as const }] : []),
        ...actionCandidates.map((candidate) => ({ candidate, candidateKind: 'action' as const })),
        ...targetCandidates.map((candidate) => ({ candidate, candidateKind: 'target' as const })),
      ]
    : [
        ...targetCandidates.map((candidate) => ({ candidate, candidateKind: 'target' as const })),
        ...actionCandidates.map((candidate) => ({ candidate, candidateKind: 'action' as const })),
      ];
  const synthetic = createSyntheticCandidate(options.evidence);
  if (synthetic && (!candidates.length || ['ready', 'low-confidence', 'needs-coordinate'].includes(readiness))) {
    candidates.push({ candidate: synthetic, candidateKind: options.evidence?.primaryAction ? 'action' : 'target' });
  }
  return candidates
    .filter(({ candidate }) => candidate.enabled !== false && candidate.offscreen !== true && hasAgentCandidateLocationEvidence(candidate))
    .map((choice, index) => ({
      ...choice,
      ...scoreCandidate({ ...choice, evidence: options.evidence, index, sourceText: options.sourceText, userGoal: options.userGoal }),
    }))
    .sort((a, b) => b.score - a.score)[0] ?? null;
}

function clampRatio(value: number, fallback: number) {
  return Number.isFinite(value) ? Math.max(0.05, Math.min(0.9, value)) : fallback;
}

function focusArgs(
  candidate: AgentStructuredToolCandidateEvidence,
  readiness: AgentStructuredToolEvidence['visualActionReadiness'] = null,
): Record<string, unknown> | null {
  const width = Number(candidate.bounds?.width);
  const height = Number(candidate.bounds?.height);
  const boundsRatio = candidate.bounds?.coordinateSpace?.includes('ratio') || (width <= 1 && height <= 1);
  const needsRelationContext = readiness === 'needs-relation';
  const contextMultiplier = needsRelationContext ? 4.8 : 2.4;
  const minWidthRatio = needsRelationContext ? 0.42 : 0.28;
  const minHeightRatio = needsRelationContext ? 0.36 : 0.24;
  const focusScale = readiness === 'ready'
    ? Math.max(2, candidate.confidence === 'low' ? 3 : candidate.confidence === 'medium' ? 2 : 2)
    : candidate.confidence === 'low'
    || Number.isFinite(width) && Number.isFinite(height) && (
      boundsRatio ? width * height <= 0.018 || Math.max(width, height) <= 0.16 : width <= 260 || height <= 150
    ) ? 3 : candidate.confidence === 'medium' ? 2 : 1;
  const scaleArgs = focusScale > 1 ? { focusScale } : {};
  const ratioX = Number(candidate.centerRatio?.x);
  const ratioY = Number(candidate.centerRatio?.y);
  if (Number.isFinite(ratioX) && Number.isFinite(ratioY) && ratioX >= 0 && ratioX <= 1 && ratioY >= 0 && ratioY <= 1) {
    return {
      focusCenterRatioX: ratioX,
      focusCenterRatioY: ratioY,
      focusHeightRatio: boundsRatio ? clampRatio(height * contextMultiplier, minHeightRatio) : minHeightRatio,
      ...scaleArgs,
      focusWidthRatio: boundsRatio ? clampRatio(width * contextMultiplier, minWidthRatio) : minWidthRatio,
    };
  }
  const x = Number(candidate.bounds?.x);
  const y = Number(candidate.bounds?.y);
  if ([x, y, width, height].every(Number.isFinite) && width > 0 && height > 0) {
    return {
      focusCoordinateSpace: candidate.bounds?.coordinateSpace?.trim() || 'native-screen',
        focusHeight: Math.max(needsRelationContext ? 260 : 120, Math.round(height * (needsRelationContext ? 4.4 : 2.2))),
      ...scaleArgs,
        focusWidth: Math.max(needsRelationContext ? 320 : 180, Math.round(width * (needsRelationContext ? 4.4 : 2.2))),
      focusX: Math.max(0, Math.round(x - width * 0.6)),
      focusY: Math.max(0, Math.round(y - height * 0.6)),
    };
  }
  const centerX = Number(candidate.center?.x);
  const centerY = Number(candidate.center?.y);
  return Number.isFinite(centerX) && Number.isFinite(centerY)
    ? {
        focusCoordinateSpace: candidate.center?.coordinateSpace?.trim() || 'native-screen',
        focusHeight: needsRelationContext ? 360 : 240,
        ...scaleArgs,
        focusWidth: needsRelationContext ? 520 : 360,
        focusX: Math.max(0, Math.round(centerX - 180)),
        focusY: Math.max(0, Math.round(centerY - 120)),
      }
    : null;
}

function createFailedVisualRecovery(options: {
  latestEntry: AgentRuntimeToolResultEntry;
  sourceText: string;
  toolResults: AgentRuntimeToolResultEntry[];
  userGoal: string;
}) {
  if (
    options.latestEntry.result.ok !== false
    || !isFailedVisualRecoverySourceCommand(options.latestEntry.command)
    || options.toolResults.some((entry) => isFailedVisualRecoveryCommand(entry.command))
  ) return null;
  const input = options.latestEntry.command.toolCall?.input ?? {};
  const evidence = getAgentStructuredEvidence(options.latestEntry);
  const query = [input.sourceQuery, input.query, input.windowTitle, input.title, input.target, input.name]
    .find((value) => typeof value === 'string' && value.trim())?.toString().trim()
    || options.sourceText || options.userGoal;
  const targetText = [input.targetText, evidence?.targetMatched, input.targetDescription, input.query, options.userGoal]
    .find((value) => typeof value === 'string' && value.trim())?.toString().trim() ?? '';
  const hwnd = Number(input.hwnd);
  return createAgentToolCommand({
    args: {
      action: 'inspect_window_ui',
      forceRefresh: true,
      ...(Number.isFinite(hwnd) && hwnd > 0 ? { hwnd: Math.round(hwnd) } : {}),
      limit: 80,
      maxDepth: 6,
      question: [
        AGENT_FAILED_VISUAL_UIA_RECOVERY_MARKER,
        'The previous visual/OCR-like observation failed before finding a reliable visual action.',
        'Use read-only Windows UI Automation to inspect the active or named app window for controls, buttons, list items, text fields, and bounds.',
        targetText ? `Target text/content: ${targetText}.` : '',
        query ? `Window/source query: ${query}.` : '',
        'Return targetCandidates/actionCandidates, supported UI actions, screen bounds, enabled/offscreen state, and visualActionReadiness when possible.',
        'Do not click or invoke anything.',
      ].filter(Boolean).join(' '),
      ...(query ? { query } : {}),
      targetDescription: targetText || options.userGoal,
      ...(targetText ? { targetText } : {}),
    },
    sourceText: options.sourceText,
    toolName: 'execute_desktop_observation',
    userGoal: options.userGoal,
  });
}

export function createAgentVisualRefinementCommand(options: {
  latestEntry: AgentRuntimeToolResultEntry | null;
  sourceText: string;
  toolResults: AgentRuntimeToolResultEntry[];
  userGoal: string;
}): AgentChatCommand | null {
  const latestEntry = options.latestEntry;
  if (
    !latestEntry
    || !hasAgentDirectActionIntent(options.sourceText, options.userGoal)
    || options.toolResults.filter((entry) => isRefinementCommand(entry.command)).length >= AGENT_VISUAL_REFINEMENT_MAX_RUNS
    || isRefinementCommand(latestEntry.command)
      && evaluateAgentVisualTargetVerification({
        command: latestEntry.command,
        current: getAgentStructuredEvidence(latestEntry),
        previous: (() => {
          const previous = findPreviousVisualEvidence(latestEntry, options.toolResults);
          return previous ? getAgentStructuredEvidence(previous) : null;
        })(),
      }).status === 'passed'
    || !isVisualObservationCommand(latestEntry.command)
  ) return null;
  const evidence = getAgentStructuredEvidence(latestEntry);
  const windowUiVisualFallback = createWindowUiVisualFallback({
    latestEntry,
    sourceText: options.sourceText,
    userGoal: options.userGoal,
  });
  if (windowUiVisualFallback) {
    return windowUiVisualFallback;
  }
  const readiness = evidence?.visualActionReadiness ?? null;
  const synthetic = createSyntheticCandidate(evidence);
  const needsReadyRefinement = readiness === 'ready'
    && (!hasDirectInvokableUiCandidate(evidence) || hasUnresolvedActionRelation(evidence))
    && Boolean(synthetic || hasTopLevelActionPoint(evidence));
  if (!readiness || readiness === 'not-actionable' || (readiness === 'ready' && !needsReadyRefinement)) {
    return createFailedVisualRecovery({ ...options, latestEntry });
  }
  const choice = selectCandidate({ evidence, sourceText: options.sourceText, userGoal: options.userGoal });
  const selectedFocusArgs = choice ? focusArgs(choice.candidate, readiness) : null;
  if (!choice || !selectedFocusArgs) {
    return createFailedVisualRecovery({ ...options, latestEntry });
  }
  const input = latestEntry.command.toolCall?.input ?? {};
  const candidateText = choice.candidate.label?.trim()
    || choice.candidate.description?.trim()
    || choice.candidate.region?.trim()
    || evidence?.targetMatched?.trim()
    || 'candidate visual region';
  const originalTargetDescription = [input.targetDescription, input.targetText, input.query, options.userGoal]
    .find((value) => typeof value === 'string' && value.trim())?.toString().trim() ?? options.userGoal;
  return createAgentToolCommand({
    args: {
      ...('sourceId' in input ? { sourceId: input.sourceId } : {}),
      ...('sourceQuery' in input ? { sourceQuery: input.sourceQuery } : {}),
      ...(!('sourceQuery' in input) && typeof input.query === 'string' && input.query.trim() ? { sourceQuery: input.query.trim() } : {}),
      ...('sourceType' in input ? { sourceType: input.sourceType } : {}),
      ...(!('sourceType' in input) && evidence?.captureSourceType ? { sourceType: evidence.captureSourceType } : {}),
      ...(input.allowScreenFallback !== undefined
        ? { allowScreenFallback: input.allowScreenFallback }
        : evidence?.captureSourceType === 'window' ? { allowScreenFallback: false } : {}),
      ...selectedFocusArgs,
      action: 'locate_element',
      forceRefresh: true,
      question: [
        AGENT_VISUAL_REFINEMENT_MARKER,
        `Previous visual readiness was ${readiness}.`,
        needsReadyRefinement
          ? 'The previous result looked action-ready, but visual confidence, coordinate confidence, candidate ambiguity, or small text/buttons still need focused validation before approval.'
          : '',
        `Candidate ranking selected a ${choice.candidateKind} candidate with score ${Math.round(choice.score)} because ${choice.reason}.`,
        `Focus the candidate area "${candidateText}" and use OCR/visual inspection to verify the exact target, primary action, relation, and coordinates.`,
        'The focused crop may be magnified for small text/buttons/icons; interpret coordinates relative to the focused sourceBounds if returned.',
        'Return targetMatched, primaryAction, relation, elementCenter or elementCenterRatio with sourceBounds, confidence, coordinateConfidence, and visualActionReadiness.',
        'Do not mark ready unless the primary action belongs to the requested target and the coordinate is usable for a later permission-gated click.',
      ].filter(Boolean).join(' '),
      targetDescription: `${originalTargetDescription}; focused candidate: ${candidateText}`,
    },
    sourceText: options.sourceText,
    toolName: 'locate_screen_elements',
    userGoal: options.userGoal,
  });
}
