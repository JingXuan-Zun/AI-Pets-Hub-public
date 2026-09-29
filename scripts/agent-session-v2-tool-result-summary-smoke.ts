import assert from 'node:assert/strict';
import {
  AGENT_TOOL_RESULT_CACHE_HIT_PREFIX,
  createAgentToolResultCriticalFacts,
  formatAgentToolResultForModel,
  isAgentCachedToolResult,
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentSessionV2ModelCaller,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';
import {
  createAgentToolResultCriticalFacts,
  formatAgentToolResultForModel,
} from '../src/agent/runtime/agentToolResultSummary.ts';
import {
  assertSourceDoesNotMatch,
  assertSourceMatches,
  readProjectSources,
} from './smokeTestHarness.ts';

const {
  cacheEvidence: cacheEvidenceSource,
  index: indexSource,
  session: sessionSource,
  summary: summarySource,
  summaryRuntime: summaryRuntimeSource,
} = readProjectSources({
  cacheEvidence: 'src/agent/runtime/agentToolResultCacheEvidence.ts',
  index: 'src/agent/legacy/index.ts',
  session: 'src/agent/agentProductionSessionImplementation.ts',
  summary: 'src/agent/runtime/agentToolResultSummary.ts',
  summaryRuntime: 'src/agent/runtime/agentToolResultSummary.ts',
});

assertSourceMatches(
  summaryRuntimeSource,
  /export function createAgentToolResultCriticalFacts/u,
  'Tool Result Summary Runtime should own critical fact extraction.',
);
assertSourceMatches(
  summaryRuntimeSource,
  /export function formatAgentToolResultForModel/u,
  'Tool Result Summary Runtime should own model-facing formatting.',
);
assertSourceMatches(
  cacheEvidenceSource,
  /export function isAgentCachedToolResult/u,
  'Runtime should own cache-hit evidence detection.',
);
assertSourceMatches(
  sessionSource,
  /from '\.\/runtime\/agentToolResultSummary'/u,
  'AgentSessionV2 should consume Tool Result Summary Runtime directly.',
);
assertSourceDoesNotMatch(
  sessionSource,
  /function createAgentSessionV2CriticalFacts/u,
  'AgentSessionV2 should not own critical fact extraction implementation.',
);
assertSourceDoesNotMatch(
  sessionSource,
  /function formatAgentSessionV2ToolResultForModel/u,
  'AgentSessionV2 should not own model-facing tool result formatting implementation.',
);

function createToolCommand(toolName: AgentChatCommand['toolCall']['name'], input: Record<string, unknown>): AgentChatCommand {
  return {
    capabilityId: 'desktop-control',
    instruction: 'tool result summary smoke',
    kind: 'tool-call',
    sourceText: '/agent tool result summary smoke',
    toolCall: {
      goal: 'tool result summary smoke',
      input,
      name: toolName,
    },
  };
}

const command = createToolCommand('execute_desktop_input', {
  action: 'click',
  x: 120,
  y: 240,
});
const result: AgentChatCommandResult = {
  assessment: {
    evidence: ['State diff changed.'],
    status: 'unverified',
    summary: 'Click was sent, but user-level goal still needs verification.',
  },
  followUpAction: {
    command,
    kind: 'run-command',
    label: 'retry with verification',
    requiresApproval: true,
  },
  ok: true,
  observations: ['Button area was clicked.'],
  receipt: {
    evidenceLines: ['Receipt evidence line'],
    status: 'unverified',
    summaryLines: ['Click command sent'],
    title: 'Desktop input',
    toolName: 'execute_desktop_input',
    verification: 'Receipt verification was unverified.',
  },
  responseText: 'Click sent.',
  stateSummary: {
    actionEvidence: {
      action: 'click',
      confidence: 0.62,
      diff: {
        changed: false,
        signals: ['uiChanged=false'],
        summary: 'No visible state change was detected.',
      },
      outcome: 'no-op',
      targetRef: {
        confidence: 'medium',
        kind: 'pixel',
        label: 'Start button',
      },
      timestamp: Date.now(),
      tool: 'execute_desktop_input',
    },
    missingEvidence: ['missing:post-click-state', 'missing:user-level-success'],
    observedState: ['Button area clicked, no visible change yet.'],
    recommendedRecovery: ['tool:observe_windows_and_apps', 'tool:locate_screen_elements'],
    structuredEvidence: {
      elementCenter: {
        label: 'Start button',
        x: 120,
        y: 240,
      },
      elementCenterRatio: {
        x: 0.5,
        y: 0.25,
      },
      launcherVerification: {
        detailMatchesTarget: false,
        primaryActionMatchesTarget: false,
        status: 'needs-selection',
        targetSelected: false,
        targetVisible: true,
      },
      primaryAction: 'Start',
      targetMatched: 'Example Game',
      visualActionReadiness: 'needs-target-selection',
    },
    verificationEvidence: ['Input primitive was sent.'],
  },
  verification: 'Click is not enough to prove user-level completion.',
};

const criticalFacts = createAgentToolResultCriticalFacts(command, result);
assert.equal(criticalFacts, createAgentToolResultCriticalFacts(command, result));
assert.match(criticalFacts, /tool=execute_desktop_input/u);
assert.match(criticalFacts, /ok=true/u);
assert.match(criticalFacts, /receipt=unverified/u);
assert.match(criticalFacts, /actionOutcome=no-op/u);
assert.match(criticalFacts, /actionTarget=Start button/u);
assert.match(criticalFacts, /target=Example Game/u);
assert.match(criticalFacts, /primaryAction=Start/u);
assert.match(criticalFacts, /elementCenter=120,240/u);
assert.match(criticalFacts, /elementCenterRatio=0\.500,0\.250/u);
assert.match(criticalFacts, /launcherStatus=needs-selection/u);
assert.match(criticalFacts, /launcherTargetVisible=true/u);
assert.match(criticalFacts, /launcherTargetSelected=false/u);
assert.match(criticalFacts, /visualActionReadiness=needs-target-selection/u);
assert.match(criticalFacts, /missing=missing:post-click-state/u);
assert.match(criticalFacts, /recover=tool:observe_windows_and_apps/u);

const modelSummary = formatAgentToolResultForModel(command, result);
assert.equal(modelSummary, formatAgentToolResultForModel(command, result));
assert.match(modelSummary, /criticalFacts=.*actionOutcome=no-op/u);
assert.match(modelSummary, /assessmentStatus=unverified/u);
assert.match(modelSummary, /receiptStatus=unverified/u);
assert.match(modelSummary, /availableFollowUpActions=run-command:retry with verification:requiresApproval/u);
assert.match(modelSummary, /rawEvidencePreview=Receipt evidence line/u);
assert.match(modelSummary, /observationsPreview=Button area was clicked/u);
assert.match(modelSummary, /observedState=Button area clicked, no visible change yet/u);
assert.match(modelSummary, /verificationEvidence=Input primitive was sent/u);
assert.match(modelSummary, /missingEvidence=missing:post-click-state \| missing:user-level-success/u);
assert.match(modelSummary, /recommendedRecovery=tool:observe_windows_and_apps \| tool:locate_screen_elements/u);
assert.match(modelSummary, /actionEvidence=outcome=no-op/u);
assert.match(modelSummary, /structuredEvidence=/u);

const cachedResult: AgentChatCommandResult = {
  ...result,
  observations: [
    `${AGENT_TOOL_RESULT_CACHE_HIT_PREFIX}: reused silent read-only observation.`,
  ],
};
assert.equal(isAgentCachedToolResult(cachedResult), true);
assert.match(createAgentToolResultCriticalFacts(command, cachedResult), /cache=hit/u);

let modelCalls = 0;
const modelCaller: AgentSessionV2ModelCaller = async ({ userInput }) => {
  modelCalls += 1;

  if (modelCalls === 1) {
    return JSON.stringify({
      action: 'tool_call',
      args: {
        action: 'summarize_visual_snapshot',
        query: 'Example Game Start button',
      },
      reason: 'Collect evidence for the target.',
      tool: 'execute_desktop_observation',
      understanding: {
        remainingGoals: ['collect target evidence'],
        successCriteria: 'target evidence is available',
        userNeed: 'inspect target',
        verificationStatus: 'unknown',
      },
    });
  }

  assert.match(userInput, /criticalFacts=tool=execute_desktop_observation/u);
  assert.match(userInput, /missingEvidence=missing:post-click-state/u);
  assert.match(userInput, /recommendedRecovery=tool:observe_windows_and_apps/u);
  assert.match(userInput, /actionEvidence=outcome=no-op/u);
  return JSON.stringify({
    action: 'final_answer',
    message: 'evidence summarized',
    understanding: {
      blockedGoals: ['target evidence remains unverified'],
      completedGoals: ['tool result evidence was summarized'],
      remainingGoals: [],
      successCriteria: 'summary includes evidence and recovery gaps',
      userNeed: 'inspect target',
      verificationEvidence: ['criticalFacts includes actionOutcome=no-op'],
      verificationGaps: [],
      verificationStatus: 'blocked',
    },
  });
};

const sessionResult = await runAgentProductionSession({
  maxSteps: 3,
  modelCaller,
  settings: {} as PetConfig['settings'],
  sourceText: '/agent inspect target',
  toolExecutor: async () => result,
  userGoal: 'inspect target',
});

assert.equal(modelCalls, 2);
assert.equal(sessionResult.status, 'completed');

console.log('agent session v2 tool result summary smoke ok');
