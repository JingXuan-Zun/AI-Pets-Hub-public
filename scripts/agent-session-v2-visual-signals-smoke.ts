import assert from 'node:assert/strict';
import {
  createAgentRecentVisualContextText,
  createAgentVisualRecoveryText,
  isAgentVisualContextToolCommand,
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentSessionV2ModelCaller,
  type AgentSessionV2ToolResultEntry,
} from '../src/agent/legacy/index.ts';
import {
  createAgentRecentVisualContextText,
  createAgentVisualRecoveryText,
  isAgentVisualContextToolCommand,
} from '../src/agent/runtime/agentVisualPlanningSignals.ts';
import { type PetConfig } from '../src/types.ts';
import {
  assertSourceDoesNotMatch,
  assertSourceMatches,
  readProjectSources,
} from './smokeTestHarness.ts';

const {
  index: indexSource,
  session: sessionSource,
  visualRuntime: visualRuntimeSource,
  visualSignals: visualSignalsSource,
} = readProjectSources({
  index: 'src/agent/legacy/index.ts',
  session: 'src/agent/agentProductionSessionImplementation.ts',
  visualRuntime: 'src/agent/runtime/agentVisualPlanningSignals.ts',
  visualSignals: 'src/agent/runtime/agentVisualPlanningSignals.ts',
});
assertSourceMatches(
  visualRuntimeSource,
  /visualRecoveryPolicy=This signal is advisory\/evidence-driven/u,
  'Visual recovery signal should explicitly remain advisory and evidence-driven.',
);
assertSourceMatches(
  sessionSource,
  /from '\.\/runtime\/agentVisualPlanningSignals'/u,
  'AgentSessionV2 should consume Visual Planning Signals Runtime directly.',
);
assertSourceDoesNotMatch(
  sessionSource,
  /function createAgentSessionV2RecentVisualContextText/u,
  'AgentSessionV2 should not own recent visual context text implementation.',
);
assertSourceDoesNotMatch(
  sessionSource,
  /function createAgentSessionV2VisualRecoveryText/u,
  'AgentSessionV2 should not own visual recovery text implementation.',
);

function createToolCommand(toolName: AgentChatCommand['toolCall']['name'], input: Record<string, unknown>): AgentChatCommand {
  return {
    capabilityId: 'desktop-observation',
    instruction: 'visual signals smoke',
    kind: 'tool-call',
    sourceText: '/agent visual signals smoke',
    toolCall: {
      goal: 'visual signals smoke',
      input,
      name: toolName,
    },
  };
}

function createEntry(command: AgentChatCommand, result: AgentChatCommandResult): AgentSessionV2ToolResultEntry {
  return {
    command,
    result,
  };
}

const failedVisualCommand = createToolCommand('execute_desktop_observation', {
  action: 'summarize_visual_snapshot',
  query: 'Example Game Start button',
  sourceId: 'missing-source',
});
const failedVisualResult: AgentChatCommandResult = {
  errorText: 'Capture source missing',
  followUp: 'Retry with a valid source.',
  observations: [
    'The requested capture source id is not available.',
    'Capture source candidate: League Client',
    '1. [window] League Client',
  ],
  ok: false,
  responseText: 'Could not capture the requested source.',
  stateSummary: {
    missingEvidence: ['missing:trusted-capture-source'],
    observedState: ['The requested capture source id is not available.'],
    recommendedRecovery: ['tool:list_capture_sources', 'tool:get_active_window_info'],
  },
  verification: 'No visual summary was produced.',
};
const captureListCommand = createToolCommand('execute_desktop_observation', {
  action: 'list_capture_sources',
  query: 'League Client',
});
const captureListResult: AgentChatCommandResult = {
  observations: [
    'Capture source candidate: League Client',
  ],
  ok: true,
  responseText: 'Capture source candidate: League Client',
  stateSummary: {
    observedState: ['Capture source candidate: League Client'],
    verificationEvidence: ['Capture sources were listed.'],
  },
};
const nonVisualCommand = createToolCommand('observe_windows_and_apps', {
  query: 'Chrome',
});

assert.equal(isAgentVisualContextToolCommand(failedVisualCommand), true);
assert.equal(isAgentVisualContextToolCommand(captureListCommand), true);
assert.equal(isAgentVisualContextToolCommand(nonVisualCommand), false);
assert.equal(isAgentVisualContextToolCommand(failedVisualCommand), true);
assert.equal(isAgentVisualContextToolCommand(captureListCommand), true);
assert.equal(isAgentVisualContextToolCommand(nonVisualCommand), false);

const toolResults = [
  createEntry(nonVisualCommand, {
    observations: ['Chrome is active.'],
    ok: true,
    responseText: 'Chrome is active.',
  }),
  createEntry(failedVisualCommand, failedVisualResult),
  createEntry(captureListCommand, captureListResult),
];

const recentVisualContextText = createAgentRecentVisualContextText(toolResults);
assert.equal(createAgentRecentVisualContextText(toolResults), recentVisualContextText);
assert.match(recentVisualContextText, /1\. tool=execute_desktop_observation/u);
assert.match(recentVisualContextText, /sourceId=missing-source/u);
assert.match(recentVisualContextText, /query=Example Game Start button/u);
assert.match(recentVisualContextText, /observed=The requested capture source id is not available/u);
assert.match(recentVisualContextText, /uncertain=missing:trusted-capture-source/u);
assert.match(recentVisualContextText, /recommendedRecovery=tool:list_capture_sources/u);
assert.match(recentVisualContextText, /2\. tool=execute_desktop_observation/u);
assert.match(recentVisualContextText, /query=League Client/u);

const visualRecoveryText = createAgentVisualRecoveryText(toolResults);
assert.equal(createAgentVisualRecoveryText(toolResults), visualRecoveryText);
assert.match(visualRecoveryText, /tool=execute_desktop_observation/u);
assert.match(visualRecoveryText, /ok=false/u);
assert.match(visualRecoveryText, /errorText=Capture source missing/u);
assert.match(visualRecoveryText, /missingEvidence=missing:trusted-capture-source/u);
assert.match(visualRecoveryText, /recommendedRecovery=tool:list_capture_sources \| tool:get_active_window_info/u);
assert.match(visualRecoveryText, /candidateSources=Capture source candidate: League Client/u);
assert.match(visualRecoveryText, /visualRecoveryPolicy=This signal is advisory\/evidence-driven/u);
assert.doesNotMatch(
  visualRecoveryText,
  /open_app\s*->|wait_ui\s*->|locate\s*->|click\s*->|verify/iu,
  'Visual recovery signal should not encode a fixed tool chain.',
);

let modelCalls = 0;
const modelCaller: AgentSessionV2ModelCaller = async ({ userInput }) => {
  modelCalls += 1;

  if (modelCalls === 1) {
    return JSON.stringify({
      action: 'tool_call',
      args: {
        action: 'summarize_visual_snapshot',
        query: 'Example Game Start button',
        sourceId: 'missing-source',
      },
      reason: 'Read visual state.',
      tool: 'execute_desktop_observation',
      understanding: {
        remainingGoals: ['read visual state'],
        successCriteria: 'visual evidence is available',
        userNeed: 'inspect visual state',
        verificationStatus: 'unknown',
      },
    });
  }

  assert.match(userInput, /Recent visual context from this Agent session:/u);
  assert.match(userInput, /Current visual recovery signal:/u);
  assert.match(userInput, /visualRecoveryPolicy=This signal is advisory\/evidence-driven/u);
  return JSON.stringify({
    action: 'final_answer',
    message: 'visual source is blocked',
    understanding: {
      blockedGoals: ['visual source was missing'],
      completedGoals: ['visual failure evidence was collected'],
      remainingGoals: [],
      successCriteria: 'blocked state is explained with evidence',
      userNeed: 'inspect visual state',
      verificationEvidence: ['missingEvidence=missing:trusted-capture-source'],
      verificationGaps: [],
      verificationStatus: 'blocked',
    },
  });
};

const sessionResult = await runAgentProductionSession({
  maxSteps: 3,
  modelCaller,
  settings: {} as PetConfig['settings'],
  sourceText: '/agent inspect visual state',
  toolExecutor: async () => failedVisualResult,
  userGoal: 'inspect visual state',
});

assert.equal(modelCalls, 2);
assert.equal(sessionResult.status, 'completed');

console.log('agent session v2 visual signals smoke ok');
