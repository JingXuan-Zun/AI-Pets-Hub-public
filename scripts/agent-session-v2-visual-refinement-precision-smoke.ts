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
      // The focused crop verified the small Start button; the model selects
      // the click, which pauses for approval.
      assert.match(userInput, /visual refinement result:/u);
      return JSON.stringify({
        action: 'tool_call',
        args: {
          stepsJson: JSON.stringify([
            {
              args: { action: 'click', x: 1150, y: 790 },
              reason: 'Click the verified small Start button.',
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
        targetDescription: 'Example Game tiny launch tile and its start button',
      },
      reason: 'Locate the in-app launch control with visual evidence.',
      tool: 'locate_screen_elements',
      understanding: {
        completedGoals: [],
        remainingGoals: ['refine the ambiguous small target area'],
        successCriteria: 'target/action/relation/coordinate are verified before requesting input',
        userNeed: 'start Example Game inside Launcher',
        verificationEvidence: [],
        verificationGaps: ['Need precise visual evidence for the tiny launch tile.'],
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
      return {
        observations: [
          'Visual target candidate 1: Example Game hidden tile, offscreen=true, centerRatio=0.200,0.250',
          'Visual target candidate 2: Example Game tiny library tile, centerRatio=0.640,0.680',
          'Visual target candidate 3: Generic news card, centerRatio=0.400,0.450',
          'Visual action readiness: needs-target-selection',
        ],
        ok: true,
        responseText: 'Multiple target candidates were found; the exact actionable tile is ambiguous.',
        stateSummary: {
          missingEvidence: ['Multiple target candidates remain plausible.'],
          recommendedRecovery: ['Focus the most relevant candidate crop before acting.'],
          structuredEvidence: {
            status: 'unverified',
            targetCandidates: [
              {
                centerRatio: { x: 0.2, y: 0.25 },
                confidence: 'high',
                label: 'Example Game hidden tile',
                offscreen: true,
                region: 'offscreen virtualized list item',
              },
              {
                bounds: {
                  coordinateSpace: 'source-ratio',
                  height: 0.05,
                  source: 'test',
                  width: 0.08,
                  x: 0.6,
                  y: 0.655,
                },
                centerRatio: {
                  coordinateSpace: 'source-ratio',
                  source: 'test',
                  x: 0.64,
                  y: 0.68,
                },
                confidence: 'medium',
                label: 'Example Game tiny library tile',
                region: 'small library tile',
                relation: 'candidate label matches the requested game but text is small',
              },
              {
                centerRatio: { x: 0.4, y: 0.45 },
                confidence: 'medium',
                label: 'Generic news card',
                region: 'news panel',
              },
            ],
            sourceBounds: {
              coordinateSpace: 'native-screen',
              height: 180,
              source: 'test-window',
              width: 300,
              x: 934,
              y: 653,
            },
            visualActionReadiness: 'needs-target-selection',
          },
        },
        verification: 'Target is ambiguous and needs focused visual observation.',
      };
    }

    assert.equal(command.toolCall.input.action, 'locate_element');
    assert.equal(command.toolCall.input.forceRefresh, true);
    assert.equal(toolCallCount, 2);
    assert.equal(command.toolCall.input.focusCenterRatioX, 0.64);
    assert.equal(command.toolCall.input.focusCenterRatioY, 0.68);
    assert.equal(command.toolCall.input.focusWidthRatio, 0.192);
    assert.equal(command.toolCall.input.focusHeightRatio, 0.12);
    assert.equal(command.toolCall.input.focusScale, 3);
    assert.match(String(command.toolCall.input.question), /Candidate ranking selected a target candidate/u);
    assert.match(String(command.toolCall.input.question), /small target needs close crop/u);
    assert.doesNotMatch(String(command.toolCall.input.targetDescription), /hidden tile/u);

    return {
      observations: [
        'Visual focus crop: small library tile',
        'Visual target matched: Example Game',
        'Visual primary action: Start',
        'Visual target/action relation: Start belongs to Example Game',
        'Visual element center ratio: x=0.500 y=0.500',
        'Visual action readiness: ready',
      ],
      ok: true,
      responseText: 'Focused crop verified the small Example Game Start button.',
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
        verificationEvidence: ['Focused crop verified the small Start button coordinate.'],
      },
      verification: 'Focused crop verified target/action relation and coordinate.',
    };
  },
  userGoal: 'start Example Game inside Launcher',
});

assert.equal(modelCallCount, 2);
assert.equal(toolCallCount, 2);
assert.equal(result.status, 'needs-approval');
assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
assert.match(String(result.pendingApproval?.command.toolCall?.input.stepsJson), /1150/u);
assert.match(String(result.pendingApproval?.command.toolCall?.input.stepsJson), /790/u);
assert.match(result.continuation.historyLines.join('\n'), /visual refinement result/u);
assert.match(result.continuation.historyLines.join('\n'), /selected approval-required tool:/u);

console.log('agent session v2 visual refinement precision smoke ok');
