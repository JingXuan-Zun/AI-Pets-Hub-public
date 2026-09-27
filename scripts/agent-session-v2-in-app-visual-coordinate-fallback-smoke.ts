import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];

const result = await runAgentProductionSession({
  maxSteps: 4,
  modelCaller: async () => JSON.stringify({
    action: 'tool_call',
    args: {
      action: 'locate_element',
      sourceQuery: 'Launcher',
      sourceType: 'window',
      targetDescription: 'Example Game and its primary launch button',
      targetText: 'Example Game',
    },
    reason: 'Need to locate the game and associated launch action inside the launcher.',
    tool: 'locate_screen_elements',
  }),
  settings,
  sourceText: '/agent start Example Game inside Launcher',
  toolExecutor: async (command: AgentChatCommand) => {
    if (command.toolCall?.name !== 'locate_screen_elements') {
      throw new Error(`unexpected tool ${command.toolCall?.name ?? command.kind}`);
    }

    return {
      observations: [
        'Visual target matched: Example Game',
        'Visual primary action: Start',
        'Visual target/action relation: Start belongs to Example Game detail page',
        'Visual element center: x=1300 y=894',
      ],
      ok: true,
      responseText: 'Screen element observation: Example Game Start action is visible.',
      stateSummary: {
        observedState: [
          'Target matched: Example Game',
          'Primary action: Start',
          'Relation: Start belongs to Example Game detail page',
        ],
        structuredEvidence: {
          confidence: 'high',
          coordinateConfidence: 'high',
          elementCenter: {
            coordinateSpace: 'native-screen',
            source: 'visual',
            x: 1300,
            y: 894,
          },
          primaryAction: 'Start',
          relation: 'Start belongs to Example Game detail page',
          status: 'success',
          targetMatched: 'Example Game',
          visualActionReadiness: 'ready',
        },
        verificationEvidence: ['Visual coordinate is high-confidence and associated with Example Game.'],
      },
      verification: 'locate_screen_elements verified a high-confidence visual coordinate for Example Game Start.',
    };
  },
  userGoal: 'start Example Game inside Launcher',
});

assert.equal(result.status, 'needs-approval');
assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');

const stepsJson = String(result.pendingApproval?.command.toolCall?.input.stepsJson ?? '');
assert.match(stepsJson, /"tool":"execute_desktop_input"/u);
assert.match(stepsJson, /"action":"click"/u);
assert.match(stepsJson, /"x":1300/u);
assert.match(stepsJson, /"y":894/u);
assert.doesNotMatch(stepsJson, /"interact_window_ui"/u);

console.log('agent session v2 in-app visual coordinate fallback smoke ok');
