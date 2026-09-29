import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentSessionV2ContinuationState,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];

function createLocateCommand(input: Record<string, unknown>): AgentChatCommand {
  return {
    capabilityId: 'desktop-observation',
    instruction: 'locate ambiguous launcher target',
    kind: 'tool-call',
    sourceText: '/agent start the visible app from the launcher',
    toolCall: {
      goal: 'start the visible app from the launcher',
      input,
      name: 'locate_screen_elements',
    },
  };
}

function createAmbiguousLocateResult(label: string): AgentChatCommandResult {
  return {
    observations: [
      `${label}: Visual target candidate 1 centerRatio=0.720,0.640`,
      `${label}: Visual target candidate 2 centerRatio=0.430,0.410`,
    ],
    ok: true,
    receipt: {
      evidenceLines: [`${label}: two plausible candidates remain.`],
      status: 'unverified',
      summaryLines: ['Call: locate_screen_elements', `${label}: target ambiguous`],
      title: 'Ambiguous visual observation',
      toolName: 'locate_screen_elements',
      verification: 'Target remains ambiguous.',
    },
    responseText: `${label}: two plausible candidates remain.`,
    stateSummary: {
      missingEvidence: ['Multiple target candidates remain plausible.'],
      observedState: [
        `${label}: Visual target candidate 1 centerRatio=0.720,0.640`,
        `${label}: Visual target candidate 2 centerRatio=0.430,0.410`,
      ],
      recommendedRecovery: ['Use focus crop or ask the user to choose between similar candidates.'],
      structuredEvidence: {
        status: 'unverified',
        targetCandidates: [
          {
            centerRatio: { x: 0.72, y: 0.64 },
            confidence: 'high',
            label: 'Example Game tile',
            region: 'launcher library tile',
          },
          {
            centerRatio: { x: 0.43, y: 0.41 },
            confidence: 'high',
            label: 'Example Game news card',
            region: 'news panel',
          },
        ],
        visualActionReadiness: 'needs-target-selection',
      },
    },
    verification: 'Target remains ambiguous.',
  };
}

const focusAttemptInput = {
  action: 'locate_element',
  focusCenterRatioX: 0.72,
  focusCenterRatioY: 0.64,
  focusHeightRatio: 0.24,
  focusWidthRatio: 0.28,
  forceRefresh: true,
  targetDescription: 'Example Game target',
};

const continuation: AgentSessionV2ContinuationState = {
  historyLines: ['Existing recovery history contains two focus crop attempts.'],
  sourceText: '/agent start the visible app from the launcher',
  steps: [],
  toolResults: [
    {
      command: createLocateCommand(focusAttemptInput),
      result: createAmbiguousLocateResult('focus attempt 1'),
    },
    {
      command: createLocateCommand(focusAttemptInput),
      result: createAmbiguousLocateResult('focus attempt 2'),
    },
    {
      command: createLocateCommand({
        action: 'locate_element',
        forceRefresh: true,
        question: 'AgentSessionV2 auto recovery observation Post-action state is unknown. Expected target/content: Example Game. After this safe recovery observation, summarize current window/visual evidence.',
        targetDescription: 'Example Game target',
      }),
      result: createAmbiguousLocateResult('post-action recovery'),
    },
  ],
  userGoal: 'start Example Game from launcher',
};

let modelCallCount = 0;
const result = await runAgentProductionSession({
  continuation,
  maxSteps: 2,
  modelCaller: async ({ systemInstruction, userInput }) => {
    modelCallCount += 1;
    assert.match(systemInstruction, /budget=exhausted/u);
    assert.match(userInput, /Current replanning signal/u);
    assert.match(userInput, /reason=latest_tool_unverified/u);
    assert.match(userInput, /strategy=focus_candidate_crop tool=locate_screen_elements budget=exhausted used=2\/2/u);
    assert.match(userInput, /strategy=ask_user_disambiguate tool=ask_user budget=available used=0\/1/u);
    assert.match(userInput, /fallback because focus_candidate_crop reached 2\/2/u);

    return JSON.stringify({
      action: 'ask_user',
      message: 'I used the focus-crop budget, but two candidates remain. Which one should I start?',
      understanding: {
        blockedGoals: ['two visual candidates remain ambiguous after focus crop budget'],
        completedGoals: ['read ambiguous visual candidates'],
        remainingGoals: ['choose the correct target before clicking'],
        successCriteria: 'correct target is selected before any desktop input',
        userNeed: 'start Example Game from launcher',
        verificationEvidence: ['focus_candidate_crop budget exhausted used=2/2'],
        verificationGaps: ['which visual candidate is the intended target'],
        verificationStatus: 'blocked',
      },
    });
  },
  settings,
  sourceText: '/agent start the visible app from the launcher',
  userGoal: 'start Example Game from launcher',
});

assert.ok(modelCallCount >= 1, `expected at least one model call, got ${modelCallCount}`);
assert.notEqual(result.status, 'failed', JSON.stringify({
  finalAnswer: result.finalAnswer,
  status: result.status,
}, null, 2));

console.log('agent session v2 recovery strategy budget smoke ok');
