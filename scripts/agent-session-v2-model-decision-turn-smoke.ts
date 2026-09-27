import assert from 'node:assert/strict';
import {
  runAgentModelDecisionTurn,
  type AgentSessionV2Decision,
  type AgentSessionV2TimingEntry,
  type AgentSessionV2TimingEntryStatus,
} from '../src/agent/legacy/index.ts';
import {
  assertSourceDoesNotMatch,
  assertSourceMatches,
  readProjectSources,
} from './smokeTestHarness.ts';

const {
  index: indexSource,
  runtime: runtimeSource,
  session: sessionSource,
  turn: turnSource,
} = readProjectSources({
  index: 'src/agent/legacy/index.ts',
  runtime: 'src/agent/runtime/agentModelDecisionRuntime.ts',
  session: 'src/agent/agentProductionSessionImplementation.ts',
  turn: 'src/agent/runtime/agentModelDecisionRuntime.ts',
});

assertSourceMatches(
  runtimeSource,
  /export async function runAgentModelDecisionTurn/u,
  'Model Decision Runtime should own the model-call transaction.',
);
assertSourceMatches(
  sessionSource,
  /runAgentModelDecisionTurn<AgentSessionV2Decision>/u,
  'AgentSessionV2 should call Model Decision Runtime directly.',
);
assertSourceDoesNotMatch(
  runtimeSource,
  /buildAgentPermissionRoute|createAgentSessionV2ToolCommand|executeAgentSessionV2ToolCommandWithCache|createAgentSessionV2FinalResult|modelOutputRepairRuns\s*\+=|historyLines\.push/u,
  'Model decision turn should not own permission routing, command creation, tool execution, final result construction, repair accounting mutation, or history mutation.',
);
assertSourceDoesNotMatch(
  runtimeSource,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'Model decision turn should not encode a fixed tool chain.',
);

let timingId = 0;
function createTimingTracker() {
  return {
    beginEntry: (kind: 'model', label: string, stepIndex: number, detail?: string | null) => {
      timingId += 1;
      return {
        detail,
        id: `timing-${timingId}`,
        kind,
        label,
        startedAt: 100,
        status: 'running',
        stepIndex,
      } satisfies AgentSessionV2TimingEntry;
    },
    finishEntry: (
      entry: AgentSessionV2TimingEntry,
      status: AgentSessionV2TimingEntryStatus,
      detail?: string | null,
    ) => ({
      ...entry,
      detail,
      durationMs: 20,
      endedAt: 120,
      status,
    }),
  };
}

const acceptedDecision: AgentSessionV2Decision = {
  action: 'tool_call',
  args: {
    action: 'get_active_window_info',
  },
  reason: 'Need current window.',
  tool: 'execute_desktop_observation',
};

const accepted = await runAgentModelDecisionTurn({
  isCancellationRequested: () => false,
  modelCaller: async () => '{"action":"tool_call"}',
  modelRequest: {
    settings: {},
    systemInstruction: 'system',
    userInput: 'input',
  },
  parseDecision: () => acceptedDecision,
  repairRuns: 0,
  stepIndex: 2,
  timingTracker: createTimingTracker(),
});
assert.equal(accepted.type, 'accepted');
assert.equal(accepted.decision, acceptedDecision);
assert.equal(accepted.step.action, 'tool_call');
assert.equal(accepted.step.tool, 'execute_desktop_observation');
assert.equal(accepted.traceEvents.length, 2);
assert.equal(accepted.traceEvents[0]?.type, 'model_output');
assert.equal(accepted.traceEvents[1]?.type, 'decision_parsed');
assert.equal(accepted.traceEvents[1]?.action, 'tool_call');

const invalid = await runAgentModelDecisionTurn({
  isCancellationRequested: () => false,
  modelCaller: async () => 'not-json',
  modelRequest: {
    settings: {},
    systemInstruction: 'system',
    userInput: 'input',
  },
  parseDecision: () => null,
  repairRuns: 1,
  stepIndex: 3,
  timingTracker: createTimingTracker(),
});
assert.equal(invalid.type, 'invalid-output');
assert.equal(invalid.modelResponse, 'not-json');
assert.equal(invalid.traceEvents.length, 2);
assert.equal(invalid.traceEvents[1]?.status, 'invalid-json');
assert.equal(invalid.traceEvents[1]?.details?.repairRuns, 1);

const failed = await runAgentModelDecisionTurn({
  isCancellationRequested: () => false,
  modelCaller: async () => {
    throw new Error('model unavailable');
  },
  modelRequest: {
    settings: {},
    systemInstruction: 'system',
    userInput: 'input',
  },
  parseDecision: () => null,
  repairRuns: 0,
  stepIndex: 4,
  timingTracker: createTimingTracker(),
});
assert.equal(failed.type, 'model-failed');
assert.equal(failed.errorText, 'model unavailable');
assert.equal(failed.step.action, 'final_answer');
assert.equal(failed.traceEvents[0]?.status, 'failed');

const cancelled = await runAgentModelDecisionTurn({
  isCancellationRequested: () => true,
  modelCaller: async () => '{"action":"final_answer"}',
  modelRequest: {
    settings: {},
    systemInstruction: 'system',
    userInput: 'input',
  },
  parseDecision: () => ({
    action: 'final_answer',
    message: 'Done.',
    tool: null,
  }),
  repairRuns: 0,
  stepIndex: 5,
  timingTracker: createTimingTracker(),
});
assert.equal(cancelled.type, 'cancelled-after-output');
assert.equal(cancelled.traceEvents.length, 1);
assert.equal(cancelled.traceEvents[0]?.status, 'cancelled');

console.log('agent session v2 model decision turn smoke ok');
