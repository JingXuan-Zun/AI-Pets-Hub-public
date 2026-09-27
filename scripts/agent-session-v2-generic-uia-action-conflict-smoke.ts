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
        targetDescription: 'Example Game Start button',
      },
      reason: 'Locate the requested target and the action that belongs to it.',
      tool: 'locate_screen_elements',
    });
  },
  settings,
  sourceText: '/agent start Example Game inside Launcher',
  toolExecutor: async (command: AgentChatCommand) => {
    toolCallCount += 1;
    assert.equal(command.toolCall?.name, 'locate_screen_elements');

    if (toolCallCount === 1) {
      assert.equal(command.toolCall.input.action, 'locate_element');
      return {
        observations: [
          'Visual target matched: Example Game',
          'Visual primary action: Start',
          'UIA action candidate: Start button at 900,500',
          'Visual action candidate: Start button belongs to Example Game at 1250,760',
        ],
        ok: true,
        responseText: 'Launcher shows multiple Start controls; only the visual candidate is tied to Example Game.',
        stateSummary: {
          observedState: [
            'Visual target matched: Example Game',
            'Visual primary action: Start',
          ],
          structuredEvidence: {
            actionCandidates: [
              {
                actions: ['invoke'],
                automationId: 'generic-start',
                center: {
                  coordinateSpace: 'native-screen',
                  source: 'ui-automation',
                  x: 900,
                  y: 500,
                },
                confidence: 'high',
                controlType: 'Button',
                description: 'Start id=generic-start type=Button actions=invoke',
                enabled: true,
                label: 'Start',
                name: 'Start',
                offscreen: false,
                relation: 'UI Automation reports this Start button is actionable, but target ownership is unknown.',
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
                  x: 1250,
                  y: 760,
                },
                confidence: 'high',
                label: 'Start',
                relation: 'Start button belongs to Example Game.',
                source: 'visual',
              },
            ],
            confidence: 'high',
            coordinateConfidence: 'high',
            elementCenter: {
              coordinateSpace: 'native-screen',
              source: 'visual',
              x: 1250,
              y: 760,
            },
            primaryAction: 'Start',
            relation: 'Start button belongs to Example Game.',
            status: 'success',
            targetMatched: 'Example Game',
            visualActionReadiness: 'ready',
          },
          verificationEvidence: [
            'The visual candidate is tied to Example Game; the UIA Start candidate has no ownership evidence.',
          ],
        },
        verification: 'Only the visual candidate has target/action ownership evidence.',
      };
    }

    assert.equal(command.toolCall.input.action, 'locate_element');
    assert.equal(command.toolCall.input.forceRefresh, true);
    assert.match(String(command.toolCall.input.question), /AgentSessionV2 visual refinement/u);
    return {
      observations: [
        'Focused crop confirms the Start button belongs to Example Game.',
        'Visual target matched: Example Game',
        'Visual primary action: Start',
        'Visual target/action relation: Start button belongs to Example Game.',
        'Visual element center: x=1250 y=760',
      ],
      ok: true,
      responseText: 'Focused observation verified the correct Start button for Example Game.',
      stateSummary: {
        observedState: [
          'Visual target matched: Example Game',
          'Visual primary action: Start',
          'Visual target/action relation: Start button belongs to Example Game.',
        ],
        structuredEvidence: {
          confidence: 'high',
          coordinateConfidence: 'high',
          elementCenter: {
            coordinateSpace: 'native-screen',
            source: 'focused-crop-test',
            x: 1250,
            y: 760,
          },
          primaryAction: 'Start',
          relation: 'Start button belongs to Example Game.',
          status: 'success',
          targetMatched: 'Example Game',
          visualActionReadiness: 'ready',
        },
        verificationEvidence: ['Focused crop verified the target/action relation and coordinate.'],
      },
      verification: 'Focused crop verified the target-owned action coordinate.',
    };
  },
  userGoal: 'start Example Game inside Launcher',
});

assert.equal(modelCallCount, 1);
assert.equal(result.status, 'needs-approval');
assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
const stepsJson = String(result.pendingApproval?.command.toolCall?.input.stepsJson);
assert.match(stepsJson, /1250/u);
assert.match(stepsJson, /760/u);
assert.doesNotMatch(stepsJson, /generic-start/u);
assert.doesNotMatch(stepsJson, /900/u);
assert.doesNotMatch(stepsJson, /500/u);

console.log('agent session v2 generic UIA action conflict smoke ok');
