import assert from 'node:assert/strict';
import {
  createAgentSessionV3ExperimentalV2Adapters,
  runAgentSessionV3ExperimentalSession,
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentSessionV2ModelRequest,
  type AgentRuntimeTraceEventDraft,
} from '../src/agent/legacy/index.ts';
import { readProjectFile } from './smokeTestHarness.ts';

const adapterSource = readProjectFile('src/agent/agentSessionV3ExperimentalV2Adapters.ts');
const sessionSource = readProjectFile('src/agent/agentSessionV3ExperimentalSession.ts');
const controllerSource = readProjectFile('src/agent/agentSessionV3RuntimeController.ts');
const indexSource = readProjectFile('src/agent/legacy/index.ts');

assert.match(adapterSource, /export function createAgentSessionV3ExperimentalV2Adapters/u);
assert.match(adapterSource, /runAgentSessionV2ModelDecisionTurn/u);
assert.match(adapterSource, /runAgentToolTransaction/u);
assert.doesNotMatch(adapterSource, /runAgentSessionV2ToolExecutionTransaction/u);
assert.match(adapterSource, /buildAgentPermissionRoute/u);
assert.match(indexSource, /export \* from '\.\.\/agentSessionV3ExperimentalV2Adapters';/u);

const baseModelRequest: AgentSessionV2ModelRequest = {
  settings: {},
  systemInstruction: 'system',
  userInput: 'user',
};

const traceEvents: AgentRuntimeTraceEventDraft[] = [];
const executedCommands: AgentChatCommand[] = [];
const adapterResult = createAgentSessionV3ExperimentalV2Adapters({
  appendTraceEvent: (event) => {
    traceEvents.push(event);
  },
  modelCaller: async () => JSON.stringify({
    action: 'tool_call',
    args: {
      action: 'get_cursor_position',
    },
    reason: 'Need cursor position through v3 experimental v2 adapter.',
    tool: 'execute_desktop_observation',
  }),
  modelRequest: baseModelRequest,
  sourceText: '/agent v3 adapter smoke',
  toolExecutor: async (command): Promise<AgentChatCommandResult> => {
    executedCommands.push(command);
    return {
      ok: true,
      responseText: `Executed ${command.toolCall?.name ?? command.kind}.`,
      verification: 'v3 experimental v2 adapter execution verified.',
    };
  },
  userGoal: 'Run v3 adapter smoke',
});

const result = await runAgentSessionV3ExperimentalSession({
  adapters: {
    ...adapterResult.adapters,
    evaluate: () => ({
      finalAnswer: 'v3 experimental v2 adapter completed.',
      kind: 'launched',
      postActionState: 'launched',
      status: 'completed',
      stepAction: 'final_answer',
      stepReason: 'v3 experimental v2 adapter evaluation completed.',
    }),
  },
});

assert.equal(result.status, 'completed');
assert.equal(result.runtime.state.phase, 'done');
assert.equal(result.runtime.state.terminal?.status, 'completed');
assert.equal(adapterResult.state.decision?.action, 'tool_call');
assert.equal(adapterResult.state.command, null);
assert.equal(adapterResult.state.latestToolResult?.command.toolCall?.name, 'execute_desktop_observation');
assert.equal(adapterResult.state.latestToolResult?.command.toolCall?.input.action, 'get_cursor_position');
assert.equal(executedCommands.length, 1);
assert.equal(executedCommands[0], adapterResult.state.latestToolResult?.command);
assert.deepEqual(
  result.runtime.transitions.map((transition) => transition.event.type),
  [
    'start',
    'model-decision-accepted',
    'command-prepared',
    'transaction-finished',
    'evaluation-completed',
  ],
);
assert.equal(traceEvents.some((event) => event.type === 'model_output'), true);
assert.equal(traceEvents.some((event) => event.type === 'tool_started'), true);
assert.equal(traceEvents.some((event) => event.type === 'tool_finished'), true);

const approvalAdapter = createAgentSessionV3ExperimentalV2Adapters({
  modelCaller: async () => JSON.stringify({
    action: 'tool_call',
    args: {
      action: 'click',
      x: 10,
      y: 20,
    },
    reason: 'Need approval before desktop input.',
    tool: 'execute_desktop_input',
  }),
  modelRequest: baseModelRequest,
  sourceText: '/agent v3 approval adapter smoke',
  toolExecutor: async () => {
    throw new Error('approval route should not execute before approval adapter exists');
  },
  userGoal: 'Click something',
});
const approvalResult = await runAgentSessionV3ExperimentalSession({
  adapters: approvalAdapter.adapters,
});
assert.equal(approvalResult.status, 'needs-approval');
assert.equal(approvalResult.runtime.state.phase, 'needs_approval');
assert.equal(approvalResult.runtime.stopReason, 'waiting-for-phase-event');
assert.equal(approvalAdapter.state.command?.toolCall?.name, 'execute_desktop_input');

const invalidToolAdapter = createAgentSessionV3ExperimentalV2Adapters({
  modelCaller: async () => JSON.stringify({
    action: 'tool_call',
    args: {},
    reason: 'invalid tool',
    tool: 'missing_tool',
  }),
  modelRequest: baseModelRequest,
  sourceText: '/agent v3 invalid tool adapter smoke',
  userGoal: 'Use invalid tool',
});
const invalidToolResult = await runAgentSessionV3ExperimentalSession({
  adapters: invalidToolAdapter.adapters,
  maxTransitions: 4,
});
assert.equal(invalidToolResult.runtime.transitions.some((transition) => transition.event.type === 'command-unavailable'), true);
assert.equal(invalidToolResult.runtime.state.phase, 'recover');
assert.equal(invalidToolResult.status, 'waiting');
assert.match(invalidToolResult.finalAnswer, /No experimental v3 adapter is configured for phase recover/u);

for (const [label, source] of [
  ['v2 adapter wiring', adapterSource],
  ['experimental session', sessionSource],
  ['runtime controller', controllerSource],
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
  'v2 adapter wiring must reuse narrow v2 modules, not call the full v2 session loop.',
);

console.log('agent session v3 experimental session v2 adapter wiring smoke ok');
