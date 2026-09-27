import assert from 'node:assert/strict';
import {
  evaluateAgentSessionV3PilotShadowAgreement,
  runAgentProductionSession,
  type AgentSessionV2ModelCaller,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';
import {
  assertSourceDoesNotMatch,
  assertSourceMatches,
  readProjectSources,
} from './smokeTestHarness.ts';

const {
  agreement: agreementSource,
  session: sessionSource,
} = readProjectSources({
  agreement: 'src/agent/agentSessionV3PilotShadowAgreement.ts',
  session: 'src/agent/agentProductionSessionImplementation.ts',
});

assertSourceMatches(
  sessionSource,
  /modelDecisionTurn\.type === 'model-failed'[\s\S]*appendModelDecisionTurn\(modelDecisionTurn\)/u,
  'model-failed exits should be sampled into v3 shadow debug before returning.',
);
assertSourceMatches(
  sessionSource,
  /modelDecisionTurn\.type === 'cancelled-after-output'[\s\S]*appendModelDecisionTurn\(modelDecisionTurn\)/u,
  'cancelled-after-output exits should be sampled into v3 shadow debug before returning.',
);
assertSourceMatches(
  sessionSource,
  /appendCommandUnavailable\('Repeated rejected failed tool call loop guard prevented command preparation\.'\)/u,
  'repeated failed tool-call loop guards should expose command-unavailable evidence to the shadow mirror.',
);
assertSourceDoesNotMatch(
  agreementSource,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'shadow agreement sampling should not encode a fixed tool chain.',
);

const settings = {} as PetConfig['settings'];

const needsUserResult = await runAgentProductionSession({
  modelCaller: async () => JSON.stringify({
    action: 'ask_user',
    message: 'Need one detail before continuing.',
    reason: 'The requested target is ambiguous.',
  }),
  settings,
  sourceText: '/agent do the ambiguous thing',
  userGoal: 'do the ambiguous thing',
  v3PilotShadow: {
    enabled: true,
  },
});

const needsUserAgreement = evaluateAgentSessionV3PilotShadowAgreement(needsUserResult);
assert.equal(needsUserResult.status, 'needs-user');
assert.equal(needsUserAgreement.status, 'aligned');
assert.equal(needsUserAgreement.observed.runnerStatus, 'terminal');
assert.equal(needsUserAgreement.observed.terminalStatus, 'needs-user');

const modelFailedResult = await runAgentProductionSession({
  modelCaller: async () => {
    throw new Error('simulated model outage');
  },
  settings,
  sourceText: '/agent model failed path',
  userGoal: 'model failed path',
  v3PilotShadow: {
    enabled: true,
  },
});

const modelFailedAgreement = evaluateAgentSessionV3PilotShadowAgreement(modelFailedResult);
assert.equal(modelFailedResult.status, 'failed');
assert.equal(modelFailedAgreement.status, 'aligned');
assert.equal(modelFailedAgreement.observed.runnerStatus, 'terminal');
assert.equal(modelFailedAgreement.observed.terminalStatus, 'failed');
assert.equal(modelFailedAgreement.observed.phase, 'failed');

const cancelledController = new AbortController();
const cancelledAfterOutputResult = await runAgentProductionSession({
  cancellationSignal: cancelledController.signal,
  modelCaller: async () => {
    cancelledController.abort();
    return JSON.stringify({
      action: 'final_answer',
      message: 'This output should be cancelled before acceptance.',
    });
  },
  settings,
  sourceText: '/agent cancel after output',
  userGoal: 'cancel after output',
  v3PilotShadow: {
    enabled: true,
  },
});

const cancelledAgreement = evaluateAgentSessionV3PilotShadowAgreement(cancelledAfterOutputResult);
assert.equal(cancelledAfterOutputResult.status, 'cancelled');
assert.equal(cancelledAgreement.status, 'aligned');
assert.equal(cancelledAgreement.observed.runnerStatus, 'terminal');
assert.equal(cancelledAgreement.observed.terminalStatus, 'cancelled');

let repeatedFailureModelCalls = 0;
let repeatedFailureToolCalls = 0;
const repeatedFailureModelCaller: AgentSessionV2ModelCaller = async () => {
  repeatedFailureModelCalls += 1;
  return JSON.stringify({
    action: 'tool_call',
    args: {
      action: 'get_display_info',
    },
    reason: 'Need display evidence.',
    tool: 'execute_desktop_observation',
  });
};

const repeatedFailureResult = await runAgentProductionSession({
  maxSteps: 5,
  modelCaller: repeatedFailureModelCaller,
  settings,
  sourceText: '/agent repeated failed observation',
  toolExecutor: async () => {
    repeatedFailureToolCalls += 1;
    return {
      errorText: 'Display observation failed.',
      ok: false,
      responseText: 'Display observation failed.',
      verification: 'display-observation-failed',
    };
  },
  userGoal: 'repeated failed observation',
  v3PilotShadow: {
    enabled: true,
  },
});

const repeatedFailureAgreement = evaluateAgentSessionV3PilotShadowAgreement(repeatedFailureResult);
assert.equal(repeatedFailureResult.status, 'failed');
assert.equal(repeatedFailureModelCalls, 3);
assert.equal(repeatedFailureToolCalls, 1);
assert.equal(repeatedFailureAgreement.status, 'aligned');
assert.equal(repeatedFailureAgreement.observed.runnerStatus, 'terminal');
assert.equal(repeatedFailureAgreement.observed.terminalStatus, 'failed');

const toolBudgetResult = await runAgentProductionSession({
  maxToolCalls: 0,
  modelCaller: async () => JSON.stringify({
    action: 'tool_call',
    args: {
      action: 'get_display_info',
    },
    reason: 'Need one observation.',
    tool: 'execute_desktop_observation',
  }),
  settings,
  sourceText: '/agent budget-limited observation',
  toolExecutor: async () => {
    throw new Error('tool must not execute after tool budget is exhausted');
  },
  userGoal: 'budget-limited observation',
  v3PilotShadow: {
    enabled: true,
  },
});

const toolBudgetAgreement = evaluateAgentSessionV3PilotShadowAgreement(toolBudgetResult);
assert.equal(toolBudgetResult.status, 'budget-exceeded');
assert.equal(toolBudgetAgreement.status, 'inconclusive');
assert.deepEqual(toolBudgetAgreement.expectations, ['no-strict-terminal-mapping']);
assert.equal(toolBudgetAgreement.observed.shadowStatus, 'observed');

let maxStepsModelCalls = 0;
const maxStepsResult = await runAgentProductionSession({
  maxModelCalls: 4,
  maxSteps: 1,
  modelCaller: async () => {
    maxStepsModelCalls += 1;
    return JSON.stringify({
      action: 'tool_call',
      args: {
        action: 'get_display_info',
      },
      reason: 'Need one observation before answering.',
      tool: 'execute_desktop_observation',
    });
  },
  settings,
  sourceText: '/agent max steps observation',
  toolExecutor: async () => ({
    ok: true,
    responseText: 'Display observed.',
    verification: 'display-observed',
  }),
  userGoal: 'max steps observation',
  v3PilotShadow: {
    enabled: true,
  },
});

const maxStepsAgreement = evaluateAgentSessionV3PilotShadowAgreement(maxStepsResult);
assert.equal(maxStepsResult.status, 'max-steps');
assert.equal(maxStepsModelCalls, 1);
assert.equal(maxStepsAgreement.status, 'inconclusive');
assert.deepEqual(maxStepsAgreement.expectations, ['no-strict-terminal-mapping']);
assert.equal(maxStepsAgreement.observed.shadowStatus, 'observed');

console.log('agent session v2 v3 shadow agreement sampling smoke ok');
