import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];
let modelCallCount = 0;
let toolCallCount = 0;

const result = await runAgentProductionSession({
  maxSteps: 4,
  modelCaller: async ({ userInput }) => {
    modelCallCount += 1;
    if (modelCallCount === 2) {
      // After the bounded refinements verify the coordinate, the model selects
      // the approval-gated click.
      assert.match(userInput, /elementCenter=1460,930/u);
      return JSON.stringify({
        action: 'tool_call',
        args: {
          stepsJson: JSON.stringify([
            {
              args: { action: 'click', x: 1460, y: 930 },
              reason: 'Click the verified Start button.',
              tool: 'execute_desktop_input',
            },
          ]),
        },
        reason: 'The focused crop verified the Start button; request approval for the click.',
        tool: 'execute_desktop_sequence',
      });
    }
    assert.equal(modelCallCount, 1);
    return JSON.stringify({
      action: 'tool_call',
      args: {
        action: 'locate_element',
        sourceQuery: 'Launcher',
        sourceType: 'window',
        targetDescription: 'Example Game and its primary launch button',
      },
      reason: 'Locate the in-app launch control.',
      tool: 'locate_screen_elements',
      understanding: {
        blockedGoals: [],
        completedGoals: [],
        remainingGoals: ['find the launch button for Example Game'],
        successCriteria: 'target/action/relation/coordinate are verified before input',
        userNeed: 'start Example Game inside Launcher',
        verificationEvidence: [],
        verificationGaps: ['Need visual evidence for the launch button.'],
        verificationStatus: 'unknown',
      },
    });
  },
  settings,
  sourceText: '/agent start Example Game inside Launcher',
  toolExecutor: async (command: AgentChatCommand) => {
    toolCallCount += 1;
    assert.equal(command.toolCall?.name, 'locate_screen_elements');

    if (toolCallCount === 1) {
      assert.equal(command.toolCall.input.action, 'locate_element');
      assert.equal(command.toolCall.input.sourceQuery, 'Launcher');
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

    assert.equal(command.toolCall.input.action, 'locate_element');
    assert.equal(command.toolCall.input.forceRefresh, true);
    assert.match(String(command.toolCall.input.question), /AgentSessionV2 visual refinement/u);
    if (toolCallCount === 2) {
      assert.equal(command.toolCall.input.focusCenterRatioX, 0.72);
      assert.equal(command.toolCall.input.focusCenterRatioY, 0.64);
      assert.equal(command.toolCall.input.focusWidthRatio, 0.28);
      assert.equal(command.toolCall.input.focusHeightRatio, 0.24);
      assert.equal(command.toolCall.input.focusScale, 2);
      assert.match(String(command.toolCall.input.question), /Previous visual readiness was needs-primary-action/u);
    } else {
      // Bounded second refinement validates the now-ready candidate.
      assert.equal(toolCallCount, 3);
      assert.match(String(command.toolCall.input.question), /Previous visual readiness was ready/u);
      assert.match(String(command.toolCall.input.targetDescription), /; focused candidate: /u);
    }

    return {
      observations: [
        'Focused crop: Example Game tile',
        'Visual target matched: Example Game',
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

assert.equal(modelCallCount, 2);
assert.equal(toolCallCount, 3);
assert.equal(result.status, 'needs-approval');
assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
assert.match(String(result.pendingApproval?.command.toolCall?.input.stepsJson), /1460/u);
assert.match(String(result.pendingApproval?.command.toolCall?.input.stepsJson), /930/u);
assert.match(result.continuation.historyLines.join('\n'), /visual refinement result/u);
assert.match(result.continuation.historyLines.join('\n'), /selected approval-required tool:/u);

console.log('agent session v2 failed visual auto recovery smoke ok');
