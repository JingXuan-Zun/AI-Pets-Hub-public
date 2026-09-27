import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const { registrySource, sessionSource } = readProjectSources({
  registrySource: 'src/agent/agentToolRegistry.ts',
  sessionSource: 'src/agent/agentProductionSessionImplementation.ts',
});

assert.match(registrySource, /folder contains an app, launcher, shortcut, executable, or startup method/u);
assert.match(sessionSource, /A top-level list_directory alone is not enough/u);

const settings = {} as PetConfig['settings'];
const userGoal = '查一下 D:\\we 里面是不是有 WeGame 的启动方式';
let modelCallCount = 0;
let toolCallCount = 0;

const result = await runAgentProductionSession({
  maxSteps: 6,
  modelCaller: async ({ systemInstruction }) => {
    modelCallCount += 1;
    assert.match(systemInstruction, /search_files/u);
    assert.match(systemInstruction, /\.exe,\.lnk,\.url,\.appref-ms/u);

    if (modelCallCount === 1) {
      return JSON.stringify({
        action: 'tool_call',
        args: {
          action: 'search_files',
          extensions: '.exe,.lnk,.url,.appref-ms',
          maxDepth: 5,
          path: 'D:\\we',
          query: 'wegame',
        },
        reason: 'Need to search inside the provided folder for WeGame launch files instead of only listing the top level.',
        tool: 'execute_local_file_action',
        understanding: {
          completedGoals: ['resolved search root D:\\we'],
          remainingGoals: ['find WeGame launch file candidates'],
          successCriteria: 'WeGame launch file candidates under D:\\we are searched by filename',
          userNeed: userGoal,
          verificationEvidence: [],
          verificationGaps: ['Need recursive filename search evidence.'],
          verificationStatus: 'unknown',
        },
      });
    }

    return JSON.stringify({
      action: 'final_answer',
      message: '在 D:\\we 里找到了 WeGame.exe，可以作为启动方式候选。',
      understanding: {
        completedGoals: ['searched D:\\we for WeGame launch files'],
        remainingGoals: [],
        successCriteria: 'WeGame launch file candidates under D:\\we are searched by filename',
        userNeed: userGoal,
        verificationEvidence: ['search_files returned D:\\we\\WeGame\\WeGame.exe'],
        verificationGaps: [],
        verificationStatus: 'satisfied',
      },
    });
  },
  settings,
  sourceText: `/agent ${userGoal}`,
  toolExecutor: async (command: AgentChatCommand) => {
    toolCallCount += 1;
    assert.equal(command.toolCall?.name, 'execute_local_file_action');
    assert.equal(command.toolCall.input.action, 'search_files');
    assert.equal(command.toolCall.input.path, 'D:\\we');
    assert.equal(command.toolCall.input.query, 'wegame');
    assert.equal(command.toolCall.input.extensions, '.exe,.lnk,.url,.appref-ms');
    assert.equal(command.toolCall.input.maxDepth, 5);

    return {
      observations: [
        'Local file action: search_files',
        'Search root: D:\\we',
        'Search query: wegame',
        '1. [file] WeGame.exe -> D:\\we\\WeGame\\WeGame.exe',
      ],
      ok: true,
      responseText: '在 D:\\we 中按文件名搜索“wegame”，找到 1 项：D:\\we\\WeGame\\WeGame.exe',
      verification: 'searched filenames under D:\\we and found WeGame.exe',
    };
  },
  userGoal,
});

assert.equal(result.status, 'completed');
assert.equal(toolCallCount, 1);
assert.equal(result.toolResults[0]?.command.toolCall?.name, 'execute_local_file_action');
assert.equal(result.toolResults[0]?.command.toolCall?.input.action, 'search_files');

console.log('agent local folder app launcher search smoke ok');
