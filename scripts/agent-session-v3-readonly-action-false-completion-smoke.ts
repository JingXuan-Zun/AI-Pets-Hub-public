import assert from 'node:assert/strict';
import {
  runAgentSessionV3ExperimentalChatRunner,
} from '../src/agent/agentSessionV3ExperimentalChatRunner.ts';
import { type AgentChatCommandResult } from '../src/agent/agentChatCommand.ts';

let modelCallCount = 0;
const result = await runAgentSessionV3ExperimentalChatRunner({
  modelCaller: async ({ userInput }) => {
    modelCallCount += 1;
    if (modelCallCount === 1) {
      return JSON.stringify({
        action: 'tool_call',
        args: {
          includeActiveWindow: true,
          includeDisplays: true,
          includeInstalledApps: true,
          includeRunningApps: true,
          query: 'Chrome Bilibili LC34G55T',
        },
        reason: 'Observe browsers, windows, and displays before choosing the non-Edge browser action.',
        tool: 'observe_windows_and_apps',
      });
    }

    assert.match(userInput, /Experimental v3 tool result/u);
    assert.match(userInput, /observe_windows_and_apps/u);
    assert.match(userInput, /read-only observation/u);
    return JSON.stringify({
      action: 'tool_call',
      args: {
        postVerify: true,
        postVerifyQuery: '哔哩哔哩 on LC34G55T',
        postVerifyVisualQuery: '',
        stepsJson: JSON.stringify([
          {
            args: {
              action: 'open_resource',
              resourceType: 'url',
              target: 'https://www.bilibili.com',
              withApp: 'Chrome',
            },
            reason: 'Open Bilibili with a non-Edge browser.',
            tool: 'execute_desktop_action',
          },
          {
            args: {
              action: 'move_window_to_display',
              fallbackToActiveWindow: true,
              preserveSize: true,
              target: 'Chrome',
              targetDisplay: 'LC34G55T',
            },
            reason: 'Move the browser window to the requested secondary display.',
            tool: 'execute_desktop_action',
          },
        ]),
      },
      reason: 'Observation found enough browser/display evidence; request one approval for open and move.',
      tool: 'execute_desktop_sequence',
    });
  },
  settings: {
    agentRuntimeMode: 'v3-experimental',
  },
  sourceText: '/agent 用 Chrome 打开哔哩哔哩并放到副屏 LC34G55T，不要用 Edge',
  toolExecutor: async (): Promise<AgentChatCommandResult> => ({
    ok: true,
    responseText: 'Observed apps/windows: installed=40, taskbarPinned=13, running=5. Active window: Codex.',
    verification: 'Window/app observation returned installed apps, running windows, active window, and displays.',
  }),
  userGoal: '用非Edge浏览器打开URL，窗口移动到副屏',
});

assert.equal(result.status, 'needs-approval');
assert.equal(modelCallCount, 2);
assert.equal(result.toolResults.length, 1);
assert.equal(result.toolResults[0]?.command.toolCall?.name, 'observe_windows_and_apps');
assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
assert.match(String(result.pendingApproval?.command.toolCall?.input.stepsJson), /open_resource/u);
assert.match(String(result.pendingApproval?.command.toolCall?.input.stepsJson), /move_window_to_display/u);
assert.doesNotMatch(result.finalAnswer, /已经.*打开/u);
assert.doesNotMatch(result.finalAnswer, /已经.*放到/u);
assert.doesNotMatch(result.finalAnswer, /completed.*task/u);

console.log('agent session v3 readonly action false completion smoke ok');
