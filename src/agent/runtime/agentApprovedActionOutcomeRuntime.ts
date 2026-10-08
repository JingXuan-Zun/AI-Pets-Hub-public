import { type AgentActionRuntimeDecision } from '../agentActionRuntime';
import { type AgentRecoveryTriggerDecision } from './agentRecoveryController';
import {
  type AgentRuntimePendingApproval,
  type AgentRuntimeToolResultEntry,
} from './agentRuntimeContract';
import {
  selectAgentTaskRuntimeNextTransition,
  type AgentTaskRuntimeTransitionState,
} from './agentTaskRuntime';

export type AgentApprovedActionOutcomeTransition = {
  actionDecision: AgentActionRuntimeDecision;
  approval: AgentRuntimePendingApproval | null;
  kind:
    | 'terminal'
    | 'approval'
    | 'target-resolution'
    | 'recovery'
    | 'verification'
    | 'stop-needs-user';
  reason: string;
  recoveryDecision: AgentRecoveryTriggerDecision;
};

export interface AgentApprovedActionOutcomeOptions {
  actionDecision: AgentActionRuntimeDecision;
  approval: AgentRuntimePendingApproval | null;
  latestEntry: AgentRuntimeToolResultEntry;
  recoveryDecision: AgentRecoveryTriggerDecision;
  taskState?: AgentTaskRuntimeTransitionState | null;
}

export function transitionAgentApprovedActionOutcome(
  options: AgentApprovedActionOutcomeOptions,
): AgentApprovedActionOutcomeTransition {
  const base = {
    actionDecision: options.actionDecision,
    approval: options.approval,
    recoveryDecision: options.recoveryDecision,
  };

  if (options.actionDecision.terminalEvaluation) {
    return {
      ...base,
      kind: 'terminal',
      reason: options.actionDecision.terminalEvaluation.stepReason,
    };
  }
  if (options.approval) {
    return {
      ...base,
      kind: 'approval',
      reason: 'Approved action evidence contains the next actionable target.',
    };
  }
  if (options.recoveryDecision.action === 'stop-needs-user') {
    return {
      ...base,
      kind: 'stop-needs-user',
      reason: options.recoveryDecision.reason,
    };
  }
  if (
    options.recoveryDecision.action === 'failed-action'
    || options.recoveryDecision.action === 'wait'
  ) {
    return {
      ...base,
      kind: 'recovery',
      reason: options.recoveryDecision.reason,
    };
  }
  const structuredEvidence = options.latestEntry.result.stateSummary?.structuredEvidence
    ?? options.latestEntry.result.receipt?.stateSummary?.structuredEvidence
    ?? null;
  const actionOutcome = options.latestEntry.result.stateSummary?.actionEvidence?.outcome
    ?? options.latestEntry.result.receipt?.stateSummary?.actionEvidence?.outcome
    ?? null;
  const latestTool = options.latestEntry.command.toolCall?.name ?? options.latestEntry.command.kind;
  const receiptStatus = options.latestEntry.result.receipt?.status ?? null;
  const approvedAction = typeof options.latestEntry.command.toolCall?.input.action === 'string'
    ? options.latestEntry.command.toolCall.input.action.trim().toLowerCase().replace(/[-\s]+/gu, '_')
    : '';
  const hasExplicitRecovery = Boolean(structuredEvidence?.postActionRecovery);
  const hasWindowEvidence = Boolean(structuredEvidence?.finalWindow);
  const postActionStateRequiresRecovery = new Set([
    'blocked',
    'error',
    'loading',
    'selection_mismatch',
    'updating',
    'visible_only',
    'waiting_target',
    'waiting_window',
    'unchanged',
    'unknown',
  ]).has(options.actionDecision.postActionState.trim().toLowerCase());
  if (
    options.recoveryDecision.action === 'automatic-observation'
    && (
      hasExplicitRecovery
      || postActionStateRequiresRecovery
      || (
        latestTool === 'execute_desktop_action'
        && approvedAction !== 'focus_window'
        && !hasWindowEvidence
        && receiptStatus !== 'success'
      )
    )
  ) {
    return {
      ...base,
      kind: 'recovery',
      reason: options.recoveryDecision.reason,
    };
  }
  const taskTransition = selectAgentTaskRuntimeNextTransition({ taskState: options.taskState });
  const changedIntermediateActionRequiresTargetResolution = taskTransition.kind === 'compatibility'
    && options.recoveryDecision.action === 'automatic-observation'
    && (
      actionOutcome === 'changed'
      || approvedAction === 'focus_window'
      || (
        latestTool === 'execute_desktop_action'
        && !hasWindowEvidence
        && receiptStatus === 'success'
      )
    );
  if (taskTransition.kind === 'target-resolution' || changedIntermediateActionRequiresTargetResolution) {
    return {
      ...base,
      kind: 'target-resolution',
      reason: taskTransition.kind === 'target-resolution'
        ? taskTransition.reason
        : 'The intermediate input changed local UI state and the unresolved task target must be located.',
    };
  }
  return {
    ...base,
    kind: 'verification',
    reason: 'The approved action was dispatched and now requires outcome verification.',
  };
}
