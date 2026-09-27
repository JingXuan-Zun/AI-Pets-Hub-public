import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];

let modelCallCount = 0;
let locateCallCount = 0;

const result = await runAgentProductionSession({
  maxSteps: 4,
  modelCaller: async () => {
    modelCallCount += 1;
    return JSON.stringify({
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
    });
  },
  settings,
  sourceText: '/agent start Example Game inside Launcher',
  toolExecutor: async (command: AgentChatCommand) => {
    if (command.toolCall?.name !== 'locate_screen_elements') {
      throw new Error(`unexpected tool ${command.toolCall?.name ?? command.kind}`);
    }

    locateCallCount += 1;
    return {
      observations: [
        'Visual/UIA target matched: Example Game',
        'UI Automation primary action: Start id=primary-start type=Button',
        'Visual target/action relation: Start button belongs to Example Game detail page',
      ],
      ok: true,
      responseText: 'Screen element observation: Example Game Start action is visible and invokable.',
      stateSummary: {
        observedState: [
          'Target matched: Example Game',
          'Primary action: Start id=primary-start type=Button',
          'Relation: Start button belongs to Example Game detail page',
        ],
        structuredEvidence: {
          actionCandidates: [
            {
              actions: ['invoke'],
              automationId: 'primary-start',
              center: {
                coordinateSpace: 'native-screen',
                source: 'ui-automation',
                x: 1300,
                y: 894,
              },
              confidence: 'high',
              controlType: 'Button',
              description: 'Start button belongs to Example Game detail page',
              label: 'Start',
              relation: 'belongs to Example Game detail page',
              source: 'ui-automation',
              window: {
                hwnd: 1234,
                processName: 'Launcher',
                title: 'Launcher',
              },
            },
          ],
          confidence: 'high',
          coordinateConfidence: 'high',
          elementCenter: {
            coordinateSpace: 'native-screen',
            source: 'ui-automation',
            x: 1300,
            y: 894,
          },
          launcherVerification: {
            detailMatchesTarget: true,
            primaryActionMatchesTarget: true,
            status: 'ready',
            targetSelected: true,
            targetVisible: true,
          },
          primaryAction: 'Start id=primary-start type=Button',
          relation: 'Start button belongs to Example Game detail page',
          status: 'success',
          targetMatched: 'Example Game',
          visualActionReadiness: 'ready',
        },
        verificationEvidence: ['UI Automation action candidate is invokable and associated with Example Game.'],
      },
      verification: 'locate_screen_elements verified an invokable Start action for Example Game.',
    };
  },
  userGoal: 'start Example Game inside Launcher',
});

assert.equal(modelCallCount, 1);
assert.equal(locateCallCount, 1);
assert.equal(result.status, 'needs-approval');
assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');

const stepsJson = String(result.pendingApproval?.command.toolCall?.input.stepsJson ?? '');
assert.match(stepsJson, /"tool":"execute_desktop_action"/u);
assert.match(stepsJson, /"action":"interact_window_ui"/u);
assert.match(stepsJson, /"uiAction":"invoke"/u);
assert.match(stepsJson, /"automationId":"primary-start"/u);
assert.doesNotMatch(stepsJson, /"tool":"execute_desktop_input"/u);

console.log('agent session v2 in-app uia invoke priority smoke ok');
