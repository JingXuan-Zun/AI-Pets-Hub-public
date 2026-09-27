import {
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentStructuredToolCandidateEvidence,
  type AgentStructuredToolEvidence,
} from './agentChatCommand';
import {
  createAgentToolCommand,
} from './runtime/agentToolCommandFactory';
import { resolveAgentTargetInteractionVerification } from './runtime/agentRuntimeVerificationEvidence';

export type AgentExecutionStrategyKind = 'coordinate' | 'none' | 'uia';

export interface AgentExecutionStrategyDecision {
  command?: AgentChatCommand;
  diagnostics: string[];
  kind: AgentExecutionStrategyKind;
  reason: string;
}

const AGENT_EXECUTION_STRATEGY_UI_ACTION_PRIORITY = ['invoke', 'select', 'toggle', 'expand-collapse', 'focus'] as const;

function normalizeAgentExecutionStrategyUiActionToken(value: unknown) {
  return typeof value === 'string'
    ? value.trim().toLowerCase().replace(/[_\s]+/gu, '-')
    : '';
}

function getAgentExecutionStrategyCandidateUiActions(candidate: AgentStructuredToolCandidateEvidence) {
  const actions = Array.isArray(candidate.actions) ? candidate.actions : [];
  const normalizedActions = actions.map(normalizeAgentExecutionStrategyUiActionToken);
  const actionText = [
    ...normalizedActions,
    candidate.description ?? '',
  ].join(' ').toLowerCase().replace(/[_\s]+/gu, '-');

  return AGENT_EXECUTION_STRATEGY_UI_ACTION_PRIORITY.filter((action) => (
    normalizedActions.includes(action)
    || new RegExp(`\\b${action.replace('-', '[-_]')}\\b`, 'iu').test(actionText)
  ));
}

function inferAgentExecutionStrategyWindowUiAction(candidate: AgentStructuredToolCandidateEvidence) {
  const actions = getAgentExecutionStrategyCandidateUiActions(candidate);
  if (actions.includes('invoke')) {
    return 'invoke';
  }
  if (actions.includes('select')) {
    return 'select';
  }
  if (actions.includes('toggle')) {
    return 'toggle';
  }
  if (actions.includes('expand-collapse')) {
    return 'expand';
  }
  if (actions.includes('focus')) {
    return 'focus';
  }

  return '';
}

function scoreAgentExecutionStrategyInvokableCandidate(
  candidate: AgentStructuredToolCandidateEvidence,
  index: number,
) {
  const uiAction = inferAgentExecutionStrategyWindowUiAction(candidate);
  if (!uiAction || candidate.enabled === false || candidate.offscreen === true || candidate.confidence === 'low') {
    return null;
  }

  let score = 100 - index;
  if (candidate.confidence === 'high') {
    score += 20;
  } else if (candidate.confidence === 'medium') {
    score += 8;
  }
  if (candidate.automationId?.trim()) {
    score += 18;
  }
  if (candidate.controlType?.trim()) {
    score += 10;
  }
  if (candidate.source === 'ui-automation') {
    score += 14;
  }
  score += getAgentExecutionStrategyCandidateUiActions(candidate).length * 10;

  return {
    candidate,
    score,
    uiAction,
  };
}

function resolveAgentExecutionStrategyInvokableCandidate(
  evidence: AgentStructuredToolEvidence | null,
) {
  const actionCandidates = Array.isArray(evidence?.actionCandidates) ? evidence.actionCandidates : [];
  const targetCandidates = Array.isArray(evidence?.targetCandidates) ? evidence.targetCandidates : [];

  return [
    ...actionCandidates.map(scoreAgentExecutionStrategyInvokableCandidate),
    ...targetCandidates.map(scoreAgentExecutionStrategyInvokableCandidate),
  ]
    .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)
    .sort((a, b) => b.score - a.score)
    .at(0)
    ?? null;
}

function createAgentExecutionStrategyDiagnostics(options: {
  evidence: AgentStructuredToolEvidence | null;
  strategy: AgentExecutionStrategyKind;
  strategyReason: string;
}) {
  return [
    `Execution strategy: ${options.strategy}`,
    `Execution strategy reason: ${options.strategyReason}`,
    options.evidence?.visualActionReadiness ? `Visual readiness: ${options.evidence.visualActionReadiness}` : '',
    options.evidence?.confidence ? `Visual confidence: ${options.evidence.confidence}` : '',
    options.evidence?.coordinateConfidence ? `Coordinate confidence: ${options.evidence.coordinateConfidence}` : '',
    options.evidence?.coordinateAuditStatus || options.evidence?.coordinateAudit?.status
      ? `Coordinate audit: ${options.evidence.coordinateAuditStatus ?? options.evidence.coordinateAudit?.status}`
      : '',
    options.evidence?.coordinateAudit?.reason ? `Coordinate audit reason: ${options.evidence.coordinateAudit.reason}` : '',
    options.evidence?.sourceBounds
      ? `Source bounds: ${Math.round(Number(options.evidence.sourceBounds.x))},${Math.round(Number(options.evidence.sourceBounds.y))} ${Math.round(Number(options.evidence.sourceBounds.width))}x${Math.round(Number(options.evidence.sourceBounds.height))}`
      : '',
  ].filter(Boolean);
}

function resolveAgentVisualExecutionStrategyStructuredEvidence(
  result: AgentChatCommandResult,
): AgentStructuredToolEvidence | null {
  return result.stateSummary?.structuredEvidence
    ?? result.receipt?.stateSummary?.structuredEvidence
    ?? parseAgentVisualExecutionStrategyTextEvidence(result);
}

function collectAgentVisualExecutionStrategyResultText(result: AgentChatCommandResult) {
  return [
    result.responseText,
    result.verification,
    result.errorText,
    ...(result.observations ?? []),
    ...(result.stateSummary?.observedState ?? []),
    ...(result.receipt?.evidenceLines ?? []),
    ...(result.receipt?.summaryLines ?? []),
  ].filter((line): line is string => typeof line === 'string' && Boolean(line.trim())).join('\n');
}

function parseAgentVisualExecutionStrategyTextPoint(
  text: string,
  pattern: RegExp,
): { x: number; y: number } | null {
  const match = pattern.exec(text);
  if (!match) {
    return null;
  }

  const x = Number(match[1]);
  const y = Number(match[2]);
  return Number.isFinite(x) && Number.isFinite(y)
    ? { x, y }
    : null;
}

function parseAgentVisualExecutionStrategyTextEvidence(
  result: AgentChatCommandResult,
): AgentStructuredToolEvidence | null {
  const text = collectAgentVisualExecutionStrategyResultText(result);
  if (!text || !/Visual\s+(?:action readiness|element center|coordinate audit|target matched)/iu.test(text)) {
    return null;
  }

  const readiness = (
    /Visual action readiness:\s*(ready|needs-target-selection|needs-primary-action|needs-coordinate|low-confidence|not-actionable|unknown)/iu.exec(text)?.[1]?.toLowerCase()
  ) as AgentStructuredToolEvidence['visualActionReadiness'] | undefined;
  const confidence = /Visual confidence:\s*(high|medium|low|0?\.\d+|1(?:\.0+)?)/iu.exec(text)?.[1]?.toLowerCase();
  const coordinateAuditStatus = (
    /Visual coordinate audit:\s*status=([a-z0-9_-]+)/iu.exec(text)?.[1]
  ) as AgentStructuredToolEvidence['coordinateAuditStatus'] | undefined;
  const targetMatched = /Visual target matched:\s*([^\n|]+)/iu.exec(text)?.[1]?.trim() ?? null;
  const primaryAction = /Visual primary action:\s*([^\n|]+)/iu.exec(text)?.[1]?.trim() ?? null;
  const relation = /Visual target\/action relation:\s*([^\n|]+)/iu.exec(text)?.[1]?.trim() ?? null;
  const elementRegion = /Visual element region:\s*([^\n|]+)/iu.exec(text)?.[1]?.trim() ?? null;
  const elementCenter = parseAgentVisualExecutionStrategyTextPoint(
    text,
    /Visual element center:\s*x=(-?\d+(?:\.\d+)?)\s*y=(-?\d+(?:\.\d+)?)/iu,
  );
  const elementCenterRatio = parseAgentVisualExecutionStrategyTextPoint(
    text,
    /Visual element center ratio:\s*x=(-?\d+(?:\.\d+)?)\s*y=(-?\d+(?:\.\d+)?)/iu,
  );
  const sourceBoundsMatch = /Visual source bounds:\s*x=(-?\d+(?:\.\d+)?)\s*y=(-?\d+(?:\.\d+)?)\s*width=(\d+(?:\.\d+)?)\s*height=(\d+(?:\.\d+)?)/iu.exec(text);
  const interactionVerificationStatus = (
    /(?:Target interaction|Launcher) verification:\s*status=([a-z0-9_-]+)/iu.exec(text)?.[1]
  ) as NonNullable<AgentStructuredToolEvidence['targetInteractionVerification']>['status'] | undefined;
  const interactionActionMatches = /(?:Target interaction|Launcher) verification:[^\n]*actionMatches=(true|false|unknown)/iu.exec(text)?.[1]?.toLowerCase();

  const numericConfidence = confidence && /^\d/u.test(confidence) ? Number(confidence) : NaN;
  const normalizedConfidence: AgentStructuredToolEvidence['confidence'] = confidence === 'high' || confidence === 'medium' || confidence === 'low'
    ? confidence
    : Number.isFinite(numericConfidence)
      ? numericConfidence >= 0.75 ? 'high' : numericConfidence >= 0.45 ? 'medium' : 'low'
      : null;

  return {
    confidence: normalizedConfidence,
    coordinateAuditStatus: coordinateAuditStatus ?? null,
    elementCenter: elementCenter
      ? {
          coordinateSpace: 'native-screen',
          ...elementCenter,
        }
      : null,
    elementCenterRatio: elementCenterRatio
      ? {
          coordinateSpace: 'source-ratio',
          ...elementCenterRatio,
        }
      : null,
    elementRegion,
    targetInteractionVerification: interactionVerificationStatus
      ? {
          primaryActionMatchesTarget: interactionActionMatches === 'true'
            ? true
            : interactionActionMatches === 'false'
              ? false
              : null,
          status: interactionVerificationStatus,
        }
      : null,
    primaryAction,
    relation,
    sourceBounds: sourceBoundsMatch
      ? {
          coordinateSpace: 'native-screen',
          height: Number(sourceBoundsMatch[4]),
          width: Number(sourceBoundsMatch[3]),
          x: Number(sourceBoundsMatch[1]),
          y: Number(sourceBoundsMatch[2]),
        }
      : null,
    targetMatched,
    visualActionReadiness: readiness ?? null,
  };
}

function isAgentExecutionStrategyFinitePoint(point: AgentStructuredToolEvidence['elementCenter']) {
  return Boolean(point && Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y)));
}

function isAgentExecutionStrategyNativePoint(point: AgentStructuredToolEvidence['elementCenter']) {
  return Boolean(
    isAgentExecutionStrategyFinitePoint(point)
    && (point?.coordinateSpace?.trim().toLowerCase() || 'native-screen') === 'native-screen',
  );
}

function isAgentExecutionStrategyRatioPoint(point: AgentStructuredToolEvidence['elementCenterRatio']) {
  const x = Number(point?.x);
  const y = Number(point?.y);
  const coordinateSpace = point?.coordinateSpace?.trim().toLowerCase() || 'source-ratio';
  return Boolean(
    Number.isFinite(x)
    && Number.isFinite(y)
    && x >= 0
    && x <= 1
    && y >= 0
    && y <= 1
    && coordinateSpace.includes('ratio'),
  );
}

function resolveAgentExecutionStrategySourceBounds(evidence: AgentStructuredToolEvidence | null) {
  const bounds = evidence?.sourceBounds ?? null;
  const x = Number(bounds?.x);
  const y = Number(bounds?.y);
  const width = Number(bounds?.width);
  const height = Number(bounds?.height);
  const coordinateSpace = bounds?.coordinateSpace?.trim().toLowerCase() || 'native-screen';
  if (
    ![x, y, width, height].every(Number.isFinite)
    || width <= 0
    || height <= 0
    || coordinateSpace !== 'native-screen'
  ) {
    return null;
  }

  return { height, width, x, y };
}

function resolveAgentExecutionStrategyElementBoundsCenter(
  evidence: AgentStructuredToolEvidence | null,
  sourceBounds: ReturnType<typeof resolveAgentExecutionStrategySourceBounds>,
) {
  const bounds = evidence?.elementBounds ?? null;
  const x = Number(bounds?.x);
  const y = Number(bounds?.y);
  const width = Number(bounds?.width);
  const height = Number(bounds?.height);
  const coordinateSpace = bounds?.coordinateSpace?.trim().toLowerCase() || 'native-screen';
  if (!bounds || ![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    return null;
  }

  if (coordinateSpace === 'native-screen') {
    return {
      x: Math.round(x + width / 2),
      y: Math.round(y + height / 2),
    };
  }

  if (coordinateSpace.includes('ratio') && sourceBounds) {
    return {
      x: Math.round(sourceBounds.x + sourceBounds.width * (x + width / 2)),
      y: Math.round(sourceBounds.y + sourceBounds.height * (y + height / 2)),
    };
  }

  return null;
}

function resolveAgentExecutionStrategySourceHwnd(options: {
  command: AgentChatCommand;
  evidence: AgentStructuredToolEvidence | null;
}) {
  const input = options.command.toolCall?.input ?? {};
  const candidateWindowHwnd = [
    ...(Array.isArray(options.evidence?.actionCandidates) ? options.evidence.actionCandidates : []),
    ...(Array.isArray(options.evidence?.targetCandidates) ? options.evidence.targetCandidates : []),
  ]
    .map((candidate) => Number(candidate.window?.hwnd))
    .find((hwnd) => Number.isFinite(hwnd) && hwnd > 0);
  const hwnd = Number(
    options.evidence?.finalWindow?.hwnd
      ?? candidateWindowHwnd
      ?? input.hwnd
      ?? input.sourceHwnd
      ?? input.windowHandle,
  );
  return Number.isFinite(hwnd) && hwnd > 0 ? Math.round(hwnd) : null;
}

function resolveAgentExecutionStrategyActionableTarget(options: {
  command: AgentChatCommand;
  evidence: AgentStructuredToolEvidence | null;
}) {
  const { command, evidence } = options;
  if (!evidence) {
    return { actionable: false, reason: 'no structured visual evidence' };
  }

  if (evidence.visualActionReadiness !== 'ready') {
    return { actionable: false, reason: `visual readiness is ${evidence.visualActionReadiness ?? 'unknown'}` };
  }

  if (evidence.confidence === 'low') {
    return { actionable: false, reason: 'visual confidence is low' };
  }

  if (evidence.coordinateConfidence === 'low') {
    return { actionable: false, reason: 'coordinate confidence is low' };
  }

  if (!isAgentExecutionStrategyTargetResolvedForCoordinate(evidence)) {
    return { actionable: false, reason: 'target_not_resolved: visual target is ambiguous or unmatched' };
  }

  if (evidence.selectionVerificationStatus === 'visible-only' || evidence.selectionVerificationStatus === 'mismatch') {
    return { actionable: false, reason: `selection verification is ${evidence.selectionVerificationStatus}` };
  }

  const targetInteractionVerification = resolveAgentTargetInteractionVerification(evidence);
  if (targetInteractionVerification) {
    const directContinuationText = [evidence.targetMatched, evidence.primaryAction]
      .filter(Boolean)
      .join(' ');
    const isSafeDirectContinuation = isAgentExecutionStrategySafeKeyboardContinuationTarget(directContinuationText)
      && evidence.confidence === 'high'
      && evidence.coordinateConfidence === 'high'
      && evidence.coordinateAuditStatus === 'coordinate_ok'
      && evidence.captureSourceType === 'window'
      && evidence.captureTrusted !== false
      && targetInteractionVerification.targetVisible !== false
      && targetInteractionVerification.targetSelected !== false
      && targetInteractionVerification.detailMatchesTarget !== false
      && targetInteractionVerification.primaryActionMatchesTarget !== false;
    if (targetInteractionVerification.status !== 'ready' && !(
      targetInteractionVerification.status === 'needs-relation'
      && isSafeDirectContinuation
    )) {
      return { actionable: false, reason: `target interaction verification is ${targetInteractionVerification.status ?? 'unknown'}` };
    }
    if (targetInteractionVerification.targetVisible === false) {
      return { actionable: false, reason: 'target is not visible' };
    }
    if (targetInteractionVerification.targetSelected === false || targetInteractionVerification.detailMatchesTarget === false) {
      return { actionable: false, reason: 'target selection/detail does not match' };
    }
    if (targetInteractionVerification.primaryActionMatchesTarget !== true && !isSafeDirectContinuation) {
      return { actionable: false, reason: 'primary action is not verified for target' };
    }
  }

  const sourceHwnd = resolveAgentExecutionStrategySourceHwnd({ command, evidence });
  const sourceBounds = resolveAgentExecutionStrategySourceBounds(evidence);
  if (!sourceHwnd && !sourceBounds) {
    return { actionable: false, reason: 'no target source window hwnd or native source bounds' };
  }

  return {
    actionable: true,
    reason: sourceHwnd ? 'source window hwnd is available' : 'native source bounds are available',
    sourceHwnd,
  };
}

function isAgentExecutionStrategyCoordinateAuditOk(evidence: AgentStructuredToolEvidence | null) {
  const status = evidence?.coordinateAuditStatus ?? evidence?.coordinateAudit?.status ?? null;
  return status === 'coordinate_ok';
}

function resolveAgentExecutionStrategyCoordinatePoint(evidence: AgentStructuredToolEvidence | null) {
  if (!evidence) {
    return {
      point: null,
      reason: 'no structured visual evidence',
    };
  }

  const sourceBounds = resolveAgentExecutionStrategySourceBounds(evidence);
  const boundsCenter = resolveAgentExecutionStrategyElementBoundsCenter(evidence, sourceBounds);
  if (boundsCenter) {
    return {
      point: boundsCenter,
      reason: 'used the geometric center of the actionable element bounds',
    };
  }

  if (isAgentExecutionStrategyRatioPoint(evidence.elementCenterRatio) && sourceBounds) {
    return {
      point: {
        x: Math.round(sourceBounds.x + sourceBounds.width * Number(evidence.elementCenterRatio?.x)),
        y: Math.round(sourceBounds.y + sourceBounds.height * Number(evidence.elementCenterRatio?.y)),
      },
      reason: 'derived native-screen point from elementCenterRatio and sourceBounds',
    };
  }

  if (isAgentExecutionStrategyNativePoint(evidence.elementCenter) && isAgentExecutionStrategyCoordinateAuditOk(evidence)) {
    return {
      point: {
        x: Math.round(Number(evidence.elementCenter?.x)),
        y: Math.round(Number(evidence.elementCenter?.y)),
      },
      reason: 'native-screen elementCenter passed coordinate audit',
    };
  }

  const auditStatus = evidence.coordinateAuditStatus ?? evidence.coordinateAudit?.status ?? null;
  if (auditStatus && auditStatus !== 'coordinate_ok') {
    return {
      point: null,
      reason: `coordinate audit is ${auditStatus}`,
    };
  }

  if (isAgentExecutionStrategyNativePoint(evidence.elementCenter)) {
    return {
      point: null,
      reason: 'native-screen elementCenter has no passing coordinate audit',
    };
  }

  if (isAgentExecutionStrategyRatioPoint(evidence.elementCenterRatio) && !sourceBounds) {
    return {
      point: null,
      reason: 'elementCenterRatio is available but sourceBounds are missing or not native-screen',
    };
  }

  return {
    point: null,
    reason: !evidence.elementCenter && !evidence.elementCenterRatio
      ? 'no visual action point'
      : `coordinate space is ${evidence.elementCenter?.coordinateSpace ?? evidence.elementCenterRatio?.coordinateSpace ?? 'unknown'}`,
  };
}

export function isAgentExecutionStrategyAmbiguousTargetText(text: string | null | undefined) {
  const normalized = text?.normalize('NFKC').replace(/\s+/gu, ' ').trim().toLowerCase() ?? '';
  if (!normalized) {
    return true;
  }

  return /(?:unknown|unclear|ambiguous|unmatched|not\s+matched|no\s+match|target\s+mismatch|\u6682\u65e0\u6cd5\u786e\u5b9a|\u65e0\u6cd5\u786e\u5b9a|\u4e0d\u80fd\u786e\u5b9a|\u9700\u5148\u786e\u8ba4|\u9700\u8981\u5148\u786e\u8ba4|\u672a\u660e\u786e|\u4e0d\u660e\u786e|\u76ee\u6807\u672a\u5339\u914d|\u672a\u5339\u914d|\u6ca1\u6709\u5339\u914d|\u7121\u5339\u914d)/iu.test(normalized);
}

export function isAgentExecutionStrategySafeKeyboardContinuationTarget(text: string | null | undefined) {
  if (isAgentExecutionStrategyAmbiguousTargetText(text)) {
    return false;
  }

  return /(?:login|log\s*in|sign\s*in|continue|confirm|ok|next|\u767b\u5f55|\u767b\u9678|\u5feb\u901f\u767b\u5f55|\u5b89\u5168\u767b\u5f55|\u7ee7\u7eed|\u7e7c\u7e8c|\u786e\u8ba4|\u78ba\u8a8d|\u4e0b\u4e00\u6b65|\u597d\u7684)/iu.test(text);
}

function inferAgentExecutionStrategyFocusQuery(options: {
  command: AgentChatCommand;
  evidence?: AgentStructuredToolEvidence | null;
  sourceText: string;
  userGoal: string;
}) {
  const input = options.command.toolCall?.input ?? {};
  const explicitQuery = [
    input.sourceQuery,
    input.windowQuery,
    input.windowTitle,
    input.sourceName,
  ].find((value) => typeof value === 'string' && value.trim());
  if (typeof explicitQuery === 'string' && explicitQuery.trim()) {
    return explicitQuery.trim();
  }

  const candidateWindow = [
    options.evidence?.finalWindow,
    ...(options.evidence?.actionCandidates ?? []).map((candidate) => candidate.window),
    ...(options.evidence?.targetCandidates ?? []).map((candidate) => candidate.window),
  ].find((window) => window?.title?.trim() || window?.processName?.trim());
  return candidateWindow?.title?.trim() || candidateWindow?.processName?.trim() || '';
}

function createAgentExecutionStrategyFocusStep(query: string) {
  return query
    ? {
        args: {
          action: 'focus_window',
          query,
        },
        reason: `Focus "${query}" before synthetic input so the coordinate click is delivered to the target app, not the Agent/chat window.`,
        tool: 'execute_desktop_action' as const,
      }
    : null;
}

function isAgentExecutionStrategyTargetResolvedForCoordinate(evidence: AgentStructuredToolEvidence) {
  const targetText = evidence.targetMatched?.trim() ?? '';
  if (!isAgentExecutionStrategyAmbiguousTargetText(targetText)) {
    return true;
  }

  return isAgentExecutionStrategySafeKeyboardContinuationTarget(evidence.primaryAction);
}

function createAgentExecutionStrategyCoordinateSteps(options: {
  clickPoint: { x: number; y: number };
  focusQuery: string;
  primaryActionText: string;
  targetText: string;
}) {
  const focusStep = createAgentExecutionStrategyFocusStep(options.focusQuery);
  const clickStep = {
    args: {
      action: 'click',
      button: 'left',
      coordinateSpace: 'native-screen',
      x: options.clickPoint.x,
      y: options.clickPoint.y,
    },
    reason: `Execution strategy: coordinate. Click "${options.primaryActionText}" for "${options.targetText}" at native-screen coordinate (${options.clickPoint.x}, ${options.clickPoint.y}).`,
    tool: 'execute_desktop_input' as const,
  };
  const targetText = `${options.primaryActionText}\n${options.targetText}`;
  if (!isAgentExecutionStrategySafeKeyboardContinuationTarget(targetText)) {
    return [
      ...(focusStep ? [focusStep] : []),
      clickStep,
    ];
  }

  return [
    ...(focusStep ? [focusStep] : []),
    {
      ...clickStep,
      args: {
        ...clickStep.args,
        holdMs: 140,
        intervalMs: 160,
        preClickDelayMs: 180,
        forceMouseEventFallback: true,
        repeat: 1,
      },
      reason: `${clickStep.reason} Safe login/continue click uses single click, preClickDelayMs=180, holdMs=140, intervalMs=160 and forced mouse_event fallback to avoid hover-only no-op in launcher/CEF UI.`,
    },
    {
      args: {
        action: 'send_keys',
        keys: '{ENTER}',
      },
      reason: 'Execution strategy fallback: send Enter after the safe login/continue click in case the launcher button accepted focus/hover but ignored injected mouse-up.',
      tool: 'execute_desktop_input' as const,
    },
  ];
}

export function resolveAgentVisualExecutionStrategy(options: {
  command: AgentChatCommand;
  result: AgentChatCommandResult;
  sourceText: string;
  userGoal: string;
}): AgentExecutionStrategyDecision {
  if (options.command.toolCall?.name !== 'locate_screen_elements') {
    return {
      diagnostics: ['Execution strategy: none', 'Execution strategy reason: command is not locate_screen_elements'],
      kind: 'none',
      reason: 'command is not locate_screen_elements',
    };
  }

  const evidence = resolveAgentVisualExecutionStrategyStructuredEvidence(options.result);
  const actionableTarget = resolveAgentExecutionStrategyActionableTarget({
    command: options.command,
    evidence,
  });
  if (!actionableTarget.actionable) {
    const reason = `target_not_actionable: ${actionableTarget.reason}`;
    return {
      diagnostics: createAgentExecutionStrategyDiagnostics({
        evidence,
        strategy: 'none',
        strategyReason: reason,
      }),
      kind: 'none',
      reason,
    };
  }

  const invokableCandidate = resolveAgentExecutionStrategyInvokableCandidate(evidence);
  if (invokableCandidate) {
    const candidate = invokableCandidate.candidate;
    const targetText = candidate.name?.trim()
      || candidate.label?.trim()
      || evidence.targetMatched?.trim()
      || evidence.primaryAction?.trim()
      || 'UI control';
    const query = candidate.window?.title?.trim()
      || candidate.window?.processName?.trim()
      || (typeof options.command.toolCall.input?.query === 'string' ? options.command.toolCall.input.query.trim() : '')
      || (typeof options.command.toolCall.input?.sourceQuery === 'string' ? options.command.toolCall.input.sourceQuery.trim() : '');
    const hwnd = Number(candidate.window?.hwnd);
    const point = resolveAgentExecutionStrategyCoordinatePoint(evidence).point ?? candidate.center ?? null;
    const fallbackX = Number(point?.x);
    const fallbackY = Number(point?.y);
    const reason = `UIA ${invokableCandidate.uiAction} candidate found for "${targetText}".`;
    return {
      command: createAgentToolCommand({
        args: {
          executionStrategy: 'uia',
          executionStrategyReason: reason,
          postVerify: true,
          postVerifyRequired: true,
          postVerifyQuery: options.userGoal,
          postVerifyVisualQuery: options.userGoal,
          stepsJson: JSON.stringify([
            {
              args: {
                action: 'interact_window_ui',
                ...(candidate.automationId?.trim() ? { automationId: candidate.automationId.trim() } : {}),
                ...(candidate.controlType?.trim() ? { controlType: candidate.controlType.trim() } : {}),
                ...(Number.isFinite(fallbackX) && Number.isFinite(fallbackY)
                  ? {
                      fallbackX: Math.round(fallbackX),
                      fallbackY: Math.round(fallbackY),
                      x: Math.round(fallbackX),
                      y: Math.round(fallbackY),
                    }
                  : {}),
                ...(Number.isFinite(hwnd) && hwnd > 0 ? { hwnd: Math.round(hwnd) } : {}),
                ...(query ? { query } : {}),
                targetDescription: [
                  candidate.description?.trim(),
                  evidence.relation?.trim(),
                ].filter(Boolean).join(' | '),
                targetText,
                uiAction: invokableCandidate.uiAction,
              },
              reason: `Execution strategy: UIA. ${reason}`,
              tool: 'execute_desktop_action',
            },
          ]),
        },
        sourceText: options.sourceText,
        toolName: 'execute_desktop_sequence',
        userGoal: options.userGoal,
      }),
      diagnostics: createAgentExecutionStrategyDiagnostics({
        evidence,
        strategy: 'uia',
        strategyReason: reason,
      }),
      kind: 'uia',
      reason,
    };
  }

  const coordinateResolution = resolveAgentExecutionStrategyCoordinatePoint(evidence);
  const point = coordinateResolution.point;
  if (!isAgentExecutionStrategyTargetResolvedForCoordinate(evidence)) {
    const reason = 'target_not_resolved: visual target is ambiguous or unmatched';
    return {
      diagnostics: createAgentExecutionStrategyDiagnostics({
        evidence,
        strategy: 'none',
        strategyReason: reason,
      }),
      kind: 'none',
      reason,
    };
  }

  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    const reason = `target_not_actionable: ${coordinateResolution.reason}`;
    return {
      diagnostics: createAgentExecutionStrategyDiagnostics({
        evidence,
        strategy: 'none',
        strategyReason: reason,
      }),
      kind: 'none',
      reason,
    };
  }

  const targetText = evidence.targetMatched?.trim() || 'visual target';
  const primaryActionText = evidence.primaryAction?.trim() || 'primary action';
  const clickPoint = {
    x: Math.round(point.x),
    y: Math.round(point.y),
  };
  const reason = `No usable UIA candidate; coordinate click available for "${targetText}" (${coordinateResolution.reason}).`;
  const sourceHwnd = actionableTarget.sourceHwnd ?? null;
  const sourceWindowTitle = inferAgentExecutionStrategyFocusQuery({ ...options, evidence });
  if (!sourceHwnd) {
    return {
      command: createAgentToolCommand({
        args: {
          executionStrategy: 'coordinate',
          executionStrategyReason: reason,
          postVerify: true,
          postVerifyRequired: true,
          postVerifyQuery: options.userGoal,
          postVerifyVisualQuery: options.userGoal,
          stepsJson: JSON.stringify(createAgentExecutionStrategyCoordinateSteps({
            clickPoint,
            focusQuery: sourceWindowTitle,
            primaryActionText,
            targetText,
          })),
        },
        sourceText: options.sourceText,
        toolName: 'execute_desktop_sequence',
        userGoal: options.userGoal,
      }),
      diagnostics: createAgentExecutionStrategyDiagnostics({
        evidence,
        strategy: 'coordinate',
        strategyReason: `${reason} Source HWND is unavailable, so using the legacy coordinate sequence.`,
      }),
      kind: 'coordinate',
      reason,
    };
  }

  return {
    command: createAgentToolCommand({
      args: {
        app: sourceWindowTitle,
        executionStrategy: 'coordinate',
        executionStrategyReason: reason,
        postVerifyVisualQuery: options.userGoal,
        mode: 'visible_click',
        requireActionable: true,
        requireSameHwnd: true,
        sourceHwnd,
        sourceWindowTitle,
        target: primaryActionText || targetText,
        targetRole: 'primary-action',
        targetX: clickPoint.x,
        targetY: clickPoint.y,
      },
      sourceText: options.sourceText,
      toolName: 'execute_desktop_sequence',
      userGoal: options.userGoal,
    }),
    diagnostics: createAgentExecutionStrategyDiagnostics({
      evidence,
      strategy: 'coordinate',
      strategyReason: reason,
    }),
    kind: 'coordinate',
    reason,
  };
}
