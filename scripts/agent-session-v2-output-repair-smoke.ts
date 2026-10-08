import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentSessionV2ModelCaller,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];

let invalidJsonModelCalls = 0;
const invalidJsonResult = await runAgentProductionSession({
  maxSteps: 4,
  modelCaller: async ({ userInput }) => {
    invalidJsonModelCalls += 1;

    if (invalidJsonModelCalls === 1) {
      return JSON.stringify({
        action: 'tool_call',
        args: {
          includeActiveWindow: true,
          includeDisplays: true,
          includeRunningApps: true,
          query: 'WeGame',
        },
        reason: 'Need current window evidence before deciding.',
        tool: 'observe_windows_and_apps',
        understanding: {
          neededCapability: 'window observation',
          remainingGoals: ['decide whether WeGame needs a login handoff'],
          userNeed: 'open League of Legends from WeGame',
          verificationStatus: 'unknown',
        },
      });
    }

    if (invalidJsonModelCalls === 2) {
      assert.match(userInput, /Observed apps\/windows/u);
      return '我看到了 WeGame，但还没有返回 JSON。';
    }

    assert.match(userInput, /rejected invalid model output/u);
    assert.match(userInput, /Return exactly one JSON object/u);
    return JSON.stringify({
      action: 'ask_user',
      message: 'WeGame 当前需要你先完成账号登录，我等你登录后再继续。',
      understanding: {
        blockedGoals: ['login is a private user step'],
        completedGoals: ['WeGame window was observed'],
        remainingGoals: ['continue after login'],
        userNeed: 'open League of Legends from WeGame',
        verificationStatus: 'blocked',
        verificationEvidence: ['WeGame is present but login is private'],
      },
    });
  },
  settings,
  sourceText: '/agent 在WeGame中打开英雄联盟',
  toolExecutor: async (command: AgentChatCommand) => {
    assert.equal(command.toolCall?.name, 'observe_windows_and_apps');
    return {
      observations: ['Observed apps/windows: running=1. Active window: WeGame'],
      ok: true,
      responseText: 'Observed apps/windows: running=1. Active window: WeGame',
      verification: 'Window/app observation returned current running window evidence.',
    };
  },
  userGoal: '在WeGame中打开英雄联盟',
});

assert.equal(invalidJsonResult.status, 'needs-user');
assert.equal(invalidJsonModelCalls, 3);
assert.match(invalidJsonResult.finalAnswer, /登录/u);
assert.equal(invalidJsonResult.toolResults.length, 1);

let unknownToolModelCalls = 0;
const unknownToolModelCaller: AgentSessionV2ModelCaller = async ({ userInput }) => {
  unknownToolModelCalls += 1;

  if (unknownToolModelCalls === 1) {
    return JSON.stringify({
      action: 'tool_call',
      args: {},
      reason: 'Need an unspecified desktop action.',
      tool: 'unknown',
      understanding: {
        neededCapability: 'desktop operation',
        remainingGoals: ['choose a valid tool'],
        userNeed: 'open a target inside WeGame',
        verificationStatus: 'unknown',
      },
    });
  }

  if (unknownToolModelCalls === 3) {
    assert.match(userInput, /Observed apps\/windows/u);
    return JSON.stringify({
      action: 'ask_user',
      message: '已改用有效工具观察到 WeGame 窗口，但里面具体入口还需要登录后再识别。',
      understanding: {
        completedGoals: ['WeGame window was observed with a valid tool'],
        remainingGoals: ['continue after launcher login'],
        userNeed: 'open a target inside WeGame',
        verificationStatus: 'partial',
        verificationEvidence: ['Observed apps/windows returned WeGame'],
        verificationGaps: ['in-app target state is not yet visible'],
      },
    });
  }

  assert.match(userInput, /rejected unavailable tool selection/u);
  assert.match(userInput, /Allowed primary tools/u);
  assert.match(userInput, /observe_windows_and_apps/u);
  return JSON.stringify({
    action: 'tool_call',
    args: {
      includeActiveWindow: true,
      includeRunningApps: true,
      query: 'WeGame',
    },
    reason: 'Use a valid primary observation tool to inspect the launcher state.',
    tool: 'observe_windows_and_apps',
    understanding: {
      neededCapability: 'window observation',
      remainingGoals: ['inspect WeGame state'],
      userNeed: 'open a target inside WeGame',
      verificationStatus: 'unknown',
    },
  });
};

const unknownToolResult = await runAgentProductionSession({
  maxSteps: 4,
  modelCaller: unknownToolModelCaller,
  settings,
  sourceText: '/agent 在WeGame中打开英雄联盟',
  toolExecutor: async (command: AgentChatCommand) => {
    assert.equal(command.toolCall?.name, 'observe_windows_and_apps');
    return {
      observations: ['Observed apps/windows: running=1. Active window: WeGame'],
      ok: true,
      responseText: 'Observed apps/windows: running=1. Active window: WeGame',
      verification: 'Window/app observation returned current running window evidence.',
    };
  },
  userGoal: '在WeGame中打开英雄联盟',
});

assert.equal(unknownToolModelCalls, 3);
assert.equal(unknownToolResult.status, 'needs-user');
assert.equal(unknownToolResult.toolResults.length, 1);
assert.equal(unknownToolResult.toolResults[0]?.command.toolCall?.name, 'observe_windows_and_apps');
assert.notEqual(unknownToolResult.steps.some((step) => step.errorText?.includes('Tool "unknown"')), true);


let sharedRepairModelCalls = 0;
let sharedRepairToolCalls = 0;
const sharedRepairResult = await runAgentProductionSession({
  maxSteps: 4,
  modelCaller: async ({ userInput }) => {
    sharedRepairModelCalls += 1;
    if (sharedRepairModelCalls === 1) return 'invalid JSON before parallel selection';
    if (sharedRepairModelCalls === 2 || sharedRepairModelCalls === 3) {
      if (sharedRepairModelCalls === 3) assert.match(userInput, /rejected invalid parallel tool selection/u);
      return JSON.stringify({action: 'tool_calls', tools: [{tool: 'unavailable_shared_repair_tool', args: {}}]});
    }
    assert.match(userInput, /rejected parallel tool calls/u);
    return JSON.stringify({action: 'ask_user', message: 'The requested tool is unavailable.'});
  },
  settings,
  sourceText: '/agent inspect the environment',
  toolExecutor: async () => {
    sharedRepairToolCalls += 1;
    throw new Error('Unavailable tools must never execute.');
  },
  userGoal: 'inspect the environment',
});
assert.equal(sharedRepairModelCalls, 4);
assert.equal(sharedRepairToolCalls, 0);
assert.equal(sharedRepairResult.status, 'needs-user');
assert.equal(sharedRepairResult.steps.filter((step) => step.errorText?.startsWith('Parallel tool_calls can only run silent read-only tools.')).length, 1);

let singleSharedRepairModelCalls = 0;
let singleSharedRepairToolCalls = 0;
const singleSharedRepairResult = await runAgentProductionSession({
  maxSteps: 4,
  modelCaller: async ({ userInput }) => {
    singleSharedRepairModelCalls += 1;
    if (singleSharedRepairModelCalls === 1) return 'invalid JSON before shared selections';
    if (singleSharedRepairModelCalls === 2) {
      return JSON.stringify({action: 'tool_calls', tools: [{tool: 'unavailable_shared_repair_tool', args: {}}]});
    }
    if (singleSharedRepairModelCalls === 3) {
      assert.match(userInput, /rejected invalid parallel tool selection/u);
      return JSON.stringify({action: 'tool_call', tool: 'unavailable_shared_single_tool', args: {}});
    }
    assert.match(userInput, /Tool "unavailable_shared_single_tool" is not available/u);
    return JSON.stringify({action: 'ask_user', message: 'The requested tool is unavailable.'});
  },
  settings,
  sourceText: '/agent inspect the environment',
  toolExecutor: async () => {
    singleSharedRepairToolCalls += 1;
    throw new Error('Unavailable tools must never execute.');
  },
  userGoal: 'inspect the environment',
});
assert.equal(singleSharedRepairModelCalls, 4);
assert.equal(singleSharedRepairToolCalls, 0);
assert.equal(singleSharedRepairResult.status, 'needs-user');
assert.equal(singleSharedRepairResult.steps.filter((step) => step.errorText?.includes('Tool "unavailable_shared_single_tool" is not available')).length, 1);

console.log('agent session v2 output repair smoke ok');
