import assert from 'node:assert/strict';

import {
  runAgentRecoveryExecution,
  type AgentChatCommand,
  type AgentRuntimeTimingEntry,
  type AgentRuntimeTimingEntryStatus,
  type AgentRuntimeTimingStopReason,
  type AgentRuntimeTraceEventDraft,
} from '../src/agent/index.ts';

const recoveryCommand: AgentChatCommand = {
  capabilityId: 'desktop-observation',
  instruction: 'Observe the current UI after the action.',
  kind: 'tool-call',
  sourceText: '/agent continue Example App task',
  toolCall: {
    goal: 'Continue Example App task.',
    input: {
      action: 'wait_and_observe',
      recoveryAttempt: 1,
      recoveryMaxAttempts: 2,
      waitMs: 500,
    },
    name: 'execute_desktop_observation',
  },
};

const unsafeCommand: AgentChatCommand = {
  capabilityId: 'app-launcher',
  instruction: 'Open another app.',
  kind: 'tool-call',
  sourceText: '/agent open another app',
  toolCall: {
    goal: 'Open another app.',
    input: { query: 'Another App' },
    name: 'launch_local_app',
  },
};

function createTimingTracker(stopReason: AgentRuntimeTimingStopReason | null = null) {
  let markedStopReason: AgentRuntimeTimingStopReason | null = null;
  return {
    beginEntry: (
      kind: 'tool',
      label: string,
      stepIndex: number,
      detail?: string | null,
    ): AgentRuntimeTimingEntry => ({
      detail,
      id: `recovery:${stepIndex}`,
      kind,
      label,
      startedAt: 1,
      status: 'running',
      stepIndex,
    }),
    finishEntry: (
      entry: AgentRuntimeTimingEntry,
      status: AgentRuntimeTimingEntryStatus,
      detail?: string | null,
    ): AgentRuntimeTimingEntry => ({
      ...entry,
      detail,
      durationMs: 1,
      endedAt: 2,
      status,
    }),
    getBudgetStopReason: () => stopReason,
    getMarkedStopReason: () => markedStopReason,
    markStopReason: (reason: AgentRuntimeTimingStopReason) => {
      markedStopReason = reason;
    },
  };
}

function createOptions(command: AgentChatCommand = recoveryCommand) {
  const traceEvents: AgentRuntimeTraceEventDraft[] = [];
  const timingTracker = createTimingTracker();
  return {
    input: {
      appendTraceEvent: (event: AgentRuntimeTraceEventDraft) => traceEvents.push(event),
      authorizeRecovery: () => ({
        allowed: true,
        attempt: 1,
        limit: 2,
        reason: 'recovery-authorized',
      }),
      executeCommand: async () => ({ ok: true, responseText: 'Fresh UI evidence observed.' }),
      getTimingDetail: () => 'recovery-runtime-smoke',
      isCancellationRequested: () => false,
      kind: 'automatic-observation' as const,
      proposal: {
        command,
        reason: 'Read-only recovery proposed.',
        status: 'proposed' as const,
      },
      reason: 'post-action-verification',
      requestedLimit: 2,
      resolveTimingStatus: (): AgentRuntimeTimingEntryStatus => 'success',
      sourceText: '/agent continue Example App task',
      stepIndex: 4,
      timingTracker,
      traceSource: 'auto-recovery',
      userGoal: 'Continue Example App task.',
    },
    timingTracker,
    traceEvents,
  };
}

{
  const lifecycleKinds: string[] = [];
  const authorizationReasons: string[] = [];
  const fixture = createOptions();
  const outcome = await runAgentRecoveryExecution({
    ...fixture.input,
    onAuthorization: (decision) => authorizationReasons.push(decision.reason),
    onCollected: ({ progressEvent }) => lifecycleKinds.push(progressEvent.taskTransition?.kind ?? ''),
    onStarted: ({ progressEvent }) => lifecycleKinds.push(progressEvent.taskTransition?.kind ?? ''),
  });

  assert.equal(outcome.kind, 'executed');
  assert.deepEqual(authorizationReasons, ['recovery-authorized']);
  assert.deepEqual(lifecycleKinds, ['recovery-started', 'recovery-collected']);
  assert.deepEqual(fixture.traceEvents.map((event) => event.type), [
    'permission_routed',
    'tool_started',
    'tool_finished',
  ]);
  if (outcome.kind === 'executed') {
    assert.equal(outcome.collected.entry.result.responseText, 'Fresh UI evidence observed.');
    assert.match(outcome.started.progressEvent.message, /\(1\/2\)/u);
  }
}

{
  let dispatchCount = 0;
  const fixture = createOptions();
  const outcome = await runAgentRecoveryExecution({
    ...fixture.input,
    authorizeRecovery: () => ({
      allowed: false,
      attempt: 2,
      limit: 2,
      reason: 'recovery-budget-exhausted',
    }),
    executeCommand: async () => {
      dispatchCount += 1;
      return { ok: true, responseText: 'unexpected dispatch' };
    },
  });

  assert.equal(outcome.kind, 'authorization-denied');
  assert.equal(dispatchCount, 0);
}

{
  let dispatchCount = 0;
  const fixture = createOptions(unsafeCommand);
  const outcome = await runAgentRecoveryExecution({
    ...fixture.input,
    executeCommand: async () => {
      dispatchCount += 1;
      return { ok: true, responseText: 'unexpected dispatch' };
    },
  });

  assert.equal(outcome.kind, 'not-executed');
  if (outcome.kind === 'not-executed') {
    assert.equal(outcome.stage, 'permission');
  }
  assert.equal(dispatchCount, 0);
}

console.log('agent recovery execution runtime smoke ok');
