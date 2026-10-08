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
    reason: 'Read UI Automation controls before typing into the in-app search field.',
    tool: 'execute_desktop_observation',
  }),
  settings,
  sourceText: '/agent 在 Launcher 里搜索框输入 "Example Game" 然后回车',
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
              relation: 'UI Automation reports this search box is keyboard focusable but does not expose ValuePattern.',
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
          primaryAction: 'type into Search games and submit',
          relation: 'The target matched a keyboard-focusable UI Automation search field.',
          status: 'success',
          targetMatched: 'Search games',
          visualActionReadiness: 'ready',
        },
        verificationEvidence: ['UI Automation returned a matched focusable search field.'],
      },
      verification: 'Window UI inspection returned a focusable search field.',
    };
  },
  userGoal: '在 Launcher 里搜索框输入 "Example Game" 然后回车',
});

assert.equal(result.status, 'needs-approval');
assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
const stepsJson = String(result.pendingApproval?.command.toolCall?.input.stepsJson);
const steps = JSON.parse(stepsJson) as Array<{ args: Record<string, unknown>; tool: string }>;
assert.equal(steps.length, 3);
assert.equal(steps[0]?.tool, 'execute_desktop_action');
assert.equal(steps[0]?.args.action, 'interact_window_ui');
assert.equal(steps[0]?.args.uiAction, 'focus');
assert.equal(steps[0]?.args.automationId, 'game-search-box');
assert.equal(steps[1]?.tool, 'execute_desktop_input');
assert.equal(steps[1]?.args.action, 'type_text');
assert.equal(steps[1]?.args.text, 'Example Game');
assert.equal(steps[2]?.tool, 'execute_desktop_input');
assert.equal(steps[2]?.args.action, 'hotkey');
assert.equal(steps[2]?.args.hotkey, 'Enter');

console.log('agent session v2 window ui focus type submit smoke ok');
