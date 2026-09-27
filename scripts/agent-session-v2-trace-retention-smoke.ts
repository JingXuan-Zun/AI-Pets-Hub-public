import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentSessionV2ModelCaller,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];
let modelCalls = 0;
let toolCalls = 0;

const modelCaller: AgentSessionV2ModelCaller = async ({ userInput }) => {
  modelCalls += 1;

  if (modelCalls <= 25) {
    return JSON.stringify({
      action: 'tool_call',
      args: {
        includeActiveWindow: true,
        limit: 1,
        query: `Trace retention ${modelCalls}`,
      },
      reason: `Create trace retention event set ${modelCalls}.`,
      tool: 'observe_windows_and_apps',
      understanding: {
        remainingGoals: ['collect retention trace events'],
        successCriteria: 'trace retention compacts old events',
        userNeed: 'exercise long trace retention',
        verificationStatus: 'unknown',
      },
    });
  }

  assert.match(userInput, /Current user goal: exercise long trace retention/u);
  return JSON.stringify({
    action: 'final_answer',
    message: 'trace retention exercised',
    understanding: {
      completedGoals: ['collect retention trace events'],
      remainingGoals: [],
      successCriteria: 'trace retention compacts old events',
      userNeed: 'exercise long trace retention',
      verificationEvidence: ['many observation tool calls completed'],
      verificationGaps: [],
      verificationStatus: 'satisfied',
    },
  });
};

const result = await runAgentProductionSession({
  maxModelCalls: 30,
  maxSteps: 30,
  maxToolCalls: 30,
  modelCaller,
  settings,
  sourceText: '/agent exercise long trace retention',
  toolExecutor: async (command) => {
    toolCalls += 1;
    return {
      observations: [`Observed ${command.toolCall?.input.query ?? 'trace retention'}`],
      ok: true,
      responseText: `Observed ${command.toolCall?.input.query ?? 'trace retention'}`,
      verification: 'Observation completed.',
    };
  },
  userGoal: 'exercise long trace retention',
});

assert.equal(result.status, 'completed');
assert.equal(modelCalls, 26);
assert.equal(toolCalls, 25);
assert.ok(result.traceEvents.length <= 80, `traceEvents should be compacted, got ${result.traceEvents.length}`);
assert.equal(result.traceEvents[0]?.type, 'trace_compacted');
assert.equal(result.continuation.traceEvents[0]?.type, 'trace_compacted');
assert.equal(result.traceEvents.length, result.continuation.traceEvents.length);
assert.ok(
  Number(result.traceEvents[0]?.details?.compactedEventCount ?? 0) > 0,
  'compacted trace event should record compactedEventCount',
);
assert.match(String(result.traceEvents[0]?.details?.typeCounts ?? ''), /model_output/u);

const traceIds = result.traceEvents.map((event) => event.id);
assert.equal(new Set(traceIds).size, traceIds.length, 'trace event ids should remain unique after compaction');
assert.ok(result.traceEvents.some((event) => event.type === 'final_answer'));

console.log('agent session v2 trace retention smoke ok');
