import assert from 'node:assert/strict';
import {
  createAgentPostActionRecoveryFollowUpText,
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentSessionV2ContinuationState,
  type AgentSessionV2ModelCaller,
  type AgentPostActionRecoveryFollowUpSignalDependencies,
  type AgentSessionV2ToolResultEntry,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';
import {
  assertSourceDoesNotMatch,
  assertSourceMatches,
  readProjectSources,
} from './smokeTestHarness.ts';

const {
  index: indexSource,
  runtimeSignal: runtimeSignalSource,
  session: sessionSource,
  signal: signalSource,
} = readProjectSources({
  index: 'src/agent/legacy/index.ts',
  runtimeSignal: 'src/agent/runtime/agentPostActionRecoveryFollowUpSignal.ts',
  session: 'src/agent/agentProductionSessionImplementation.ts',
  signal: 'src/agent/runtime/agentPostActionRecoveryFollowUpSignal.ts',
});

assertSourceMatches(
  runtimeSignalSource,
  /export function createAgentPostActionRecoveryFollowUpText/u,
  'Post-action recovery follow-up signal should live in Runtime.',
);
assertSourceMatches(
  runtimeSignalSource,
  /postActionRecoveryFollowUpPolicy=This signal is advisory\/evidence-driven/u,
  'Post-action recovery follow-up signal should explicitly remain advisory and evidence-driven.',
);
assertSourceMatches(
  sessionSource,
  /from '\.\/runtime\/agentPostActionRecoveryFollowUpSignal'/u,
  'AgentSessionV2 should consume Runtime post-action recovery follow-up directly.',
);
assertSourceMatches(
  sessionSource,
  /createPostActionRecoveryFollowUpText:[\s\S]*createAgentPostActionRecoveryFollowUpText/u,
  'Planning Context adapters should use the Runtime follow-up signal.',
);
assertSourceDoesNotMatch(
  sessionSource,
  /function createAgentSessionV2PostActionRecoveryFollowUpText/u,
  'AgentSessionV2 should not own post-action recovery follow-up signal implementation.',
);

function createCommand(
  toolName: AgentChatCommand['toolCall']['name'],
  input: Record<string, unknown>,
): AgentChatCommand {
  return {
    capabilityId: 'desktop-observation',
    instruction: 'post-action recovery follow-up smoke',
    kind: 'tool-call',
    sourceText: '/agent post-action recovery follow-up smoke',
    toolCall: {
      goal: 'post-action recovery follow-up smoke',
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

function createAutoRecoveryCommand(): AgentChatCommand {
  return createCommand('locate_screen_elements', {
    action: 'locate_element',
    forceRefresh: true,
    question: 'AgentSessionV2 auto recovery observation Post-action state is unknown. Expected target/content: Example App. After this safe recovery observation, summarize current window/visual evidence.',
    targetDescription: 'Example App Start button',
  });
}

const previousActionEntry = createEntry(createCommand('execute_desktop_input', {
  action: 'click',
  x: 1120,
  y: 720,
}), {
  ok: true,
  receipt: {
    evidenceLines: ['Click was sent but launch was not verified.'],
    status: 'unverified',
    summaryLines: ['Click action sent.'],
    title: 'Execution receipt',
    toolName: 'execute_desktop_input',
    verification: 'No launched window evidence yet.',
  },
  responseText: 'Click sent.',
  stateSummary: {
    missingEvidence: ['The requested app did not visibly launch yet.'],
  },
});

const recoveryResult: AgentChatCommandResult = {
  observations: [
    'Example App tile is visible but the primary action is ambiguous.',
    'Candidate 1 centerRatio=0.700,0.650',
  ],
  ok: true,
  receipt: {
    evidenceLines: ['Recovery observation found one plausible target candidate.'],
    status: 'unverified',
    summaryLines: ['Post-action state read.'],
    title: 'Post-action recovery observation',
    toolName: 'locate_screen_elements',
    verification: 'Target/action still needs confirmation.',
  },
  responseText: 'Post-action state is unknown; target candidate is visible.',
  stateSummary: {
    missingEvidence: ['Need a precise primary action coordinate before retrying.'],
    observedState: ['Example App visible in launcher.'],
    recommendedRecovery: ['Focus the candidate crop or ask one short clarification question.'],
    structuredEvidence: {
      actionCandidates: [
        {
          centerRatio: { x: 0.7, y: 0.65 },
          confidence: 'medium',
          label: 'Open',
          relation: 'May belong to Example App tile.',
        },
      ],
      elementCenterRatio: { x: 0.7, y: 0.65 },
      postActionState: 'unknown',
      targetCandidates: [
        {
          centerRatio: { x: 0.7, y: 0.65 },
          confidence: 'high',
          label: 'Example App',
          region: 'launcher tile',
        },
      ],
      targetMatched: 'Example App',
      visualActionReadiness: 'needs-primary-action',
    },
    verificationEvidence: ['Post-action recovery observation did not prove launch success.'],
  },
  verification: 'Still unverified after recovery observation.',
};

const directDependencies: AgentPostActionRecoveryFollowUpSignalDependencies = {
  findRecoverableUnverifiedActionAttempt: () => previousActionEntry,
  isAutoRecoveryCommand: (command) => command.toolCall?.name === 'locate_screen_elements',
  recoveryStrategyDependencies: {
    countAutoRecoveryWaits: () => 0,
    resolveAutoRecoveryMaxWaits: () => 1,
  },
};

const directSignal = createAgentPostActionRecoveryFollowUpText({
  dependencies: directDependencies,
  toolResults: [
    previousActionEntry,
    createEntry(createAutoRecoveryCommand(), recoveryResult),
  ],
});

assert.match(directSignal, /reason=post_action_recovery_observed/u);
assert.match(directSignal, /sourcePostActionState=unknown/u);
assert.match(directSignal, /previousActionTool=execute_desktop_input/u);
assert.match(directSignal, /previousActionPrimitiveSignature=execute_desktop_input/u);
assert.match(directSignal, /latestRecoveryEvidence=Post-action recovery observation did not prove launch success/u);
assert.match(directSignal, /missingEvidence=Need a precise primary action coordinate before retrying/u);
assert.match(directSignal, /recommendedRecovery=Focus the candidate crop or ask one short clarification question/u);
assert.match(directSignal, /target=Example App/u);
assert.match(directSignal, /visualActionReadiness=needs-primary-action/u);
assert.match(directSignal, /elementCenterRatio=0\.700,0\.650/u);
assert.match(directSignal, /targetCandidates=1:Example App/u);
assert.match(directSignal, /actionCandidates=1:Open/u);
assert.match(directSignal, /suggestedLocateTool=locate_screen_elements/u);
assert.match(directSignal, /suggestedLocateArgs=.*"targetText":"Example App"/u);
assert.match(directSignal, /suggestedLocateArgs=.*primary open\/start\/play\/launch action/u);
assert.match(directSignal, /postActionRecoveryFollowUpPolicy=This signal is advisory\/evidence-driven/u);
assert.match(directSignal, /requiredReplan=This is evidence collected after an incomplete user action/u);
assert.doesNotMatch(
  directSignal,
  /open_app\s*->|wait_ui\s*->|locate\s*->|click\s*->|verify/iu,
  'Post-action recovery follow-up signal should not encode a fixed tool chain.',
);

assert.equal(createAgentPostActionRecoveryFollowUpText({
  dependencies: directDependencies,
  toolResults: [previousActionEntry],
}), '');

const continuation: AgentSessionV2ContinuationState = {
  historyLines: ['Existing history contains an unverified desktop click followed by safe post-action recovery observation.'],
  sourceText: '/agent start Example App',
  steps: [],
  toolResults: [
    previousActionEntry,
    createEntry(createAutoRecoveryCommand(), recoveryResult),
  ],
  userGoal: 'start Example App',
};

let modelCalls = 0;
let sawPostActionFollowUpSignal = false;
const modelCaller: AgentSessionV2ModelCaller = async ({ userInput }) => {
  modelCalls += 1;
  assert.match(userInput, /Current post-action recovery follow-up signal:/u);
  assert.match(userInput, /sourcePostActionState=unknown/u);
  assert.match(userInput, /visualActionBlocker=primary-open-start-play-action-not-identified/u);
  assert.match(userInput, /postActionRecoveryFollowUpPolicy=This signal is advisory\/evidence-driven/u);
  assert.match(userInput, /targetCandidates=1:Example App/u);
  assert.match(userInput, /suggestedLocateTool=locate_screen_elements/u);
  assert.match(userInput, /suggestedLocateArgs=/u);
  sawPostActionFollowUpSignal = true;
  return JSON.stringify({
    action: 'ask_user',
    message: 'The post-action recovery evidence is still ambiguous. Which visible Open control belongs to Example App?',
    understanding: {
      blockedGoals: ['primary action is still ambiguous'],
      completedGoals: ['read post-action recovery evidence'],
      remainingGoals: [],
      successCriteria: 'blocked state is explained with evidence',
      userNeed: 'start Example App',
      verificationEvidence: ['targetCandidates=1:Example App'],
      verificationGaps: ['primary action coordinate is not verified'],
      verificationStatus: 'blocked',
    },
  });
};

const sessionResult = await runAgentProductionSession({
  continuation,
  maxSteps: 2,
  modelCaller,
  settings: {} as PetConfig['settings'],
  sourceText: '/agent start Example App',
  userGoal: 'start Example App',
});

assert.ok(modelCalls >= 1, `expected at least one model call, got ${modelCalls}`);
assert.equal(sawPostActionFollowUpSignal, true);
assert.notEqual(sessionResult.status, 'failed', JSON.stringify({
  finalAnswer: sessionResult.finalAnswer,
  status: sessionResult.status,
  steps: sessionResult.steps.map((step) => ({
    action: step.action,
    message: step.message,
    tool: step.tool,
  })),
}, null, 2));

console.log('agent session v2 post action recovery follow-up signal smoke ok');
