import {
  type AgentRuntimeStatus,
  type AgentTaskRuntimeProductionState,
  type AgentTaskRuntimeActivePhase,
  type AgentTaskRuntimeLifecycleTransitionKind,
  type AgentTaskRuntimeStateRecord,
  type AgentTaskRuntimeNextSubgoalAction,
  type AgentTaskRuntimeSubgoalRecord,
} from '../agentRuntimeContract';

export function mapAgentRuntimeStatusToTaskState(
  status: AgentRuntimeStatus,
): AgentTaskRuntimeProductionState {
  switch (status) {
    case 'needs-approval':
      return 'waiting_approval';
    case 'needs-user':
      return 'blocked_needs_user';
    case 'completed':
      return 'succeeded';
    case 'cancelled':
      return 'cancelled';
    case 'budget-exceeded':
      return 'budget_exceeded';
    case 'failed':
    case 'max-steps':
      return 'failed';
  }
}

export function mapAgentTaskRuntimeStateToPhase(
  state: AgentTaskRuntimeProductionState,
): AgentTaskRuntimeActivePhase {
  if (state === 'waiting_approval') {
    return 'approval';
  }
  return state === 'active' ? 'planning' : 'terminal';
}

export function mapAgentTaskRuntimeLifecycleTransition(options: {
  kind: AgentTaskRuntimeLifecycleTransitionKind;
}): {
  phase: AgentTaskRuntimeActivePhase;
  state: AgentTaskRuntimeProductionState;
} {
  switch (options.kind) {
    case 'observation-started':
    case 'observation-collected':
      return { phase: 'observing', state: 'active' };
    case 'target-resolution-started':
    case 'target-resolution-collected':
      return { phase: 'resolving_target', state: 'active' };
    case 'approval-required':
      return { phase: 'approval', state: 'waiting_approval' };
    case 'approval-granted':
    case 'execution-started':
      return { phase: 'executing', state: 'active' };
    case 'action-dispatched':
      return { phase: 'collecting_evidence', state: 'active' };
    case 'evidence-collected':
    case 'verification-started':
    case 'verification-collected':
      return { phase: 'verifying_outcome', state: 'active' };
    case 'recovery-started':
    case 'recovery-collected':
      return { phase: 'recovering', state: 'active' };
  }
}

const AGENT_TASK_RUNTIME_LIFECYCLE_PREDECESSORS: Record<
  AgentTaskRuntimeLifecycleTransitionKind,
  readonly AgentTaskRuntimeActivePhase[]
> = {
  'action-dispatched': ['executing'],
  'approval-granted': ['approval'],
  'approval-required': ['resolving_target', 'collecting_evidence', 'verifying_outcome'],
  'evidence-collected': ['collecting_evidence', 'recovering'],
  'execution-started': ['executing'],
  'observation-collected': ['observing', 'recovering'],
  'observation-started': [
    'planning',
    'observing',
    'resolving_target',
    'collecting_evidence',
    'verifying_outcome',
    'recovering',
  ],
  'recovery-collected': ['recovering'],
  'recovery-started': [
    'resolving_target',
    'collecting_evidence',
    'verifying_outcome',
    'recovering',
  ],
  'target-resolution-collected': ['resolving_target'],
  'target-resolution-started': [
    'planning',
    'observing',
    'resolving_target',
    'collecting_evidence',
    'verifying_outcome',
    'recovering',
  ],
  'verification-collected': ['verifying_outcome'],
  'verification-started': ['executing', 'collecting_evidence', 'verifying_outcome'],
};

export interface AgentTaskRuntimeLifecycleValidation {
  accepted: boolean;
  reason: string;
}

export function validateAgentTaskRuntimeLifecycleTransition(options: {
  kind: AgentTaskRuntimeLifecycleTransitionKind;
  previous?: AgentTaskRuntimeStateRecord | null;
}): AgentTaskRuntimeLifecycleValidation {
  const previous = options.previous ?? null;
  if (!previous) {
    return {
      accepted: true,
      reason: 'Accepted as a compatibility bootstrap without a previous Task State Record.',
    };
  }

  if (options.kind === 'approval-granted') {
    const accepted = previous.state === 'waiting_approval' && previous.phase === 'approval';
    return {
      accepted,
      reason: accepted
        ? 'Approval was granted from the waiting-approval state.'
        : `approval-granted requires waiting_approval/approval, received ${previous.state}/${previous.phase}.`,
    };
  }

  if (previous.state !== 'active') {
    return {
      accepted: false,
      reason: `${options.kind} requires an active task, received ${previous.state}/${previous.phase}.`,
    };
  }

  const accepted = AGENT_TASK_RUNTIME_LIFECYCLE_PREDECESSORS[options.kind].includes(previous.phase);
  return {
    accepted,
    reason: accepted
      ? `${options.kind} accepted from ${previous.phase}.`
      : `${options.kind} is not valid from ${previous.phase}.`,
  };
}

export interface AgentTaskRuntimeSubgoalSelection {
  action: AgentTaskRuntimeNextSubgoalAction;
  reason: string;
  subgoal: AgentTaskRuntimeSubgoalRecord | null;
}

export type AgentTaskRuntimeTransitionState = Pick<
  AgentTaskRuntimeStateRecord,
  'nextSubgoalAction'
>;

export type AgentTaskRuntimeNextTransition = {
  kind:
    | 'approval'
    | 'blocked'
    | 'complete'
    | 'compatibility'
    | 'resume'
    | 'target-resolution'
    | 'verification';
  reason: string;
};

export interface AgentTaskRuntimeLoopDispatchResult<Result> {
  adapterKind: string;
  executed: boolean;
  finalResult: Result | null;
}

export type AgentTaskRuntimeLoopContinuationDecision<Result> =
  | {
      action: 'return-final';
      continuationKind: string;
      finalResult: Result;
      reason: string;
    }
  | {
      action: 'continue-runtime' | 'request-planning';
      continuationKind: string;
      finalResult: null;
      reason: string;
    };

export interface AgentTaskRuntimeModelLoopState {
  iteration: number;
  maxIterations: number;
}

export type AgentTaskRuntimeModelLoopDecision =
  | {
      action: 'run-iteration';
      iteration: number;
      reason: string;
      state: AgentTaskRuntimeModelLoopState;
    }
  | {
      action: 'stop-cancelled' | 'stop-limit';
      iteration: number;
      reason: string;
      state: AgentTaskRuntimeModelLoopState;
    };

export function createAgentTaskRuntimeModelLoopState(options: {
  maxIterations: number;
}): AgentTaskRuntimeModelLoopState {
  const maxIterations = Number.isFinite(options.maxIterations)
    ? Math.max(0, Math.floor(options.maxIterations))
    : 0;
  return { iteration: 0, maxIterations };
}

export function transitionAgentTaskRuntimeModelLoop(
  state: AgentTaskRuntimeModelLoopState,
  event: {
    cancellationRequested: boolean;
    type: 'iteration-check';
  },
): AgentTaskRuntimeModelLoopDecision {
  if (state.iteration >= state.maxIterations) {
    return {
      action: 'stop-limit',
      iteration: state.iteration,
      reason: `Task Runtime model-loop limit reached at ${state.iteration}/${state.maxIterations}.`,
      state,
    };
  }
  if (event.cancellationRequested) {
    return {
      action: 'stop-cancelled',
      iteration: state.iteration,
      reason: 'Task Runtime stopped the model loop because cancellation was requested.',
      state,
    };
  }
  const nextState = {
    ...state,
    iteration: state.iteration + 1,
  };
  return {
    action: 'run-iteration',
    iteration: nextState.iteration,
    reason: `Task Runtime authorized model iteration ${nextState.iteration}/${nextState.maxIterations}.`,
    state: nextState,
  };
}

export function decideAgentTaskRuntimeLoopContinuation<Result>(options: {
  dispatch: AgentTaskRuntimeLoopDispatchResult<Result>;
}): AgentTaskRuntimeLoopContinuationDecision<Result> {
  if (options.dispatch.finalResult !== null) {
    return {
      action: 'return-final',
      continuationKind: options.dispatch.adapterKind,
      finalResult: options.dispatch.finalResult,
      reason: 'The selected Runtime continuation produced a final result.',
    };
  }
  if (options.dispatch.executed) {
    return {
      action: 'continue-runtime',
      continuationKind: options.dispatch.adapterKind,
      finalResult: null,
      reason: 'The selected Runtime continuation executed and produced additional task evidence.',
    };
  }
  return {
    action: 'request-planning',
    continuationKind: options.dispatch.adapterKind,
    finalResult: null,
    reason: 'No deterministic Runtime continuation executed; request the next planning decision.',
  };
}

export function selectAgentTaskRuntimeNextTransition(options: {
  taskState?: AgentTaskRuntimeTransitionState | null;
}): AgentTaskRuntimeNextTransition {
  switch (options.taskState?.nextSubgoalAction) {
    case 'execute':
      return {
        kind: 'target-resolution',
        reason: 'Task Runtime selected target resolution for the next pending subgoal.',
      };
    case 'verify':
      return {
        kind: 'verification',
        reason: 'Task Runtime selected post-dispatch verification.',
      };
    case 'await_approval':
      return {
        kind: 'approval',
        reason: 'Task Runtime is waiting for the existing task approval.',
      };
    case 'blocked':
      return {
        kind: 'blocked',
        reason: 'Task Runtime cannot continue the blocked subgoal.',
      };
    case 'complete':
      return {
        kind: 'complete',
        reason: 'Task Runtime has no remaining subgoal transition.',
      };
    case 'resume':
      return {
        kind: 'resume',
        reason: 'Task Runtime selected the in-progress subgoal for resumption.',
      };
    case undefined:
      return {
        kind: 'compatibility',
        reason: 'No production Task State transition is available; preserve the legacy continuation fallback.',
      };
  }
}

export function selectAgentTaskRuntimeNextSubgoal(
  state: AgentTaskRuntimeStateRecord,
): AgentTaskRuntimeSubgoalSelection {
  const subgoals = state.subgoals ?? [];
  if (state.state === 'succeeded') {
    return { action: 'complete', reason: 'The task has verified successful terminal evidence.', subgoal: null };
  }
  if (
    state.state === 'blocked_needs_user'
    || state.state === 'failed'
    || state.state === 'cancelled'
    || state.state === 'budget_exceeded'
  ) {
    return {
      action: 'blocked',
      reason: `The task cannot select another subgoal while state=${state.state}.`,
      subgoal: subgoals.find((subgoal) => subgoal.status === 'blocked') ?? null,
    };
  }
  if (state.state === 'waiting_approval') {
    return {
      action: 'await_approval',
      reason: 'The next subgoal is waiting for the existing task approval.',
      subgoal: subgoals.find((subgoal) => subgoal.status !== 'completed') ?? null,
    };
  }

  const inProgress = subgoals.find((subgoal) => subgoal.status === 'in_progress');
  if (inProgress) {
    return { action: 'resume', reason: 'Resume the in-progress scoped action.', subgoal: inProgress };
  }
  const blocked = subgoals.find((subgoal) => subgoal.status === 'blocked');
  if (blocked) {
    return { action: 'blocked', reason: 'The remaining subgoal is blocked.', subgoal: blocked };
  }
  const pending = subgoals.find((subgoal) => subgoal.status === 'pending');
  if (pending) {
    return { action: 'execute', reason: 'Execute the next pending subgoal.', subgoal: pending };
  }
  const dispatched = subgoals.find((subgoal) => subgoal.status === 'dispatched');
  if (dispatched) {
    return { action: 'verify', reason: 'Collect evidence for the dispatched subgoal.', subgoal: dispatched };
  }
  return { action: 'complete', reason: 'All persisted subgoals are completed.', subgoal: null };
}
