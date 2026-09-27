import assert from 'node:assert/strict';

import {
  authorizeAgentTaskRuntimeModelIteration,
  runAgentRuntime,
  type AgentRuntimeContinuation,
  type AgentRuntimeResult,
  type AgentRuntimeStatus,
} from '../src/agent/index.ts';

function createResult(options: {
  continuation?: AgentRuntimeContinuation | null;
  status: AgentRuntimeStatus;
}): AgentRuntimeResult {
  const continuation = options.continuation ?? {
    historyLines: [],
    sourceText: 'open the target application',
    steps: [],
    traceEvents: [],
    toolResults: [],
    userGoal: 'open the target application and continue inside it',
  };
  return {
    continuation,
    finalAnswer: options.status,
    sourceText: continuation.sourceText,
    status: options.status,
    steps: continuation.steps,
    traceEvents: continuation.traceEvents,
    toolResults: continuation.toolResults,
  };
}

const initial = await runAgentRuntime({
  adapter: {
    id: 'model-iteration-initial-run-smoke',
    async run(context) {
      const first = context?.authorizeModelIteration({
        cancellationRequested: false,
        requestedLimit: 6,
        sourceText: 'open the target application',
        userGoal: 'open the target application and continue inside it',
      });
      const second = context?.authorizeModelIteration({
        cancellationRequested: false,
        requestedLimit: 6,
        sourceText: 'open the target application',
        userGoal: 'open the target application and continue inside it',
      });
      assert.equal(first?.action, 'run-iteration');
      assert.equal(first?.iteration, 1);
      assert.equal(second?.action, 'run-iteration');
      assert.equal(second?.iteration, 2);
      return {
        implementation: 'stable' as const,
        reason: 'Initial run reached approval after two model iterations.',
        result: createResult({ status: 'needs-approval' }),
      };
    },
  },
});

assert.equal(initial.result?.taskState?.modelIterationCount, 2);
assert.equal(initial.result?.taskState?.modelIterationLimit, 6);
assert.equal(initial.result?.taskState?.state, 'waiting_approval');
const initialTaskId = initial.result?.taskState?.taskId;
assert.ok(initialTaskId);

const resumed = await runAgentRuntime({
  adapter: {
    id: 'model-iteration-approval-continuation-smoke',
    async run(context) {
      const continuation = initial.result?.continuation;
      assert.ok(continuation);
      context?.onProgress({
        continuation,
        message: 'Approval granted',
        stepIndex: 3,
        taskTransition: { kind: 'approval-granted' },
        type: 'model-thinking',
      });
      const decisions = Array.from({ length: 4 }, () => context?.authorizeModelIteration({
        cancellationRequested: false,
        requestedLimit: 6,
        sourceText: continuation.sourceText,
        taskState: continuation.taskState,
        userGoal: continuation.userGoal,
      }));
      assert.deepEqual(decisions.map((decision) => decision?.iteration), [3, 4, 5, 6]);
      assert.ok(decisions.every((decision) => decision?.action === 'run-iteration'));
      const stopped = context?.authorizeModelIteration({
        cancellationRequested: true,
        requestedLimit: 6,
        sourceText: continuation.sourceText,
        taskState: continuation.taskState,
        userGoal: continuation.userGoal,
      });
      assert.equal(stopped?.action, 'stop-limit');
      assert.equal(stopped?.iteration, 6);
      return {
        implementation: 'stable' as const,
        reason: 'Continuation preserved and exhausted the original model budget.',
        result: createResult({ continuation, status: 'max-steps' }),
      };
    },
  },
});

assert.equal(resumed.result?.taskState?.taskId, initialTaskId);
assert.equal(resumed.result?.taskState?.modelIterationCount, 6);
assert.equal(resumed.result?.taskState?.modelIterationLimit, 6);

const cancelledBeforeLimit = authorizeAgentTaskRuntimeModelIteration({
  previous: initial.result?.taskState,
  request: {
    cancellationRequested: true,
    requestedLimit: 6,
    sourceText: initial.result?.sourceText ?? '',
    taskState: initial.result?.taskState,
    userGoal: initial.result?.continuation.userGoal ?? '',
  },
});
assert.equal(cancelledBeforeLimit.action, 'stop-cancelled');
assert.equal(cancelledBeforeLimit.iteration, 2);
assert.equal(cancelledBeforeLimit.taskState.taskId, initialTaskId);

const persistedLimitFallback = authorizeAgentTaskRuntimeModelIteration({
  previous: initial.result?.taskState,
  request: {
    cancellationRequested: false,
    requestedLimit: 0,
    sourceText: initial.result?.sourceText ?? '',
    taskState: initial.result?.taskState,
    userGoal: initial.result?.continuation.userGoal ?? '',
  },
});
assert.equal(persistedLimitFallback.limit, 6);
assert.equal(persistedLimitFallback.action, 'run-iteration');

console.log('agent task runtime model iteration continuation smoke ok');
