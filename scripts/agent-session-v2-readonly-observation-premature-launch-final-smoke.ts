import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];
let modelCallCount = 0;
let toolCallCount = 0;

const result = await runAgentProductionSession({
  maxSteps: 5,
  modelCaller: async ({ userInput }) => {
    modelCallCount += 1;

    if (modelCallCount === 1) {
      return JSON.stringify({
        action: 'tool_call',
        args: {
          includeActiveWindow: true,
          includeInstalledApps: true,
          includeRunningApps: true,
          query: 'ExampleLauncher',
        },
        reason: 'Check whether the requested launcher exists or is already running before opening it.',
        tool: 'observe_windows_and_apps',
        understanding: {
          completedGoals: [],
          remainingGoals: [
            'open ExampleLauncher',
            'start ExampleGame inside ExampleLauncher',
          ],
          successCriteria: 'ExampleLauncher is open and ExampleGame is started from inside it',
          userNeed: 'open ExampleGame inside ExampleLauncher',
          verificationEvidence: [],
          verificationGaps: [
            'Need app/window observation first.',
          ],
          verificationStatus: 'unknown',
        },
      });
    }

    if (modelCallCount === 2) {
      assert.match(userInput, /tool=observe_windows_and_apps/u);
      assert.match(userInput, /running=0/u);
      return JSON.stringify({
        action: 'final_answer',
        message: '已经帮你打开 ExampleLauncher 里的 ExampleGame 了�?,
        understanding: {
          completedGoals: [
            'opened ExampleLauncher',
            'started ExampleGame',
          ],
          remainingGoals: [],
          successCriteria: 'ExampleLauncher is open and ExampleGame is started from inside it',
          userNeed: 'open ExampleGame inside ExampleLauncher',
          verificationEvidence: [
            'Observed installed app entries for ExampleLauncher.',
          ],
          verificationGaps: [],
          verificationStatus: 'satisfied',
        },
      });
    }

    assert.match(userInput, /rejected read-only observation final answer/u);
    assert.match(userInput, /only read-only observation tools have run/u);
    assert.match(userInput, /Next action must request approval/u);
    return JSON.stringify({
      action: 'tool_call',
      args: {
        action: 'launch_local_app',
        target: 'ExampleLauncher',
      },
      reason: 'Observation cannot open the launcher; request approval for the actual launch step.',
      tool: 'execute_desktop_action',
      understanding: {
        completedGoals: [
          'confirmed ExampleLauncher appears installed',
        ],
        remainingGoals: [
          'open ExampleLauncher',
          'start ExampleGame inside ExampleLauncher',
        ],
        successCriteria: 'ExampleLauncher is opened before locating and starting ExampleGame inside it',
        userNeed: 'open ExampleGame inside ExampleLauncher',
        verificationEvidence: [
          'Observed installed app entries, but no running launcher window.',
        ],
        verificationGaps: [
          'No approved launch action has run yet.',
        ],
        verificationStatus: 'partial',
      },
    });
  },
  settings,
  sourceText: '/agent 小魅魔帮我打开 ExampleLauncher 里的 ExampleGame',
  toolExecutor: async (command: AgentChatCommand) => {
    toolCallCount += 1;
    assert.equal(toolCallCount, 1);
    assert.equal(command.toolCall?.name, 'observe_windows_and_apps');

    return {
      observations: [
        'Observed apps/windows: installed=5, taskbarPinned=0, running=0.',
        'Active window: Codex - Codex.',
      ],
      ok: true,
      responseText: 'Observed apps/windows: installed=5, taskbarPinned=0, running=0. Active window: Codex - Codex.',
      stateSummary: {
        observedState: [
          'installed=5',
          'taskbarPinned=0',
          'running=0',
          'active window: Codex - Codex',
        ],
        structuredEvidence: {
          runningCount: 0,
          status: 'success',
          targetMatched: 'ExampleLauncher',
        },
        verificationEvidence: [
          'ExampleLauncher appears in installed app candidates.',
          'No running ExampleLauncher window was observed.',
        ],
      },
      verification: 'Read-only observation completed. No app/window launch action was executed.',
    };
  },
  userGoal: '小魅魔帮我打开 ExampleLauncher 里的 ExampleGame',
});

assert.equal(modelCallCount, 3);
assert.equal(toolCallCount, 1);
assert.equal(result.status, 'needs-approval');
assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_action');
assert.equal(result.pendingApproval?.command.toolCall?.input.action, 'launch_local_app');
assert.equal(result.pendingApproval?.command.toolCall?.input.target, 'ExampleLauncher');
assert.match(result.continuation.historyLines.join('\n'), /rejected read-only observation final answer/u);
assert.match(result.continuation.historyLines.join('\n'), /read-only observation can identify candidates, but it cannot satisfy open\/start\/launch\/control/u);

console.log('agent session v2 readonly observation premature launch final smoke ok');
