import assert from 'node:assert/strict';
import {
  createAgentSessionV3PilotShadowAgreementReportExport,
  createAgentSessionV3PilotShadowAgreementReportFromResults,
  createAgentSessionV3PilotShadowDebugExport,
  runAgentProductionSession,
  runAgentSessionV3PilotDiagnosticSampleRunner,
  type AgentSessionV2ModelCaller,
  type AgentSessionV2Result,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';
import { readProjectSources } from './smokeTestHarness.ts';

interface DiagnosticScenarioResult {
  label: string;
  result: AgentSessionV2Result;
}

const { scenarioSource, runnerSource, sessionSource } = readProjectSources({
  scenarioSource: 'scripts/agent-session-v3-pilot-diagnostic-scenario-set-smoke.ts',
  runnerSource: 'src/agent/agentSessionV3PilotDiagnosticSampleRunner.ts',
  sessionSource: 'src/agent/agentProductionSessionImplementation.ts',
});

assert.doesNotMatch(
  runnerSource,
  /AgentSessionV2|runAgentSessionV2|executeAgentSessionV2|buildAgentPermissionRoute|execute_desktop|observe_windows_and_apps|locate_screen_elements|toolExecutor/u,
  'diagnostic sample runner should not know v2 runtime execution, permissions, concrete tools, or tool execution.',
);
assert.doesNotMatch(
  runnerSource,
  /from 'node:fs'|writeFile|appendFile|createWriteStream|mkdir/u,
  'diagnostic sample runner should not write logs directly.',
);
assert.doesNotMatch(
  scenarioSource,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'diagnostic scenario set should not encode a fixed desktop tool chain.',
);
assert.doesNotMatch(
  sessionSource,
  /historyLines\.push\([^)]*v3PilotShadow|createAgentSessionV2ModelInput\([^)]*v3PilotShadow/isu,
  'v3 pilot shadow output should stay out of history and model input.',
);

const settings = {} as PetConfig['settings'];
let scenarioCollectionRuns = 0;
let cachedScenarioResults: Promise<DiagnosticScenarioResult[]> | null = null;
const toolModelInputs: string[] = [];

function createV3PilotShadowOptions() {
  return {
    debugSummary: {
      enabled: true,
      includeReasons: true,
    },
    enabled: true,
  };
}

async function runDiagnosticScenarios(): Promise<DiagnosticScenarioResult[]> {
  scenarioCollectionRuns += 1;

  const finalResult = await runAgentProductionSession({
    modelCaller: async () => JSON.stringify({
      action: 'final_answer',
      message: 'hello from diagnostic scenario',
      reason: 'The requested answer is known.',
    }),
    settings,
    sourceText: '/agent say hello',
    userGoal: 'say hello',
    v3PilotShadow: createV3PilotShadowOptions(),
  });

  let toolModelCalls = 0;
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
      message: 'active window observed for diagnostic scenario',
      reason: 'The observation is enough.',
      understanding: {
        completedGoals: ['read active window'],
        remainingGoals: [],
        successCriteria: 'active window evidence was observed',
        userNeed: 'what is the current active window',
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
    v3PilotShadow: createV3PilotShadowOptions(),
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
    sourceText: '/agent click the requested target',
    toolExecutor: async () => {
      throw new Error('approval-required tool should not execute in this smoke');
    },
    userGoal: 'click the requested target',
    v3PilotShadow: createV3PilotShadowOptions(),
  });

  const needsUserResult = await runAgentProductionSession({
    modelCaller: async () => JSON.stringify({
      action: 'ask_user',
      message: 'Need one detail before continuing.',
      reason: 'The requested target is ambiguous.',
    }),
    settings,
    sourceText: '/agent do the ambiguous diagnostic task',
    userGoal: 'do the ambiguous diagnostic task',
    v3PilotShadow: createV3PilotShadowOptions(),
  });

  const modelFailedResult = await runAgentProductionSession({
    modelCaller: async () => {
      throw new Error('simulated diagnostic model outage');
    },
    settings,
    sourceText: '/agent diagnostic model failed path',
    userGoal: 'diagnostic model failed path',
    v3PilotShadow: createV3PilotShadowOptions(),
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
    sourceText: '/agent diagnostic budget limited observation',
    toolExecutor: async () => {
      throw new Error('tool must not execute after tool budget is exhausted');
    },
    userGoal: 'diagnostic budget limited observation',
    v3PilotShadow: createV3PilotShadowOptions(),
  });

  assert.equal(toolModelCalls, 2);

  return [
    {
      label: 'final-completed',
      result: finalResult,
    },
    {
      label: 'readonly-tool-completed',
      result: toolResult,
    },
    {
      label: 'approval-required',
      result: approvalResult,
    },
    {
      label: 'needs-user',
      result: needsUserResult,
    },
    {
      label: 'model-failed',
      result: modelFailedResult,
    },
    {
      label: 'budget-exceeded',
      result: budgetResult,
    },
  ];
}

function getDiagnosticScenarioResults() {
  cachedScenarioResults ??= runDiagnosticScenarios();
  return cachedScenarioResults;
}

const diagnosticRun = await runAgentSessionV3PilotDiagnosticSampleRunner({
  agreementReport: {
    collect: async () => {
      const scenarioResults = await getDiagnosticScenarioResults();
      return createAgentSessionV3PilotShadowAgreementReportExport(
        createAgentSessionV3PilotShadowAgreementReportFromResults(scenarioResults.map((entry) => ({
          label: entry.label,
          result: entry.result,
        }))),
        {
          includeSamples: true,
          maxSamples: 6,
        },
      );
    },
  },
  corpusOptions: {
    maxShadowDebugSamples: 3,
  },
  includeJsonText: true,
  label: 'explicit-debug-v2-scenarios',
  shadowDebugSamples: [
    {
      collect: async () => {
        const scenarioResults = await getDiagnosticScenarioResults();
        const scenario = scenarioResults.find((entry) => entry.label === 'final-completed');
        return scenario?.result.debug?.v3PilotShadow
          ? {
            label: scenario.label,
            shadow: createAgentSessionV3PilotShadowDebugExport(scenario.result.debug.v3PilotShadow),
          }
          : null;
      },
      label: 'final-completed',
    },
    {
      collect: async () => {
        const scenarioResults = await getDiagnosticScenarioResults();
        const scenario = scenarioResults.find((entry) => entry.label === 'readonly-tool-completed');
        return scenario?.result.debug?.v3PilotShadow
          ? {
            label: scenario.label,
            shadow: createAgentSessionV3PilotShadowDebugExport(scenario.result.debug.v3PilotShadow),
          }
          : null;
      },
      label: 'readonly-tool-completed',
    },
    {
      collect: async () => {
        const scenarioResults = await getDiagnosticScenarioResults();
        const scenario = scenarioResults.find((entry) => entry.label === 'approval-required');
        return scenario?.result.debug?.v3PilotShadow
          ? {
            label: scenario.label,
            shadow: createAgentSessionV3PilotShadowDebugExport(scenario.result.debug.v3PilotShadow),
          }
          : null;
      },
      label: 'approval-required',
    },
    {
      collect: async () => {
        const scenarioResults = await getDiagnosticScenarioResults();
        const scenario = scenarioResults.find((entry) => entry.label === 'needs-user');
        return scenario?.result.debug?.v3PilotShadow
          ? {
            label: scenario.label,
            shadow: createAgentSessionV3PilotShadowDebugExport(scenario.result.debug.v3PilotShadow),
          }
          : null;
      },
      label: 'needs-user',
    },
    {
      collect: async () => {
        const scenarioResults = await getDiagnosticScenarioResults();
        const scenario = scenarioResults.find((entry) => entry.label === 'model-failed');
        return scenario?.result.debug?.v3PilotShadow
          ? {
            label: scenario.label,
            shadow: createAgentSessionV3PilotShadowDebugExport(scenario.result.debug.v3PilotShadow),
          }
          : null;
      },
      label: 'model-failed',
    },
    {
      collect: async () => {
        const scenarioResults = await getDiagnosticScenarioResults();
        const scenario = scenarioResults.find((entry) => entry.label === 'budget-exceeded');
        return scenario?.result.debug?.v3PilotShadow
          ? {
            label: scenario.label,
            shadow: createAgentSessionV3PilotShadowDebugExport(scenario.result.debug.v3PilotShadow),
          }
          : null;
      },
      label: 'budget-exceeded',
    },
  ],
});

assert.equal(diagnosticRun.status, 'collected');
assert.equal(diagnosticRun.issueCount, 0);
assert.equal(diagnosticRun.label, 'explicit-debug-v2-scenarios');
assert.equal(scenarioCollectionRuns, 1);
assert.equal(toolModelInputs.some((input) => /AgentSessionV3Pilot|v3PilotShadow/u.test(input)), false);
assert.equal(diagnosticRun.collection.corpus.counts.agreementSampleCount, 6);
assert.equal(diagnosticRun.collection.corpus.counts.shadowDebugSampleCount, 6);
assert.ok(diagnosticRun.collection.corpus.counts.shadowAnomalySampleCount >= 2);
assert.equal(diagnosticRun.collection.corpus.agreementReport?.counts.aligned, 5);
assert.equal(diagnosticRun.collection.corpus.agreementReport?.counts.inconclusive, 1);
assert.equal(diagnosticRun.collection.corpus.agreementReport?.counts.mismatch, 0);
assert.equal(diagnosticRun.collection.corpus.agreementReport?.v2StatusCounts.completed, 2);
assert.equal(diagnosticRun.collection.corpus.agreementReport?.v2StatusCounts['needs-approval'], 1);
assert.equal(diagnosticRun.collection.corpus.agreementReport?.v2StatusCounts['needs-user'], 1);
assert.equal(diagnosticRun.collection.corpus.agreementReport?.v2StatusCounts.failed, 1);
assert.equal(diagnosticRun.collection.corpus.agreementReport?.v2StatusCounts['budget-exceeded'], 1);
assert.equal(diagnosticRun.collection.corpus.shadowDebugSamples?.length, 3);
assert.match(diagnosticRun.summaryText, /agreementSamples=6/u);
assert.match(diagnosticRun.summaryText, /shadowSamples=6/u);

assert.ok(diagnosticRun.jsonText);
const parsedJson = JSON.parse(diagnosticRun.jsonText);
assert.equal(parsedJson.kind, 'agent-session-v3-pilot-debug-sample-corpus');
assert.equal(parsedJson.counts.agreementSampleCount, 6);
assert.equal(parsedJson.counts.shadowDebugSampleCount, 6);
assert.equal(parsedJson.shadowDebugSamples.length, 3);
assert.doesNotMatch(diagnosticRun.jsonText, /\n/u);

console.log('agent session v3 pilot diagnostic scenario set smoke ok');
