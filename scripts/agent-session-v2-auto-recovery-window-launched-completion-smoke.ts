import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentChatCommandResult,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];

function createToolCommand(name: AgentChatCommand['toolCall']['name'], input: Record<string, unknown>): AgentChatCommand {
  return {
    capabilityId: name === 'observe_windows_and_apps' ? 'desktop-observation' : 'app-launcher',
    instruction: 'start Example Game from launcher',
    kind: 'tool-call',
    sourceText: '/agent start Example Game from launcher',
    toolCall: {
      goal: 'start Example Game from launcher',
      input,
      name,
    },
  };
}

function createUnknownSequenceResult(): AgentChatCommandResult {
  return {
    ok: true,
    receipt: {
      evidenceLines: ['Step 1/1 tool=execute_desktop_input status=ok', 'Post-action visual state: unknown'],
      status: 'unverified',
      summaryLines: ['Call: execute_desktop_sequence', 'Post-action state: unknown'],
      title: 'Agent desktop sequence',
      toolName: 'execute_desktop_sequence',
      verification: 'The click ran, but the requested app window was not confirmed yet.',
    },
    responseText: 'Clicked the launcher control, but the target window is not confirmed yet.',
    stateSummary: {
      missingEvidence: ['The requested app window was not confirmed.'],
      observedState: ['Post-action visual state: unknown'],
      recommendedRecovery: ['Confirm whether the requested game window appeared after the click.'],
      structuredEvidence: {
        postActionRecovery: {
          nextArgs: {
            includeActiveWindow: true,
            includeDisplays: true,
            includeRunningApps: true,
            query: 'Example Game',
          },
          nextTool: 'observe_windows_and_apps',
          reason: 'Confirm whether the requested game window appeared after the click.',
          strategy: 'refresh-observation',
        },
        postActionState: 'unknown',
        status: 'unverified',
        targetMatched: 'Example Game',
      },
    },
    verification: 'The click ran, but no target window was confirmed.',
  };
}

function createVerifiedWindowObservationResult(): AgentChatCommandResult {
  return {
    observations: [
      'Windows/apps query: Example Game',
      'Running windows: 1',
      'Active process: ExampleGame.exe',
      'Active title: Example Game',
      'Running 1. ExampleGame.exe pid=88 hwnd=990 display="Secondary" title="Example Game"',
    ],
    ok: true,
    receipt: {
      evidenceLines: ['Active process: ExampleGame.exe', 'Active title: Example Game'],
      status: 'success',
      summaryLines: ['Call: observe_windows_and_apps', 'Running: 1', 'Active: ExampleGame.exe'],
      title: 'Window/app observation',
      toolName: 'observe_windows_and_apps',
      verification: 'Observed Example Game as the active running window.',
    },
    responseText: 'Observed apps/windows: running=1.\nActive window: ExampleGame.exe - Example Game @ Secondary',
    stateSummary: {
      observedState: ['Active process: ExampleGame.exe', 'Active title: Example Game'],
      structuredEvidence: {
        finalWindow: {
          displayLabel: 'Secondary',
          hwnd: 990,
          pid: 88,
          processName: 'ExampleGame.exe',
          title: 'Example Game',
        },
        status: 'success',
        targetMatched: 'Example Game',
      },
      verificationEvidence: ['Observed Example Game as the active running window.'],
    },
    verification: 'Observed Example Game as the active running window.',
  };
}

const recoveryCommands: AgentChatCommand[] = [];
let modelCallCount = 0;

const result = await runAgentProductionSession({
  approvedToolResult: {
    command: createToolCommand('execute_desktop_sequence', {
      postVerifyQuery: 'Example Game',
      stepsJson: JSON.stringify([
        {
          args: {
            action: 'click',
            button: 'left',
            x: 1440,
            y: 920,
          },
          reason: 'Click the visible start control.',
          tool: 'execute_desktop_input',
        },
      ]),
    }),
    result: createUnknownSequenceResult(),
  },
  maxSteps: 3,
  modelCaller: async () => {
    modelCallCount += 1;
    throw new Error('model should not be called after recovery verifies the target window is running');
  },
  settings,
  sourceText: '/agent start Example Game from launcher',
  toolExecutor: async (command) => {
    recoveryCommands.push(command);
    assert.equal(command.toolCall?.name, 'observe_windows_and_apps');
    assert.equal(command.toolCall.input.query, 'Example Game');
    assert.equal(command.toolCall.input.forceRefresh, true);
    assert.equal(command.toolCall.input.includeRunningApps, true);
    return createVerifiedWindowObservationResult();
  },
  userGoal: 'start Example Game from launcher',
});

assert.equal(modelCallCount, 0);
assert.equal(recoveryCommands.length, 1);
assert.equal(result.status, 'completed');
assert.match(result.finalAnswer, /打开\/启动成功|鍚姩鎴愬姛/u);
assert.match(result.continuation.historyLines.join('\n'), /verified-target-window/u);
assert.match(result.continuation.historyLines.join('\n'), /postActionState=launched/u);

console.log('agent session v2 auto recovery window launched completion smoke ok');
