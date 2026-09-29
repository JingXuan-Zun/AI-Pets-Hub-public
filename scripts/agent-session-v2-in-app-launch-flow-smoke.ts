import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];
let modelCallCount = 0;

const result = await runAgentProductionSession({
  maxSteps: 4,
  modelCaller: async ({ systemInstruction, userInput }) => {
    modelCallCount += 1;
    assert.match(systemInstruction, /in-app UI operation/u);
    assert.match(systemInstruction, /locate_screen_elements/u);
    assert.match(systemInstruction, /execute_desktop_sequence/u);

    if (modelCallCount === 1) {
      return JSON.stringify({
        action: 'tool_call',
        args: {
          action: 'locate_element',
          sourceQuery: 'Launcher',
          sourceType: 'window',
          targetDescription: 'Game and its associated launch button',
        },
        reason: 'Need visual evidence inside the launcher before clicking the launch button.',
        tool: 'locate_screen_elements',
      });
    }

    assert.match(userInput, /tool=locate_screen_elements/u);
    assert.match(userInput, /target=Game/u);
    assert.match(userInput, /primaryAction=Launch button/u);
    assert.match(userInput, /elementCenter=1715,1050/u);

    return JSON.stringify({
      action: 'tool_call',
      args: {
        stepsJson: JSON.stringify([
          {
            args: {
              action: 'click',
              x: 1715,
              y: 1050,
            },
            reason: 'Click the visually located launch button.',
            tool: 'execute_desktop_input',
          },
        ]),
      },
      reason: 'The target/action evidence is ready, so request one approval for the click.',
      tool: 'execute_desktop_sequence',
    });
  },
  settings,
  sourceText: '/agent open Game inside Launcher',
  toolExecutor: async (command: AgentChatCommand) => {
    if (command.toolCall?.name === 'locate_screen_elements') {
      assert.equal(command.capabilityId, 'desktop-observation');
      assert.equal(command.toolCall.input.sourceQuery, 'Launcher');
      assert.equal(command.toolCall.input.targetDescription, 'Game and its associated launch button');
      return {
        observations: [
          'Screen element locate action: locate_element',
          'Source query: Launcher',
          'Target element: Game and its associated launch button',
          'Visual target matched: Game',
          'Visual primary action: Launch button',
          'Visual element region: bottom right, button center around x=1715 y=1050',
          'Visual target/action relation: Launch button belongs to the selected Game page',
          'Visual confidence: 0.86',
        ],
        ok: true,
        responseText: 'Screen element observation: Game launch button is visible.',
        stateSummary: {
          observedState: [
            'Visual target matched: Game',
            'Visual primary action: Launch button',
            'Visual element region: bottom right, button center around x=1715 y=1050',
            'Visual target/action relation: Launch button belongs to the selected Game page',
          ],
          structuredEvidence: {
            confidence: 'high',
            coordinateConfidence: 'high',
            elementCenter: {
              coordinateSpace: 'native-screen',
              source: 'test',
              x: 1715,
              y: 1050,
            },
            elementRegion: 'bottom right, button center around x=1715 y=1050',
            primaryAction: 'Launch button',
            relation: 'Launch button belongs to the selected Game page',
            status: 'success',
            targetMatched: 'Game',
            visualActionReadiness: 'ready',
          },
          verificationEvidence: ['Visual confidence: 0.86'],
        },
        verification: 'locate_screen_elements verified the target and launch button.',
      };
    }

    throw new Error('execute_desktop_sequence should pause for approval before running');
  },
  userGoal: 'open Game inside Launcher',
});

assert.equal(modelCallCount, 1);
assert.equal(result.status, 'needs-approval');
assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
assert.match(String(result.pendingApproval?.command.toolCall?.input.stepsJson), /execute_desktop_input/u);
assert.match(result.continuation.historyLines.join('\n'), /prepared visual-action approval/u);

console.log('agent session v2 in-app launch flow smoke ok');
