import assert from 'node:assert/strict';

import {
  runAgentVisualRefinementExecution,
  type AgentChatCommand,
  type AgentRuntimeTimingEntry,
  type AgentRuntimeTimingEntryStatus,
  type AgentRuntimeTimingStopReason,
  type AgentRuntimeTraceEventDraft,
} from '../src/agent/index.ts';

const refinementCommand: AgentChatCommand = {
  capabilityId: 'desktop-observation',
  instruction: 'Refine the current visual candidate.',
  kind: 'tool-call',
  sourceText: '/agent click Continue in Example App',
  toolCall: {
    goal: 'Click Continue in Example App.',
    input: {
      action: 'locate_element',
      question: 'Inspect the focused candidate area without clicking.',
      targetText: 'Continue',
    },
    name: 'locate_screen_elements',
  },
};

const unsafeCommand: AgentChatCommand = {
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
      id: `refinement:${stepIndex}`,
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

function createOptions(options: {
  command?: AgentChatCommand;
  stopReason?: AgentRuntimeTimingStopReason | null;
} = {}) {
  const traceEvents: AgentRuntimeTraceEventDraft[] = [];
  const timingTracker = createTimingTracker(options.stopReason ?? null);
  return {
    input: {
      appendTraceEvent: (event: AgentRuntimeTraceEventDraft) => traceEvents.push(event),
      command: options.command ?? refinementCommand,
      executeCommand: async () => ({ ok: true, responseText: 'Focused candidate evidence returned.' }),
      getTimingDetail: () => 'visual-refinement-runtime-smoke',
      isCancellationRequested: () => false,
      resolveTimingStatus: (): AgentRuntimeTimingEntryStatus => 'success',
      stepIndex: 5,
      timingTracker,
    },
    timingTracker,
    traceEvents,
  };
}

{
  const lifecycleKinds: string[] = [];
  const fixture = createOptions();
  const outcome = await runAgentVisualRefinementExecution({
    ...fixture.input,
    onCollected: ({ progressEvent }) => lifecycleKinds.push(progressEvent.taskTransition?.kind ?? ''),
    onStarted: ({ progressEvent }) => lifecycleKinds.push(progressEvent.taskTransition?.kind ?? ''),
  });

  assert.equal(outcome.kind, 'executed');
  assert.deepEqual(lifecycleKinds, ['target-resolution-started', 'target-resolution-collected']);
  assert.deepEqual(fixture.traceEvents.map((event) => event.type), [
    'permission_routed',
    'tool_started',
    'tool_finished',
  ]);
}

{
  let dispatchCount = 0;
  const fixture = createOptions({ stopReason: 'max-tool-calls' });
  const outcome = await runAgentVisualRefinementExecution({
    ...fixture.input,
    executeCommand: async () => {
      dispatchCount += 1;
      return { ok: true, responseText: 'unexpected dispatch' };
    },
  });

  assert.equal(outcome.kind, 'budget-exceeded');
  assert.equal(dispatchCount, 0);
  assert.equal(fixture.timingTracker.getMarkedStopReason(), 'max-tool-calls');
}

{
  let dispatchCount = 0;
  const fixture = createOptions({ command: unsafeCommand });
  const outcome = await runAgentVisualRefinementExecution({
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

console.log('agent visual refinement execution runtime smoke ok');
