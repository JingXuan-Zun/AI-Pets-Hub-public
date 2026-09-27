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
      reason: 'Locate the in-app launch button before clicking.',
      tool: 'locate_screen_elements',
      understanding: {
        completedGoals: [],
        remainingGoals: ['verify the launch button coordinate'],
        successCriteria: 'target/action/relation and a reliable click coordinate are verified before approval',
        userNeed: 'start Example Game inside Launcher',
        verificationEvidence: [],
        verificationGaps: ['Need reliable visual evidence before input.'],
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
          'Visual action candidate 1: Start | confidence=medium | centerRatio=0.720,0.760',
          'Visual action candidate 2: Start | confidence=medium | centerRatio=0.760,0.760',
          'Visual action readiness: ready',
          'Visual coordinate confidence: medium',
        ],
        ok: true,
        responseText: 'The Start button appears visible, but two small similar controls are close together.',
        stateSummary: {
          observedState: [
            'Visual target matched: Example Game',
            'Visual primary action: Start',
            'Visual target/action relation: Start belongs to Example Game',
          ],
          structuredEvidence: {
            actionCandidates: [
              {
                bounds: {
                  coordinateSpace: 'source-ratio',
                  height: 0.05,
                  source: 'test-window',
                  width: 0.08,
                  x: 0.68,
                  y: 0.735,
                },
                centerRatio: {
                  coordinateSpace: 'source-ratio',
                  source: 'test-window',
                  x: 0.72,
                  y: 0.76,
                },
                confidence: 'medium',
                label: 'Start',
                relation: 'Start button appears near Example Game, but nearby controls look similar.',
              },
              {
                centerRatio: {
                  coordinateSpace: 'source-ratio',
                  source: 'test-window',
                  x: 0.76,
                  y: 0.76,
                },
                confidence: 'medium',
                label: 'Start',
                relation: 'Nearby similar Start control.',
              },
            ],
            confidence: 'medium',
            coordinateConfidence: 'medium',
            elementCenterRatio: {
              coordinateSpace: 'source-ratio',
              source: 'test-window',
              x: 0.72,
              y: 0.76,
            },
            elementDescription: 'Small Start button beside the Example Game tile',
            primaryAction: 'Start',
            relation: 'Start belongs to Example Game',
            status: 'success',
            targetMatched: 'Example Game',
            sourceBounds: {
              coordinateSpace: 'native-screen',
              height: 180,
              source: 'test-window',
              width: 300,
              x: 934,
              y: 653,
            },
            visualActionReadiness: 'ready',
          },
          verificationEvidence: ['Target/action relation looks plausible but needs a focused crop.'],
        },
        verification: 'Ready but soft visual evidence should be refined before approval.',
      };
    }

    assert.equal(command.toolCall.input.action, 'locate_element');
    assert.equal(command.toolCall.input.forceRefresh, true);
    assert.equal(toolCallCount, 2);
    assert.equal(command.toolCall.input.focusCenterRatioX, 0.72);
    assert.equal(command.toolCall.input.focusCenterRatioY, 0.76);
    assert.equal(command.toolCall.input.focusWidthRatio, 0.192);
    assert.equal(command.toolCall.input.focusHeightRatio, 0.12);
    assert.equal(command.toolCall.input.focusScale, 3);
    assert.match(String(command.toolCall.input.question), /looked action-ready/u);
    assert.match(String(command.toolCall.input.question), /candidate ambiguity/u);

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
          actionCandidates: [{
            bounds: {
              coordinateSpace: 'native-screen',
              height: 96,
              source: 'focused-crop-test',
              width: 128,
              x: 1086,
              y: 742,
            },
            center: { coordinateSpace: 'native-screen', x: 1150, y: 790 },
            confidence: 'high',
            label: 'Start',
            relation: 'Start belongs to Example Game',
            source: 'visual',
          }],
          elementBounds: {
            coordinateSpace: 'native-screen',
            height: 96,
            source: 'focused-crop-test',
            width: 128,
            x: 1086,
            y: 742,
          },
          confidence: 'high',
          coordinateConfidence: 'high',
          elementCenterRatio: {
            coordinateSpace: 'source-ratio',
            source: 'focused-crop-test',
            x: 0.5,
            y: 0.5,
          },
          primaryAction: 'Start',
          relation: 'Start belongs to Example Game',
          sourceBounds: {
            coordinateSpace: 'native-screen',
            height: 180,
            source: 'focused-crop-test',
            width: 300,
            x: 1000,
            y: 700,
          },
          captureSourceType: 'window',
          captureTrusted: true,
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
assert.match(String(result.pendingApproval?.command.toolCall?.input.stepsJson), /1150/u);
assert.match(String(result.pendingApproval?.command.toolCall?.input.stepsJson), /790/u);
assert.match(result.continuation.historyLines.join('\n'), /visual refinement result/u);
assert.match(result.continuation.historyLines.join('\n'), /prepared visual-action approval after visual refinement/u);

console.log('agent session v2 visual ready soft evidence refinement smoke ok');
