import { type AgentActionRuntimeDecision } from '../agentActionRuntime';
import { type AgentRecoveryTriggerDecision } from './agentRecoveryController';
import {
  type AgentRuntimePendingApproval,
  type AgentRuntimeToolResultEntry,
} from './agentRuntimeContract';

export type AgentToolOutcomeApprovalSource = 'visual-action' | 'approval-ready';

export type AgentToolOutcomeTransition = {
  actionDecision: AgentActionRuntimeDecision;
  approval: AgentRuntimePendingApproval | null;
  approvalSource: AgentToolOutcomeApprovalSource | null;
  kind:
    | 'terminal'
    | 'approval'
    | 'target-resolution'
    | 'refine'
    | 'recovery'
    | 'planning'
    | 'stop-needs-user';
  reason: string;
  recoveryDecision: AgentRecoveryTriggerDecision;
  recoveryMode: 'automatic-observation' | 'failed-action' | null;
};

export interface AgentToolOutcomeOptions {
  actionDecision: AgentActionRuntimeDecision;
  approvalReadyApproval: AgentRuntimePendingApproval | null;
  latestEntry: AgentRuntimeToolResultEntry;
  recoveryDecision: AgentRecoveryTriggerDecision;
  recoveryEnabled: boolean;
  refinementAvailable: boolean;
  targetResolutionAvailable?: boolean;
  visualApproval: AgentRuntimePendingApproval | null;
}

function isVisualObservationEntry(entry: AgentRuntimeToolResultEntry) {
  const toolName = entry.command.toolCall?.name ?? '';
  const action = typeof entry.command.toolCall?.input.action === 'string'
    ? entry.command.toolCall.input.action.trim().toLowerCase().replace(/[-\s]+/gu, '_')
    : '';
  return toolName === 'locate_screen_elements'
    || toolName === 'summarize_visual_snapshot'
    || toolName === 'execute_desktop_observation'
      && ['summarize_visual_snapshot', 'inspect_window_ui'].includes(action);
}

export function transitionAgentToolOutcome(
  options: AgentToolOutcomeOptions,
): AgentToolOutcomeTransition {
  const base = {
    actionDecision: options.actionDecision,
    approval: null,
    approvalSource: null,
    recoveryDecision: options.recoveryDecision,
    recoveryMode: null,
  };
  const structuredEvidence = options.latestEntry.result.stateSummary?.structuredEvidence
    ?? options.latestEntry.result.receipt?.stateSummary?.structuredEvidence
    ?? null;
  const visualActionReadiness = structuredEvidence?.visualActionReadiness ?? null;
  const recoveryEligible = options.actionDecision.actionAttempted !== false;

  if (
    options.actionDecision.terminalEvaluation
    || (
      options.actionDecision.status === 'completed'
      && options.actionDecision.reason === 'terminal-completed'
    )
  ) {
    return {
      ...base,
      kind: 'terminal',
      reason: options.actionDecision.terminalEvaluation?.stepReason
        ?? options.actionDecision.reason,
    };
  }
  if (
    options.visualApproval
    && !(options.refinementAvailable && visualActionReadiness && visualActionReadiness !== 'ready')
  ) {
    return {
      ...base,
      approval: options.visualApproval,
      approvalSource: 'visual-action',
      kind: 'approval',
      reason: 'Tool evidence contains an actionable target that requires approval.',
    };
  }
  if (options.approvalReadyApproval) {
    return {
      ...base,
      approval: options.approvalReadyApproval,
      approvalSource: 'approval-ready',
      kind: 'approval',
      reason: 'Tool evidence contains an approval-ready follow-up action.',
    };
  }
  if (
    options.refinementAvailable
    && structuredEvidence?.postActionState === 'login_required'
    && structuredEvidence?.postActionRecovery
  ) {
    return {
      ...base,
      kind: 'refine',
      reason: 'A login gate was observed with a bounded visual recovery proposal; locate a safe continuation control before deciding whether user input is required.',
    };
  }
  if (options.recoveryEnabled && recoveryEligible && structuredEvidence?.postActionRecovery) {
    return {
      ...base,
      kind: 'recovery',
      reason: 'Structured tool evidence provides an explicit bounded read-only recovery proposal.',
      recoveryMode: 'automatic-observation',
    };
  }
  if (options.refinementAvailable) {
    return {
      ...base,
      kind: 'refine',
      reason: 'Tool evidence requires one read-only visual refinement before execution.',
    };
  }
  if (options.targetResolutionAvailable && !isVisualObservationEntry(options.latestEntry)) {
    return {
      ...base,
      kind: 'target-resolution',
      reason: 'The outer operation surface is available while the requested in-app action remains unresolved.',
    };
  }
  if (options.visualApproval) {
    return {
      ...base,
      approval: options.visualApproval,
      approvalSource: 'visual-action',
      kind: 'approval',
      reason: 'No further read-only refinement is available before the target-selection approval.',
    };
  }
  if (options.recoveryEnabled && options.recoveryDecision.action === 'stop-needs-user') {
    return {
      ...base,
      kind: 'stop-needs-user',
      reason: options.recoveryDecision.reason,
    };
  }
  if (
    options.recoveryEnabled
    && recoveryEligible
    && (
      options.recoveryDecision.action === 'automatic-observation'
      || options.recoveryDecision.action === 'failed-action'
      || options.recoveryDecision.action === 'wait'
    )
  ) {
    return {
      ...base,
      kind: 'recovery',
      reason: options.recoveryDecision.reason,
      recoveryMode: options.recoveryDecision.action === 'failed-action'
        ? 'failed-action'
        : 'automatic-observation',
    };
  }
  return {
    ...base,
    kind: 'planning',
    reason: options.recoveryEnabled
      ? 'The latest tool evidence requires the next planning decision.'
      : 'The read-only parallel batch should finish collecting results before planning continues.',
  };
}
