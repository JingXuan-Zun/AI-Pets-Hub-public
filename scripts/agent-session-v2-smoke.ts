import assert from 'node:assert/strict';
import {
  resolveAgentSessionV2Instruction,
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentSessionV2ModelCaller,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

assert.equal(resolveAgentSessionV2Instruction('/agent check displays'), 'check displays');
assert.equal(resolveAgentSessionV2Instruction('/check displays'), 'check displays');
assert.equal(resolveAgentSessionV2Instruction('normal chat'), null);

const settings = {} as PetConfig['settings'];

const displayModelInputs: string[] = [];
let displayModelCallCount = 0;
const displayModelCaller: AgentSessionV2ModelCaller = async ({ systemInstruction, userInput }) => {
  displayModelCallCount += 1;
  displayModelInputs.push(userInput);
  assert.match(systemInstruction, /model-driven desktop agent loop/u);

  if (displayModelCallCount === 1) {
    return JSON.stringify({
      action: 'tool_call',
      args: { action: 'get_display_info' },
      reason: 'Need current display evidence before answering.',
      tool: 'execute_desktop_observation',
      understanding: {
        neededCapability: 'current display observation',
        successCriteria: 'display tool returns current screen metrics',
        userNeed: 'user wants current display information',
      },
    });
  }

  assert.match(userInput, /tool result/iu);
  assert.match(userInput, /2 displays: primary 2560x1440, secondary 3440x1440/u);
  return JSON.stringify({
    action: 'final_answer',
    message: 'I can see 2 displays: primary 2560x1440, secondary 3440x1440.',
    understanding: {
      successCriteria: 'answered from current display tool evidence',
      userNeed: 'user wants current display information',
    },
  });
};

const displayToolCommands: AgentChatCommand[] = [];
const displayResult = await runAgentProductionSession({
  modelCaller: displayModelCaller,
  settings,
  sourceText: '/agent check displays',
  toolExecutor: async (command) => {
    displayToolCommands.push(command);
    return {
      observations: ['Display 1 primary 2560x1440', 'Display 2 secondary 3440x1440'],
      ok: true,
      responseText: '2 displays: primary 2560x1440, secondary 3440x1440',
      verification: 'read 2 displays',
    };
  },
  userGoal: 'check displays',
});

// The successful read-only observation satisfies the task, so the runtime
// answers from the tool evidence without a second model turn.
assert.equal(displayResult.status, 'completed');
assert.equal(displayResult.finalAnswer, '2 displays: primary 2560x1440, secondary 3440x1440');
assert.equal(displayModelInputs.length, 1);
assert.match(displayResult.continuation.historyLines.join('\n'), /Runtime read-only terminal:/u);
assert.equal(displayToolCommands.length, 1);
assert.equal(displayToolCommands[0]?.toolCall?.name, 'execute_desktop_observation');
assert.equal(displayToolCommands[0]?.toolCall?.input.action, 'get_display_info');
assert.equal(displayResult.steps[0]?.understanding?.userNeed, 'user wants current display information');
assert.doesNotMatch(displayResult.continuation.historyLines.join('\n'), /fast path decision/u);

console.log('agent session v2 smoke ok');
