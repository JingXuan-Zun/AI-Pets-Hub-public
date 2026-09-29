import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentChatCommandResult,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];

function createLaunchCommand(): AgentChatCommand {
  return {
    capabilityId: 'app-launcher',
    instruction: 'open Example Game inside Example Launcher',
    kind: 'tool-call',
    sourceText: '/agent open Example Game inside Example Launcher',
    toolCall: {
      goal: 'open Example Game inside Example Launcher',
      input: {
        action: 'launch_local_app',
        target: 'Example Game Launcher Shortcut',
      },
      name: 'execute_desktop_action',
    },
  };
}

function createUnverifiedLaunchResult(): AgentChatCommandResult {
  return {
    observations: [
      'Tool: execute_desktop_action',
      'Desktop action: launch_local_app',
      'Launch status: launched-unverified',
      'Launch query: Example Game Launcher Shortcut',
    ],
    ok: true,
    receipt: {
      evidenceLines: [
        'Launch status: launched-unverified',
        'Launch query: Example Game Launcher Shortcut',
      ],
      status: 'unverified',
      summaryLines: [
        'Call: execute_desktop_action',
        'Result: launch request accepted, final visible state unverified',
      ],
      title: 'Execution receipt',
      toolName: 'execute_desktop_action',
      verification: 'Launch request sent, but no focusable window was verified: no-window-match.',
    },
    responseText: 'Launch status: launched-unverified',
    verification: 'Launch request sent, but no focusable window was verified: no-window-match.',
  };
}

let toolCallCount = 0;
let sawPostApprovalRead = false;
const observedTools: string[] = [];
let sawPostActionFollowUpSignal = false;

const result = await runAgentProductionSession({
  approvedToolResult: {
    command: createLaunchCommand(),
    result: createUnverifiedLaunchResult(),
  },
  maxSteps: 5,
  modelCaller: async ({ userInput }) => {
    sawPostActionFollowUpSignal = /Current post-action recovery follow-up signal:/u.test(userInput)
      && /requiredReplan=This is evidence collected after an incomplete user action/u.test(userInput);
    assert.match(userInput, /inAppLauncherRecoveryHint=/u);
    assert.match(userInput, /sourceQuery\/sourceId for A and targetDescription\/targetText for B/u);
    assert.match(userInput, /suggestedLocateTool=locate_screen_elements/u);
    assert.match(userInput, /suggestedLocateArgs=/u);
    assert.match(userInput, /not a fixed app-specific chain/u);
    return JSON.stringify({
      action: 'ask_user',
      message: 'The launch request was sent but no window was verified. Please provide the launcher path or confirm it is visible.',
      understanding: {
        blockedGoals: ['target window not verified'],
        completedGoals: ['checked post-action recovery evidence'],
        remainingGoals: [],
        successCriteria: 'Example Game launches from Example Launcher',
        userNeed: 'open Example Game inside Example Launcher',
        verificationEvidence: ['No focusable target window was found after launch request.'],
        verificationGaps: ['Need launcher window/path or a visible in-app target.'],
        verificationStatus: 'blocked',
      },
    });
  },
  settings,
  sourceText: '/agent open Example Game inside Example Launcher',
  toolExecutor: async (command) => {
    toolCallCount += 1;
    observedTools.push(command.toolCall?.name ?? command.kind);
    if (
      command.toolCall?.name === 'observe_windows_and_apps'
      || command.toolCall?.name === 'execute_desktop_observation'
    ) {
      sawPostApprovalRead = true;
    }
    if (command.toolCall?.name === 'observe_windows_and_apps') {
      assert.equal(command.toolCall.input.includeActiveWindow, true);
      assert.equal(command.toolCall.input.includeDisplays, true);
      assert.equal(command.toolCall.input.includeRunningApps, true);
      assert.equal(command.toolCall.input.includeInstalledApps, false);
      assert.equal(command.toolCall.input.includeTaskbarPinned, false);
    }
    return {
      observations: [
        'Tool: observe_windows_and_apps',
        'Windows/apps query: Example Game Launcher Shortcut',
        'Observed apps/windows: installed=4, taskbarPinned=0, running=0.',
      ],
      ok: true,
      responseText: 'Observed apps/windows: installed=4, taskbarPinned=0, running=0.',
      verification: 'Read current app/window state; no target window verified.',
    };
  },
  userGoal: 'open Example Game inside Example Launcher',
});

assert.ok(toolCallCount >= 1, `expected post-approval recovery observation, got tools=${observedTools.join(',')}`);
assert.ok(toolCallCount <= 3, `expected bounded recovery observation, got tools=${observedTools.join(',')}`);
assert.equal(observedTools[0], 'execute_desktop_observation');
assert.ok(observedTools.includes('observe_windows_and_apps'), `expected lightweight window read after short wait, got tools=${observedTools.join(',')}`);
assert.equal(sawPostApprovalRead, true, `expected post-approval read, got tools=${observedTools.join(',')}`);
assert.equal(sawPostActionFollowUpSignal, true);
assert.equal(result.status, 'needs-user');
assert.doesNotMatch(result.finalAnswer, /完成|done|opened successfully|successfully opened/iu);
assert.match(result.continuation.historyLines.join('\n'), /postActionState=waiting_window/u);
assert.match(result.continuation.historyLines.join('\n'), /tool=observe_windows_and_apps/u);

console.log('agent session v2 unverified launch recovery observation smoke ok');
