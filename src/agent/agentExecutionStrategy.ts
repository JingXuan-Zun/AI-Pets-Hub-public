import { resolveAgentVisualExecutionStrategyStructuredEvidence, resolveAgentExecutionStrategySourceBounds, resolveAgentExecutionStrategySourceHwnd, resolveAgentExecutionStrategyCoordinatePoint, resolveAgentExecutionStrategyExpectedWindowHwnd } from './executionStrategy/visualEvidence';
export { resolveAgentExecutionStrategyExpectedWindowHwnd } from './executionStrategy/visualEvidence';

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
  expectedWindowHwnd?: number | null;
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
      ...(options.expectedWindowHwnd ? { expectedWindowHwnd: options.expectedWindowHwnd } : {}),
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
            expectedWindowHwnd: resolveAgentExecutionStrategyExpectedWindowHwnd(evidence, clickPoint),
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
