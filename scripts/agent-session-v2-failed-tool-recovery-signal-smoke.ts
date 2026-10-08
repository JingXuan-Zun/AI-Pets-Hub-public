import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentSessionV2ContinuationState,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];

function createFailedLocateCommand(): AgentChatCommand {
  return {
    capabilityId: 'desktop-observation',
    instruction: 'start Example Game inside Launcher',
    kind: 'tool-call',
    sourceText: '/agent start Example Game inside Launcher',
    toolCall: {
      goal: 'start Example Game inside Launcher',
      input: {
        action: 'locate_element',
        sourceQuery: 'Launcher',
        sourceType: 'window',
        targetDescription: 'Example Game and its primary launch button',
      },
      name: 'locate_screen_elements',
    },
  };
}

function createFailedLocateResult(): AgentChatCommandResult {
  return {
    errorText: 'Vision could not determine the primary launch button coordinate.',
    observations: [
      'Visual target candidate 1: Example Game tile centerRatio=0.720,0.640.',
      'Visual action candidate: button-like text is too small to confirm.',
    ],
    ok: false,
    responseText: 'The target tile was partially recognized, but the launch button was not reliable enough.',
    stateSummary: {
      missingEvidence: [
        'Primary launch button was not found.',
        'A reliable coordinate is still missing.',
      ],
      observedState: [
        'Example Game tile may be visible in the launcher library.',
      ],
      recommendedRecovery: [
        'Focus the candidate crop and re-locate target/action/relation before clicking.',
      ],
      structuredEvidence: {
        confidence: 'medium',
        status: 'failed',
        targetCandidates: [
          {
            centerRatio: {
              coordinateSpace: 'source-ratio',
              source: 'test',
              x: 0.72,
              y: 0.64,
            },
            confidence: 'medium',
            label: 'Example Game tile',
            region: 'launcher library tile',
          },
        ],
        targetMatched: 'Example Game',
        visualActionReadiness: 'needs-primary-action',
      },
    },
    verification: 'Launch button coordinate is missing.',
  };
}

const continuation: AgentSessionV2ContinuationState = {
  historyLines: [
    'Step 1 tool result:',
    'tool=locate_screen_elements',
    'ok=false',
  ],
  sourceText: '/agent start Example Game inside Launcher',
  steps: [],
  toolResults: [
    {
      command: createFailedLocateCommand(),
      result: createFailedLocateResult(),
    },
  ],
  userGoal: 'start Example Game inside Launcher',
};

let modelCallCount = 0;
let toolCallCount = 0;
const result = await runAgentProductionSession({
  continuation,
  maxSteps: 2,
  modelCaller: async ({ userInput }) => {
    modelCallCount += 1;
    assert.match(userInput, /reason=latest_tool_failed/u);
    assert.match(userInput, /failedTool=locate_screen_elements/u);
    assert.match(userInput, /missingEvidence=.*Primary launch button was not found/u);
    assert.match(userInput, /recommendedRecovery=.*Focus the candidate crop/u);
    assert.match(userInput, /visualActionReadiness=needs-primary-action/u);
    assert.match(userInput, /targetCandidates=.*Example Game tile/u);
    assert.match(userInput, /rankedRecoveryStrategies=.*strategy=focus_candidate_crop tool=locate_screen_elements/u);
    assert.match(userInput, /strategy=relocate_with_coordinates tool=locate_screen_elements/u);
    assert.match(userInput, /failureRecoveryRule=.*safe read-only recovery/u);
    assert.match(userInput, /Do not repeat the same failed tool and args/u);

    return JSON.stringify({
      action: 'tool_call',
      args: {
        action: 'locate_element',
        focusCenterRatioX: 0.72,
        focusCenterRatioY: 0.64,
        focusHeightRatio: 0.24,
        focusScale: 3,
        focusWidthRatio: 0.28,
        forceRefresh: true,
        sourceQuery: 'Launcher',
        sourceType: 'window',
        targetDescription: 'focused Example Game tile and its primary launch/start button',
      },
      reason: 'Focus the candidate tile instead of repeating the failed full-window locate.',
      tool: 'locate_screen_elements',
      understanding: {
        blockedGoals: [],
        completedGoals: ['read failed visual evidence'],
        remainingGoals: ['verify the launch button in a focused candidate crop'],
        successCriteria: 'target/action/relation/coordinate are verified before input',
        userNeed: 'start Example Game inside Launcher',
        verificationEvidence: ['failed locate produced a candidate tile but no reliable launch coordinate'],
        verificationGaps: ['exact launch button coordinate'],
        verificationStatus: 'partial',
      },
    });
  },
  settings,
  sourceText: '/agent start Example Game inside Launcher',
  toolExecutor: async (command) => {
    toolCallCount += 1;
    assert.equal(command.toolCall?.name, 'locate_screen_elements');
    assert.equal(command.toolCall.input.action, 'locate_element');
    assert.equal(command.toolCall.input.focusCenterRatioX, 0.72);
    assert.equal(command.toolCall.input.focusCenterRatioY, 0.64);
    assert.equal(command.toolCall.input.focusScale, 3);

    return {
      observations: [
        'Focused crop: Example Game tile',
        'Visual primary action: Start',
        'Visual element center: x=1460 y=930',
      ],
      ok: true,
      responseText: 'Focused crop verified the Start button.',
      stateSummary: {
        observedState: [
          'Visual target matched: Example Game',
          'Visual primary action: Start',
          'Visual element center: x=1460 y=930',
        ],
        structuredEvidence: {
          confidence: 'high',
          coordinateConfidence: 'high',
          // Declared bounds let the actionable-area gate accept the verified point.
          elementBounds: {
            coordinateSpace: 'native-screen',
            height: 44,
            source: 'focused-crop-test',
            width: 150,
            x: 1385,
            y: 908,
          },
          elementCenter: {
            coordinateSpace: 'native-screen',
            source: 'focused-crop-test',
            x: 1460,
            y: 930,
          },
          primaryAction: 'Start',
          relation: 'Start belongs to Example Game',
          status: 'success',
          targetMatched: 'Example Game',
          visualActionReadiness: 'ready',
        },
        verificationEvidence: ['Focused crop verified the Start button coordinate.'],
      },
      verification: 'Focused crop verified target/action/relation and coordinate.',
    };
  },
  userGoal: 'start Example Game inside Launcher',
});

assert.equal(modelCallCount, 1);
assert.equal(toolCallCount, 1);
assert.equal(result.status, 'needs-approval');
assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
assert.match(String(result.pendingApproval?.command.toolCall?.input.stepsJson), /1460/u);
assert.match(String(result.pendingApproval?.command.toolCall?.input.stepsJson), /930/u);
assert.equal(
  result.continuation.steps.some((step) => /Focus the candidate tile/u.test(step.reason ?? '')),
  true,
);

console.log('agent session v2 failed tool recovery signal smoke ok');
