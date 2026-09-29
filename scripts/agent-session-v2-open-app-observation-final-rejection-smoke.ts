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
  maxSteps: 4,
  modelCaller: async ({ userInput }) => {
    modelCallCount += 1;

    if (modelCallCount === 1) {
      return JSON.stringify({
        action: 'tool_call',
        args: {
          includeInstalledApps: true,
          includeRunningApps: true,
          query: 'WeGame',
        },
        reason: 'Observe app/window state first.',
        tool: 'observe_windows_and_apps',
      });
    }

    if (modelCallCount === 2) {
      assert.match(userInput, /Observed apps\/windows/u);
      return JSON.stringify({
        action: 'final_answer',
        message: 'WeGame is not running, but I opened it successfully.',
        understanding: {
          completedGoals: ['opened WeGame'],
          remainingGoals: [],
          successCriteria: 'WeGame is opened',
          userNeed: 'open WeGame',
          verificationEvidence: ['Observed app list showed WeGame was installed.'],
          verificationGaps: [],
          verificationStatus: 'satisfied',
        },
      });
    }

    assert.match(userInput, /unattempted requested action/u);
    assert.match(userInput, /open\/focus\/launch the requested app or resource/u);
    return JSON.stringify({
      action: 'tool_call',
      args: {
        action: 'launch_local_app',
        target: 'WeGame',
      },
      reason: 'Observation alone did not open the requested app.',
      tool: 'execute_desktop_action',
    });
  },
  settings,
  sourceText: '/agent open WeGame',
  toolExecutor: async (command) => {
    toolCommands.push(command);

    if (command.toolCall?.name === 'observe_windows_and_apps') {
      return {
        observations: [
          'Observed apps/windows: installed=1, running=0.',
          'Installed app: WeGame',
        ],
        ok: true,
        responseText: 'Observed apps/windows: installed=1, running=0. Installed app: WeGame.',
        verification: 'read installed and running app state',
      };
    }

    if (
      command.toolCall?.name === 'execute_desktop_action'
      && command.toolCall.input.action === 'launch_local_app'
    ) {
      return {
        observations: [
          'Launch status: launched-unverified',
          'Launch query: WeGame',
          'Matched app: WeGame',
        ],
        ok: true,
        receipt: {
          evidenceLines: [
            'Launch status: launched-unverified',
            'Matched app: WeGame',
          ],
          status: 'unverified',
          summaryLines: [
            'Call: launch_local_app',
            'Result: launch request accepted, final visible state unverified',
          ],
          title: 'Execution receipt',
          toolName: 'execute_desktop_action',
          verification: 'Launch request accepted, but final visible state was not verified.',
        },
        responseText: 'Launch request accepted for WeGame, but final state is unverified.',
        verification: 'launch accepted but unverified',
      };
    }

    throw new Error(`unexpected tool: ${command.toolCall?.name ?? 'unknown'}`);
  },
  userGoal: 'open WeGame',
});

assert.equal(modelCallCount, 3);
assert.equal(toolCommands.length >= 1, true);
assert.equal(toolCommands[0]?.toolCall?.name, 'observe_windows_and_apps');
if (result.status === 'needs-approval') {
  assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_action');
  assert.equal(result.pendingApproval?.command.toolCall?.input.action, 'launch_local_app');
  assert.equal(result.pendingApproval?.command.toolCall?.input.target, 'WeGame');
} else if (toolCommands.length >= 2) {
  assert.equal(toolCommands[1]?.toolCall?.name, 'execute_desktop_action');
  assert.equal(toolCommands[1]?.toolCall?.input.action, 'launch_local_app');
  assert.equal(toolCommands[1]?.toolCall?.input.target, 'WeGame');
}
assert.notEqual(result.finalAnswer, 'WeGame is not running, but I opened it successfully.');

console.log('agent session v2 open app observation final rejection smoke ok');
