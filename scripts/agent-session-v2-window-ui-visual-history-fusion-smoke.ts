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
      reason: 'Use UI Automation first, then visually verify the target/action relation.',
      tool: 'execute_desktop_observation',
      understanding: {
        completedGoals: ['Launcher is the outer app'],
        remainingGoals: ['verify the target/action relation before launching'],
        successCriteria: 'the Start action is confirmed to belong to Example Game and can be invoked safely',
        userNeed: 'start Example Game inside Launcher',
        verificationEvidence: [],
        verificationGaps: ['Need visual relation evidence between Example Game and the Start button.'],
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
          'Action candidate: Button id=game-start-button bounds=950,540,160x48 actions=invoke',
        ],
        ok: true,
        responseText: 'UI Automation found the game tile and an invokable button, but relation needs visual verification.',
        stateSummary: {
          missingEvidence: ['Target/action relation is not fully proven by UI Automation alone.'],
          observedState: [
            'Example Game tile has screen bounds.',
            'An invokable button has screen bounds and automationId game-start-button.',
          ],
          recommendedRecovery: ['Use a focused visual crop around both UI Automation candidates.'],
          structuredEvidence: {
            actionCandidates: [
              {
                actions: ['invoke'],
                automationId: 'game-start-button',
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
                confidence: 'medium',
                controlType: 'Button',
                description: 'Button id=game-start-button actions=invoke',
                enabled: true,
                keyboardFocusable: true,
                label: 'Button',
                region: 'Button',
                relation: 'UI Automation reports this control as actionable, but not which game tile it belongs to.',
                source: 'ui-automation',
                window: {
                  hwnd: 1001,
                  processName: 'Launcher.exe',
                  title: 'Launcher',
                },
              },
            ],
            confidence: 'medium',
            coordinateConfidence: 'medium',
            primaryAction: 'Start',
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
    assert.equal(command.toolCall.input.focusCoordinateSpace, 'native-screen');

    return {
      observations: [
        'Visual focus crop: combined Example Game tile and Start button area',
        'OCR text: Example Game',
        'OCR text: Start',
        'Visual target/action relation: Start button belongs to Example Game',
        'Visual element center: x=1032 y=565',
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
          confidence: 'high',
          coordinateConfidence: 'high',
          elementCenter: {
            coordinateSpace: 'native-screen',
            source: 'focused-crop-test',
            x: 1032,
            y: 565,
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
const stepsJson = String(result.pendingApproval?.command.toolCall?.input.stepsJson);
assert.match(stepsJson, /interact_window_ui/u);
assert.match(stepsJson, /"uiAction":"invoke"/u);
assert.match(stepsJson, /game-start-button/u);
assert.match(stepsJson, /1032/u);
assert.match(stepsJson, /565/u);
assert.doesNotMatch(stepsJson, /execute_desktop_input/u);
assert.match(result.continuation.historyLines.join('\n'), /visual refinement result/u);
assert.match(result.continuation.historyLines.join('\n'), /prepared visual-action approval after visual refinement/u);

console.log('agent session v2 window UI visual history fusion smoke ok');
