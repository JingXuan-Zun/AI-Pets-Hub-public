import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];
let modelCallCount = 0;
const executedTools: string[] = [];

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
    executedTools.push(command.toolCall?.name ?? 'unknown');
    if (command.toolCall?.name === 'locate_screen_elements') {
      assert.equal(command.capabilityId, 'desktop-observation');
      assert.equal(command.toolCall.input.sourceQuery, 'Launcher');
      // The runtime may follow up with one read-only focused refinement whose
      // target description extends the original one with the focused candidate.
      assert.match(
        String(command.toolCall.input.targetDescription),
        /^Game and its associated launch button/u,
      );
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

    throw new Error(`unexpected tool execution before approval: ${command.toolCall?.name}`);
  },
  userGoal: 'open Game inside Launcher',
});

// One model turn to locate, one runtime-driven read-only focused refinement,
// then one model turn selecting the click sequence, which must pause for
// approval against the still-current target surface (not loop as stale).
assert.equal(modelCallCount, 2);
assert.deepEqual(executedTools, ['locate_screen_elements', 'locate_screen_elements']);
assert.equal(result.status, 'needs-approval');
assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
assert.match(String(result.pendingApproval?.command.toolCall?.input.stepsJson), /execute_desktop_input/u);
assert.ok(result.pendingApproval?.surfaceId, 'approval should be bound to the observed surface');
const history = result.continuation.historyLines.join('\n');
assert.match(history, /selected approval-required tool:\ntool=execute_desktop_sequence/u);
assert.doesNotMatch(history, /target-stale/u);

console.log('agent session v2 in-app launch flow smoke ok');
