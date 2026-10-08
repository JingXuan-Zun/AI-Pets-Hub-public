import assert from 'node:assert/strict';
import {
  runAgentDeferredToolTransactions,
  runAgentParallelToolTransaction,
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentSessionV2ParallelToolExecutionPlan,
  type AgentSessionV2TimingEntry,
  type AgentSessionV2TimingEntryStatus,
  type AgentRuntimeTraceEventDraft,
} from '../src/agent/legacy/index.ts';
import {
  assertSourceDoesNotMatch,
  assertSourceMatches,
  readProjectSources,
} from './smokeTestHarness.ts';

const {
  index: indexSource,
  legacyTransaction: legacyTransactionSource,
  session: sessionEntrySource,
  parallelExecution: sessionSource,
  transaction: transactionSource,
} = readProjectSources({
  index: 'src/agent/index.ts',
  legacyTransaction: 'src/agent/runtime/agentParallelToolTransactionExecutor.ts',
  session: 'src/agent/agentProductionSessionImplementation.ts',
  parallelExecution: 'src/agent/productionSession/parallelExecution.ts',
  transaction: 'src/agent/runtime/agentParallelToolTransactionExecutor.ts',
});

assertSourceMatches(sessionEntrySource, /from '\.\/productionSession\/parallelExecution'/u);
assertSourceMatches(sessionEntrySource, /createAgentProductionParallelExecution\(\{/u);
assertSourceMatches(sessionEntrySource, /await executeParallelBatch\(\{/u);

assertSourceMatches(
  transactionSource,
  /export async function runAgentParallelToolTransaction/u,
  'Parallel transaction authority should live in the version-neutral Runtime module.',
);
assertSourceMatches(
  indexSource,
  /export \* from '\.\/runtime\/agentParallelToolTransactionExecutor'/u,
  'Version-neutral parallel transaction should be exported through the Agent barrel.',
);
assertSourceMatches(
  sessionSource,
  /runAgentParallelToolTransaction/u,
  'AgentSessionV2 should consume the version-neutral parallel transaction module.',
);
assertSourceDoesNotMatch(
  transactionSource,
  /buildAgentPermissionRoute|createAgentSessionV2ToolCommand|prepareAgentSessionV2DecisionToolInput|createAgentSessionV2UnavailableToolRepairText|resolveAgentSessionV2VisualActionApproval|createAgentSessionV2FinalResult/u,
  'Parallel transaction should not own permission routing, command creation, schema validation, repair policy, approval follow-up, or final result policy.',
);
assertSourceDoesNotMatch(
  transactionSource,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'Parallel transaction should not encode a fixed tool chain.',
);

function createCommand(name: string, input: Record<string, unknown>): AgentChatCommand {
  return {
    capabilityId: 'desktop-control',
    instruction: 'parallel transaction smoke',
    kind: 'tool-call',
    sourceText: '/agent parallel transaction smoke',
    toolCall: {
      goal: 'parallel transaction smoke',
      input,
      name,
    },
  };
}

const observeCommand = createCommand('observe_windows_and_apps', {
  includeActiveWindow: true,
});
const coveredCommand = createCommand('execute_desktop_observation', {
  action: 'get_active_window_info',
});
const independentCommand = createCommand('execute_desktop_observation', {
  action: 'get_cursor_position',
});

const plan: AgentSessionV2ParallelToolExecutionPlan = {
  coveredCommands: [{
    command: coveredCommand,
    coveredByCommand: observeCommand,
    reason: 'active window is already included in observe_windows_and_apps for this batch',
  }],
  runCommands: [
    observeCommand,
    independentCommand,
  ],
};

const traceEvents: AgentRuntimeTraceEventDraft[] = [];
const executedTools: string[] = [];
let timingId = 0;

const resultByTool = new Map<AgentChatCommand, AgentChatCommandResult>([
  [observeCommand, {
    ok: true,
    observations: ['active window: editor'],
    responseText: 'Observed windows and apps',
    verification: 'Observed active window',
  }],
  [independentCommand, {
    ok: true,
    responseText: 'Cursor at 10,20',
    verification: 'Observed cursor position',
  }],
]);

const transaction = await runAgentParallelToolTransaction({
  appendTraceEvent: (event) => {
    traceEvents.push(event);
  },
  createCoveredResult: ({ command, coveringResult, reason }) => ({
    ok: true,
    observations: [
      `covered: ${reason}`,
      ...(coveringResult.observations ?? []),
    ],
    responseText: `Skipped duplicate read-only observation; ${reason}.`,
    verification: `Covered ${command.toolCall?.name ?? command.kind}`,
  }),
  executeCommand: async (command) => {
    executedTools.push(command.toolCall?.name ?? command.kind);
    const result = resultByTool.get(command);
    assert.ok(result, 'Only runCommands should be executed when coverage succeeds.');
    return result;
  },
  getTimingDetail: (command) => String(command.toolCall?.input?.action ?? command.toolCall?.name ?? command.kind),
  plan,
  resolveTimingStatus: (result): AgentSessionV2TimingEntryStatus => (
    result.ok === false ? 'failed' : 'success'
  ),
  stepIndex: 4,
  timingTracker: {
    beginEntry: (kind, label, stepIndex, detail) => {
      timingId += 1;
      return {
        detail,
        id: `timing-${timingId}`,
        kind,
        label,
        startedAt: 100 + timingId,
        status: 'running',
        stepIndex,
      } satisfies AgentSessionV2TimingEntry;
    },
    finishEntry: (entry, status, detail) => ({
      ...entry,
      detail,
      durationMs: 12,
      endedAt: Number(entry.startedAt) + 12,
      status,
    }),
  },
  traceAction: 'tool_calls',
});

assert.deepEqual(executedTools, [
  'observe_windows_and_apps',
  'execute_desktop_observation',
]);
assert.equal(transaction.runResults.length, 2);
assert.equal(transaction.coveredResults.length, 1);
assert.equal(transaction.allResults.length, 3);
assert.equal(transaction.coveredResults[0]?.command, coveredCommand);
assert.equal(transaction.coveredResults[0]?.timing.status, 'deduped');
assert.equal(transaction.coveredResults[0]?.result.responseText, 'Skipped duplicate read-only observation; active window is already included in observe_windows_and_apps for this batch.');

const startedEvents = traceEvents.filter((event) => event.type === 'tool_started');
const finishedEvents = traceEvents.filter((event) => event.type === 'tool_finished');
assert.equal(startedEvents.length, 2);
assert.equal(finishedEvents.length, 3);
assert.ok(
  startedEvents.every((event) => event.action === 'tool_calls'),
  'Started trace events should preserve the model decision action.',
);
assert.ok(
  finishedEvents.filter((event) => event.status === 'success').length === 2,
  'Finished trace events should reflect successful run command execution.',
);
const dedupedTrace = finishedEvents.find((event) => event.status === 'deduped');
assert.equal(dedupedTrace?.tool, 'execute_desktop_observation');
assert.equal(dedupedTrace?.details?.coveredByTool, 'observe_windows_and_apps');
assert.equal(dedupedTrace?.details?.timingStatus, 'deduped');
assert.equal(dedupedTrace?.details?.timingDetail, 'active window is already included in observe_windows_and_apps for this batch');

const failedCoveringExecuted: string[] = [];
const failedCoveringTransaction = await runAgentParallelToolTransaction({
  appendTraceEvent: () => undefined,
  createCoveredResult: () => ({ ok: true, responseText: 'incorrectly deduped' }),
  executeCommand: async (command) => {
    failedCoveringExecuted.push(command.toolCall?.name ?? command.kind);
    return {
      ok: true,
      receipt: { status: 'failed' },
      responseText: '',
    };
  },
  getTimingDetail: () => 'failed-covering',
  plan: {
    coveredCommands: [{
      command: coveredCommand,
      coveredByCommand: observeCommand,
      reason: 'covering command failed',
    }],
    runCommands: [observeCommand],
  },
  resolveTimingStatus: () => 'failed',
  stepIndex: 5,
  timingTracker: {
    beginEntry: () => ({
      detail: 'failed-covering',
      id: 'timing-failed-covering',
      kind: 'tool',
      label: 'execute_desktop_observation',
      startedAt: 300,
      status: 'running',
      stepIndex: 5,
    }),
    finishEntry: (entry, status, detail) => ({ ...entry, detail, status }),
  },
  traceAction: 'tool_calls',
});
assert.deepEqual(failedCoveringExecuted, [
  'observe_windows_and_apps',
  'execute_desktop_observation',
]);
assert.equal(failedCoveringTransaction.coveredResults[0]?.result.receipt?.status, 'failed');

const deferredExecution: string[] = [];
const deferredResults = await runAgentDeferredToolTransactions({
  appendTraceEvent: () => undefined,
  commands: [coveredCommand, independentCommand],
  executeCommand: async (command) => {
    deferredExecution.push(command.toolCall?.name ?? command.kind);
    return { ok: true, responseText: 'deferred result' };
  },
  getTimingDetail: () => 'deferred',
  resolveTimingStatus: () => 'success',
  stepIndex: 6,
  timingTracker: {
    beginEntry: (kind, label, stepIndex, detail) => ({
      detail,
      id: `timing-deferred-${label}`,
      kind,
      label,
      startedAt: 500,
      status: 'running',
      stepIndex,
    }),
    finishEntry: (entry, status, detail) => ({ ...entry, detail, status }),
  },
  traceAction: 'tool_calls',
});
assert.deepEqual(deferredExecution, [
  'execute_desktop_observation',
  'execute_desktop_observation',
]);
assert.equal(deferredResults.length, 2);

console.log('agent session v2 parallel tool execution transaction smoke ok');
