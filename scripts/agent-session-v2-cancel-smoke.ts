import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentSessionV2ModelCaller,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];

const preCancelledController = new AbortController();
preCancelledController.abort();

let preCancelledModelCalls = 0;
const preCancelledResult = await runAgentProductionSession({
  cancellationSignal: preCancelledController.signal,
  modelCaller: async () => {
    preCancelledModelCalls += 1;
    return JSON.stringify({
      action: 'final_answer',
      message: 'should not be called',
    });
  },
  settings,
  sourceText: '/agent cancel before start',
  toolExecutor: async () => {
    throw new Error('tool executor should not run after pre-cancel');
  },
  userGoal: 'cancel before start',
});

assert.equal(preCancelledResult.status, 'cancelled');
assert.equal(preCancelledModelCalls, 0);
assert.equal(preCancelledResult.toolResults.length, 0);

const midDecisionController = new AbortController();
let midDecisionToolCalls = 0;
const midDecisionModelCaller: AgentSessionV2ModelCaller = async ({ signal }) => {
  assert.equal(signal, midDecisionController.signal);
  midDecisionController.abort();
  return JSON.stringify({
    action: 'tool_call',
    args: {
      action: 'get_display_info',
    },
    reason: 'Model selected a read-only observation, but user cancelled before execution.',
    tool: 'execute_desktop_observation',
  });
};

const midDecisionResult = await runAgentProductionSession({
  cancellationSignal: midDecisionController.signal,
  modelCaller: midDecisionModelCaller,
  settings,
  sourceText: '/agent cancel after model decision',
  toolExecutor: async () => {
    midDecisionToolCalls += 1;
    throw new Error('tool executor should not run after model-decision cancel');
  },
  userGoal: 'cancel after model decision',
});

assert.equal(midDecisionResult.status, 'cancelled');
assert.equal(midDecisionToolCalls, 0);
assert.equal(midDecisionResult.toolResults.length, 0);

console.log('agent session v2 cancel smoke ok');
