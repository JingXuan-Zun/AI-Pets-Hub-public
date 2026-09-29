import {
  type AgentRuntimeResult,
  type AgentRuntimeRunResult,
  type RunAgentRuntimeOptions,
} from './agentRuntimeContract';
import {
  advanceAgentTaskRuntimeProgress,
  authorizeAgentTaskRuntimeModelIteration,
  authorizeAgentTaskRuntimeRecovery,
  commitAgentTaskRuntimeState,
} from './agentTaskRuntime';
import {
  createAgentRuntimeTaskTransactionState,
  transitionAgentRuntimeTaskTransaction,
  type AgentRuntimeTaskTransactionState,
} from './agentRuntimeTaskTransaction';

function isAgentRuntimeResult(value: unknown): value is AgentRuntimeResult {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const result = value as Partial<AgentRuntimeResult>;
  return Boolean(
    result.continuation
    && typeof result.status === 'string'
    && Array.isArray(result.toolResults),
  );
}

export async function runAgentRuntime<Result>(
  options: RunAgentRuntimeOptions<Result>,
): Promise<AgentRuntimeRunResult<Result>> {
  const adapterId = options.adapter.id.trim();
  if (!adapterId) {
    throw new Error('AgentRuntime requires an adapter with a stable id.');
  }

  let currentTaskState = null;
  let taskTransaction: AgentRuntimeTaskTransactionState | null = options.taskTransaction ?? null;
  currentTaskState = taskTransaction?.taskState ?? null;
  if (!taskTransaction && options.taskIdentity) {
    taskTransaction = createAgentRuntimeTaskTransactionState();
  }
  if (taskTransaction && options.taskIdentity && taskTransaction.phase === 'idle') {
    const started = transitionAgentRuntimeTaskTransaction({
      event: {
        sourceText: options.taskIdentity.sourceText,
        type: 'start',
        userGoal: options.taskIdentity.userGoal,
      },
      previous: taskTransaction,
    });
    if (started.accepted) {
      taskTransaction = started.state;
      currentTaskState = taskTransaction.taskState;
    }
  }
  if (taskTransaction && options.taskTransactionEvent) {
    const controlled = transitionAgentRuntimeTaskTransaction({
      event: options.taskTransactionEvent,
      previous: taskTransaction,
    });
    if (controlled.accepted) {
      taskTransaction = controlled.state;
      currentTaskState = taskTransaction.taskState;
    }
  }
  if (taskTransaction?.phase === 'resuming') {
    const resumed = transitionAgentRuntimeTaskTransaction({
      event: { type: 'resume' },
      previous: taskTransaction,
    });
    if (resumed.accepted) {
      taskTransaction = resumed.state;
      currentTaskState = taskTransaction.taskState;
    }
  }

  const outcome = await options.adapter.run({
    authorizeModelIteration(request) {
      const decision = authorizeAgentTaskRuntimeModelIteration({
        previous: currentTaskState ?? request.taskState ?? null,
        request,
      });
      currentTaskState = decision.taskState;
      return decision;
    },
    authorizeRecovery(request) {
      const authorization = authorizeAgentTaskRuntimeRecovery({
        previous: currentTaskState ?? request.taskState ?? null,
        request,
      });
      currentTaskState = authorization.taskState;
      return authorization.decision;
    },
    onProgress(event) {
      const advanced = advanceAgentTaskRuntimeProgress({
        event,
        previous: currentTaskState,
      });
      currentTaskState = advanced.taskState;
      if (taskTransaction) {
        taskTransaction = {
          ...taskTransaction,
          taskState: currentTaskState,
        };
      }
      options.onProgress?.({
        ...advanced.event,
        continuation: taskTransaction
          ? {
              ...advanced.event.continuation,
              taskTransaction,
            }
          : advanced.event.continuation,
      });
    },
    taskTransaction,
    cancellationSignal: options.cancellationSignal ?? null,
  });
  if (outcome.implementation !== 'unavailable' && !outcome.result) {
    throw new Error(`AgentRuntime adapter ${adapterId} returned no result for ${outcome.implementation}.`);
  }

  let result = outcome.result
    ? commitAgentTaskRuntimeState(outcome.result, undefined, currentTaskState)
    : null;
  if (result && taskTransaction && options.taskIdentity && isAgentRuntimeResult(result)) {
    const recorded = transitionAgentRuntimeTaskTransaction({
      event: {
        approval: result.pendingApproval ?? null,
        resultStatus: result.status,
        sourceText: options.taskIdentity.sourceText,
        type: 'result',
        userGoal: options.taskIdentity.userGoal,
      },
      previous: {
        ...taskTransaction,
        taskState: result.taskState ?? taskTransaction.taskState,
      },
    });
    if (recorded.accepted) {
      taskTransaction = {
        ...recorded.state,
        taskState: result.taskState ?? recorded.state.taskState,
      };
      result = {
        ...result,
        continuation: {
          ...result.continuation,
          taskTransaction,
        },
      } as Result;
    }
  }

  return {
    ...outcome,
    result,
  };
}
