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
  modelCaller: async () => {
    modelCallCount += 1;
    assert.equal(modelCallCount, 1);
    return JSON.stringify({
      action: 'tool_call',
      args: {
        action: 'locate_element',
        sourceQuery: 'Launcher',
        sourceType: 'window',
        targetDescription: 'Example Game Start button',
      },
      reason: 'Locate the in-app launch button.',
      tool: 'locate_screen_elements',
      understanding: {
        completedGoals: [],
        remainingGoals: ['verify the clickable coordinate for Example Game Start'],
        successCriteria: 'target/action/relation and a reliable click coordinate are verified before approval',
        userNeed: 'start Example Game inside Launcher',
        verificationEvidence: [],
        verificationGaps: ['Need a reliable screen coordinate before input.'],
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
      return {
        observations: [
          'Visual target matched: Example Game',
          'Visual primary action: Start',
          'Visual target/action relation: Start belongs to Example Game',
          'Visual element center ratio: x=0.720 y=0.760',
          'Visual action readiness: ready',
          'Visual coordinate confidence: low',
        ],
        ok: true,
        responseText: 'The Start button is probably visible, but only a low-confidence ratio coordinate was returned.',
        stateSummary: {
          observedState: [
            'Visual target matched: Example Game',
            'Visual primary action: Start',
            'Visual target/action relation: Start belongs to Example Game',
          ],
          structuredEvidence: {
            confidence: 'high',
            coordinateConfidence: 'low',
            elementCenterRatio: {
              coordinateSpace: 'source-ratio',
              source: 'test-window',
              x: 0.5,
              y: 0.76,
            },
            sourceBounds: {
              coordinateSpace: 'native-screen',
              height: 670,
              source: 'test-window',
              width: 1191,
              x: 684,
              y: 355,
            },
            elementDescription: 'Small Start button beside the Example Game tile',
            primaryAction: 'Start',
            relation: 'Start belongs to Example Game',
            status: 'success',
            targetMatched: 'Example Game',
            visualActionReadiness: 'ready',
          },
          verificationEvidence: ['Target/action relation is visible, but the coordinate needs validation.'],
        },
        verification: 'Coordinate confidence is low and sourceBounds are missing.',
      };
    }

    assert.equal(command.toolCall.input.action, 'locate_element');
    assert.equal(command.toolCall.input.forceRefresh, true);
    assert.equal(command.toolCall.input.focusCenterRatioX, 0.5);
    assert.equal(command.toolCall.input.focusCenterRatioY, 0.76);
    assert.equal(command.toolCall.input.focusWidthRatio, 0.28);
    assert.equal(command.toolCall.input.focusHeightRatio, 0.24);
    assert.equal(command.toolCall.input.focusScale, 3);
    assert.match(String(command.toolCall.input.question), /looked action-ready/u);
    assert.match(String(command.toolCall.input.question), /sourceBounds/u);

    return {
      observations: [
        'Visual focus crop: Example Game Start area',
        'Visual target matched: Example Game',
        'Visual primary action: Start',
        'Visual target/action relation: Start belongs to Example Game',
        'Visual element center ratio: x=0.500 y=0.500',
        'Visual action readiness: ready',
      ],
      ok: true,
      responseText: 'Focused crop verified the Example Game Start button coordinate.',
      stateSummary: {
        observedState: [
          'Visual target matched: Example Game',
          'Visual primary action: Start',
          'Visual target/action relation: Start belongs to Example Game',
        ],
        structuredEvidence: {
          confidence: 'high',
          coordinateConfidence: 'high',
            elementCenter: {
              coordinateSpace: 'native-screen',
              source: 'focused-crop-test',
              x: 1280,
              y: 864,
            },
            elementBounds: {
              coordinateSpace: 'native-screen',
              height: 48,
              source: 'focused-crop-test',
              width: 120,
              x: 1220,
              y: 840,
            },
          primaryAction: 'Start',
          relation: 'Start belongs to Example Game',
            sourceBounds: {
              coordinateSpace: 'native-screen',
              height: 180,
              source: 'focused-crop-test',
              width: 300,
              x: 1130,
              y: 774,
            },
          status: 'success',
          targetMatched: 'Example Game',
          visualActionReadiness: 'ready',
        },
        verificationEvidence: ['Focused crop verified the Start button coordinate.'],
      },
      verification: 'Focused crop verified a reliable screen coordinate.',
    };
  },
  userGoal: 'start Example Game inside Launcher',
});

assert.equal(modelCallCount, 1);
assert.equal(toolCallCount, 2);
assert.equal(result.status, 'needs-approval');
assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
assert.match(String(result.pendingApproval?.command.toolCall?.input.stepsJson), /1280/u);
assert.match(String(result.pendingApproval?.command.toolCall?.input.stepsJson), /864/u);
assert.match(result.continuation.historyLines.join('\n'), /visual refinement result/u);
assert.match(result.continuation.historyLines.join('\n'), /prepared visual-action approval after visual refinement/u);

console.log('agent session v2 visual ready coordinate refinement smoke ok');
