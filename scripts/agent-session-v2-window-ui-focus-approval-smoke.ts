import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];

const result = await runAgentProductionSession({
  maxSteps: 3,
  modelCaller: async () => JSON.stringify({
    action: 'tool_call',
    args: {
      action: 'inspect_window_ui',
      query: 'Launcher',
      targetText: 'Search games',
    },
    reason: 'Read UI Automation controls before focusing the requested in-app search field.',
    tool: 'execute_desktop_observation',
  }),
  settings,
  sourceText: '/agent 在 Launcher 里先聚焦 Search games 输入框',
  toolExecutor: async (command: AgentChatCommand) => {
    assert.equal(command.toolCall?.name, 'execute_desktop_observation');
    assert.equal(command.toolCall.input.action, 'inspect_window_ui');

    return {
      observations: [
        'Desktop observation: inspect_window_ui',
        'Matched controls: Search games type=Edit actions=focus enabled=true keyboardFocusable=true matchScore=100',
      ],
      ok: true,
      responseText: 'Inspected UI controls in Launcher. controls=18, matched=1, actionable=1',
      stateSummary: {
        observedState: ['Window UI query: Launcher', 'Target text: Search games'],
        structuredEvidence: {
          actionCandidates: [
            {
              actions: ['focus'],
              automationId: 'game-search-box',
              center: {
                coordinateSpace: 'native-screen',
                source: 'ui-automation',
                x: 960,
                y: 180,
              },
              confidence: 'high',
              controlType: 'Edit',
              description: 'Search games id=game-search-box type=Edit actions=focus enabled=true keyboardFocusable=true depth=4',
              enabled: true,
              keyboardFocusable: true,
              label: 'Search games id=game-search-box type=Edit',
              name: 'Search games',
              offscreen: false,
              region: 'Edit',
              relation: 'UI Automation reports this control is keyboard focusable.',
              source: 'ui-automation',
              window: {
                hwnd: 4321,
                processName: 'Launcher.exe',
                title: 'Launcher',
              },
            },
          ],
          confidence: 'high',
          coordinateConfidence: 'high',
          primaryAction: 'focus Search games',
          relation: 'The target matched a keyboard-focusable UI Automation control.',
          status: 'success',
          targetMatched: 'Search games',
          visualActionReadiness: 'ready',
        },
        verificationEvidence: ['UI Automation returned a matched focusable control.'],
      },
      verification: 'Window UI inspection returned a focusable search field.',
    };
  },
  userGoal: '在 Launcher 里先聚焦 Search games 输入框',
});

assert.equal(result.status, 'needs-approval');
assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
const stepsJson = String(result.pendingApproval?.command.toolCall?.input.stepsJson);
assert.match(stepsJson, /interact_window_ui/u);
assert.match(stepsJson, /"uiAction":"focus"/u);
assert.match(stepsJson, /"automationId":"game-search-box"/u);
assert.doesNotMatch(stepsJson, /execute_desktop_input/u);

console.log('agent session v2 window ui focus approval smoke ok');
