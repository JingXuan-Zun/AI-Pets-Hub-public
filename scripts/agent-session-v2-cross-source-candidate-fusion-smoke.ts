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
      action: 'locate_element',
      sourceQuery: 'Launcher',
      sourceType: 'window',
      targetDescription: 'Example Game Start button',
    },
    reason: 'Locate the in-app launch button before clicking.',
    tool: 'locate_screen_elements',
  }),
  settings,
  sourceText: '/agent start Example Game inside Launcher',
  toolExecutor: async (command: AgentChatCommand) => {
    assert.equal(command.toolCall?.name, 'locate_screen_elements');
    return {
      observations: [
        'Visual target matched: Example Game',
        'Visual primary action: Start',
        'Visual action candidate: unrelated Start at 1320,820',
        'Visual action candidate: Example Game Start at 1008,612',
        'UIA action candidate: Start button at 1012,616',
      ],
      ok: true,
      responseText: 'Visual and UI Automation found Start candidates. One candidate is cross-source confirmed.',
      stateSummary: {
        observedState: [
          'Visual target matched: Example Game',
          'Visual primary action: Start',
        ],
        structuredEvidence: {
          actionCandidates: [
            {
              center: {
                coordinateSpace: 'native-screen',
                source: 'visual',
                x: 1320,
                y: 820,
              },
              confidence: 'high',
              label: 'Start',
              relation: 'A visible Start button, but relation to Example Game is unclear.',
              source: 'visual',
            },
            {
              actions: ['invoke'],
              automationId: 'example-game-start',
              center: {
                coordinateSpace: 'native-screen',
                source: 'ui-automation',
                x: 1012,
                y: 616,
              },
              confidence: 'medium',
              controlType: 'Button',
              description: 'Start id=example-game-start type=Button actions=invoke',
              enabled: true,
              label: 'Start',
              name: 'Start',
              offscreen: false,
              relation: 'UI Automation reports this Start button is actionable.',
              source: 'ui-automation',
              window: {
                hwnd: 4321,
                processName: 'Launcher.exe',
                title: 'Launcher',
              },
            },
            {
              center: {
                coordinateSpace: 'native-screen',
                source: 'visual',
                x: 1008,
                y: 612,
              },
              confidence: 'medium',
              label: 'Start',
              relation: 'Visual OCR sees Start beside the Example Game tile.',
              source: 'visual',
            },
          ],
          confidence: 'high',
          coordinateConfidence: 'high',
          primaryAction: 'Start',
          relation: 'Start belongs to Example Game.',
          status: 'success',
          targetMatched: 'Example Game',
          visualActionReadiness: 'ready',
        },
        verificationEvidence: ['Visual and UIA evidence mutually support one Start button.'],
      },
      verification: 'Cross-source evidence identifies the actionable Start button.',
    };
  },
  userGoal: 'start Example Game inside Launcher',
});

assert.equal(result.status, 'needs-approval');
assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
const stepsJson = String(result.pendingApproval?.command.toolCall?.input.stepsJson);
assert.match(stepsJson, /interact_window_ui/u);
assert.match(stepsJson, /example-game-start/u);
assert.match(stepsJson, /1012/u);
assert.match(stepsJson, /616/u);
assert.doesNotMatch(stepsJson, /1320/u);
assert.doesNotMatch(stepsJson, /820/u);

console.log('agent session v2 cross source candidate fusion smoke ok');
