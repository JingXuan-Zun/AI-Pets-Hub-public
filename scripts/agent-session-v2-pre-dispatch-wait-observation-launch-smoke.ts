import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentChatCommandResult,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const target = 'Example Calculator';
const request = `打开 ${target}，等待它的窗口出现，只验证 ${target} 窗口已经出现，不要点击或操作应用内部控件。`;
let modelCallCount = 0;
const toolCommands: AgentChatCommand[] = [];

function createPreDispatchWaitResult(): AgentChatCommandResult {
  return {
    observations: ['Waited 3000ms, then observed current desktop state.'],
    ok: true,
    receipt: {
      evidenceLines: [`No running window matched ${target}.`],
      status: 'success',
      summaryLines: ['Call: execute_desktop_observation', 'Result: desktop state observed'],
      title: 'Desktop observation',
      toolName: 'execute_desktop_observation',
      verification: `No running window matched ${target}.`,
    },
    responseText: `Observed current desktop state; ${target} is not running.`,
    stateSummary: {
      structuredEvidence: {
        postActionRecovery: {
          nextArgs: { action: 'wait_and_observe', query: target },
          nextTool: 'execute_desktop_observation',
          reason: 'The requested window is not visible yet.',
          strategy: 'wait-for-window',
        },
        postActionState: 'waiting_window',
        status: 'success',
        targetMatched: target,
      },
    },
    verification: `No running window matched ${target}.`,
  };
}

const result = await runAgentProductionSession({
  maxSteps: 4,
  modelCaller: async ({ userInput }) => {
    modelCallCount += 1;
    if (modelCallCount === 1) {
      return JSON.stringify({
        action: 'tool_call',
        args: {
          action: 'wait_and_observe',
          forceRefresh: true,
          includeVisual: false,
          query: target,
          waitMs: 3000,
        },
        reason: 'Wait for the requested window before checking it.',
        tool: 'execute_desktop_observation',
      });
    }

    assert.match(userInput, /reason=observation_only_for_open_or_launch_request/u);
    assert.match(userInput, /requiredNextAction=open-or-launch/u);
    assert.match(userInput, /suggestedTool=execute_desktop_action/u);
    assert.match(userInput, /suggestedArgs=.*launch_local_app/u);
    return JSON.stringify({
      action: 'tool_call',
      args: { action: 'launch_local_app', target },
      reason: 'The read-only wait did not perform the requested launch.',
      tool: 'execute_desktop_action',
    });
  },
  settings: {} as PetConfig['settings'],
  sourceText: request,
  toolExecutor: async (command) => {
    toolCommands.push(command);
    assert.equal(
      command.toolCall?.name,
      'execute_desktop_observation',
      'the launch must stop at approval instead of executing silently',
    );
    return createPreDispatchWaitResult();
  },
  userGoal: request,
});

assert.equal(modelCallCount, 2, result.continuation.historyLines.join('\n'));
assert.deepEqual(toolCommands.map((command) => command.toolCall?.name), ['execute_desktop_observation']);
assert.equal(result.status, 'needs-approval');
assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_action');
assert.equal(result.pendingApproval?.command.toolCall?.input.action, 'launch_local_app');
assert.equal(result.pendingApproval?.command.toolCall?.input.target, target);
assert.equal(
  result.steps.some((step) => step.tool === 'execute_desktop_observation' && step.reason?.includes('automatic')),
  false,
  'pre-dispatch wait evidence must not start the automatic recovery loop',
);

console.log('agent session v2 pre-dispatch wait observation launch smoke ok');
