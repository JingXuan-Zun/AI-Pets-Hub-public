import assert from 'node:assert/strict';
import {
  evaluateAgentSessionV3PilotShadowAgreement,
  runAgentProductionSession,
  runAgentSessionV3PilotShadowEventList,
  type AgentSessionV2ModelCaller,
  type AgentSessionV2Result,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';
import {
  assertSourceDoesNotMatch,
  assertSourceMatches,
  readProjectSources,
} from './smokeTestHarness.ts';

const {
  agreement: agreementSource,
  index: indexSource,
} = readProjectSources({
  agreement: 'src/agent/agentSessionV3PilotShadowAgreement.ts',
  index: 'src/agent/legacy/index.ts',
});

assertSourceMatches(
  agreementSource,
  /export function evaluateAgentSessionV3PilotShadowAgreement/u,
  'v2/v3 shadow agreement should live in its own module.',
);
assertSourceMatches(
  indexSource,
  /export \* from '\.\.\/agentSessionV3PilotShadowAgreement'/u,
  'v2/v3 shadow agreement should be exported through the agent barrel.',
);
assertSourceDoesNotMatch(
  agreementSource,
  /execute_desktop|observe_windows_and_apps|locate_screen_elements|buildAgentPermissionRoute|createAgentSessionV2ToolCommand|toolExecutor/u,
  'shadow agreement should not know concrete tools, permission routing, command creation, or execution.',
);
assertSourceDoesNotMatch(
  agreementSource,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'shadow agreement should not encode a fixed tool chain.',
);

const settings = {} as PetConfig['settings'];

const defaultOffResult = await runAgentProductionSession({
  modelCaller: async () => JSON.stringify({
    action: 'final_answer',
    message: 'shadow agreement unavailable',
  }),
  settings,
  sourceText: '/agent answer without shadow agreement',
  userGoal: 'answer without shadow agreement',
});

const defaultOffAgreement = evaluateAgentSessionV3PilotShadowAgreement(defaultOffResult);
assert.equal(defaultOffAgreement.status, 'unavailable');
assert.equal(defaultOffAgreement.v2Status, 'completed');
assert.equal(defaultOffAgreement.observed.shadowStatus, null);
assert.deepEqual(defaultOffAgreement.expectations, ['terminal:completed']);

const finalShadowResult = await runAgentProductionSession({
  modelCaller: async () => JSON.stringify({
    action: 'final_answer',
    message: 'shadow agreement final',
    reason: 'The answer is already known.',
  }),
  settings,
  sourceText: '/agent answer with shadow agreement',
  userGoal: 'answer with shadow agreement',
  v3PilotShadow: {
    enabled: true,
  },
});

const finalAgreement = evaluateAgentSessionV3PilotShadowAgreement(finalShadowResult);
assert.equal(finalAgreement.status, 'aligned');
assert.equal(finalAgreement.v2Status, 'completed');
assert.equal(finalAgreement.observed.runnerStatus, 'terminal');
assert.equal(finalAgreement.observed.terminalStatus, 'completed');
assert.equal(finalAgreement.observed.phase, 'done');

let toolModelCallCount = 0;
const toolModelCaller: AgentSessionV2ModelCaller = async ({ userInput }) => {
  toolModelCallCount += 1;
  if (toolModelCallCount === 1) {
    return JSON.stringify({
      action: 'tool_call',
      args: {
        includeActiveWindow: true,
        query: 'current window',
      },
      reason: 'Need current window evidence.',
      tool: 'observe_windows_and_apps',
    });
  }

  assert.match(userInput, /tool result/u);
  return JSON.stringify({
    action: 'final_answer',
    message: 'active window observed for agreement',
    reason: 'The observation is enough.',
    understanding: {
      completedGoals: ['read active window'],
      remainingGoals: [],
      successCriteria: 'active window evidence was observed',
      userNeed: 'read active window with shadow agreement',
      verificationEvidence: ['Active window observed.'],
      verificationGaps: [],
      verificationStatus: 'satisfied',
    },
  });
};

const toolShadowResult = await runAgentProductionSession({
  modelCaller: toolModelCaller,
  settings,
  sourceText: '/agent what is the active window with shadow agreement',
  toolExecutor: async () => ({
    ok: true,
    responseText: 'Active window result',
    verification: 'Active window observed.',
  }),
  userGoal: 'what is the active window with shadow agreement',
  v3PilotShadow: {
    enabled: true,
  },
});

const toolAgreement = evaluateAgentSessionV3PilotShadowAgreement(toolShadowResult);
assert.equal(toolAgreement.status, 'aligned');
assert.equal(toolAgreement.v2Status, 'completed');
assert.equal(toolAgreement.observed.runnerStatus, 'terminal');
assert.equal(toolAgreement.observed.terminalStatus, 'completed');

const approvalShadowResult = await runAgentProductionSession({
  modelCaller: async () => JSON.stringify({
    action: 'tool_call',
    args: {
      action: 'click',
      button: 'left',
      x: 120,
      y: 240,
    },
    reason: 'Clicking the requested target changes the desktop state.',
    tool: 'execute_desktop_input',
  }),
  settings,
  sourceText: '/agent click the requested target',
  toolExecutor: async () => {
    throw new Error('approval-required tool should not execute in this smoke');
  },
  userGoal: 'click the requested target',
  v3PilotShadow: {
    enabled: true,
  },
});

const approvalAgreement = evaluateAgentSessionV3PilotShadowAgreement(approvalShadowResult);
assert.equal(approvalShadowResult.status, 'needs-approval');
assert.equal(approvalAgreement.status, 'aligned');
assert.deepEqual(approvalAgreement.expectations, ['waiting:needs_approval', 'terminal:needs-user']);
assert.equal(approvalAgreement.observed.runnerStatus, 'waiting-for-event');
assert.equal(approvalAgreement.observed.phase, 'needs_approval');

const mismatchedResult: AgentSessionV2Result = {
  ...finalShadowResult,
  debug: {
    v3PilotShadow: runAgentSessionV3PilotShadowEventList({
      enabled: true,
      events: [
        {
          reason: 'begin mismatched replay',
          type: 'start',
        },
        {
          reason: 'simulated needs-user terminal',
          route: 'terminal',
          terminalStatus: 'needs-user',
          type: 'model-decision-accepted',
        },
      ],
    }),
  },
};

const mismatchAgreement = evaluateAgentSessionV3PilotShadowAgreement(mismatchedResult);
assert.equal(mismatchAgreement.status, 'mismatch');
assert.equal(mismatchAgreement.v2Status, 'completed');
assert.equal(mismatchAgreement.observed.terminalStatus, 'needs-user');

const maxStepsResult: AgentSessionV2Result = {
  ...finalShadowResult,
  status: 'max-steps',
};
const maxStepsAgreement = evaluateAgentSessionV3PilotShadowAgreement(maxStepsResult);
assert.equal(maxStepsAgreement.status, 'inconclusive');
assert.deepEqual(maxStepsAgreement.expectations, ['no-strict-terminal-mapping']);

console.log('agent session v2 v3 shadow agreement smoke ok');
