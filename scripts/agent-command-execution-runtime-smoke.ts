import assert from 'node:assert/strict';

import {
  runAgentCommandExecution,
  type AgentChatCommand,
  type AgentRuntimeTimingEntry,
  type AgentRuntimeTimingEntryStatus,
  type AgentRuntimeTimingStopReason,
  type AgentRuntimeTraceEventDraft,
} from '../src/agent/index.ts';

const silentCommand: AgentChatCommand = {
  capabilityId: 'system-inspector',
  instruction: 'Read system information.',
  kind: 'tool-call',
  sourceText: '/agent read system information',
  toolCall: {
    goal: 'Read system information.',
    input: { includeDisplays: true },
    name: 'get_system_info',
  },
};

const approvalCommand: AgentChatCommand = {
  capabilityId: 'app-launcher',
  instruction: 'Open Example App.',
  kind: 'tool-call',
  sourceText: '/agent open Example App',
  toolCall: {
    goal: 'Open Example App.',
    input: { query: 'Example App' },
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
      id: `command-execution:${stepIndex}`,
      kind,
      label,
      startedAt: 10,
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
      durationMs: 5,
      endedAt: 15,
      status,
    }),
    getBudgetStopReason: () => stopReason,
    getMarkedStopReason: () => markedStopReason,
    markStopReason: (reason: AgentRuntimeTimingStopReason) => {
      markedStopReason = reason;
    },
  };
}

function createBaseOptions(options: {
  command?: AgentChatCommand;
  executeCommand?: ((command: AgentChatCommand) => Promise<{
    ok: boolean;
    responseText: string;
  }>) | null;
  isCancellationRequested?: () => boolean;
  stopReason?: AgentRuntimeTimingStopReason | null;
} = {}) {
  const traceEvents: AgentRuntimeTraceEventDraft[] = [];
  const timingTracker = createTimingTracker(options.stopReason ?? null);
  return {
    input: {
      appendTraceEvent: (event: AgentRuntimeTraceEventDraft) => traceEvents.push(event),
      approvalReason: () => 'Approval is required for this command.',
      command: options.command ?? silentCommand,
      executeCommand: options.executeCommand === undefined
        ? async () => ({ ok: true, responseText: 'System information observed.' })
        : options.executeCommand,
      getTimingDetail: () => 'command-execution-smoke',
      isCancellationRequested: options.isCancellationRequested ?? (() => false),
      resolveTimingStatus: (): AgentRuntimeTimingEntryStatus => 'success',
      stepIndex: 3,
      timingTracker,
      traceAction: 'tool_call' as const,
    },
    timingTracker,
    traceEvents,
  };
}

{
  const startedKinds: string[] = [];
  const collectedKinds: string[] = [];
  const fixture = createBaseOptions();
  const outcome = await runAgentCommandExecution({
    ...fixture.input,
    onCollected: ({ progressEvent }) => collectedKinds.push(progressEvent.taskTransition?.kind ?? ''),
    onStarted: ({ progressEvent }) => startedKinds.push(progressEvent.taskTransition?.kind ?? ''),
  });

  assert.equal(outcome.kind, 'executed');
  assert.deepEqual(startedKinds, ['observation-started']);
  assert.deepEqual(collectedKinds, ['observation-collected']);
  assert.deepEqual(fixture.traceEvents.map((event) => event.type), [
    'permission_routed',
    'tool_started',
    'tool_finished',
  ]);
  if (outcome.kind === 'executed') {
    assert.equal(outcome.route.status, 'silent');
    assert.equal(outcome.collected.entry.result.responseText, 'System information observed.');
  }
}

{
  let dispatchCount = 0;
  const fixture = createBaseOptions({
    command: approvalCommand,
    executeCommand: async () => {
      dispatchCount += 1;
      return { ok: true, responseText: 'unexpected dispatch' };
    },
  });
  const outcome = await runAgentCommandExecution(fixture.input);

  assert.equal(outcome.kind, 'approval-required');
  assert.equal(dispatchCount, 0);
  if (outcome.kind === 'approval-required') {
    assert.equal(outcome.route.status, 'needs-approval');
    assert.equal(outcome.approval.command, approvalCommand);
  }
}

{
  const fixture = createBaseOptions({ executeCommand: null });
  const outcome = await runAgentCommandExecution(fixture.input);

  assert.equal(outcome.kind, 'executor-unavailable');
  assert.deepEqual(fixture.traceEvents.map((event) => event.type), ['permission_routed']);
}

{
  let dispatchCount = 0;
  const fixture = createBaseOptions({
    executeCommand: async () => {
      dispatchCount += 1;
      return { ok: true, responseText: 'unexpected dispatch' };
    },
    stopReason: 'max-tool-calls',
  });
  const outcome = await runAgentCommandExecution(fixture.input);

  assert.equal(outcome.kind, 'budget-exceeded');
  assert.equal(dispatchCount, 0);
  assert.equal(fixture.timingTracker.getMarkedStopReason(), 'max-tool-calls');
}

{
  let cancellationChecks = 0;
  const fixture = createBaseOptions({
    isCancellationRequested: () => {
      cancellationChecks += 1;
      return true;
    },
  });
  const outcome = await runAgentCommandExecution(fixture.input);

  assert.equal(outcome.kind, 'cancelled');
  assert.equal(cancellationChecks, 1);
  assert.deepEqual(fixture.traceEvents.map((event) => event.type), [
    'permission_routed',
    'tool_started',
    'tool_finished',
  ]);
}

console.log('agent command execution runtime smoke ok');
