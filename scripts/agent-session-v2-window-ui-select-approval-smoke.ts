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
      targetText: 'Advanced',
    },
    reason: 'Read UI Automation controls before selecting a tab.',
    tool: 'execute_desktop_observation',
  }),
  settings,
  sourceText: '/agent select Advanced in Settings',
  toolExecutor: async (command: AgentChatCommand) => {
    assert.equal(command.toolCall?.name, 'execute_desktop_observation');
    assert.equal(command.toolCall.input.action, 'inspect_window_ui');

    return {
      observations: [
        'Desktop observation: inspect_window_ui',
        'Matched controls: Advanced type=TabItem center=512,88 actions=select matchScore=100',
      ],
      ok: true,
      responseText: 'Inspected UI controls in Settings. controls=5, matched=1, actionable=1',
      stateSummary: {
        missingEvidence: [],
        observedState: ['Window UI query: Settings', 'Target text: Advanced'],
        recommendedRecovery: [],
        structuredEvidence: {
          actionCandidates: [
            {
              actions: ['select'],
              automationId: 'advanced-tab',
              center: {
                coordinateSpace: 'native-screen',
                source: 'ui-automation',
                x: 512,
                y: 88,
              },
              confidence: 'high',
              controlType: 'TabItem',
              description: 'Advanced id=advanced-tab type=TabItem actions=select depth=2',
              label: 'Advanced id=advanced-tab type=TabItem',
              name: 'Advanced',
              region: 'TabItem',
              relation: 'UI Automation reports this control as actionable or focusable.',
              source: 'ui-automation',
              window: {
                hwnd: 2002,
                processName: 'Settings.exe',
                title: 'Settings',
              },
            },
          ],
          confidence: 'high',
          coordinateConfidence: 'high',
          primaryAction: 'Select Advanced tab',
          relation: 'The target text matched an actionable UI Automation control.',
          status: 'success',
          targetMatched: 'Advanced',
          visualActionReadiness: 'ready',
        },
        verificationEvidence: ['UI Automation returned a matched selectable tab.'],
      },
      verification: 'Window UI inspection returned current control names, types, actions, and screen bounds.',
    };
  },
  userGoal: 'select Advanced in Settings',
});

const stepsJson = String(result.pendingApproval?.command.toolCall?.input.stepsJson);
assert.equal(result.status, 'needs-approval');
assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
assert.match(stepsJson, /interact_window_ui/u);
assert.match(stepsJson, /"uiAction":"select"/u);
assert.doesNotMatch(stepsJson, /execute_desktop_input/u);

console.log('agent session v2 window ui select approval smoke ok');
