import assert from 'node:assert/strict';
import {
  runAgentToolTransaction,
  type AgentChatCommand,
  type AgentChatCommandResult,
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
  commandExecution: commandExecutionSource,
  index: indexSource,
  legacyTransaction: legacyTransactionSource,
  recoveryExecution: recoveryExecutionSource,
  session: sessionSource,
  transaction: transactionSource,
  visualRefinementExecution: visualRefinementExecutionSource,
} = readProjectSources({
  commandExecution: 'src/agent/runtime/agentCommandExecutionRuntime.ts',
  index: 'src/agent/index.ts',
  legacyTransaction: 'src/agent/runtime/agentToolTransactionExecutor.ts',
  recoveryExecution: 'src/agent/runtime/agentRecoveryExecutionRuntime.ts',
  session: 'src/agent/agentProductionSessionImplementation.ts',
  transaction: 'src/agent/runtime/agentToolTransactionExecutor.ts',
  visualRefinementExecution: 'src/agent/runtime/agentVisualRefinementExecutionRuntime.ts',
});

assertSourceMatches(
  transactionSource,
  /export async function runAgentToolTransaction/u,
  'Tool execution transaction authority should live in the version-neutral Runtime module.',
);
assertSourceMatches(
  indexSource,
  /export \* from '\.\/runtime\/agentToolTransactionExecutor'/u,
  'Version-neutral tool execution transaction should be exported through the Agent barrel.',
);
assertSourceDoesNotMatch(
  sessionSource,
  /runAgentToolTransaction\(/u,
  'AgentSessionV2 should adapt Runtime execution outcomes instead of dispatching transactions directly.',
);
for (const [label, source] of [
  ['Command Execution Runtime', commandExecutionSource],
  ['Recovery Execution Runtime', recoveryExecutionSource],
  ['Visual Refinement Execution Runtime', visualRefinementExecutionSource],
]) {
  assertSourceMatches(
    source,
    /runAgentToolTransaction\(/u,
    `${label} should consume the version-neutral transaction module.`,
  );
}
assertSourceDoesNotMatch(
  transactionSource,
  /buildAgentPermissionRoute|createAgentSessionV2ToolCommand|createAgentSessionV2AutoRecoveryObservationCommand|resolveAgentSessionV2VisualActionApproval|createAgentSessionV2FinalResult/u,
  'Tool execution transaction should not own permission routing, command creation, recovery strategy, approval follow-up, or final result policy.',
);
assertSourceDoesNotMatch(
  transactionSource,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'Tool execution transaction should not encode a fixed tool chain.',
);

const command: AgentChatCommand = {
  capabilityId: 'desktop-control',
  instruction: 'transaction smoke',
  kind: 'tool-call',
  sourceText: '/agent transaction smoke',
  toolCall: {
    goal: 'transaction smoke',
    input: {
      action: 'get_cursor_position',
    },
    name: 'execute_desktop_observation',
  },
};

const traceEvents: AgentRuntimeTraceEventDraft[] = [];
const timingEntries: AgentSessionV2TimingEntry[] = [];
let executedCommand: AgentChatCommand | null = null;

const result: AgentChatCommandResult = {
  ok: true,
  responseText: 'Cursor at 10,20',
  verification: 'Observed cursor position',
};

const transaction = await runAgentToolTransaction({
  appendTraceEvent: (event) => {
    traceEvents.push(event);
  },
  command,
  executeCommand: async (selectedCommand) => {
    executedCommand = selectedCommand;
    return result;
  },
  getTimingDetail: (selectedCommand) => String(selectedCommand.toolCall?.input?.action ?? 'unknown'),
  resolveTimingStatus: (toolResult): AgentSessionV2TimingEntryStatus => (
    toolResult.ok === false ? 'failed' : 'success'
  ),
  source: 'transaction-smoke',
  stepIndex: 3,
  timingTracker: {
    beginEntry: (kind, label, stepIndex, detail) => {
      const entry: AgentSessionV2TimingEntry = {
        detail,
        id: 'timing-1',
        kind,
        label,
        startedAt: 100,
        status: 'running',
        stepIndex,
      };
      timingEntries.push(entry);
      return entry;
    },
    finishEntry: (entry, status, detail) => ({
      ...entry,
      detail,
      durationMs: 15,
      endedAt: 115,
      status,
    }),
  },
  traceAction: 'tool_call',
  traceDetails: {
    postActionState: 'unverified',
  },
});

assert.equal(executedCommand, command);
assert.equal(transaction.command, command);
assert.equal(transaction.result, result);
assert.equal(transaction.timing.status, 'success');
assert.equal(transaction.timing.label, 'execute_desktop_observation');
assert.equal(transaction.timing.detail, 'get_cursor_position');
assert.equal(transaction.outcome?.classification, 'unknown');
assert.equal(transaction.outcome?.effect, 'none');
assert.equal(transaction.outcome?.retryPolicy, 'safe');
assert.equal(timingEntries.length, 1);

assert.equal(traceEvents.length, 2);
assert.equal(traceEvents[0]?.type, 'tool_started');
assert.equal(traceEvents[0]?.action, 'tool_call');
assert.equal(traceEvents[0]?.tool, 'execute_desktop_observation');
assert.equal(traceEvents[0]?.details?.source, 'transaction-smoke');
assert.equal(traceEvents[0]?.details?.postActionState, 'unverified');
assert.equal(traceEvents[1]?.type, 'tool_finished');
assert.equal(traceEvents[1]?.status, 'success');
assert.equal(traceEvents[1]?.details?.source, 'transaction-smoke');
assert.equal(traceEvents[1]?.details?.postActionState, 'unverified');
assert.equal(traceEvents[1]?.details?.responseText, 'Cursor at 10,20');
assert.equal(traceEvents[1]?.details?.durationMs, 15);
assert.equal(traceEvents[1]?.details?.timingDetail, 'get_cursor_position');
assert.equal(traceEvents[1]?.details?.timingStatus, 'success');
assert.equal(traceEvents[1]?.details?.cacheHit, false);
assert.equal(traceEvents[1]?.details?.outcomeClass, transaction.outcome?.classification);
assert.equal(traceEvents[1]?.details?.retryPolicy, 'safe');

const sideEffectCommand: AgentChatCommand = {
  ...command,
  toolCall: { input: { action: 'click' }, name: 'execute_desktop_action' },
};
const sideEffectTransaction = await runAgentToolTransaction({
  appendTraceEvent: () => undefined,
  command: sideEffectCommand,
  executeCommand: async () => ({ ok: true, responseText: 'Sent input' }),
  getTimingDetail: () => 'click',
  resolveTimingStatus: () => 'success',
  stepIndex: 5,
  timingTracker: {
    beginEntry: () => ({ id: 'timing-side-effect', kind: 'tool', label: 'action', startedAt: 1, status: 'running', stepIndex: 5 }),
    finishEntry: (entry, status) => ({ ...entry, status }),
  },
});
assert.equal(sideEffectTransaction.outcome?.classification, 'failure');
assert.equal(sideEffectTransaction.outcome?.uncertainEffects, true);
assert.equal(sideEffectTransaction.outcome?.retryPolicy, 'halt');

const blockedTransaction = await runAgentToolTransaction({
  appendTraceEvent: () => undefined,
  command: sideEffectCommand,
  executeCommand: async () => ({
    ok: false,
    receipt: { status: 'blocked', summaryLines: [], title: 'Blocked' },
    responseText: '',
  }),
  getTimingDetail: () => 'blocked',
  resolveTimingStatus: () => 'failed',
  stepIndex: 6,
  timingTracker: {
    beginEntry: () => ({ id: 'timing-blocked', kind: 'tool', label: 'action', startedAt: 1, status: 'running', stepIndex: 6 }),
    finishEntry: (entry, status) => ({ ...entry, status }),
  },
});
assert.equal(blockedTransaction.outcome?.execution, 'blocked');
assert.equal(blockedTransaction.outcome?.classification, 'failure');

const thrownTraceEvents: AgentRuntimeTraceEventDraft[] = [];
const thrownTransaction = await runAgentToolTransaction({
  appendTraceEvent: (event) => thrownTraceEvents.push(event),
  command,
  executeCommand: async () => {
    throw new Error('tool backend exploded');
  },
  getTimingDetail: () => 'throwing-tool',
  resolveTimingStatus: (toolResult): AgentSessionV2TimingEntryStatus => (
    toolResult.ok === false ? 'failed' : 'success'
  ),
  source: 'transaction-throw-smoke',
  stepIndex: 4,
  timingTracker: {
    beginEntry: () => ({
      detail: 'throwing-tool',
      id: 'timing-throw',
      kind: 'tool',
      label: 'execute_desktop_observation',
      startedAt: 200,
      status: 'running',
      stepIndex: 4,
    }),
    finishEntry: (entry, status, detail) => ({ ...entry, detail, status }),
  },
  traceAction: 'tool_call',
});
assert.equal(thrownTransaction.result.ok, false);
assert.equal(thrownTransaction.result.errorText, 'tool backend exploded');
assert.equal(thrownTransaction.timing.status, 'failed');
assert.equal(thrownTraceEvents.at(-1)?.type, 'tool_finished');
assert.equal(thrownTraceEvents.at(-1)?.status, 'failed');
assert.equal(thrownTransaction.outcome?.retryPolicy, 'safe');

console.log('agent session v2 tool execution transaction smoke ok');
