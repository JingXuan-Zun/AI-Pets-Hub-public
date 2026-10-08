import assert from 'node:assert/strict';
import {
  authorizeAgentTaskRuntimeRecovery,
  commitAgentTaskRuntimeState,
  createAgentRuntimeProductionAdapter,
  runAgentRuntime,
  transitionAgentTaskRuntimeState,
  type AgentRuntimeResult,
} from '../src/agent/index.ts';

const plannedState = transitionAgentTaskRuntimeState({
  event: { phase: 'planning', type: 'progress' },
  now: 500,
  sourceText: '/agent open Example Game',
  userGoal: 'Open Example Game',
});
const observedState = transitionAgentTaskRuntimeState({
  event: { phase: 'observing', type: 'progress' },
  now: 600,
  previous: plannedState,
  sourceText: plannedState.sourceText,
  userGoal: plannedState.userGoal,
});
assert.equal(observedState.phase, 'observing');
assert.equal(observedState.state, 'active');
assert.equal(observedState.taskId, plannedState.taskId);
assert.equal(observedState.revision, plannedState.revision + 1);
assert.equal(observedState.startedAt, plannedState.startedAt);

const invalidDispatchState = transitionAgentTaskRuntimeState({
  event: { kind: 'action-dispatched', type: 'lifecycle' },
  now: 650,
  previous: plannedState,
  sourceText: plannedState.sourceText,
  userGoal: plannedState.userGoal,
});
assert.equal(invalidDispatchState.phase, 'planning');
assert.equal(invalidDispatchState.state, 'active');
assert.equal(invalidDispatchState.lastTransitionKind, null);
assert.equal(invalidDispatchState.lastRejectedTransitionKind, 'action-dispatched');
assert.match(invalidDispatchState.lastTransitionError ?? '', /not valid from planning/u);
assert.equal(invalidDispatchState.taskId, plannedState.taskId);

const targetResolutionState = transitionAgentTaskRuntimeState({
  event: { kind: 'target-resolution-started', type: 'lifecycle' },
  now: 700,
  previous: observedState,
  sourceText: observedState.sourceText,
  userGoal: observedState.userGoal,
});
assert.equal(targetResolutionState.phase, 'resolving_target');
assert.equal(targetResolutionState.lastTransitionKind, 'target-resolution-started');

const approvalState = transitionAgentTaskRuntimeState({
  event: { kind: 'approval-required', type: 'lifecycle' },
  now: 800,
  previous: targetResolutionState,
  sourceText: targetResolutionState.sourceText,
  userGoal: targetResolutionState.userGoal,
});
assert.equal(approvalState.phase, 'approval');
assert.equal(approvalState.state, 'waiting_approval');

const executionState = transitionAgentTaskRuntimeState({
  event: { kind: 'approval-granted', type: 'lifecycle' },
  now: 900,
  previous: approvalState,
  sourceText: approvalState.sourceText,
  userGoal: approvalState.userGoal,
});
assert.equal(executionState.phase, 'executing');
assert.equal(executionState.state, 'active');

const evidenceState = transitionAgentTaskRuntimeState({
  event: { kind: 'action-dispatched', type: 'lifecycle' },
  now: 950,
  previous: executionState,
  sourceText: executionState.sourceText,
  userGoal: executionState.userGoal,
});
assert.equal(evidenceState.phase, 'collecting_evidence');

const verificationState = transitionAgentTaskRuntimeState({
  event: { kind: 'evidence-collected', type: 'lifecycle' },
  now: 975,
  previous: evidenceState,
  sourceText: evidenceState.sourceText,
  userGoal: evidenceState.userGoal,
});
assert.equal(verificationState.phase, 'verifying_outcome');
assert.equal(verificationState.taskId, plannedState.taskId);

function result(options: {
  continuation?: AgentRuntimeResult['continuation'];
  status: AgentRuntimeResult['status'];
}): AgentRuntimeResult {
  const continuation = options.continuation ?? {
    historyLines: [],
    sourceText: '/agent open Example Game',
    steps: [],
    traceEvents: [],
    toolResults: [],
    userGoal: 'Open Example Game',
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

const initial = commitAgentTaskRuntimeState(result({ status: 'needs-approval' }), 1000);
assert.equal(initial.taskState?.owner, 'task-runtime');
assert.equal(initial.taskState?.state, 'waiting_approval');
assert.equal(initial.taskState?.revision, 1);
assert.equal(initial.continuation.taskState?.taskId, initial.taskState?.taskId);

const continued = commitAgentTaskRuntimeState(result({
  continuation: initial.continuation,
  status: 'completed',
}), 2000);
assert.equal(continued.taskState?.taskId, initial.taskState?.taskId);
assert.equal(continued.taskState?.revision, 2);
assert.equal(continued.taskState?.state, 'succeeded');
assert.equal(continued.taskState?.startedAt, 1000);
assert.equal(continued.taskState?.updatedAt, 2000);

const terminalRestartState = transitionAgentTaskRuntimeState({
  event: { kind: 'observation-started', type: 'lifecycle' },
  now: 2001,
  previous: continued.taskState,
  sourceText: continued.sourceText,
  userGoal: continued.continuation.userGoal,
});
assert.equal(terminalRestartState.state, 'succeeded');
assert.equal(terminalRestartState.phase, 'terminal');
assert.equal(terminalRestartState.lastRejectedTransitionKind, 'observation-started');
assert.match(terminalRestartState.lastTransitionError ?? '', /requires an active task/u);

let recoveryState = continued.taskState;
// Default recovery budget is 5 attempts per stage (an approval starts a new stage).
for (let attempt = 1; attempt <= 5; attempt += 1) {
  const authorization = authorizeAgentTaskRuntimeRecovery({
    now: 2000 + attempt,
    previous: recoveryState,
    request: {
      kind: 'automatic-observation',
      requestedLimit: 6,
      sourceText: continued.sourceText,
      userGoal: continued.continuation.userGoal,
    },
  });
  assert.equal(authorization.decision.allowed, true);
  assert.equal(authorization.decision.attempt, attempt);
  assert.equal(authorization.decision.limit, 5);
  assert.equal(authorization.taskState.recoveryAttemptCount, attempt);
  assert.equal(authorization.taskState.taskId, continued.taskState?.taskId);
  assert.equal(authorization.taskState.revision, (recoveryState?.revision ?? 0) + 1);
  recoveryState = authorization.taskState;
}
const rejectedRecovery = authorizeAgentTaskRuntimeRecovery({
  now: 2004,
  previous: recoveryState,
  request: {
    kind: 'failed-action',
    sourceText: continued.sourceText,
    userGoal: continued.continuation.userGoal,
  },
});
assert.equal(rejectedRecovery.decision.allowed, false);
assert.equal(rejectedRecovery.decision.attempt, 6);
assert.equal(rejectedRecovery.taskState.recoveryAttemptCount, 5);
assert.equal(rejectedRecovery.taskState.state, 'blocked_needs_user');
assert.equal(rejectedRecovery.taskState.taskId, continued.taskState?.taskId);
assert.equal(rejectedRecovery.taskState.revision, (recoveryState?.revision ?? 0) + 1);

const progressStates: Array<{ phase: string; revision: number; taskId: string }> = [];
const routed = await runAgentRuntime({
  adapter: {
    id: 'task-runtime-production-state-smoke',
    async run(context) {
      const continuation = result({ status: 'needs-user' }).continuation;
      const recoveryDecisions = Array.from({ length: 6 }, () => context?.authorizeRecovery({
        kind: 'automatic-observation',
        sourceText: continuation.sourceText,
        userGoal: continuation.userGoal,
      }));
      assert.deepEqual(recoveryDecisions.map((decision) => decision?.allowed), [true, true, true, true, true, false]);
      context?.onProgress({
        continuation,
        message: 'Planning',
        stepIndex: 1,
        type: 'model-thinking',
      });
      context?.onProgress({
        command: {
          capabilityId: 'desktop-observation',
          kind: 'tool-call',
          sourceText: continuation.sourceText,
          toolCall: {
            input: {},
            name: 'locate_screen_elements',
          },
        },
        continuation,
        message: 'Resolving target',
        stepIndex: 2,
        type: 'tools-running',
      });
      context?.onProgress({
        continuation,
        message: 'Approval required',
        stepIndex: 3,
        taskTransition: { kind: 'approval-required' },
        type: 'model-thinking',
      });
      context?.onProgress({
        continuation,
        message: 'Approval granted',
        stepIndex: 4,
        taskTransition: { kind: 'approval-granted' },
        type: 'model-thinking',
      });
      context?.onProgress({
        continuation,
        message: 'Execution started',
        stepIndex: 5,
        taskTransition: { kind: 'execution-started' },
        type: 'tools-running',
      });
      context?.onProgress({
        continuation,
        message: 'Action dispatched',
        stepIndex: 6,
        taskTransition: { kind: 'action-dispatched' },
        type: 'tool-result',
      });
      context?.onProgress({
        continuation,
        message: 'Verifying outcome',
        stepIndex: 7,
        taskPhase: 'planning',
        taskTransition: { kind: 'verification-started' },
        type: 'tool-result',
      });
      context?.onProgress({
        continuation,
        message: 'Recovering',
        stepIndex: 8,
        taskTransition: { kind: 'recovery-started' },
        type: 'tools-running',
      });
      return {
        implementation: 'stable' as const,
        reason: 'smoke',
        result: result({ status: 'needs-user' }),
      };
    },
  },
  onProgress(event) {
    const state = event.continuation.taskState;
    assert.ok(state);
    progressStates.push({
      phase: state.phase,
      revision: state.revision,
      taskId: state.taskId,
    });
  },
});
assert.deepEqual(
  progressStates.map((state) => state.phase),
  [
    'planning',
    'resolving_target',
    'approval',
    'executing',
    'executing',
    'collecting_evidence',
    'verifying_outcome',
    'recovering',
  ],
);
assert.deepEqual(progressStates.map((state) => state.revision), [7, 8, 9, 10, 11, 12, 13, 14]);
assert.equal(progressStates[0]?.taskId, progressStates[1]?.taskId);
assert.equal(routed.result?.taskState?.state, 'blocked_needs_user');
assert.equal(routed.result?.taskState?.revision, 15);
assert.equal(routed.result?.taskState?.taskId, progressStates[0]?.taskId);
assert.equal(routed.result?.continuation.taskState?.owner, 'task-runtime');

const resumedRecovery = await runAgentRuntime({
  adapter: {
    id: 'task-runtime-recovery-continuation-smoke',
    async run(context) {
      const continuation = result({
        continuation: routed.result?.continuation,
        status: 'needs-user',
      }).continuation;
      const decision = context?.authorizeRecovery({
        kind: 'automatic-observation',
        sourceText: continuation.sourceText,
        taskState: continuation.taskState,
        userGoal: continuation.userGoal,
      });
      assert.equal(decision?.allowed, false);
      assert.equal(decision?.attempt, 6);
      return {
        implementation: 'stable' as const,
        reason: 'recovery continuation smoke',
        result: result({ continuation, status: 'needs-user' }),
      };
    },
  },
});
assert.equal(resumedRecovery.result?.taskState?.taskId, routed.result?.taskState?.taskId);
assert.equal(resumedRecovery.result?.taskState?.recoveryAttemptCount, 5);
assert.equal(resumedRecovery.result?.taskState?.state, 'blocked_needs_user');

// A task-scoped auto continuation resumes with an approve event outside waiting_approval.
// The approved action already ran, so the next stage still gets a fresh recovery budget.
const approvedContinuation = await runAgentRuntime({
  adapter: {
    id: 'task-runtime-approved-continuation-budget-smoke',
    async run(context) {
      const decision = context?.authorizeRecovery({
        kind: 'automatic-observation',
        sourceText: 'smoke',
        taskState: routed.result?.taskState ?? null,
        userGoal: 'smoke',
      });
      assert.equal(decision?.allowed, true, 'approved continuation resets the exhausted budget');
      assert.equal(decision?.attempt, 1);
      return {
        implementation: 'stable' as const,
        reason: 'approved continuation budget smoke',
        result: result({ continuation: routed.result?.continuation, status: 'needs-user' }),
      };
    },
  },
  taskTransaction: { approval: null, lastError: null, phase: 'resuming', taskState: routed.result?.taskState ?? null } as never,
  taskTransactionEvent: { approval: null, type: 'approve' } as never,
});
assert.equal(approvedContinuation.result?.taskState?.recoveryAttemptCount, 1);

const productionProgressPhases: string[] = [];
const productionRouted = await runAgentRuntime({
  adapter: createAgentRuntimeProductionAdapter({
    run: async (context) => {
      const stableResult = result({ status: 'completed' });
      context?.onProgress({
        command: {
          capabilityId: 'desktop-observation',
          kind: 'tool-call',
          sourceText: stableResult.sourceText,
          toolCall: {
            input: {},
            name: 'observe_windows_and_apps',
          },
        },
        continuation: stableResult.continuation,
        message: 'Observing',
        stepIndex: 1,
        type: 'tools-running',
      });
      return stableResult;
    },
  }),
  onProgress(event) {
    productionProgressPhases.push(event.continuation.taskState?.phase ?? 'missing');
  },
});
assert.deepEqual(productionProgressPhases, ['observing']);
assert.equal(productionRouted.result?.taskState?.state, 'succeeded');
assert.equal(productionRouted.result?.taskState?.revision, 2);

const opaque = { source: 'legacy-test' };
assert.equal(commitAgentTaskRuntimeState(opaque), opaque);

console.log('agent task runtime production state smoke ok');
