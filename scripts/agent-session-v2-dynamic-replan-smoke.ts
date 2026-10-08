import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];
let modelCallCount = 0;
const toolCommands: AgentChatCommand[] = [];

const result = await runAgentProductionSession({
  maxSteps: 7,
  modelCaller: async ({ userInput }) => {
    modelCallCount += 1;

    if (modelCallCount === 1) {
      assert.doesNotMatch(userInput, /Current replanning signal:/u);
      return JSON.stringify({
        action: 'tool_call',
        args: {
          action: 'summarize_visual_snapshot',
          query: 'current launcher button',
          sourceId: 'missing-source',
        },
        reason: 'Try to inspect the requested launcher UI.',
        tool: 'execute_desktop_observation',
        understanding: {
          completedGoals: [],
          remainingGoals: [
            'identify launcher state',
            'start the requested item',
          ],
          successCriteria: 'identify the visible launcher state and continue toward the requested start action',
          userNeed: 'start something inside a launcher',
        },
      });
    }

    if (modelCallCount === 2) {
      assert.match(userInput, /Current replanning signal:/u);
      assert.match(userInput, /reason=latest_tool_failed/u);
      assert.match(userInput, /failedTool=execute_desktop_observation/u);
      assert.match(userInput, /sourceId(?:"\s*:\s*"|=)missing-source/u);
      assert.match(userInput, /requiredReplan=Do not repeat the same tool with the same args/u);
      return JSON.stringify({
        action: 'tool_call',
        args: {
          action: 'summarize_visual_snapshot',
          query: 'current launcher button',
          sourceId: 'missing-source',
        },
        reason: 'Incorrectly repeats the same failed visual source.',
        tool: 'execute_desktop_observation',
        understanding: {
          completedGoals: [],
          remainingGoals: [
            'identify launcher state',
            'start the requested item',
          ],
          successCriteria: 'identify the visible launcher state and continue toward the requested start action',
          userNeed: 'start something inside a launcher',
        },
      });
    }

    if (modelCallCount === 3) {
      assert.match(userInput, /rejected repeated failed tool call before execution/u);
      assert.match(userInput, /previousError=Capture source missing/u);
      return JSON.stringify({
        action: 'tool_call',
        args: {
          action: 'list_capture_sources',
          forceRefresh: true,
        },
        reason: 'Change strategy and discover valid capture sources before retrying visual analysis.',
        tool: 'execute_desktop_observation',
        understanding: {
          completedGoals: [],
          remainingGoals: [
            'identify launcher state',
            'start the requested item',
          ],
          successCriteria: 'identify the visible launcher state and continue toward the requested start action',
          userNeed: 'start something inside a launcher',
        },
      });
    }

    assert.match(userInput, /Capture source candidate: League Client/u);
    return JSON.stringify({
      action: 'final_answer',
      message: '我已经重新规划，先找到了可用的窗口来源。',
      understanding: {
        blockedGoals: [
          'start the requested item requires a follow-up click approval after locating the specific button',
        ],
        completedGoals: [
          'identify launcher state',
        ],
        remainingGoals: [],
        successCriteria: 'identify the visible launcher state and explain the next required approval step',
        userNeed: 'start something inside a launcher',
      },
    });
  },
  settings,
  sourceText: '/agent 看看启动器现在显示什么',
  toolExecutor: async (command) => {
    toolCommands.push(command);
    assert.equal(command.toolCall?.name, 'execute_desktop_observation');

    const action = command.toolCall?.input.action;
    if (action === 'summarize_visual_snapshot') {
      return {
        errorText: 'Capture source missing',
        observations: [
          'The requested capture source id is not available.',
        ],
        ok: false,
        responseText: 'Could not capture the requested source.',
      };
    }

    if (action === 'list_capture_sources') {
      return {
        observations: [
          'Capture source candidate: League Client',
        ],
        ok: true,
        receipt: {
          evidenceLines: [
            'Capture source candidate: League Client',
          ],
          status: 'success',
          summaryLines: [
            'Call: execute_desktop_observation list_capture_sources',
          ],
          title: 'Agent capture source observation',
          toolName: 'execute_desktop_observation',
          verification: 'Capture sources were listed.',
        },
        responseText: 'Capture source candidate: League Client',
        verification: 'Capture sources were listed.',
      };
    }

    throw new Error(`Unexpected action: ${String(action)}`);
  },
  userGoal: '看看启动器现在显示什么',
});

assert.equal(result.status, 'completed');
assert.equal(modelCallCount, 4);
const executedActions = toolCommands.map((command) => command.toolCall?.input.action);
assert.deepEqual(
  executedActions.filter((action) => action === 'summarize_visual_snapshot'),
  ['summarize_visual_snapshot'],
  'the repeated failed visual summary should be rejected before execution',
);
assert.equal(executedActions.at(-1), 'list_capture_sources');
assert.match(result.continuation.historyLines.join('\n'), /rejected repeated failed tool call before execution/u);

console.log('agent session v2 dynamic replan smoke ok');
