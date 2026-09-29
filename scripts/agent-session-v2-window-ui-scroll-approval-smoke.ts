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
      query: 'Settings',
      targetText: 'Advanced settings',
    },
    reason: 'Read UI Automation controls before scrolling the requested list item into view.',
    tool: 'execute_desktop_observation',
  }),
  settings,
  sourceText: '/agent scroll Advanced settings into view in Settings',
  toolExecutor: async (command: AgentChatCommand) => {
    assert.equal(command.toolCall?.name, 'execute_desktop_observation');
    assert.equal(command.toolCall.input.action, 'inspect_window_ui');

    return {
      observations: [
        'Desktop observation: inspect_window_ui',
        'Matched controls: Advanced settings type=ListItem actions=scroll-into-view offscreen=true matchScore=100',
      ],
      ok: true,
      responseText: 'Inspected UI controls in Settings. controls=20, matched=1, actionable=1',
      stateSummary: {
        observedState: ['Window UI query: Settings', 'Target text: Advanced settings'],
        structuredEvidence: {
          actionCandidates: [
            {
              actions: ['scroll-into-view'],
              automationId: 'advanced-settings-item',
              center: {
                coordinateSpace: 'native-screen',
                source: 'ui-automation',
                x: 1180,
                y: 920,
              },
              confidence: 'high',
              controlType: 'ListItem',
              description: 'Advanced settings id=advanced-settings-item type=ListItem actions=scroll-into-view offscreen=true depth=5',
              enabled: true,
              label: 'Advanced settings id=advanced-settings-item type=ListItem',
              name: 'Advanced settings',
              offscreen: true,
              region: 'ListItem',
              relation: 'UI Automation reports this list item supports ScrollItemPattern.',
              source: 'ui-automation',
              window: {
                hwnd: 9876,
                processName: 'Settings.exe',
                title: 'Settings',
              },
            },
          ],
          confidence: 'high',
          coordinateConfidence: 'high',
          primaryAction: 'scroll Advanced settings into view',
          relation: 'The target text matched an offscreen list item with ScrollItemPattern.',
          status: 'success',
          targetMatched: 'Advanced settings',
          visualActionReadiness: 'ready',
        },
        verificationEvidence: ['UI Automation returned a matched scrollable list item.'],
      },
      verification: 'Window UI inspection returned a scrollable list item.',
    };
  },
  userGoal: 'scroll Advanced settings into view in Settings',
});

assert.equal(result.status, 'needs-approval');
assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
const stepsJson = String(result.pendingApproval?.command.toolCall?.input.stepsJson);
assert.match(stepsJson, /interact_window_ui/u);
assert.match(stepsJson, /"uiAction":"scroll_into_view"/u);
assert.match(stepsJson, /"automationId":"advanced-settings-item"/u);
assert.doesNotMatch(stepsJson, /execute_desktop_input/u);

console.log('agent session v2 window ui scroll approval smoke ok');
