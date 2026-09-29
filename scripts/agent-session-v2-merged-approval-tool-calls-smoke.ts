import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];
let modelCallCount = 0;
let toolExecutorCallCount = 0;

const result = await runAgentProductionSession({
  maxSteps: 3,
  modelCaller: async () => {
    modelCallCount += 1;
    return JSON.stringify({
      action: 'tool_calls',
      reason: 'Open the requested app and move its window to the secondary display with one approval.',
      tools: [
        {
          args: {
            action: 'launch_local_app',
            target: 'Example App',
          },
          reason: 'Open or focus Example App.',
          tool: 'execute_desktop_action',
        },
        {
          args: {
            action: 'move_window_to_display',
            preserveSize: true,
            target: 'Example App',
            targetDisplay: 'secondary',
          },
          reason: 'Move Example App to the secondary display.',
          tool: 'execute_desktop_action',
        },
      ],
      understanding: {
        completedGoals: [],
        remainingGoals: [
          'open Example App',
          'move Example App to the secondary display',
        ],
        successCriteria: 'Example App is open and visible on the secondary display.',
        userNeed: 'open Example App and move it to the secondary display',
        verificationEvidence: [],
        verificationGaps: [],
        verificationStatus: 'unknown',
      },
    });
  },
  settings,
  sourceText: '/agent open Example App and move it to the secondary display',
  toolExecutor: async (_command: AgentChatCommand) => {
    toolExecutorCallCount += 1;
    throw new Error('merged approval should not execute tools before the user approves');
  },
  userGoal: 'open Example App and move it to the secondary display',
});

assert.equal(modelCallCount, 1);
assert.equal(toolExecutorCallCount, 0);
assert.equal(result.status, 'needs-approval');
assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');

const stepsJson = String(result.pendingApproval?.command.toolCall?.input.stepsJson);
assert.match(stepsJson, /launch_local_app/u);
assert.match(stepsJson, /move_window_to_display/u);
assert.match(stepsJson, /Example App/u);
assert.match(stepsJson, /secondary/u);
assert.match(result.continuation.historyLines.join('\n'), /prepared merged approval-required tool_calls/u);

console.log('agent session v2 merged approval tool calls smoke ok');
