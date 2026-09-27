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
        targetText: 'Example Game',
      },
      reason: 'Try visual location first.',
      tool: 'locate_screen_elements',
      understanding: {
        blockedGoals: [],
        completedGoals: [],
        remainingGoals: ['find the launch control for Example Game'],
        successCriteria: 'target/action/relation/coordinate are verified before input',
        userNeed: 'start Example Game inside Launcher',
        verificationEvidence: [],
        verificationGaps: ['Need launch control evidence.'],
        verificationStatus: 'unknown',
      },
    });
  },
  settings,
  sourceText: '/agent start Example Game inside Launcher',
  toolExecutor: async (command: AgentChatCommand) => {
    toolCallCount += 1;

    if (toolCallCount === 1) {
      assert.equal(command.toolCall?.name, 'locate_screen_elements');
      assert.equal(command.toolCall.input.action, 'locate_element');
      assert.equal(command.toolCall.input.sourceQuery, 'Launcher');
      return {
        errorText: 'Vision could not find a reliable button or candidate coordinate.',
        observations: [
          'Visible text is noisy.',
          'No reliable targetCandidates or actionCandidates were returned.',
        ],
        ok: false,
        responseText: 'Visual location failed before finding a reliable candidate.',
        stateSummary: {
          missingEvidence: [
            'No reliable visual candidate coordinate was found.',
            'Primary launch button is still unknown.',
          ],
          observedState: ['The Launcher window appears to be the intended source.'],
          recommendedRecovery: [
            'Inspect the window UI controls with UI Automation before asking the user.',
          ],
        },
        verification: 'Visual location did not return a reliable candidate.',
      };
    }

    assert.equal(command.toolCall?.name, 'execute_desktop_observation');
    assert.equal(command.toolCall.input.action, 'inspect_window_ui');
    assert.equal(command.toolCall.input.forceRefresh, true);
    assert.equal(command.toolCall.input.query, 'Launcher');
    assert.equal(command.toolCall.input.targetText, 'Example Game');
    assert.match(String(command.toolCall.input.question), /AgentSessionV2 failed visual UIA recovery/u);
    assert.match(String(command.toolCall.input.question), /Do not click or invoke anything/u);

    return {
      observations: [
        'Desktop observation: inspect_window_ui',
        'Window process: Launcher',
        'Matched controls: Example Game id=game-launch type=Button center=830,564 actions=invoke matchScore=100',
      ],
      ok: true,
      responseText: 'Inspected UI controls in Launcher. controls=3, matched=1, actionable=2',
      stateSummary: {
        missingEvidence: [],
        observedState: [
          'Window UI query: Launcher',
          'Target text: Example Game',
          'UI Automation controls: 3',
        ],
        recommendedRecovery: [],
        structuredEvidence: {
          actionCandidates: [
            {
              actions: ['invoke'],
              automationId: 'game-launch',
              bounds: {
                coordinateSpace: 'native-screen',
                height: 48,
                source: 'ui-automation',
                width: 180,
                x: 740,
                y: 540,
              },
              center: {
                coordinateSpace: 'native-screen',
                source: 'ui-automation',
                x: 830,
                y: 564,
              },
              confidence: 'high',
              controlType: 'Button',
              description: 'Example Game id=game-launch type=Button actions=invoke depth=3',
              label: 'Example Game id=game-launch type=Button',
              name: 'Example Game',
              region: 'Button',
              relation: 'UI Automation reports this control as actionable or focusable.',
              source: 'ui-automation',
              window: {
                hwnd: 1001,
                processName: 'Launcher.exe',
                title: 'Launcher',
              },
            },
          ],
          confidence: 'high',
          coordinateConfidence: 'high',
          elementBounds: {
            coordinateSpace: 'native-screen',
            height: 48,
            source: 'ui-automation',
            width: 180,
            x: 740,
            y: 540,
          },
          elementCenter: {
            coordinateSpace: 'native-screen',
            source: 'ui-automation',
            x: 830,
            y: 564,
          },
          elementDescription: 'Example Game id=game-launch type=Button',
          primaryAction: 'Example Game id=game-launch type=Button',
          relation: 'The target text matched an actionable UI Automation control.',
          status: 'success',
          targetMatched: 'Example Game',
          visualActionReadiness: 'ready',
        },
        verificationEvidence: [
          'UI Automation returned a matched actionable control coordinate.',
        ],
      },
      verification: 'Window UI inspection returned current control names, types, actions, and screen bounds.',
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
assert.match(stepsJson, /game-launch/u);
assert.match(stepsJson, /830/u);
assert.match(stepsJson, /564/u);
assert.doesNotMatch(stepsJson, /execute_desktop_input/u);
assert.match(result.continuation.historyLines.join('\n'), /AgentSessionV2 failed visual UIA recovery/u);
assert.match(result.continuation.historyLines.join('\n'), /prepared visual-action approval after visual refinement/u);

console.log('agent session v2 failed visual UIA recovery smoke ok');
