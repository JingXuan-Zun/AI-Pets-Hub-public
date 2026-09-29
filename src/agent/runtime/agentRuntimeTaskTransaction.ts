import {
  type AgentRuntimePendingApproval,
  type AgentRuntimeStatus,
  type AgentTaskRuntimeStateRecord,
} from './agentRuntimeContract';
import {
  createAgentTaskRuntimeStateRecord,
  transitionAgentTaskRuntimeState,
} from './agentTaskRuntime';
import { validateAgentRuntimeApprovalContext } from './agentRuntimeTargetGuard';

export type AgentRuntimeTaskTransactionPhase =
  | 'idle'
  | 'running'
  | 'waiting_approval'
  | 'resuming'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export type AgentRuntimeTaskTransactionEvent =
  | {
      sourceText: string;
      type: 'start';
      userGoal: string;
    }
  | {
      approval: AgentRuntimePendingApproval;
      type: 'approve';
    }
  | {
      type: 'resume';
    }
  | {
      sourceText: string;
      type: 'cancel';
      userGoal: string;
    }
  | {
      approval?: AgentRuntimePendingApproval | null;
      resultStatus: AgentRuntimeStatus;
      sourceText: string;
      type: 'result';
      userGoal: string;
    };

export interface AgentRuntimeTaskTransactionState {
  approval: AgentRuntimePendingApproval | null;
  lastError: string | null;
  phase: AgentRuntimeTaskTransactionPhase;
  taskState: AgentTaskRuntimeStateRecord | null;
}

export interface AgentRuntimeTaskTransactionTransition {
  accepted: boolean;
  state: AgentRuntimeTaskTransactionState;
  reason: string;
}

function phaseFromTaskState(state: AgentTaskRuntimeStateRecord | null): AgentRuntimeTaskTransactionPhase {
  switch (state?.state) {
    case 'waiting_approval':
      return 'waiting_approval';
    case 'succeeded':
      return 'succeeded';
    case 'failed':
    case 'blocked_needs_user':
    case 'budget_exceeded':
      return 'failed';
    case 'cancelled':
      return 'cancelled';
    case 'active':
      return 'running';
    default:
      return 'idle';
  }
}

function phaseFromResultStatus(status: AgentRuntimeStatus): AgentRuntimeTaskTransactionPhase {
  switch (status) {
    case 'needs-approval':
      return 'waiting_approval';
    case 'completed':
      return 'succeeded';
    case 'cancelled':
      return 'cancelled';
    case 'failed':
    case 'max-steps':
    case 'budget-exceeded':
      return 'failed';
    case 'needs-user':
      return 'failed';
  }
}

function activeState(options: {
  previous: AgentRuntimeTaskTransactionState;
  sourceText: string;
  userGoal: string;
  phase?: AgentRuntimeTaskTransactionPhase;
}) {
  const taskState = transitionAgentTaskRuntimeState({
    event: {
      phase: options.phase === 'resuming' ? 'executing' : 'planning',
      type: 'progress',
    },
    previous: options.previous.taskState,
    sourceText: options.sourceText,
    userGoal: options.userGoal,
  });
  return {
    approval: null,
    lastError: null,
    phase: options.phase ?? 'running',
    taskState,
  } satisfies AgentRuntimeTaskTransactionState;
}

export function createAgentRuntimeTaskTransactionState(options?: {
  approval?: AgentRuntimePendingApproval | null;
  taskState?: AgentTaskRuntimeStateRecord | null;
}): AgentRuntimeTaskTransactionState {
  const taskState = options?.taskState ?? null;
  return {
    approval: options?.approval ?? null,
    lastError: null,
    phase: phaseFromTaskState(taskState),
    taskState,
  };
}

export function transitionAgentRuntimeTaskTransaction(options: {
  event: AgentRuntimeTaskTransactionEvent;
  previous?: AgentRuntimeTaskTransactionState | null;
}): AgentRuntimeTaskTransactionTransition {
  const previous = options.previous ?? createAgentRuntimeTaskTransactionState();
  const event = options.event;

  if (event.type === 'start') {
    if (previous.phase !== 'idle') {
      return {
        accepted: false,
        reason: `start requires idle transaction state, received ${previous.phase}.`,
        state: { ...previous, lastError: 'transaction-start-not-idle' },
      };
    }
    return {
      accepted: true,
      reason: 'Task Runtime transaction started.',
      state: activeState({ previous, sourceText: event.sourceText, userGoal: event.userGoal }),
    };
  }

  if (event.type === 'approve') {
    if (previous.phase !== 'waiting_approval' || !previous.taskState) {
      return {
        accepted: false,
        reason: `approve requires waiting_approval with a Task State Record, received ${previous.phase}.`,
        state: { ...previous, lastError: 'transaction-approve-invalid-phase' },
      };
    }
    const approvalContext = validateAgentRuntimeApprovalContext({
      approval: event.approval,
      state: previous.taskState,
    });
    if (!approvalContext.allowed) {
      return {
        accepted: false,
        reason: `Approval was rejected because ${approvalContext.reason}.`,
        state: { ...previous, lastError: approvalContext.reason },
      };
    }
    const taskState = transitionAgentTaskRuntimeState({
      event: { kind: 'approval-granted', type: 'lifecycle' },
      previous: previous.taskState,
      sourceText: previous.taskState.sourceText,
      userGoal: previous.taskState.userGoal,
    });
    return {
      accepted: true,
      reason: 'Task Runtime transaction approved and ready to resume.',
      state: {
        approval: event.approval,
        lastError: null,
        phase: 'resuming',
        taskState,
      },
    };
  }

  if (event.type === 'resume') {
    if (previous.phase !== 'resuming') {
      return {
        accepted: false,
        reason: `resume requires resuming transaction state, received ${previous.phase}.`,
        state: { ...previous, lastError: 'transaction-resume-invalid-phase' },
      };
    }
    return {
      accepted: true,
      reason: 'Task Runtime transaction resumed.',
      state: activeState({
        previous,
        phase: 'running',
        sourceText: previous.taskState?.sourceText ?? '',
        userGoal: previous.taskState?.userGoal ?? '',
      }),
    };
  }

  if (event.type === 'cancel') {
    if (previous.phase === 'succeeded' || previous.phase === 'failed' || previous.phase === 'cancelled') {
      return {
        accepted: false,
        reason: `cancel cannot change terminal transaction state ${previous.phase}.`,
        state: { ...previous, lastError: 'transaction-cancel-terminal' },
      };
    }
    const taskState = createAgentTaskRuntimeStateRecord({
      now: Date.now(),
      previous: previous.taskState,
      sourceText: event.sourceText,
      status: 'cancelled',
      userGoal: event.userGoal,
    });
    return {
      accepted: true,
      reason: 'Task Runtime transaction cancelled.',
      state: {
        approval: null,
        lastError: null,
        phase: 'cancelled',
        taskState,
      },
    };
  }

  const taskState = createAgentTaskRuntimeStateRecord({
    now: Date.now(),
    previous: previous.taskState,
    sourceText: event.sourceText,
    status: event.resultStatus,
    userGoal: event.userGoal,
  });
  const phase = phaseFromResultStatus(event.resultStatus);
  return {
    accepted: true,
    reason: `Task Runtime recorded result status ${event.resultStatus}.`,
    state: {
      approval: event.approval ?? null,
      lastError: null,
      phase,
      taskState,
    },
  };
}

export function isAgentRuntimeTaskTransactionTerminal(
  state: AgentRuntimeTaskTransactionState,
) {
  return state.phase === 'succeeded'
    || state.phase === 'failed'
    || state.phase === 'cancelled';
}
