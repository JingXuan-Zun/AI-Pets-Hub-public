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
        action: 'inspect_window_ui',
        maxDepth: 6,
        query: 'Launcher',
        targetText: 'Example Game',
      },
      reason: 'Use UI Automation first, then visually verify that the Start button belongs to the target tile.',
      tool: 'execute_desktop_observation',
      understanding: {
        completedGoals: ['Launcher is the outer app'],
        remainingGoals: ['verify the target/action relation before input'],
        successCriteria: 'the visual crop contains both the target item and primary action button',
        userNeed: 'start Example Game inside Launcher',
        verificationEvidence: [],
        verificationGaps: ['Need visual relation evidence between the target tile and Start button.'],
        verificationStatus: 'unknown',
      },
    });
  },
  settings,
  sourceText: '/agent start Example Game inside Launcher',
  toolExecutor: async (command: AgentChatCommand) => {
    toolCallCount += 1;

    if (toolCallCount === 1) {
      assert.equal(command.toolCall?.name, 'execute_desktop_observation');
      assert.equal(command.toolCall.input.action, 'inspect_window_ui');
      return {
        observations: [
          'Desktop observation: inspect_window_ui',
          'Target candidate: Example Game tile bounds=600,500,200x120',
          'Action candidate: Start button bounds=950,540,160x48',
        ],
        ok: true,
        responseText: 'UI Automation found the game tile and a nearby Start button, but relation needs visual verification.',
        stateSummary: {
          missingEvidence: ['Target/action relation is not fully proven by UI Automation alone.'],
          observedState: [
            'Example Game tile has screen bounds.',
            'Start button has screen bounds.',
          ],
          recommendedRecovery: ['Use a focused visual crop around both UI Automation candidates.'],
          structuredEvidence: {
            actionCandidates: [
              {
                actions: ['invoke'],
                bounds: {
                  coordinateSpace: 'native-screen',
                  height: 48,
                  source: 'ui-automation',
                  width: 160,
                  x: 950,
                  y: 540,
                },
                center: {
                  coordinateSpace: 'native-screen',
                  source: 'ui-automation',
                  x: 1030,
                  y: 564,
                },
                confidence: 'high',
                controlType: 'Button',
                description: 'Start button actions=invoke',
                label: 'Start button',
                region: 'Button',
                relation: 'UI Automation reports this control as actionable.',
                source: 'ui-automation',
              },
            ],
            confidence: 'medium',
            coordinateConfidence: 'medium',
            primaryAction: 'Start button',
            relation: 'UI Automation returned separate target and action candidates; relation still needs visual verification.',
            status: 'success',
            targetCandidates: [
              {
                bounds: {
                  coordinateSpace: 'native-screen',
                  height: 120,
                  source: 'ui-automation',
                  width: 200,
                  x: 600,
                  y: 500,
                },
                center: {
                  coordinateSpace: 'native-screen',
                  source: 'ui-automation',
                  x: 700,
                  y: 560,
                },
                confidence: 'high',
                controlType: 'ListItem',
                description: 'Example Game tile type=ListItem',
                label: 'Example Game tile',
                region: 'ListItem',
                source: 'ui-automation',
              },
            ],
            targetMatched: 'Example Game',
            visualActionReadiness: 'needs-relation',
          },
          verificationEvidence: ['UI Automation found bounded target and action candidates.'],
        },
        verification: 'UI Automation relation evidence is incomplete.',
      };
    }

    assert.equal(command.toolCall?.name, 'locate_screen_elements');
    assert.equal(command.toolCall.input.action, 'locate_element');
    assert.equal(command.toolCall.input.forceRefresh, true);
    assert.equal(command.toolCall.input.sourceQuery, 'Launcher');
    assert.equal(command.toolCall.input.focusCoordinateSpace, 'native-screen');
    assert.equal(command.toolCall.input.focusX, 294);
    assert.equal(command.toolCall.input.focusY, 428);
    assert.equal(command.toolCall.input.focusWidth, 2244);
    assert.equal(command.toolCall.input.focusHeight, 528);
    assert.match(String(command.toolCall.input.question), /combined UIA target\/action relation crop/u);
    assert.match(String(command.toolCall.input.question), /verify the exact target, primary action, relation/u);

    return {
      observations: [
        'Visual focus crop: combined Example Game tile and Start button area',
        'Visual target matched: Example Game',
        'Visual primary action: Start button',
        'Visual target/action relation: Start button belongs to Example Game',
        'Visual element center: x=1030 y=564',
        'Visual action readiness: ready',
      ],
      ok: true,
      responseText: 'Focused crop verified the Start button belongs to Example Game.',
      stateSummary: {
        observedState: [
          'Visual target matched: Example Game',
          'Visual primary action: Start button',
          'Visual target/action relation: Start button belongs to Example Game',
        ],
        structuredEvidence: {
          elementBounds: {
            coordinateSpace: 'native-screen',
            height: 64,
            source: 'focused-crop-test',
            width: 180,
            x: 940,
            y: 532,
          },
          confidence: 'high',
          coordinateConfidence: 'high',
          elementCenter: {
            coordinateSpace: 'native-screen',
            source: 'focused-crop-test',
            x: 1030,
            y: 564,
          },
          primaryAction: 'Start button',
          relation: 'Start button belongs to Example Game',
          status: 'success',
          targetMatched: 'Example Game',
          visualActionReadiness: 'ready',
        },
        verificationEvidence: ['Focused visual crop verified the target/action relation and coordinate.'],
      },
      verification: 'Focused visual crop verified the actionable button.',
    };
  },
  userGoal: 'start Example Game inside Launcher',
});

assert.equal(modelCallCount, 1);
assert.equal(toolCallCount, 2);
assert.equal(result.status, 'needs-approval');
assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
assert.match(String(result.pendingApproval?.command.toolCall?.input.stepsJson), /1030/u);
assert.match(String(result.pendingApproval?.command.toolCall?.input.stepsJson), /564/u);
assert.match(result.continuation.historyLines.join('\n'), /visual refinement result/u);
assert.match(result.continuation.historyLines.join('\n'), /prepared visual-action approval after visual refinement/u);

console.log('agent session v2 window ui visual fusion smoke ok');
