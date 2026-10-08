import {
  type AgentChatCommand,
} from '../agentChatCommand';
import {
  hasAgentDirectActionIntent,
} from '../runtime/agentActionCoverage';
import {
  evaluateAgentVisualTargetVerification,
} from '../agentVisualTargetVerification';
import {
  type AgentRuntimeToolResultEntry,
} from '../runtime/agentRuntimeContract';
import {
  resolveAgentTargetResolutionHints,
} from '../runtime/agentTargetResolutionContext';
import {
  createAgentToolCommand,
} from '../runtime/agentToolCommandFactory';
import {
  getAgentStructuredEvidence,
  hasAgentCandidateLocationEvidence,
} from '../runtime/agentToolEvidence';
import {
  hasTopLevelActionPoint,
  hasDirectInvokableUiCandidate,
  hasUnresolvedActionRelation,
  isFocusedCropCommand,
  createSyntheticCandidate,
  selectCandidate,
  focusArgs,
} from './visualRefinement/visualCandidateFocus';

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
    const nextArgs = recovery.nextArgs as Record<string, unknown>;
    // The inspected window's handle pins the capture source; without it the read matched
    // the inspection query (an in-app label like 快捷安全登录) against window titles and failed.
    const inspectedHwnd = Number(input.hwnd ?? evidence?.finalWindow?.hwnd);
    const pinnedWindow = Number.isFinite(inspectedHwnd) && inspectedHwnd > 0
      && nextArgs.hwnd === undefined && nextArgs.sourceId === undefined
      ? { hwnd: Math.round(inspectedHwnd), sourceType: 'window' }
      : {};
    // Keep the fallback marker so the bounded refinement budget counts this
    // run, and carry the recovery reason so the vision read knows why it runs.
    return createAgentToolCommand({
      args: {
        ...nextArgs,
        ...pinnedWindow,
        question: [
          AGENT_WINDOW_UI_VISUAL_FALLBACK_MARKER,
          typeof recovery.reason === 'string' ? recovery.reason : '',
          typeof nextArgs.question === 'string' ? nextArgs.question : '',
          'Do not click.',
        ].filter(Boolean).join(' '),
      },
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
  // For a window inspection, targetMatched names the matched window. When the
  // user asked for a target inside that app, look for the inner target instead.
  const inAppTargetText = resolveAgentTargetResolutionHints(options.sourceText, options.userGoal)?.targetText;
  const targetText = [
    authenticationGate ? '登录或继续控件' : '',
    input.targetText,
    inAppTargetText,
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
  const cropRelativeRatio = isFocusedCropCommand(latestEntry.command);
  const synthetic = createSyntheticCandidate(evidence, cropRelativeRatio);
  // A local OCR text snap already validated the target text and its coordinates; another
  // vision pass costs 10-40s and live WeGame runs showed it only re-confirmed the same point.
  const ocrConfirmedPoint = /^OCR 校正/u.test(evidence?.elementRegion?.trim() ?? '');
  const needsReadyRefinement = readiness === 'ready'
    && !ocrConfirmedPoint
    && (!hasDirectInvokableUiCandidate(evidence) || hasUnresolvedActionRelation(evidence))
    && Boolean(synthetic || hasTopLevelActionPoint(evidence));
  if (!readiness || readiness === 'not-actionable' || (readiness === 'ready' && !needsReadyRefinement)) {
    return createFailedVisualRecovery({ ...options, latestEntry });
  }
  const choice = selectCandidate({
    cropRelativeRatio,
    evidence,
    sourceText: options.sourceText,
    userGoal: options.userGoal,
  });
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
