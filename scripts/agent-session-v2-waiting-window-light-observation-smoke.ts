import assert from 'node:assert/strict';
import {
  createAgentDesktopAutoRecoveryObservationCommand,
  resolveAgentDesktopAutoRecoveryMaxWaits,
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentSessionV2ToolResultEntry,
} from '../src/agent/legacy/index.ts';

function createCommand(input: Record<string, unknown> = {}, name: AgentChatCommand['toolCall']['name'] = 'execute_desktop_action'): AgentChatCommand {
  return {
    capabilityId: 'app-launcher',
    instruction: 'open Example Launcher',
    kind: 'tool-call',
    sourceText: '/agent open Example Launcher',
    toolCall: {
      goal: 'open Example Launcher',
      input: {
        action: 'launch_local_app',
        target: 'Example Launcher',
        ...input,
      },
      name,
    },
  };
}

function createEntry(command: AgentChatCommand, result?: Partial<AgentChatCommandResult>): AgentSessionV2ToolResultEntry {
  return {
    command,
    result: {
      observations: ['Launch status: launched-unverified'],
      ok: true,
      responseText: 'Launch status: launched-unverified',
      verification: 'Launch request sent, but no focusable window was verified: window-not-detected-after-action.',
      ...result,
    },
  };
}

const sourceEntry = createEntry(createCommand());
const dependencies = {
  resolvePostActionState: () => 'waiting_window',
};
const waitingTargetDependencies = {
  resolvePostActionState: () => 'waiting_target',
};

const visualTimeoutEntry = createEntry(createCommand({
  action: 'wait_and_observe',
  query: 'Example Launcher',
}, 'execute_desktop_observation'), {
  observations: ['Observed running window hwnd=4096 title=Example Launcher. Supplemental visual observation timed out.'],
  responseText: 'Window observation succeeded. Supplemental visual observation timed out.',
  stateSummary: {
    structuredEvidence: {
      finalWindow: { hwnd: 4096, pid: 8192, processName: 'example-launcher.exe', title: 'Example Launcher' },
      postActionState: 'waiting_window',
    },
  },
});
const visualTimeoutRecovery = createAgentDesktopAutoRecoveryObservationCommand({
  dependencies,
  latestEntry: visualTimeoutEntry,
  sourceText: '/agent open Example Game inside Example Launcher',
  toolResults: [visualTimeoutEntry],
  userGoal: 'open Example Game inside Example Launcher',
});
assert.equal(visualTimeoutRecovery?.toolCall?.name, 'locate_screen_elements');
assert.equal(visualTimeoutRecovery?.toolCall?.input.action, 'locate_element');
assert.equal(visualTimeoutRecovery?.toolCall?.input.sourceType, 'window');
assert.equal(visualTimeoutRecovery?.toolCall?.input.allowScreenFallback, false);
assert.equal(visualTimeoutRecovery?.toolCall?.input.hwnd, 4096);
assert.equal(visualTimeoutRecovery?.toolCall?.input.sourceQuery, 'Example Launcher');

const visualTimeoutWithoutQueryEntry = createEntry(createCommand({
  action: 'wait_and_observe',
  hwnd: 4096,
  includeVisual: true,
  question: 'AgentSessionV2 auto recovery observation',
}, 'execute_desktop_observation'), {
  observations: ['Active window hwnd=4096. Supplemental visual observation timed out.'],
  responseText: 'Window/process evidence is still available; supplemental visual observation timed out.',
  stateSummary: {
    structuredEvidence: {
      finalWindow: { hwnd: 4096, pid: 8192, processName: 'example-launcher.exe', title: 'Example Launcher' },
      postActionState: 'waiting_window',
    },
  },
});
const visualTimeoutWithoutQueryRecovery = createAgentDesktopAutoRecoveryObservationCommand({
  dependencies,
  latestEntry: visualTimeoutWithoutQueryEntry,
  sourceText: '/agent open Example Game inside Example Launcher',
  toolResults: [visualTimeoutWithoutQueryEntry],
  userGoal: 'open Example Game inside Example Launcher',
});
assert.equal(visualTimeoutWithoutQueryRecovery?.toolCall?.name, 'locate_screen_elements');
assert.equal(visualTimeoutWithoutQueryRecovery?.toolCall?.input.hwnd, 4096);

assert.equal(resolveAgentDesktopAutoRecoveryMaxWaits('waiting_window', sourceEntry, [sourceEntry]), 2);

const firstWaitCommand = createAgentDesktopAutoRecoveryObservationCommand({
  dependencies,
  latestEntry: sourceEntry,
  sourceText: '/agent open Example Launcher',
  toolResults: [sourceEntry],
  userGoal: 'open Example Launcher',
});

assert.equal(firstWaitCommand?.toolCall?.name, 'execute_desktop_observation');
assert.equal(firstWaitCommand?.toolCall?.input.action, 'wait_and_observe');
assert.equal(firstWaitCommand?.toolCall?.input.includeVisual, false);
assert.equal(firstWaitCommand?.toolCall?.input.waitMs, 600);

const secondWaitEntry = createEntry(firstWaitCommand!, {
  stateSummary: {
    structuredEvidence: {
      postActionState: 'waiting_window',
    },
  },
});
const secondWaitCommand = createAgentDesktopAutoRecoveryObservationCommand({
  dependencies,
  latestEntry: secondWaitEntry,
  sourceText: '/agent open Example Launcher',
  toolResults: [sourceEntry, secondWaitEntry],
  userGoal: 'open Example Launcher',
});

assert.equal(secondWaitCommand?.toolCall?.name, 'execute_desktop_observation');
assert.equal(secondWaitCommand?.toolCall?.input.action, 'wait_and_observe');
assert.equal(secondWaitCommand?.toolCall?.input.waitMs, 1200);

const cappedReadEntry = createEntry(secondWaitCommand!, {
  stateSummary: {
    structuredEvidence: {
      postActionState: 'waiting_window',
    },
  },
});
const cappedReadCommand = createAgentDesktopAutoRecoveryObservationCommand({
  dependencies,
  latestEntry: cappedReadEntry,
  sourceText: '/agent open Example Launcher',
  toolResults: [sourceEntry, secondWaitEntry, cappedReadEntry],
  userGoal: 'open Example Launcher',
});

assert.equal(cappedReadCommand?.toolCall?.name, 'observe_windows_and_apps');
assert.equal(cappedReadCommand?.toolCall?.input.includeRunningApps, true);
assert.equal(cappedReadCommand?.toolCall?.input.includeActiveWindow, true);
assert.equal(cappedReadCommand?.toolCall?.input.includeDisplays, true);
assert.equal(cappedReadCommand?.toolCall?.input.includeInstalledApps, false);
assert.equal(cappedReadCommand?.toolCall?.input.includeTaskbarPinned, false);
assert.equal(cappedReadCommand?.toolCall?.input.limit, 20);

assert.equal(resolveAgentDesktopAutoRecoveryMaxWaits('waiting_target', sourceEntry, [sourceEntry]), 5);

let waitingTargetToolResults = [sourceEntry];
const waitingTargetWaits = [3000, 5000, 7000, 8000, 8000];
for (const [index, waitMs] of waitingTargetWaits.entries()) {
  const latestEntry = waitingTargetToolResults[waitingTargetToolResults.length - 1]!;
  const waitCommand = createAgentDesktopAutoRecoveryObservationCommand({
    dependencies: waitingTargetDependencies,
    latestEntry,
    sourceText: '/agent open Example Game inside Example Launcher',
    toolResults: waitingTargetToolResults,
    userGoal: 'open Example Game inside Example Launcher',
  });
  assert.equal(waitCommand?.toolCall?.name, 'execute_desktop_observation');
  assert.equal(waitCommand?.toolCall?.input.action, 'wait_and_observe');
  assert.equal(waitCommand?.toolCall?.input.includeVisual, false);
  assert.equal(waitCommand?.toolCall?.input.waitMs, waitMs);
  waitingTargetToolResults = [
    ...waitingTargetToolResults,
    createEntry(waitCommand!, {
      stateSummary: {
        structuredEvidence: {
          postActionState: 'waiting_target',
        },
      },
      verification: `No target yet attempt ${index + 1}`,
    }),
  ];
}

const waitingTargetCappedRead = createAgentDesktopAutoRecoveryObservationCommand({
  dependencies: waitingTargetDependencies,
  latestEntry: waitingTargetToolResults[waitingTargetToolResults.length - 1]!,
  sourceText: '/agent open Example Game inside Example Launcher',
  toolResults: waitingTargetToolResults,
  userGoal: 'open Example Game inside Example Launcher',
});

assert.equal(waitingTargetCappedRead?.toolCall?.name, 'observe_windows_and_apps');
assert.equal(waitingTargetCappedRead?.toolCall?.input.includeRunningApps, true);
assert.equal(waitingTargetCappedRead?.toolCall?.input.includeInstalledApps, false);
assert.equal(waitingTargetCappedRead?.toolCall?.input.recoveryPostActionState, 'waiting_target');
assert.match(String(waitingTargetCappedRead?.toolCall?.input.recoveryReason), /target process\/window/u);

console.log('agent session v2 waiting window light observation smoke ok');
