import assert from 'node:assert/strict';
import {
  runAgentSessionV3ExperimentalChatRunner,
  type AgentChatCommand,
} from '../src/agent/legacy/index.ts';

const command: AgentChatCommand = {
  capabilityId: 'app-launcher',
  instruction: 'open Game inside Launcher',
  kind: 'tool-call',
  sourceText: '/agent open Game inside Launcher',
  toolCall: {
    goal: 'open Game inside Launcher',
    input: {
      action: 'launch_local_app',
      target: 'Launcher',
    },
    name: 'execute_desktop_action',
  },
};

let modelCalled = false;
let executorCalled = false;

const result = await runAgentSessionV3ExperimentalChatRunner({
  approvedToolResult: {
    command,
    result: {
      observations: [
        'Tool: execute_desktop_action',
        'Desktop action: launch_local_app',
        'Launch status: launched-unverified',
        'Launch query: Launcher',
      ],
      ok: true,
      receipt: {
        evidenceLines: [
          'Launch status: launched-unverified',
          'Launch query: Launcher',
        ],
        status: 'unverified',
        summaryLines: [
          'Call: execute_desktop_action',
          'Result: launch request sent, window verification uncertain',
        ],
        title: 'Execution receipt',
        toolName: 'execute_desktop_action',
        verification: 'Launch request sent, but no focusable window was verified: no-window-match.',
      },
      responseText: 'Launch status: launched-unverified',
      verification: 'Launch request sent, but no focusable window was verified: no-window-match.',
    },
  },
  continuation: {
    historyLines: [],
    sourceText: '/agent open Game inside Launcher',
    steps: [],
    toolResults: [],
    userGoal: 'open Game inside Launcher',
  },
  modelCaller: async () => {
    modelCalled = true;
    throw new Error('approval resume should evaluate unverified launch without a new model call');
  },
  settings: {
    agentRuntimeMode: 'v3-experimental',
  },
  sourceText: '/agent open Game inside Launcher',
  toolExecutor: async () => {
    executorCalled = true;
    throw new Error('approval resume should not execute the approved result twice');
  },
  userGoal: 'open Game inside Launcher',
});

assert.equal(result.status, 'needs-user');
assert.equal(result.toolResults.length, 1);
assert.equal(result.toolResults[0]?.result.receipt?.status, 'unverified');
assert.match(result.finalAnswer, /launched-unverified|no focusable window|Launch status/u);
assert.equal(modelCalled, false);
assert.equal(executorCalled, false);

console.log('agent session v3 approval unverified launch guard smoke ok');
