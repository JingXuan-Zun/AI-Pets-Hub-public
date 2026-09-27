import assert from 'node:assert/strict';
import {
  createAgentSessionV3ExperimentalV2Adapters,
  runAgentSessionV3ExperimentalSession,
  type AgentChatCommand,
  type AgentSessionV2ToolResultEntry,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const { adapterSource, sessionSource, controllerSource } = readProjectSources({
  adapterSource: 'src/agent/agentSessionV3ExperimentalV2Adapters.ts',
  sessionSource: 'src/agent/agentSessionV3ExperimentalSession.ts',
  controllerSource: 'src/agent/agentSessionV3RuntimeController.ts',
});

assert.match(sessionSource, /initialState\?: AgentSessionV3PilotState/u);
assert.match(adapterSource, /approvedToolResult\?: AgentSessionV2ToolResultEntry/u);
assert.match(adapterSource, /state\.approvedToolResult/u);

const approvedCommand: AgentChatCommand = {
  instruction: 'approval resume smoke',
  kind: 'tool-call',
  sourceText: '/agent approval resume smoke',
  toolCall: {
    input: {
      action: 'click',
      x: 10,
      y: 20,
    },
    name: 'execute_desktop_input',
  },
};

const approvedToolResult: AgentSessionV2ToolResultEntry = {
  command: approvedCommand,
  result: {
    ok: true,
    responseText: 'Approved desktop action completed.',
    verification: 'Approved desktop action verified.',
  },
  timing: {
    detail: 'approved-tool-result',
    durationMs: 12,
    endedAt: 112,
    id: 'approved-tool-timing',
    kind: 'tool',
    label: 'execute_desktop_input',
    startedAt: 100,
    status: 'success',
    stepIndex: 4,
  },
};

let toolExecutorCalled = false;
const adapterResult = createAgentSessionV3ExperimentalV2Adapters({
  approvedToolResult,
  modelCaller: async () => {
    throw new Error('approval resume should not call model decision');
  },
  modelRequest: {
    settings: {},
    systemInstruction: 'system',
    userInput: 'user',
  },
  sourceText: '/agent approval resume smoke',
  toolExecutor: async () => {
    toolExecutorCalled = true;
    throw new Error('approval resume should not execute the approved command again');
  },
  userGoal: 'Resume approved action',
});

const result = await runAgentSessionV3ExperimentalSession({
  adapters: {
    ...adapterResult.adapters,
    evaluate: () => ({
      finalAnswer: 'approval resume completed',
      kind: 'launched',
      postActionState: 'launched',
      status: 'completed',
      stepAction: 'final_answer',
      stepReason: 'approved tool result was evaluated',
    }),
  },
  initialState: {
    lastEvent: 'approval-granted',
    phase: 'execute_transaction',
    recoveryCount: 0,
    revision: 3,
    terminal: null,
  },
});

assert.equal(result.status, 'completed');
assert.equal(result.finalAnswer, 'approved tool result was evaluated');
assert.equal(result.runtime.state.phase, 'done');
assert.equal(result.runtime.state.terminal?.status, 'completed');
assert.equal(toolExecutorCalled, false);
assert.equal(adapterResult.state.command, approvedCommand);
assert.equal(adapterResult.state.latestToolResult?.result.responseText, 'Approved desktop action completed.');
assert.deepEqual(
  result.runtime.transitions.map((transition) => transition.event.type),
  ['transaction-finished', 'evaluation-completed'],
);

const waitingResult = await runAgentSessionV3ExperimentalSession({
  adapters: adapterResult.adapters,
  initialState: {
    lastEvent: 'approval-granted',
    phase: 'execute_transaction',
    recoveryCount: 0,
    revision: 3,
    terminal: null,
  },
});
assert.equal(waitingResult.status, 'waiting');
assert.equal(waitingResult.runtime.state.phase, 'evaluate');
assert.equal(waitingResult.runtime.stopReason, 'waiting-for-phase-event');

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
  'approval resume must reuse narrow v2 modules, not call the full v2 session loop.',
);

console.log('agent session v3 experimental session approval resume smoke ok');
