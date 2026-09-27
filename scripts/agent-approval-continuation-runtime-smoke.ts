import assert from 'node:assert/strict';
import {
  buildAgentPermissionRoute,
  createAgentStaleOuterApprovalSkippedResult,
  createAgentRuntimeWaitingApprovalSnapshot,
  runAgentApprovedActionLifecycle,
  runAgentTaskScopedApprovalContinuations,
  type AgentChatCommand,
  type AgentRuntimeResult,
} from '../src/agent/index.ts';

function command(query: string): AgentChatCommand {
  return {
    capabilityId: 'app-launcher',
    instruction: 'Open Example Launcher and start Example Game',
    kind: 'tool-call',
    sourceText: '/agent open Example Game inside Example Launcher',
    toolCall: {
      goal: 'Open Example Launcher and start Example Game',
      input: { query },
      name: 'launch_local_app',
    },
  };
}

function plan(value: AgentChatCommand) {
  const route = buildAgentPermissionRoute(value);
  assert.ok(route.plan);
  return route.plan;
}

function result(pendingCommand?: AgentChatCommand | null): AgentRuntimeResult {
  const continuation = {
    historyLines: [],
    sourceText: '/agent open Example Game inside Example Launcher',
    steps: [],
    traceEvents: [],
    toolResults: [],
    userGoal: 'Open Example Launcher and start Example Game',
  };
  return {
    continuation,
    finalAnswer: pendingCommand ? 'approval' : 'done',
    pendingApproval: pendingCommand ? {
      command: pendingCommand,
      plan: plan(pendingCommand),
      reason: 'same task continuation',
      routeSummary: 'needs approval',
    } : null,
    sourceText: continuation.sourceText,
    status: pendingCommand ? 'needs-approval' : 'completed',
    steps: [],
    traceEvents: [],
    toolResults: [],
  };
}

const approvedCommand = command('Example Launcher');
const approvedPlan = plan(approvedCommand);
const pendingCommand = command('Example Game');
let executeCount = 0;
const continuationPhases: string[] = [];
const consumed = await runAgentTaskScopedApprovalContinuations({
  approvedCommand,
  approvedPlan,
  createSkippedResult: () => ({ ok: true, responseText: 'skipped' }),
  execute: async () => {
    executeCount += 1;
    return { ok: true, receipt: { status: 'success' }, responseText: 'executed' };
  },
  initialResult: result(pendingCommand),
  resume: async ({ previousResult }) => {
    continuationPhases.push(previousResult.taskState?.phase ?? 'missing');
    return {
      ...previousResult,
      finalAnswer: 'done',
      pendingApproval: null,
      status: 'completed',
    };
  },
});
assert.equal(consumed.count, 1);
assert.equal(consumed.result.status, 'completed');
assert.equal(consumed.stop, null);
assert.equal(consumed.outcome.kind, 'consumed');
assert.equal(executeCount, 1);
assert.deepEqual(continuationPhases, ['collecting_evidence']);
assert.equal(consumed.result.taskState?.lastTransitionKind, 'action-dispatched');

const detachedPending = result(pendingCommand).pendingApproval!;
const initialCandidate = await runAgentTaskScopedApprovalContinuations({
  approvedCommand,
  approvedPlan,
  createSkippedResult: () => ({ ok: true, responseText: 'skipped' }),
  execute: async () => ({ ok: true, receipt: { status: 'success' }, responseText: 'executed initial candidate' }),
  initialPendingApproval: detachedPending,
  initialResult: result(null),
  resume: async () => result(null),
});
assert.equal(initialCandidate.count, 1);
assert.equal(initialCandidate.result.status, 'completed');
assert.equal(initialCandidate.outcome.kind, 'consumed');

const limited = await runAgentTaskScopedApprovalContinuations({
  approvedCommand,
  approvedPlan,
  createSkippedResult: () => ({ ok: true, responseText: 'skipped' }),
  execute: async () => ({ ok: true, receipt: { status: 'success' }, responseText: 'executed' }),
  initialResult: result(pendingCommand),
  maxContinuations: 1,
  resume: async () => result(command('Example Game second continuation')),
});
assert.equal(limited.count, 1);
assert.equal(limited.stop?.reason, 'continuation-limit');
assert.equal(limited.outcome.kind, 'limit-reached');
assert.equal(limited.result.diagnostics?.at(-1)?.source, 'agent-approval-continuation-runtime');

let skippedExecutionCount = 0;
const staleOuterApprovalResult = result(approvedCommand);
staleOuterApprovalResult.toolResults = [{
  command: approvedCommand,
  result: {
    ok: true,
    receipt: { status: 'success' },
    responseText: 'outer dispatch executed',
  },
}];
const skipped = await runAgentTaskScopedApprovalContinuations({
  approvedCommand,
  approvedPlan,
  createSkippedResult: () => ({ ok: true, responseText: 'skipped duplicate' }),
  execute: async () => {
    skippedExecutionCount += 1;
    return { ok: true, responseText: 'must not execute' };
  },
  initialResult: staleOuterApprovalResult,
  resume: async () => result(null),
});
assert.equal(skipped.count, 1);
assert.equal(skipped.staleDuplicateSkipCount, 1);
assert.equal(skipped.outcome.kind, 'stale-outer-skipped');
assert.equal(skippedExecutionCount, 0);

const unverifiedDispatchResult = result(approvedCommand);
unverifiedDispatchResult.toolResults = [{
  command: approvedCommand,
  result: {
    ok: true,
    receipt: { status: 'unverified' },
    responseText: 'Input was sent but the result was not verified.',
  },
}];
const unverifiedSkip = await runAgentTaskScopedApprovalContinuations({
  approvedCommand,
  approvedPlan,
  createSkippedResult: () => ({ ok: true, responseText: 'skipped duplicate' }),
  execute: async () => ({ ok: true, responseText: 'must not execute' }),
  initialResult: unverifiedDispatchResult,
  resume: async () => result(null),
});
assert.equal(
  unverifiedSkip.outcome.kind,
  'duplicate-blocked',
  'an unverified dispatch must not be treated as proof that the outer approval can be skipped',
);

const cancelled = await runAgentTaskScopedApprovalContinuations({
  approvedCommand,
  approvedPlan,
  createSkippedResult: () => ({ ok: true, responseText: 'skipped' }),
  execute: async () => ({ ok: true, responseText: 'must not execute' }),
  initialResult: result(pendingCommand),
  isCancelled: () => true,
  resume: async () => result(null),
});
assert.equal(cancelled.count, 0);
assert.equal(cancelled.result.status, 'needs-approval');
assert.equal(cancelled.outcome.kind, 'cancelled');

const duplicateBlocked = await runAgentTaskScopedApprovalContinuations({
  approvedCommand,
  approvedPlan,
  createSkippedResult: () => ({ ok: true, responseText: 'skipped' }),
  execute: async () => ({ ok: true, responseText: 'must not execute' }),
  initialPendingApproval: result(approvedCommand).pendingApproval!,
  initialResult: result(null),
  resume: async () => result(null),
});
assert.equal(duplicateBlocked.outcome.kind, 'duplicate-blocked');

const resolvedContinuationCommand = command('Rebound Example Game');
let resumedCommand: AgentChatCommand | null = null;
const reResolved = await runAgentTaskScopedApprovalContinuations({
  approvedCommand,
  approvedPlan,
  createSkippedResult: () => ({ ok: true, responseText: 'skipped' }),
  execute: async () => ({ ok: true, responseText: 'executed rebound command' }),
  initialResult: result(pendingCommand),
  resolveApprovedDispatch: async (_command, continuation) => ({
    command: resolvedContinuationCommand,
    continuation,
    plan: plan(resolvedContinuationCommand),
  }),
  resume: async ({ command: resumed }) => {
    resumedCommand = resumed;
    return result(null);
  },
});
assert.equal(reResolved.outcome.kind, 'consumed');
assert.equal(resumedCommand, resolvedContinuationCommand);

const skippedLifecycle = await runAgentApprovedActionLifecycle({
  command: approvedCommand,
  execute: async () => createAgentStaleOuterApprovalSkippedResult({
    command: approvedCommand,
    responseText: 'Skipped duplicate approval.',
  }),
  waitingResult: createAgentRuntimeWaitingApprovalSnapshot({
    command: approvedCommand,
    continuation: result(null).continuation,
    plan: approvedPlan,
  }),
});
assert.notEqual(
  skippedLifecycle.runtimeResult.taskState?.lastTransitionKind,
  'action-dispatched',
  'skipped stale outer approval must not advance the action lifecycle to dispatched',
);

console.log('agent approval continuation runtime smoke ok');
