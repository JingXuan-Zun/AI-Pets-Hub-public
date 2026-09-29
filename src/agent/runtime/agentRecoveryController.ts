import { type AgentChatCommand } from '../agentChatCommand';
import {
  type AgentRuntimeToolResultEntry,
  type AgentTaskRuntimeRecoveryKind,
} from './agentRuntimeContract';

export interface AgentRecoveryProposalRequest {
  kind: AgentTaskRuntimeRecoveryKind;
  latestEntry: AgentRuntimeToolResultEntry | null;
  sourceText: string;
  toolResults: AgentRuntimeToolResultEntry[];
  userGoal: string;
}

export type AgentRecoveryProposalBuilder = (
  request: AgentRecoveryProposalRequest,
) => AgentChatCommand | null;

export interface AgentRecoveryProposalAdapters {
  automaticObservation: AgentRecoveryProposalBuilder;
  failedAction: AgentRecoveryProposalBuilder;
}

export interface AgentRecoveryProposalDecision {
  command: AgentChatCommand | null;
  reason: string;
  status: 'not-applicable' | 'proposed' | 'rejected';
}

export type AgentRecoveryTriggerAction =
  | 'no-recovery'
  | 'automatic-observation'
  | 'failed-action'
  | 'wait'
  | 'stop-needs-user';

export interface AgentRecoveryTriggerRequest {
  actionStatus:
    | 'completed'
    | 'waiting'
    | 'needs-approval'
    | 'needs-recovery'
    | 'failed'
    | 'blocked'
    | 'uncertain';
  coverage: 'complete' | 'missing' | 'unknown';
  latestTool: string | null;
  missingEvidence: boolean;
  permissionState: 'clear' | 'waiting-approval' | 'blocked';
  postActionState: string;
  receiptStatus: string | null;
  resultOk: boolean | null;
  terminalStatus: 'completed' | 'needs-user' | null;
}

export interface AgentRecoveryTriggerDecision {
  action: AgentRecoveryTriggerAction;
  reason:
    | 'action-completed'
    | 'action-failed'
    | 'action-needs-recovery'
    | 'action-waiting'
    | 'insufficient-evidence'
    | 'permission-blocked'
    | 'permission-pending'
    | 'terminal-needs-user'
    | 'unverified-receipt'
    | 'no-recovery-signal';
}

const AGENT_RECOVERY_WAIT_STATES = new Set([
  'loading',
  'updating',
  'waiting_target',
  'waiting_window',
]);

export function decideAgentRecoveryTrigger(
  request: AgentRecoveryTriggerRequest,
): AgentRecoveryTriggerDecision {
  if (request.permissionState === 'waiting-approval' || request.actionStatus === 'needs-approval') {
    return { action: 'no-recovery', reason: 'permission-pending' };
  }
  if (
    request.permissionState === 'blocked'
    || request.actionStatus === 'blocked'
    || request.terminalStatus === 'needs-user'
    || request.receiptStatus === 'blocked'
  ) {
    return {
      action: 'stop-needs-user',
      reason: request.permissionState === 'blocked' || request.receiptStatus === 'blocked'
        ? 'permission-blocked'
        : 'terminal-needs-user',
    };
  }
  if (request.actionStatus === 'completed' || request.terminalStatus === 'completed') {
    return { action: 'no-recovery', reason: 'action-completed' };
  }
  if (
    request.actionStatus === 'failed'
    || request.resultOk === false
    || request.receiptStatus === 'failed'
  ) {
    return { action: 'failed-action', reason: 'action-failed' };
  }
  if (
    request.actionStatus === 'waiting'
    || AGENT_RECOVERY_WAIT_STATES.has(request.postActionState.trim().toLowerCase())
  ) {
    return { action: 'wait', reason: 'action-waiting' };
  }
  if (request.actionStatus === 'needs-recovery' || request.coverage === 'missing') {
    return { action: 'automatic-observation', reason: 'action-needs-recovery' };
  }
  if (request.receiptStatus === 'unverified') {
    return { action: 'automatic-observation', reason: 'unverified-receipt' };
  }
  if (request.missingEvidence) {
    return { action: 'automatic-observation', reason: 'insufficient-evidence' };
  }
  return { action: 'no-recovery', reason: 'no-recovery-signal' };
}

export const AGENT_RECOVERY_CONTROLLER_DEFAULT_MAX_TRANSITIONS = 6;

export interface AgentRecoveryLoopState {
  evidenceCount: number;
  executed: boolean;
  maxTransitions: number;
  transitionIndex: number;
}

export type AgentRecoveryLoopEvent =
  | {
      cancellationRequested: boolean;
      terminalAvailable: boolean;
      type: 'iteration-check';
    }
  | {
      proposalStatus: AgentRecoveryProposalDecision['status'];
      type: 'proposal-resolved';
    }
  | {
      evidenceCount: number;
      executed: boolean;
      type: 'execution-finished';
    };

export type AgentRecoveryLoopAction =
  | 'continue'
  | 'execute-proposal'
  | 'request-proposal'
  | 'stop-cancelled'
  | 'stop-execution-skipped'
  | 'stop-limit-reached'
  | 'stop-no-new-evidence'
  | 'stop-no-proposal'
  | 'stop-proposal-rejected'
  | 'stop-terminal';

export function createAgentRecoveryLoopState(options: {
  evidenceCount: number;
  maxTransitions?: number | null;
}): AgentRecoveryLoopState {
  const requestedMax = options.maxTransitions ?? AGENT_RECOVERY_CONTROLLER_DEFAULT_MAX_TRANSITIONS;
  return {
    evidenceCount: Math.max(0, options.evidenceCount),
    executed: false,
    maxTransitions: Math.max(1, Math.floor(requestedMax)),
    transitionIndex: 1,
  };
}

export function transitionAgentRecoveryLoop(
  state: AgentRecoveryLoopState,
  event: AgentRecoveryLoopEvent,
): { action: AgentRecoveryLoopAction; state: AgentRecoveryLoopState } {
  if (event.type === 'iteration-check') {
    if (event.cancellationRequested) {
      return { action: 'stop-cancelled', state };
    }
    if (event.terminalAvailable) {
      return { action: 'stop-terminal', state };
    }
    if (state.transitionIndex > state.maxTransitions) {
      return { action: 'stop-limit-reached', state };
    }
    return { action: 'request-proposal', state };
  }

  if (event.type === 'proposal-resolved') {
    if (event.proposalStatus === 'rejected') {
      return { action: 'stop-proposal-rejected', state };
    }
    if (event.proposalStatus === 'not-applicable') {
      return { action: 'stop-no-proposal', state };
    }
    return { action: 'execute-proposal', state };
  }

  if (!event.executed) {
    return { action: 'stop-execution-skipped', state };
  }
  const nextState: AgentRecoveryLoopState = {
    ...state,
    evidenceCount: event.evidenceCount,
    executed: true,
  };
  if (event.evidenceCount <= state.evidenceCount) {
    return { action: 'stop-no-new-evidence', state: nextState };
  }
  if (state.transitionIndex >= state.maxTransitions) {
    return { action: 'stop-limit-reached', state: nextState };
  }
  return {
    action: 'continue',
    state: {
      ...nextState,
      transitionIndex: state.transitionIndex + 1,
    },
  };
}

const AGENT_RECOVERY_READ_ONLY_TOOLS = new Set([
  'execute_desktop_observation',
  'get_active_window_info',
  'list_capture_sources',
  'locate_screen_elements',
  'observe_windows_and_apps',
]);

function isReadOnlyAgentRecoveryCommand(command: AgentChatCommand) {
  const toolName = command.toolCall?.name ?? '';
  return AGENT_RECOVERY_READ_ONLY_TOOLS.has(toolName);
}

export function proposeAgentRecovery(options: {
  adapters: AgentRecoveryProposalAdapters;
  request: AgentRecoveryProposalRequest;
}): AgentRecoveryProposalDecision {
  const builder = options.request.kind === 'failed-action'
    ? options.adapters.failedAction
    : options.adapters.automaticObservation;
  const command = builder(options.request);
  if (!command) {
    return {
      command: null,
      reason: `No applicable ${options.request.kind} recovery proposal was produced.`,
      status: 'not-applicable',
    };
  }
  if (!isReadOnlyAgentRecoveryCommand(command)) {
    return {
      command: null,
      reason: `Recovery Controller rejected side-effecting recovery tool ${command.toolCall?.name ?? command.kind}.`,
      status: 'rejected',
    };
  }
  return {
    command,
    reason: `Recovery Controller proposed read-only tool ${command.toolCall?.name ?? command.kind}.`,
    status: 'proposed',
  };
}
