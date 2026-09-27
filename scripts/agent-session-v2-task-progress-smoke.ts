import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
} from '../src/agent/legacy/index.ts';
import { createAgentTaskProgressText } from '../src/agent/runtime/agentTaskProgressSignal.ts';
import { type PetConfig } from '../src/types.ts';

const runtimeProgressText = createAgentTaskProgressText([{
  action: 'tool_call',
  index: 1,
  summary: 'task progress runtime smoke',
  understanding: {
    completedGoals: ['observe display information'],
    remainingGoals: ['observe system information'],
    successCriteria: 'answer from fresh local evidence',
    userNeed: 'report display and system information',
    verificationEvidence: ['Display observation: Primary 2560x1440'],
    verificationStatus: 'partial',
  },
}]);
assert.match(runtimeProgressText, /completedGoals=observe display information/u);
assert.match(runtimeProgressText, /remainingGoals=observe system information/u);
assert.match(runtimeProgressText, /verificationStatus=partial/u);
assert.equal(createAgentTaskProgressText([]), '');

const settings = {} as PetConfig['settings'];
let modelCallCount = 0;
const toolCommands: AgentChatCommand[] = [];

const result = await runAgentProductionSession({
  maxSteps: 6,
  modelCaller: async ({ userInput }) => {
    modelCallCount += 1;

    if (modelCallCount === 1) {
      assert.match(userInput, /Loop history:\s*none/u);
      return JSON.stringify({
        action: 'tool_call',
        args: {
          action: 'get_display_info',
          forceRefresh: true,
        },
        reason: 'Need live display evidence for the first part of the request.',
        tool: 'execute_desktop_observation',
        understanding: {
          completedGoals: [],
          remainingGoals: [
            'observe display information',
            'observe system information',
          ],
          successCriteria: 'answer both display information and system information from fresh local evidence',
          userNeed: 'tell the user current display and system information',
        },
      });
    }

    if (modelCallCount === 2) {
      assert.match(userInput, /Current task progress board:/u);
      assert.match(userInput, /remainingGoals=observe display information \| observe system information/u);
      assert.match(userInput, /Display observation: Primary 2560x1440/u);
      return JSON.stringify({
        action: 'final_answer',
        message: 'Display information is available.',
        understanding: {
          completedGoals: [
            'observe display information',
          ],
          remainingGoals: [
            'observe system information',
          ],
          successCriteria: 'answer both display information and system information from fresh local evidence',
          userNeed: 'tell the user current display and system information',
        },
      });
    }

    if (modelCallCount === 3) {
      assert.match(userInput, /rejected incomplete task progress final answer/u);
      assert.match(userInput, /remainingGoals=observe system information/u);
      return JSON.stringify({
        action: 'tool_call',
        args: {
          action: 'get_system_info',
          forceRefresh: true,
        },
        reason: 'The task progress board still has system information remaining.',
        tool: 'execute_desktop_observation',
        understanding: {
          completedGoals: [
            'observe display information',
          ],
          remainingGoals: [
            'observe system information',
          ],
          successCriteria: 'answer both display information and system information from fresh local evidence',
          userNeed: 'tell the user current display and system information',
        },
      });
    }

    assert.match(userInput, /System observation: RAM 32GB/u);
    return JSON.stringify({
      action: 'final_answer',
      message: 'Display is 2560x1440 and RAM is 32GB.',
      understanding: {
        completedGoals: [
          'observe display information',
          'observe system information',
        ],
        remainingGoals: [],
        successCriteria: 'answer both display information and system information from fresh local evidence',
        userNeed: 'tell the user current display and system information',
      },
    });
  },
  settings,
  sourceText: '/agent 看一下我的屏幕和电脑基本信息',
  toolExecutor: async (command) => {
    toolCommands.push(command);
    assert.equal(command.toolCall?.name, 'execute_desktop_observation');

    const action = command.toolCall?.input.action;
    if (action === 'get_display_info') {
      return {
        observations: [
          'Display observation: Primary 2560x1440',
        ],
        ok: true,
        receipt: {
          evidenceLines: [
            'Display observation: Primary 2560x1440',
          ],
          status: 'success',
          summaryLines: [
            'Call: execute_desktop_observation get_display_info',
          ],
          title: 'Agent display observation',
          toolName: 'execute_desktop_observation',
          verification: 'Display information was observed.',
        },
        responseText: 'Display observation: Primary 2560x1440',
        verification: 'Display information was observed.',
      };
    }

    if (action === 'get_system_info') {
      return {
        observations: [
          'System observation: RAM 32GB',
        ],
        ok: true,
        receipt: {
          evidenceLines: [
            'System observation: RAM 32GB',
          ],
          status: 'success',
          summaryLines: [
            'Call: execute_desktop_observation get_system_info',
          ],
          title: 'Agent system observation',
          toolName: 'execute_desktop_observation',
          verification: 'System information was observed.',
        },
        responseText: 'System observation: RAM 32GB',
        verification: 'System information was observed.',
      };
    }

    throw new Error(`Unexpected action: ${String(action)}`);
  },
  userGoal: '看一下我的屏幕和电脑基本信息',
});

assert.equal(result.status, 'completed');
assert.equal(modelCallCount, 4);
assert.equal(toolCommands.length, 2);
assert.equal(toolCommands[0]?.toolCall?.input.action, 'get_display_info');
assert.equal(toolCommands[1]?.toolCall?.input.action, 'get_system_info');
assert.equal(result.finalAnswer, 'Display is 2560x1440 and RAM is 32GB.');
assert.match(result.continuation.historyLines.join('\n'), /rejected incomplete task progress final answer/u);

console.log('agent session v2 task progress smoke ok');
