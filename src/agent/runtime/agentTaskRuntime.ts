import {
  mapAgentRuntimeStatusToTaskState,
  mapAgentTaskRuntimeStateToPhase,
  mapAgentTaskRuntimeLifecycleTransition,
  validateAgentTaskRuntimeLifecycleTransition,
  selectAgentTaskRuntimeNextSubgoal,
} from './taskRuntime/transitionPolicy';
export {
  type AgentTaskRuntimeLifecycleValidation,
  validateAgentTaskRuntimeLifecycleTransition,
  type AgentTaskRuntimeSubgoalSelection,
  type AgentTaskRuntimeTransitionState,
  type AgentTaskRuntimeNextTransition,
  type AgentTaskRuntimeLoopDispatchResult,
  type AgentTaskRuntimeLoopContinuationDecision,
  type AgentTaskRuntimeModelLoopState,
  type AgentTaskRuntimeModelLoopDecision,
  createAgentTaskRuntimeModelLoopState,
  transitionAgentTaskRuntimeModelLoop,
  decideAgentTaskRuntimeLoopContinuation,
  selectAgentTaskRuntimeNextTransition,
  selectAgentTaskRuntimeNextSubgoal,
} from './taskRuntime/transitionPolicy';

import { type AgentChatCommand } from '../agentChatCommand';
import { createAgentTaskGoalId } from './agentTaskIdentity';
import { createAgentRuntimeRunId } from './agentRuntimeTaskContract';
import { appendAgentRuntimeToolEvidence } from './agentRuntimeTaskEvidence';
import {
  createAgentTaskRuntimeStateDiagnostic,
  upsertAgentRuntimeDiagnostic,
} from './agentRuntimeDiagnostics';
import {
  type AgentRuntimeProgressEvent,
  type AgentRuntimeResult,
  type AgentRuntimeStatus,
  type AgentTaskRuntimeActivePhase,
  type AgentTaskRuntimeLifecycleTransitionKind,
  type AgentTaskRuntimeModelIterationDecision,
  type AgentTaskRuntimeModelIterationRequest,
  type AgentTaskRuntimeNextSubgoalAction,
  type AgentTaskRuntimeProductionState,
  type AgentTaskRuntimeRecoveryDecision,
  type AgentTaskRuntimeRecoveryRequest,
  type AgentTaskRuntimeStateRecord,
  type AgentTaskRuntimeSubgoalRecord,
  type AgentTaskRuntimeSubgoalStatus,
  type AgentTaskRuntimeTransitionEvent,
} from './agentRuntimeContract';

// Multi-step in-app tasks (open launcher -> log in -> find game -> start) need a second
// locate after a low-confidence one plus the click approval; 3 stopped them at the login page.
export const AGENT_TASK_RUNTIME_DEFAULT_RECOVERY_LIMIT = 5;

let agentTaskRuntimeIdentityNonce = 0;

function nextAgentTaskRuntimeIdentityNonce() {
  agentTaskRuntimeIdentityNonce = (agentTaskRuntimeIdentityNonce + 1) % 1_000_000_000;
  return agentTaskRuntimeIdentityNonce || 1;
}

function normalizeAgentTaskRuntimeModelIterationLimit(value: number | null | undefined) {
  if (!Number.isFinite(value) || value == null) {
    return 0;
  }
  return Math.max(0, Math.floor(value));
}

function normalizeAgentTaskRuntimeRecoveryLimit(value: number | null | undefined) {
  if (!Number.isFinite(value) || value == null) {
    return AGENT_TASK_RUNTIME_DEFAULT_RECOVERY_LIMIT;
  }
  return Math.max(0, Math.floor(value));
}

function createAgentTaskRuntimeId(sourceText: string, now: number) {
  const scope = sourceText
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 48) || 'task';
  return `task-${now}-${scope}`;
}

function ensureAgentTaskRuntimeRootSubgoal(options: {
  now: number;
  previous: AgentTaskRuntimeStateRecord | null;
  userGoal: string;
}) {
  const taskGoalId = createAgentTaskGoalId(options.userGoal);
  const subgoals = [...(options.previous?.subgoals ?? [])];
  if (!subgoals.some((subgoal) => subgoal.id === taskGoalId)) {
    subgoals.unshift({
      completion: 'terminal',
      id: taskGoalId,
      status: 'pending',
      targetRef: options.userGoal,
      taskGoalId,
      updatedAt: options.now,
    });
  }
  return subgoals;
}

function withAgentTaskRuntimeSubgoalSelection(
  state: AgentTaskRuntimeStateRecord,
): AgentTaskRuntimeStateRecord {
  const selection = selectAgentTaskRuntimeNextSubgoal(state);
  return {
    ...state,
    nextSubgoalAction: selection.action,
    nextSubgoalId: selection.subgoal?.id ?? null,
  };
}

function upsertAgentTaskRuntimeSubgoal(options: {
  actionScope: NonNullable<Extract<AgentTaskRuntimeTransitionEvent, { type: 'subgoal-status' }>['actionScope']>;
  now: number;
  subgoals: readonly AgentTaskRuntimeSubgoalRecord[];
  status: AgentTaskRuntimeSubgoalStatus;
}) {
  const subgoalId = options.actionScope.subgoalId?.trim()
    || `${options.actionScope.completion}:${options.actionScope.targetRef?.trim() || 'action'}`;
  const next: AgentTaskRuntimeSubgoalRecord = {
    completion: options.actionScope.completion,
    id: subgoalId,
    status: options.status,
    targetRef: options.actionScope.targetRef?.trim() || null,
    taskGoalId: options.actionScope.taskGoalId?.trim() || null,
    updatedAt: options.now,
  };
  const subgoals = [...options.subgoals];
  const existingIndex = subgoals.findIndex((subgoal) => subgoal.id === subgoalId);
  if (existingIndex >= 0) {
    subgoals[existingIndex] = next;
  } else {
    subgoals.push(next);
  }

  if (options.actionScope.completion === 'terminal' && next.taskGoalId) {
    const rootIndex = subgoals.findIndex((subgoal) => subgoal.id === next.taskGoalId);
    if (rootIndex >= 0 && rootIndex !== existingIndex) {
      subgoals[rootIndex] = {
        ...subgoals[rootIndex],
        status: options.status,
        updatedAt: options.now,
      };
    }
  }
  return { currentSubgoalId: subgoalId, subgoals };
}

function completeAgentTaskRuntimeSubgoals(
  subgoals: readonly AgentTaskRuntimeSubgoalRecord[],
  now: number,
) {
  return subgoals.map((subgoal) => (
    subgoal.status === 'blocked'
      ? subgoal
      : { ...subgoal, status: 'completed' as const, updatedAt: now }
  ));
}

export function transitionAgentTaskRuntimeState(options: {
  event: AgentTaskRuntimeTransitionEvent;
  now?: number;
  previous?: AgentTaskRuntimeStateRecord | null;
  sourceText: string;
  userGoal: string;
}): AgentTaskRuntimeStateRecord {
  const now = options.now ?? Date.now();
  const previous = options.previous ?? null;
  const subgoals = ensureAgentTaskRuntimeRootSubgoal({
    now,
    previous,
    userGoal: options.userGoal,
  });
  const identityNonce = previous ? null : nextAgentTaskRuntimeIdentityNonce();
  const base = {
    activeAction: previous?.activeAction ?? null,
    completedActions: previous?.completedActions ?? [],
    currentSubgoalId: previous?.currentSubgoalId ?? null,
    evidence: previous?.evidence ?? [],
    lastRecoveryKind: previous?.lastRecoveryKind ?? null,
    lastRejectedTransitionKind: previous?.lastRejectedTransitionKind ?? null,
    lastRuntimeStatus: previous?.lastRuntimeStatus ?? null,
    lastTransitionError: previous?.lastTransitionError ?? null,
    lastTransitionKind: previous?.lastTransitionKind ?? null,
    modelIterationCount: previous?.modelIterationCount ?? 0,
    modelIterationLimit: previous?.modelIterationLimit ?? 0,
    owner: 'task-runtime' as const,
    recoveryAttemptCount: previous?.recoveryAttemptCount ?? 0,
    recoveryLimit: previous?.recoveryLimit ?? AGENT_TASK_RUNTIME_DEFAULT_RECOVERY_LIMIT,
    revision: (previous?.revision ?? 0) + 1,
    runId: previous?.runId ?? createAgentRuntimeRunId(
      options.sourceText,
      now,
      identityNonce,
    ),
    sourceText: options.sourceText,
    startedAt: previous?.startedAt ?? now,
    taskId: previous?.taskId ?? `${createAgentTaskRuntimeId(options.sourceText, now)}-${identityNonce}`,
    subgoals,
    updatedAt: now,
    userGoal: options.userGoal,
    // The target binding is only valid against the surface it was resolved on,
    // so both must survive transitions together.
    surface: previous?.surface ?? null,
    targetBinding: previous?.targetBinding ?? null,
    verification: previous?.verification ?? null,
  };

  if (options.event.type === 'progress') {
    return withAgentTaskRuntimeSubgoalSelection({
      ...base,
      phase: options.event.phase,
      state: 'active',
    });
  }


  if (options.event.type === 'lifecycle') {
    const validation = validateAgentTaskRuntimeLifecycleTransition({
      kind: options.event.kind,
      previous,
    });
    if (!validation.accepted && previous) {
      return withAgentTaskRuntimeSubgoalSelection({
        ...base,
        lastRejectedTransitionKind: options.event.kind,
        lastTransitionError: validation.reason,
        phase: previous.phase,
        state: previous.state,
      });
    }
    const transition = mapAgentTaskRuntimeLifecycleTransition(options.event);
    return withAgentTaskRuntimeSubgoalSelection({
      ...base,
      lastRejectedTransitionKind: null,
      lastTransitionError: null,
      lastTransitionKind: options.event.kind,
      phase: transition.phase,
      state: transition.state,
    });
  }

  if (options.event.type === 'subgoal-status') {
    return withAgentTaskRuntimeSubgoalSelection({
      ...base,
      ...upsertAgentTaskRuntimeSubgoal({
        actionScope: options.event.actionScope,
        now,
        subgoals: base.subgoals,
        status: options.event.status,
      }),
      phase: previous?.phase ?? 'planning',
      state: previous?.state ?? 'active',
    });
  }

  if (options.event.type === 'model-iteration-authorization') {
    return withAgentTaskRuntimeSubgoalSelection({
      ...base,
      modelIterationCount: options.event.iteration,
      modelIterationLimit: options.event.limit,
      phase: previous?.phase ?? 'planning',
      state: previous?.state ?? 'active',
    });
  }

  if (options.event.type === 'recovery-authorization') {
    return withAgentTaskRuntimeSubgoalSelection({
      ...base,
      lastRecoveryKind: options.event.kind,
      phase: options.event.allowed ? 'recovering' : 'terminal',
      recoveryAttemptCount: options.event.allowed
        ? options.event.attempt
        : base.recoveryAttemptCount,
      recoveryLimit: options.event.limit,
      state: options.event.allowed ? 'active' : 'blocked_needs_user',
    });
  }

  const state = mapAgentRuntimeStatusToTaskState(options.event.status);
  return withAgentTaskRuntimeSubgoalSelection({
    ...base,
    lastRuntimeStatus: options.event.status,
    phase: mapAgentTaskRuntimeStateToPhase(state),
    state,
    subgoals: state === 'succeeded'
      ? completeAgentTaskRuntimeSubgoals(base.subgoals, now)
      : base.subgoals,
  });
}

export function createAgentTaskRuntimeStateRecord(options: {
  now?: number;
  previous?: AgentTaskRuntimeStateRecord | null;
  sourceText: string;
  status: AgentRuntimeStatus;
  userGoal: string;
}): AgentTaskRuntimeStateRecord {
  return transitionAgentTaskRuntimeState({
    event: {
      status: options.status,
      type: 'runtime-result',
    },
    now: options.now,
    previous: options.previous,
    sourceText: options.sourceText,
    userGoal: options.userGoal,
  });
}

export function authorizeAgentTaskRuntimeRecovery(options: {
  now?: number;
  previous?: AgentTaskRuntimeStateRecord | null;
  request: AgentTaskRuntimeRecoveryRequest;
}): {
  decision: AgentTaskRuntimeRecoveryDecision;
  taskState: AgentTaskRuntimeStateRecord;
} {
  const now = options.now ?? Date.now();
  const previous = options.previous ?? null;
  const requestedLimit = normalizeAgentTaskRuntimeRecoveryLimit(options.request.requestedLimit);
  const limit = Math.min(
    previous?.recoveryLimit ?? AGENT_TASK_RUNTIME_DEFAULT_RECOVERY_LIMIT,
    requestedLimit,
  );
  const attempt = (previous?.recoveryAttemptCount ?? 0) + 1;
  const allowed = attempt <= limit;
  const reason = allowed
    ? `Task Runtime authorized recovery attempt ${attempt}/${limit}.`
    : `Task Runtime recovery budget exhausted at ${previous?.recoveryAttemptCount ?? 0}/${limit}.`;
  const taskState = transitionAgentTaskRuntimeState({
    event: {
      allowed,
      attempt,
      kind: options.request.kind,
      limit,
      type: 'recovery-authorization',
    },
    now,
    previous,
    sourceText: options.request.sourceText,
    userGoal: options.request.userGoal,
  });
  return {
    decision: {
      allowed,
      attempt,
      limit,
      reason,
    },
    taskState,
  };
}

export function authorizeAgentTaskRuntimeModelIteration(options: {
  now?: number;
  previous?: AgentTaskRuntimeStateRecord | null;
  request: AgentTaskRuntimeModelIterationRequest;
}): AgentTaskRuntimeModelIterationDecision {
  const previous = options.previous ?? null;
  const requestedLimit = normalizeAgentTaskRuntimeModelIterationLimit(
    options.request.requestedLimit,
  );
  const persistedLimit = previous?.modelIterationLimit ?? 0;
  const limit = requestedLimit > 0
    ? (persistedLimit > 0
      ? Math.min(persistedLimit, requestedLimit)
      : requestedLimit)
    : persistedLimit;
  const iteration = previous?.modelIterationCount ?? 0;
  const action = iteration >= limit
    ? 'stop-limit' as const
    : options.request.cancellationRequested
      ? 'stop-cancelled' as const
      : 'run-iteration' as const;
  const nextIteration = action === 'run-iteration' ? iteration + 1 : iteration;
  const reason = action === 'stop-limit'
    ? `Task Runtime model-loop limit reached at ${iteration}/${limit}.`
    : action === 'stop-cancelled'
      ? 'Task Runtime stopped the model loop because cancellation was requested.'
      : `Task Runtime authorized model iteration ${nextIteration}/${limit}.`;
  const taskState = transitionAgentTaskRuntimeState({
    event: {
      action,
      iteration: nextIteration,
      limit,
      type: 'model-iteration-authorization',
    },
    now: options.now,
    previous,
    sourceText: options.request.sourceText,
    userGoal: options.request.userGoal,
  });
  return {
    action,
    iteration: nextIteration,
    limit,
    reason,
    taskState,
  };
}

function inferAgentTaskRuntimeProgressPhase(
  event: AgentRuntimeProgressEvent,
): AgentTaskRuntimeActivePhase {
  if (event.taskPhase) {
    return event.taskPhase;
  }
  const commands = [event.command, ...(event.commands ?? [])].filter(Boolean);
  const toolNames = commands.map((command) => command?.toolCall?.name ?? '');
  if (toolNames.some((name) => name === 'locate_screen_elements')) {
    return 'resolving_target';
  }
  if (event.type === 'tools-running') {
    const readOnlyObservation = commands.length > 0 && commands.every((command) => (
      command?.capabilityId?.includes('observation')
      || command?.toolCall?.name?.startsWith('observe_')
      || command?.toolCall?.name === 'execute_desktop_observation'
    ));
    return readOnlyObservation ? 'observing' : 'executing';
  }
  if (event.type === 'tool-result') {
    return 'collecting_evidence';
  }
  return 'planning';
}

export function advanceAgentTaskRuntimeProgress(options: {
  event: AgentRuntimeProgressEvent;
  now?: number;
  previous?: AgentTaskRuntimeStateRecord | null;
}) {
  const previous = options.previous ?? options.event.continuation.taskState ?? null;
  const sourceText = options.event.continuation.sourceText;
  const transitionEvent: AgentTaskRuntimeTransitionEvent = options.event.taskTransition
    ? {
        kind: options.event.taskTransition.kind,
        type: 'lifecycle',
      }
    : {
        phase: inferAgentTaskRuntimeProgressPhase(options.event),
        type: 'progress',
      };
  const taskState = transitionAgentTaskRuntimeState({
    event: transitionEvent,
    now: options.now,
    previous,
    sourceText,
    userGoal: options.event.continuation.userGoal,
  });
  const enrichedTaskState = appendAgentRuntimeToolEvidence({
    entries: options.event.continuation.toolResults,
    now: options.now,
    state: taskState,
  });
  const diagnostics = upsertAgentRuntimeDiagnostic(
    options.event.continuation.diagnostics,
    createAgentTaskRuntimeStateDiagnostic(enrichedTaskState, options.now),
  );
  return {
    event: {
      ...options.event,
      continuation: {
        ...options.event.continuation,
        diagnostics,
        taskState: enrichedTaskState,
      },
    },
    taskState: enrichedTaskState,
  };
}

function isAgentRuntimeResult(value: unknown): value is AgentRuntimeResult {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const result = value as Partial<AgentRuntimeResult>;
  return Boolean(
    result.continuation
    && typeof result.sourceText === 'string'
    && typeof result.status === 'string'
    && Array.isArray(result.steps)
    && Array.isArray(result.traceEvents)
    && Array.isArray(result.toolResults),
  );
}

export function commitAgentTaskRuntimeState<Result>(
  result: Result,
  now?: number,
  previousOverride?: AgentTaskRuntimeStateRecord | null,
): Result {
  if (!isAgentRuntimeResult(result)) {
    return result;
  }

  const previous = previousOverride ?? result.continuation.taskState ?? result.taskState ?? null;
  const taskState = createAgentTaskRuntimeStateRecord({
    now,
    previous,
    sourceText: result.sourceText,
    status: result.status,
    userGoal: result.continuation.userGoal,
  });
  const committedTaskState = appendAgentRuntimeToolEvidence({
    entries: result.toolResults,
    now,
    state: taskState,
  });
  const diagnostics = upsertAgentRuntimeDiagnostic(
    [...(result.continuation.diagnostics ?? []), ...(result.diagnostics ?? [])],
    createAgentTaskRuntimeStateDiagnostic(committedTaskState, now),
  );
  return {
    ...result,
    diagnostics,
    continuation: {
      ...result.continuation,
      diagnostics,
      taskState: committedTaskState,
    },
    taskState: committedTaskState,
  } as Result;
}

export function advanceAgentTaskRuntimeLifecycle<Result>(options: {
  kind: AgentTaskRuntimeLifecycleTransitionKind;
  now?: number;
  result: Result;
}): Result {
  if (!isAgentRuntimeResult(options.result)) {
    return options.result;
  }

  const previous = options.result.continuation.taskState ?? options.result.taskState ?? null;
  const taskState = transitionAgentTaskRuntimeState({
    event: {
      kind: options.kind,
      type: 'lifecycle',
    },
    now: options.now,
    previous,
    sourceText: options.result.sourceText,
    userGoal: options.result.continuation.userGoal,
  });
  const enrichedTaskState = appendAgentRuntimeToolEvidence({
    entries: options.result.toolResults,
    now: options.now,
    state: taskState,
  });
  const diagnostics = upsertAgentRuntimeDiagnostic(
    [...(options.result.continuation.diagnostics ?? []), ...(options.result.diagnostics ?? [])],
    createAgentTaskRuntimeStateDiagnostic(enrichedTaskState, options.now),
  );
  return {
    ...options.result,
    diagnostics,
    continuation: {
      ...options.result.continuation,
      diagnostics,
      taskState: enrichedTaskState,
    },
    taskState: enrichedTaskState,
  } as Result;
}

export function updateAgentTaskRuntimeSubgoal<Result>(options: {
  actionScope: NonNullable<AgentChatCommand['toolCall']>['actionScope'];
  now?: number;
  result: Result;
  status: AgentTaskRuntimeSubgoalStatus;
}): Result {
  if (!options.actionScope || !isAgentRuntimeResult(options.result)) {
    return options.result;
  }

  const previous = options.result.continuation.taskState ?? options.result.taskState ?? null;
  const taskState = transitionAgentTaskRuntimeState({
    event: {
      actionScope: options.actionScope,
      status: options.status,
      type: 'subgoal-status',
    },
    now: options.now,
    previous,
    sourceText: options.result.sourceText,
    userGoal: options.result.continuation.userGoal,
  });
  const enrichedTaskState = appendAgentRuntimeToolEvidence({
    entries: options.result.toolResults,
    now: options.now,
    state: taskState,
  });
  const diagnostics = upsertAgentRuntimeDiagnostic(
    [...(options.result.continuation.diagnostics ?? []), ...(options.result.diagnostics ?? [])],
    createAgentTaskRuntimeStateDiagnostic(enrichedTaskState, options.now),
  );
  return {
    ...options.result,
    diagnostics,
    continuation: {
      ...options.result.continuation,
      diagnostics,
      taskState: enrichedTaskState,
    },
    taskState: enrichedTaskState,
  } as Result;
}
