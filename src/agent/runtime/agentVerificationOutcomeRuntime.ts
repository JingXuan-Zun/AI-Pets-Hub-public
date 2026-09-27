import { type AgentChatCommandResult } from '../agentChatCommand';
import {
  evaluateAgentActionRuntime,
  type AgentActionRuntimeDecision,
  type AgentActionRuntimeDependencies,
} from '../agentActionRuntime';
import {
  decideAgentRecoveryTrigger,
  type AgentRecoveryTriggerDecision,
} from './agentRecoveryController';
import {
  type AgentRuntimePendingApproval,
  type AgentRuntimeToolResultEntry,
} from './agentRuntimeContract';

export interface AgentVerificationVisualApprovalRequest {
  command: AgentRuntimeToolResultEntry['command'];
  result: AgentChatCommandResult;
  sourceText: string;
  toolResults: AgentRuntimeToolResultEntry[];
  userGoal: string;
}

export type AgentVerificationOutcomeTransition = {
  actionDecision: AgentActionRuntimeDecision;
  approval: AgentRuntimePendingApproval | null;
  kind:
    | 'terminal'
    | 'approval'
    | 'target-resolution'
    | 'recovery'
    | 'refine'
    | 'stop-needs-user';
  reason: string;
  recoveryDecision: AgentRecoveryTriggerDecision | null;
};

export interface AgentVerificationOutcomeOptions {
  actionRuntimeDependencies: AgentActionRuntimeDependencies;
  latestEntry: AgentRuntimeToolResultEntry;
  refinementAvailable?: boolean;
  resolveVisualApproval: (
    request: AgentVerificationVisualApprovalRequest,
  ) => AgentRuntimePendingApproval | null;
  sourceText: string;
  targetResolutionAvailable?: boolean;
  toolResults: AgentRuntimeToolResultEntry[];
  userGoal: string;
}

function decideVerificationRecovery(
  actionDecision: AgentActionRuntimeDecision,
  latestEntry: AgentRuntimeToolResultEntry,
) {
  return decideAgentRecoveryTrigger({
    actionStatus: actionDecision.status,
    coverage: actionDecision.actionAttempted !== false && actionDecision.missingCoverage
      ? 'missing'
      : 'unknown',
    latestTool: latestEntry.command.toolCall?.name ?? latestEntry.command.kind,
    missingEvidence: actionDecision.reason === 'insufficient-evidence'
      || actionDecision.reason === 'no-latest-evidence',
    permissionState: 'clear',
    postActionState: actionDecision.postActionState,
    receiptStatus: latestEntry.result.receipt?.status ?? null,
    resultOk: latestEntry.result.ok !== false,
    terminalStatus: actionDecision.terminalEvaluation?.status ?? null,
  });
}

export function transitionAgentVerificationOutcome(
  options: AgentVerificationOutcomeOptions,
): AgentVerificationOutcomeTransition {
  const actionDecision = evaluateAgentActionRuntime({
    dependencies: options.actionRuntimeDependencies,
    latestEntry: options.latestEntry,
    sourceText: options.sourceText,
    toolResults: options.toolResults,
    userGoal: options.userGoal,
  });

  if (actionDecision.terminalEvaluation) {
    return {
      actionDecision,
      approval: null,
      kind: 'terminal',
      reason: actionDecision.terminalEvaluation.stepReason,
      recoveryDecision: null,
    };
  }

  const approval = options.resolveVisualApproval({
    command: options.latestEntry.command,
    result: options.latestEntry.result,
    sourceText: options.sourceText,
    toolResults: options.toolResults,
    userGoal: options.userGoal,
  });
  if (approval) {
    return {
      actionDecision,
      approval,
      kind: 'approval',
      reason: 'Verification evidence contains an actionable target that requires approval.',
      recoveryDecision: null,
    };
  }

  if (options.refinementAvailable) {
    return {
      actionDecision,
      approval: null,
      kind: 'refine',
      reason: 'Verification evidence contains a bounded visual candidate that requires read-only refinement.',
      recoveryDecision: null,
    };
  }

  const recoveryDecision = decideVerificationRecovery(actionDecision, options.latestEntry);
  if (recoveryDecision.action === 'stop-needs-user') {
    return {
      actionDecision,
      approval: null,
      kind: 'stop-needs-user',
      reason: recoveryDecision.reason,
      recoveryDecision,
    };
  }
  if (recoveryDecision.action === 'automatic-observation') {
    const structuredEvidence = options.latestEntry.result.stateSummary?.structuredEvidence
      ?? options.latestEntry.result.receipt?.stateSummary?.structuredEvidence
      ?? null;
    if (structuredEvidence?.postActionRecovery) {
      return {
        actionDecision,
        approval: null,
        kind: 'recovery',
        reason: recoveryDecision.reason,
        recoveryDecision,
      };
    }
    if (options.targetResolutionAvailable === false) {
      return {
        actionDecision,
        approval: null,
        kind: 'recovery',
        reason: `${recoveryDecision.reason} Target resolution is not eligible with the current evidence.`,
        recoveryDecision,
      };
    }
    return {
      actionDecision,
      approval: null,
      kind: 'target-resolution',
      reason: recoveryDecision.reason,
      recoveryDecision,
    };
  }
  if (recoveryDecision.action === 'wait') {
    return {
      actionDecision,
      approval: null,
      kind: 'recovery',
      reason: recoveryDecision.reason,
      recoveryDecision,
    };
  }
  if (recoveryDecision.action === 'failed-action') {
    return {
      actionDecision,
      approval: null,
      kind: 'stop-needs-user',
      reason: recoveryDecision.reason,
      recoveryDecision,
    };
  }

  return {
    actionDecision,
    approval: null,
    kind: 'refine',
    reason: recoveryDecision.reason,
    recoveryDecision,
  };
}
