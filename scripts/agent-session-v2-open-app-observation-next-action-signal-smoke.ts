import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];
let modelCallCount = 0;
const modelInputs: string[] = [];
const toolCommands: AgentChatCommand[] = [];

const result = await runAgentProductionSession({
  maxSteps: 3,
  modelCaller: async ({ userInput }) => {
    modelCallCount += 1;
    modelInputs.push(userInput);

    if (modelCallCount === 1) {
      return JSON.stringify({
        action: 'tool_call',
        args: {
          includeInstalledApps: true,
          includeRunningApps: true,
          query: 'ExampleLauncher',
        },
        reason: 'Observe installed and running app state first.',
        tool: 'observe_windows_and_apps',
      });
    }

    assert.match(userInput, /reason=observation_only_for_open_or_launch_request/u);
    assert.match(userInput, /requiredNextAction=open-or-launch/u);
    assert.match(userInput, /suggestedTool=execute_desktop_action/u);
    assert.match(userInput, /suggestedArgs=.*launch_local_app/u);
    assert.match(userInput, /observation.*did not open, focus, or launch/iu);

    return JSON.stringify({
      action: 'tool_call',
      args: {
        action: 'launch_local_app',
        target: 'ExampleLauncher',
      },
      reason: 'The observation found the candidate, but the requested launch has not been attempted.',
      tool: 'execute_desktop_action',
    });
  },
  settings,
  sourceText: '/agent open ExampleLauncher',
  toolExecutor: async (command) => {
    toolCommands.push(command);

    if (command.toolCall?.name === 'observe_windows_and_apps') {
      return {
        observations: [
          'Observed apps/windows: installed=1, running=0.',
          'Installed 1: ExampleLauncher path=C:\\Example\\ExampleLauncher.exe',
        ],
        ok: true,
        responseText: [
          'Observed apps/windows: installed=1, taskbarPinned=0, running=0.',
          'Installed 1: ExampleLauncher path=C:\\Example\\ExampleLauncher.exe',
        ].join('\n'),
        stateSummary: {
          observedState: [
            'Installed 1: ExampleLauncher path=C:\\Example\\ExampleLauncher.exe',
          ],
          structuredEvidence: {
            status: 'success',
            targetMatched: 'ExampleLauncher',
          },
          verificationEvidence: [
            'Window/app observation returned installed entries and running windows.',
          ],
        },
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
          'Matched app: ExampleLauncher',
        ],
        ok: true,
        receipt: {
          evidenceLines: [
            'Launch status: launched-unverified',
            'Matched app: ExampleLauncher',
          ],
          status: 'unverified',
          summaryLines: [
            'Call: launch_local_app',
            'Result: launch request accepted',
          ],
          title: 'Execution receipt',
          toolName: 'execute_desktop_action',
          verification: 'Launch request accepted, final visible state unverified.',
        },
        responseText: 'Launch request accepted for ExampleLauncher.',
        verification: 'launch accepted but unverified',
      };
    }

    throw new Error(`unexpected tool: ${command.toolCall?.name ?? 'unknown'}`);
  },
  userGoal: 'open ExampleLauncher',
});

assert.equal(modelCallCount >= 2, true);
assert.equal(toolCommands[0]?.toolCall?.name, 'observe_windows_and_apps');
const pendingApprovalIsLaunch = result.pendingApproval?.command.toolCall?.name === 'execute_desktop_action'
  && result.pendingApproval.command.toolCall.input.action === 'launch_local_app';
const attemptedOrPendingLaunch = toolCommands.some((command) => (
  command.toolCall?.name === 'execute_desktop_action'
  && command.toolCall.input.action === 'launch_local_app'
)) || pendingApprovalIsLaunch;
assert.equal(
  attemptedOrPendingLaunch,
  true,
  `expected launch_local_app attempt or pending approval, status=${result.status}, final=${result.finalAnswer}`,
);
assert.match(modelInputs[1] ?? '', /suggestedTool=execute_desktop_action/u);

console.log('agent session v2 open app observation next action signal smoke ok');
