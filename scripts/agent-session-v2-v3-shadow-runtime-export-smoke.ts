import assert from 'node:assert/strict';
import {
  createAgentSessionV3PilotShadowAgreementReportExport,
  createAgentSessionV3PilotShadowAgreementReportFromResults,
  runAgentProductionSession,
  stringifyAgentSessionV3PilotShadowAgreementReportExport,
  type AgentSessionV2ModelCaller,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const {
  agreement: agreementSource,
  session: sessionSource,
} = readProjectSources({
  agreement: 'src/agent/agentSessionV3PilotShadowAgreement.ts',
  session: 'src/agent/agentProductionSessionImplementation.ts',
});

assert.match(
  agreementSource,
  /export function createAgentSessionV3PilotShadowAgreementReportFromResults/u,
  'runtime sample reporting should be built from already completed v2 results.',
);
assert.doesNotMatch(
  agreementSource,
  /execute_desktop|observe_windows_and_apps|locate_screen_elements|buildAgentPermissionRoute|createAgentSessionV2ToolCommand|toolExecutor/u,
  'runtime sample reporting should not know concrete tools, permission routing, command creation, or execution.',
);
assert.doesNotMatch(
  agreementSource,
  /from 'node:fs'|writeFile|appendFile|createWriteStream|mkdir/u,
  'runtime sample reporting should not write logs directly.',
);
assert.doesNotMatch(
  sessionSource,
  /historyLines\.push\([^)]*v3PilotShadow|createAgentSessionV2ModelInput\([^)]*v3PilotShadow/isu,
  'v3 pilot shadow output should stay out of history and model input.',
);

const settings = {} as PetConfig['settings'];

const defaultOffResult = await runAgentProductionSession({
  modelCaller: async () => JSON.stringify({
    action: 'final_answer',
    message: 'shadow runtime export default off',
  }),
  settings,
  sourceText: '/agent runtime export default off',
  userGoal: 'runtime export default off',
});

const finalResult = await runAgentProductionSession({
  modelCaller: async () => JSON.stringify({
    action: 'final_answer',
    message: 'shadow runtime export final',
    reason: 'The answer is already known.',
  }),
  settings,
  sourceText: '/agent runtime export final',
  userGoal: 'runtime export final',
  v3PilotShadow: {
    enabled: true,
  },
});

let toolModelCalls = 0;
const toolModelInputs: string[] = [];
const toolModelCaller: AgentSessionV2ModelCaller = async ({ userInput }) => {
  toolModelCalls += 1;
  toolModelInputs.push(userInput);

  if (toolModelCalls === 1) {
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
  assert.doesNotMatch(userInput, /AgentSessionV3Pilot|v3PilotShadow/u);
  return JSON.stringify({
    action: 'final_answer',
    message: 'runtime export observed active window',
    reason: 'The observation is enough.',
    understanding: {
      completedGoals: ['read active window'],
      remainingGoals: [],
      successCriteria: 'active window evidence was observed',
      userNeed: 'read active window for runtime export',
      verificationEvidence: ['Active window observed.'],
      verificationGaps: [],
      verificationStatus: 'satisfied',
    },
  });
};

const toolResult = await runAgentProductionSession({
  modelCaller: toolModelCaller,
  settings,
  sourceText: '/agent what is the current active window',
  toolExecutor: async () => ({
    ok: true,
    responseText: 'Active window result',
    verification: 'Active window observed.',
  }),
  userGoal: 'what is the current active window',
  v3PilotShadow: {
    enabled: true,
  },
});

const approvalResult = await runAgentProductionSession({
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
  sourceText: '/agent runtime export click requested target',
  toolExecutor: async () => {
    throw new Error('approval-required tool should not execute in this smoke');
  },
  userGoal: 'runtime export click requested target',
  v3PilotShadow: {
    enabled: true,
  },
});

const needsUserResult = await runAgentProductionSession({
  modelCaller: async () => JSON.stringify({
    action: 'ask_user',
    message: 'Need one detail before continuing.',
    reason: 'The requested target is ambiguous.',
  }),
  settings,
  sourceText: '/agent runtime export ambiguous task',
  userGoal: 'runtime export ambiguous task',
  v3PilotShadow: {
    enabled: true,
  },
});

const modelFailedResult = await runAgentProductionSession({
  modelCaller: async () => {
    throw new Error('simulated model outage');
  },
  settings,
  sourceText: '/agent runtime export model failed path',
  userGoal: 'runtime export model failed path',
  v3PilotShadow: {
    enabled: true,
  },
});

const cancelledController = new AbortController();
const cancelledResult = await runAgentProductionSession({
  cancellationSignal: cancelledController.signal,
  modelCaller: async () => {
    cancelledController.abort();
    return JSON.stringify({
      action: 'final_answer',
      message: 'This output should be cancelled before acceptance.',
    });
  },
  settings,
  sourceText: '/agent runtime export cancel after output',
  userGoal: 'runtime export cancel after output',
  v3PilotShadow: {
    enabled: true,
  },
});

const budgetResult = await runAgentProductionSession({
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
  sourceText: '/agent runtime export budget limited observation',
  toolExecutor: async () => {
    throw new Error('tool must not execute after tool budget is exhausted');
  },
  userGoal: 'runtime export budget limited observation',
  v3PilotShadow: {
    enabled: true,
  },
});

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
  sourceText: '/agent runtime export max steps observation',
  toolExecutor: async () => ({
    ok: true,
    responseText: 'Display observed.',
    verification: 'display-observed',
  }),
  userGoal: 'runtime export max steps observation',
  v3PilotShadow: {
    enabled: true,
  },
});

assert.equal(toolModelInputs.some((input) => /AgentSessionV3Pilot|v3PilotShadow/u.test(input)), false);
assert.equal(maxStepsModelCalls, 1);

const report = createAgentSessionV3PilotShadowAgreementReportFromResults([
  {
    label: 'default-off completed',
    result: defaultOffResult,
  },
  {
    label: 'shadow final completed',
    result: finalResult,
  },
  {
    label: 'shadow tool completed',
    result: toolResult,
  },
  {
    label: 'shadow approval required',
    result: approvalResult,
  },
  {
    label: 'shadow needs user',
    result: needsUserResult,
  },
  {
    label: 'shadow model failed',
    result: modelFailedResult,
  },
  {
    label: 'shadow cancelled',
    result: cancelledResult,
  },
  {
    label: 'shadow budget exceeded',
    result: budgetResult,
  },
  {
    label: 'shadow max steps',
    result: maxStepsResult,
  },
]);

assert.equal(report.sampleCount, 9);
assert.equal(report.counts.aligned, 6);
assert.equal(report.counts.inconclusive, 2);
assert.equal(report.counts.mismatch, 0);
assert.equal(report.counts.unavailable, 1);
assert.equal(report.v2StatusCounts.completed, 3);
assert.equal(report.v2StatusCounts['needs-approval'], 1);
assert.equal(report.v2StatusCounts['needs-user'], 1);
assert.equal(report.v2StatusCounts.failed, 1);
assert.equal(report.v2StatusCounts.cancelled, 1);
assert.equal(report.v2StatusCounts['budget-exceeded'], 1);
assert.equal(report.v2StatusCounts['max-steps'], 1);
assert.equal(report.samples[0]?.label, 'default-off completed');
assert.equal(report.samples[3]?.agreement.v2Status, 'needs-approval');
assert.equal(report.samples[7]?.agreement.status, 'inconclusive');
assert.match(report.summaryText, /samples=9/u);
assert.match(report.summaryText, /aligned=6/u);
assert.match(report.summaryText, /inconclusive=2/u);
assert.match(report.summaryText, /unavailable=1/u);

const compactExport = createAgentSessionV3PilotShadowAgreementReportExport(report, {
  includeMismatchSamples: false,
});
assert.equal(compactExport.samples, undefined);
assert.equal(compactExport.mismatchSamples, undefined);
assert.equal(compactExport.sampleCount, 9);

const sampleExport = createAgentSessionV3PilotShadowAgreementReportExport(report, {
  includeSamples: true,
  maxSamples: 4,
});
assert.equal(sampleExport.samples?.length, 4);
assert.equal(sampleExport.samples?.[0]?.label, 'default-off completed');
assert.equal(sampleExport.samples?.[1]?.status, 'aligned');
assert.equal(sampleExport.samples?.[3]?.v2Status, 'needs-approval');
assert.deepEqual(sampleExport.mismatchSamples, []);

const jsonText = stringifyAgentSessionV3PilotShadowAgreementReportExport(sampleExport);
const parsed = JSON.parse(jsonText);
assert.equal(parsed.kind, 'agent-session-v3-pilot-shadow-agreement-report');
assert.equal(parsed.sampleCount, 9);
assert.equal(parsed.samples.length, 4);

console.log('agent session v2 v3 shadow runtime export smoke ok');
