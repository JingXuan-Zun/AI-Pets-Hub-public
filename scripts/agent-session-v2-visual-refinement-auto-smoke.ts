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
        targetDescription: 'Example Game and its primary launch button',
      },
      reason: 'Locate the in-app game launch control.',
      tool: 'locate_screen_elements',
      understanding: {
        completedGoals: [],
        remainingGoals: ['find the launch button for Example Game'],
        successCriteria: 'the launch button coordinate is verified before requesting a click',
        userNeed: 'start Example Game inside Launcher',
        verificationEvidence: [],
        verificationGaps: ['Need visual evidence for the in-app launch button.'],
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
      assert.equal(command.toolCall.input.sourceQuery, 'Launcher');
      assert.equal(command.toolCall.input.action, 'locate_element');
      return {
        observations: [
          'Visual target matched: Example Game',
          'Visual action candidate 1: Launch | confidence=medium | centerRatio=0.820,0.760',
          'Visual action readiness: needs-primary-action',
        ],
        ok: true,
        responseText: 'Visual returned a likely Launch candidate, but the relation is not clear enough.',
        stateSummary: {
          missingEvidence: [
            'The candidate button relation is not clear enough for input.',
          ],
          recommendedRecovery: [
            'Use focus crop params around the candidate before clicking.',
          ],
          structuredEvidence: {
            actionCandidates: [
              {
                centerRatio: {
                  coordinateSpace: 'source-ratio',
                  source: 'test',
                  x: 0.82,
                  y: 0.76,
                },
                confidence: 'medium',
                label: 'Launch',
                region: 'lower right',
              },
            ],
            sourceBounds: {
              coordinateSpace: 'native-screen',
              height: 220,
              source: 'test-window',
              width: 360,
              x: 585,
              y: 407,
            },
            confidence: 'medium',
            primaryAction: null,
            status: 'unverified',
            targetMatched: 'Example Game',
            visualActionReadiness: 'needs-primary-action',
          },
        },
        verification: 'Candidate button needs focused visual observation.',
      };
    }

    assert.equal(command.toolCall.input.action, 'locate_element');
    assert.equal(command.toolCall.input.forceRefresh, true);
    assert.equal(command.toolCall.input.focusCenterRatioX, 0.82);
    assert.equal(command.toolCall.input.focusCenterRatioY, 0.76);
    assert.equal(command.toolCall.input.focusWidthRatio, 0.28);
    assert.equal(command.toolCall.input.focusHeightRatio, 0.24);
    assert.match(String(command.toolCall.input.question), /AgentSessionV2 visual refinement/u);

    return {
      observations: [
        'Visual focus crop: lower right candidate area',
        'Visual target matched: Example Game',
        'Visual primary action: Launch button',
        'Visual target/action relation: Launch button belongs to Example Game',
        'Visual element center ratio: x=0.500 y=0.520',
        'Visual action readiness: ready',
      ],
      ok: true,
      responseText: 'Focused visual crop verified the Example Game launch button.',
      stateSummary: {
        observedState: [
          'Visual target matched: Example Game',
          'Visual primary action: Launch button',
          'Visual target/action relation: Launch button belongs to Example Game',
        ],
          structuredEvidence: {
            elementBounds: {
              coordinateSpace: 'native-screen',
              height: 96,
              source: 'focused-crop-test',
              width: 128,
              x: 816,
              y: 526,
            },
            confidence: 'high',
          coordinateConfidence: 'high',
          elementCenterRatio: {
            coordinateSpace: 'source-ratio',
            source: 'focused-crop-test',
            x: 0.5,
            y: 0.52,
          },
          primaryAction: 'Launch button',
          relation: 'Launch button belongs to Example Game',
          sourceBounds: {
            coordinateSpace: 'native-screen',
            height: 220,
            source: 'focused-crop-test',
            width: 360,
            x: 700,
            y: 460,
          },
          captureSourceType: 'window',
          captureTrusted: true,
          status: 'success',
          targetMatched: 'Example Game',
          visualActionReadiness: 'ready',
        },
        verificationEvidence: ['Focused crop verified the launch button coordinate.'],
      },
      verification: 'Focused crop verified the target/action relation and usable coordinate.',
    };
  },
  userGoal: 'start Example Game inside Launcher',
});

assert.equal(modelCallCount, 1);
assert.equal(toolCallCount, 2);
assert.equal(result.status, 'needs-approval');
assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
assert.match(String(result.pendingApproval?.command.toolCall?.input.stepsJson), /880/u);
assert.match(String(result.pendingApproval?.command.toolCall?.input.stepsJson), /574/u);
assert.match(result.continuation.historyLines.join('\n'), /visual refinement result/u);
assert.match(result.continuation.historyLines.join('\n'), /prepared visual-action approval after visual refinement/u);

console.log('agent session v2 visual refinement auto smoke ok');
