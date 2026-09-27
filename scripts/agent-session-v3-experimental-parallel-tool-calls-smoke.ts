import assert from 'node:assert/strict';
import {
  runAgentSessionV3ExperimentalChatRunner,
  type AgentChatCommand,
  type AgentChatCommandResult,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const { adapterSource, runnerSource, agentSessionV2Source, runtimeAdaptersSource } =
  readProjectSources({
    adapterSource: 'src/agent/agentSessionV3ExperimentalV2Adapters.ts',
    runnerSource: 'src/agent/agentSessionV3ExperimentalChatRunner.ts',
    agentSessionV2Source: 'src/agent/agentProductionSessionImplementation.ts',
    runtimeAdaptersSource: 'src/agent/agentSessionV3RuntimeAdapters.ts',
  });

assert.match(adapterSource, /runAgentParallelToolTransaction/u);
assert.doesNotMatch(adapterSource, /runAgentSessionV2ParallelToolExecutionTransaction/u);
assert.match(adapterSource, /createAgentSessionV2ParallelToolExecutionPlan/u);
assert.match(adapterSource, /createAgentSessionV2CoveredParallelToolResult/u);
assert.match(adapterSource, /decision\.action === 'tool_calls'/u);
assert.match(adapterSource, /prepareAgentSessionV3ExperimentalV2SingleToolFromBatch/u);
assert.match(adapterSource, /Single tool_calls batch downgraded to a sequential tool_call/u);
assert.match(adapterSource, /kind: 'parallel-tool-transaction'/u);
assert.match(adapterSource, /isAgentPermissionRouteSilentReadOnly/u);
assert.match(runnerSource, /parallelToolResults/u);
assert.match(runtimeAdaptersSource, /kind: 'parallel-tool-transaction'/u);
assert.match(agentSessionV2Source, /export function createAgentSessionV2ParallelToolExecutionPlan/u);
assert.match(agentSessionV2Source, /export function createAgentSessionV2CoveredParallelToolResult/u);

const executedCommands: AgentChatCommand[] = [];
const result = await runAgentSessionV3ExperimentalChatRunner({
  modelCaller: async () => JSON.stringify({
    action: 'tool_calls',
    reason: 'Need two independent read-only observations.',
    tools: [
      {
        args: {
          action: 'get_cursor_position',
        },
        reason: 'Cursor position is independent.',
        tool: 'execute_desktop_observation',
      },
      {
        args: {
          action: 'get_display_info',
        },
        reason: 'Display info is independent.',
        tool: 'execute_desktop_observation',
      },
    ],
  }),
  settings: {},
  sourceText: '/agent v3 parallel smoke',
  toolExecutor: async (command): Promise<AgentChatCommandResult> => {
    executedCommands.push(command);
    return {
      ok: true,
      responseText: `Observed ${command.toolCall?.input?.action ?? command.toolCall?.name ?? command.kind}`,
      verification: 'parallel read-only observation verified',
    };
  },
  userGoal: 'Run two read-only observations',
});

assert.equal(result.status, 'needs-user');
assert.equal(result.pendingApproval, null);
assert.equal(result.toolResults.length, 2);
assert.equal(result.continuation.toolResults.length, 2);
assert.equal(executedCommands.length, 2);
assert.deepEqual(
  executedCommands.map((command) => command.toolCall?.input?.action),
  ['get_cursor_position', 'get_display_info'],
);
assert.equal(result.steps.some((step) => step.action === 'tool_calls'), true);
assert.equal(result.steps.filter((step) => step.action === 'tool_result').length, 2);
assert.equal(result.timing?.toolCallCount, 2);
assert.match(result.finalAnswer, /Switch back to v2 fallback|v2 fallback should continue the task/u);
assert.deepEqual(
  result.toolResults.map((entry) => entry.result.responseText),
  ['Observed get_cursor_position', 'Observed get_display_info'],
);

const singleBatchCommands: AgentChatCommand[] = [];
const singleBatchResult = await runAgentSessionV3ExperimentalChatRunner({
  modelCaller: async () => JSON.stringify({
    action: 'tool_calls',
    reason: 'Planner emitted one observation as a batch.',
    tools: [
      {
        args: {
          action: 'inspect_window_ui',
          query: 'Launcher',
          targetText: 'Example Game',
        },
        reason: 'Inspect one app window before choosing an internal target.',
        tool: 'execute_desktop_observation',
      },
    ],
  }),
  settings: {},
  sourceText: '/agent v3 single tool_calls downgrade smoke',
  toolExecutor: async (command): Promise<AgentChatCommandResult> => {
    singleBatchCommands.push(command);
    return {
      ok: true,
      responseText: 'Window UI observed.',
      verification: 'Single batched observation ran sequentially.',
    };
  },
  userGoal: 'Inspect app internal UI',
});

assert.equal(singleBatchResult.status, 'completed');
assert.equal(singleBatchResult.toolResults.length, 1);
assert.equal(singleBatchCommands.length, 1);
assert.equal(singleBatchCommands[0]?.toolCall?.name, 'execute_desktop_observation');
assert.equal(singleBatchCommands[0]?.toolCall?.input.action, 'inspect_window_ui');
assert.equal(singleBatchResult.steps.some((step) => step.action === 'tool_calls'), true);
assert.equal(singleBatchResult.steps.filter((step) => step.action === 'tool_result').length, 1);
assert.doesNotMatch(singleBatchResult.finalAnswer, /not silent read-only/u);
assert.equal(singleBatchResult.finalAnswer, 'The transaction receipt contains positive verification evidence.');

let blockedExecutorCalled = false;
const blocked = await runAgentSessionV3ExperimentalChatRunner({
  modelCaller: async () => JSON.stringify({
    action: 'tool_calls',
    reason: 'This batch mixes read-only and input actions.',
    tools: [
      {
        args: {
          action: 'get_cursor_position',
        },
        reason: 'read-only',
        tool: 'execute_desktop_observation',
      },
      {
        args: {
          action: 'click',
          x: 1,
          y: 2,
        },
        reason: 'not read-only',
        tool: 'execute_desktop_input',
      },
    ],
  }),
  settings: {},
  sourceText: '/agent v3 blocked parallel smoke',
  toolExecutor: async () => {
    blockedExecutorCalled = true;
    throw new Error('unsafe parallel batch should not execute');
  },
  userGoal: 'Reject unsafe parallel batch',
});

assert.equal(blocked.status, 'needs-user');
assert.equal(blocked.toolResults.length, 0);
assert.equal(blockedExecutorCalled, false);
assert.match(blocked.finalAnswer, /Agent v3 runtime could not safely prepare that command|not silent read-only/u);
assert.doesNotMatch(blocked.finalAnswer, /No experimental v3 adapter is configured for phase recover/u);

for (const [label, source] of [
  ['v3 v2 adapter', adapterSource],
  ['v3 chat runner', runnerSource],
] as const) {
  assert.doesNotMatch(
    source,
    /observe_windows_and_apps\s*->\s*locate_screen_elements|locate_screen_elements\s*->\s*execute_desktop|execute_desktop_sequence\s*->\s*observe_windows_and_apps/iu,
    `${label} must not encode a fixed desktop workflow.`,
  );
  assert.doesNotMatch(
    source,
    /implementationQueue|orderedSteps|requiredReportOrder|recoveryAction/u,
    `${label} must not define fixed tool queues, report order, or recovery actions.`,
  );
}

assert.doesNotMatch(
  adapterSource,
  /runAgentSessionV2\(/u,
  'v3 parallel support must reuse narrow v2 modules, not the full v2 session loop.',
);

console.log('agent session v3 experimental parallel tool_calls smoke ok');
