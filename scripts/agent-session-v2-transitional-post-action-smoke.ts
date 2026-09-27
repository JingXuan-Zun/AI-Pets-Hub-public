import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentChatCommandResult,
} from '../src/agent/legacy/index.ts';
import { inferAgentRuntimeDesktopSequencePostActionState } from '../src/agent/agentRuntimeDesktopSequenceTools.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];

assert.equal(
  inferAgentRuntimeDesktopSequencePostActionState({
    observations: [
      'No visible error text.',
      'The client is initializing and connecting to the server.',
    ],
    ok: true,
    responseText: 'No visible error text. The client is initializing and connecting to server.',
    verification: 'The target is not launched yet.',
  }),
  'loading',
);

assert.equal(
  inferAgentRuntimeDesktopSequencePostActionState({
    observations: [
      'No visible error text.',
      'The launch request is waiting in queue, position 3.',
    ],
    ok: true,
    responseText: 'No visible error text. Waiting in queue before the game opens.',
    verification: 'The target is queued and not launched yet.',
  }),
  'updating',
);

function createSequenceCommand(): AgentChatCommand {
  return {
    capabilityId: 'app-launcher',
    instruction: 'start Example Game from Launcher',
    kind: 'tool-call',
    sourceText: '/agent start Example Game from Launcher',
    toolCall: {
      goal: 'start Example Game from Launcher',
      input: {
        postVerifyVisualQuery: 'Example Game',
        stepsJson: JSON.stringify([
          {
            args: {
              action: 'click',
              button: 'left',
              x: 900,
              y: 620,
            },
            reason: 'Click the Start button for Example Game.',
            tool: 'execute_desktop_input',
          },
        ]),
      },
      name: 'execute_desktop_sequence',
    },
  };
}

function createApprovedSequenceResult(): AgentChatCommandResult {
  return {
    observations: ['Clicked the Start button for Example Game.'],
    ok: true,
    receipt: {
      evidenceLines: ['Step 1/1 tool=execute_desktop_input status=ok'],
      status: 'success',
      summaryLines: ['Call: execute_desktop_sequence'],
      title: 'Agent desktop sequence',
      toolName: 'execute_desktop_sequence',
      verification: 'The click primitive completed, but the final launch is not verified yet.',
    },
    responseText: 'Desktop sequence completed 1/1 step(s).',
    verification: 'The click primitive completed.',
  };
}

let toolCallCount = 0;

const result = await runAgentProductionSession({
  approvedToolResult: {
    command: createSequenceCommand(),
    result: createApprovedSequenceResult(),
  },
  maxSteps: 3,
  modelCaller: async () => {
    throw new Error('model should not be called while transitional post-action recovery can continue');
  },
  settings,
  sourceText: '/agent start Example Game from Launcher',
  toolExecutor: async (command) => {
    toolCallCount += 1;

    if (toolCallCount === 1) {
      assert.equal(command.toolCall?.name, 'execute_desktop_observation');
      assert.equal(command.toolCall.input.action, 'summarize_visual_snapshot');
      assert.match(String(command.toolCall.input.question), /AgentRuntime post-action verification/u);
      return {
        observations: [
          'No visible error text.',
          'The client is initializing and connecting to the server.',
          'Example Game window is not visible yet.',
        ],
        ok: true,
        receipt: {
          evidenceLines: [
            'No visible error text.',
            'The client is initializing and connecting to the server.',
          ],
          status: 'unverified',
          summaryLines: ['Call: execute_desktop_observation summarize_visual_snapshot'],
          title: 'Post approval visual verification',
          toolName: 'execute_desktop_observation',
          verification: 'The target is still initializing and not launched yet.',
        },
        responseText: 'No visible error text. The client is initializing and connecting to server.',
        verification: 'The target is still initializing and not launched yet.',
      };
    }

    assert.equal(toolCallCount, 2);
    assert.equal(command.toolCall?.name, 'execute_desktop_observation');
    assert.equal(command.toolCall.input.action, 'wait_and_observe');
    assert.equal(command.toolCall.input.recoveryPostActionState, 'loading');
    assert.equal(command.toolCall.input.query, 'Example Game');
    return {
      observations: [
        'Example Game main window is visible.',
        'The requested game appears launched.',
      ],
      ok: true,
      receipt: {
        evidenceLines: ['Example Game main window is visible.'],
        status: 'success',
        summaryLines: ['Call: execute_desktop_observation wait_and_observe'],
        title: 'Agent wait and observe',
        toolName: 'execute_desktop_observation',
        verification: 'Example Game launched.',
      },
      responseText: 'Example Game main window is visible.',
      stateSummary: {
        observedState: ['Example Game main window is visible.'],
        structuredEvidence: {
          finalWindow: {
            hwnd: 301,
            processName: 'example-game',
            title: 'Example Game',
          },
          postActionState: 'launched',
          status: 'success',
          targetMatched: 'Example Game',
        },
        verificationEvidence: ['Example Game main window is visible.'],
      },
      verification: 'Example Game launched.',
    };
  },
  userGoal: 'start Example Game from Launcher',
});

assert.equal(result.status, 'completed');
assert.equal(toolCallCount, 2);
assert.match(result.continuation.historyLines.join('\n'), /postActionState=loading/u);
assert.match(result.continuation.historyLines.join('\n'), /postActionState=launched/u);

console.log('agent session v2 transitional post action smoke ok');
