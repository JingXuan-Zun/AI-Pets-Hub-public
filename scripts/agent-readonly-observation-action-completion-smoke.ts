import assert from 'node:assert/strict';
import {
  assessAgentCommandResult,
  createAgentDecisionSummary,
  resolveAgentResultFollowUpActions,
  type AgentChatCommand,
} from '../src/agent/index.ts';

function createToolCommand(name: AgentChatCommand['toolCall']['name'], input: Record<string, unknown>): AgentChatCommand {
  return {
    capabilityId: 'app-launcher',
    instruction: 'open Example Game inside Example Launcher',
    kind: 'tool-call',
    sourceText: '/agent open Example Game inside Example Launcher',
    toolCall: {
      goal: 'open Example Game inside Example Launcher',
      input,
      name,
    },
  };
}

const unverifiedLaunch = assessAgentCommandResult(
  createToolCommand('execute_desktop_action', {
    action: 'launch_local_app',
    target: 'Example Game Launcher Shortcut',
  }),
  {
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
  },
);

assert.equal(unverifiedLaunch.assessment?.status, 'unverified');
assert.notEqual(
  createAgentDecisionSummary(unverifiedLaunch, resolveAgentResultFollowUpActions(unverifiedLaunch)),
  '结果已验证，可以交给角色回复',
);

const plainPostActionObservation = assessAgentCommandResult(
  createToolCommand('observe_windows_and_apps', {
    forceRefresh: true,
    includeInstalledApps: true,
    includeRunningApps: true,
    query: 'Example Launcher',
  }),
  {
    observations: [
      'Tool: observe_windows_and_apps',
      'Goal: open Example Game inside Example Launcher',
      'Windows/apps query: Example Launcher',
      'Installed app entries: 4',
      'Taskbar pinned entries: 0',
    ],
    ok: true,
    responseText: 'Observed apps/windows: installed=4, taskbarPinned=0, running=0.',
    verification: 'Window/app observation returned current installed entries, taskbar pins, windows, active window, and displays when requested.',
  },
);

assert.equal(
  plainPostActionObservation.assessment?.status,
  'unverified',
  'a successful read-only observation with no target-running/window evidence must not verify an action request',
);
assert.notEqual(
  createAgentDecisionSummary(plainPostActionObservation, resolveAgentResultFollowUpActions(plainPostActionObservation)),
  '结果已验证，可以交给角色回复',
);
assert.ok(
  plainPostActionObservation.stateSummary?.missingEvidence?.some((line) => /action-completion|target-window|target-running/u.test(line)),
);
assert.ok(
  plainPostActionObservation.stateSummary?.recommendedRecovery?.some((line) => /execute_desktop_action|execute_desktop_sequence|locate_screen_elements|observe_windows_and_apps/u.test(line)),
);

const emptyQueryPostApprovalObservation = assessAgentCommandResult(
  createToolCommand('observe_windows_and_apps', {
    forceRefresh: true,
    includeActiveWindow: true,
    includeRunningApps: true,
    recoveryReason: 'AgentRuntime post-action verification After the approved desktop action, read current app/window/display state before deciding whether the user-level goal is verified.',
  }),
  {
    observations: [
      'Tool: observe_windows_and_apps',
      'Goal: open Example Game inside Example Launcher',
      'Windows/apps query:',
      'Installed app entries: 40',
      'Running sample: 1. Chat pid=123 title="Chat"',
    ],
    ok: true,
    responseText: 'Observed apps/windows: installed=40, running=7. Active window: Chat.',
    verification: 'Window/app observation returned current installed entries, taskbar pins, windows, active window, and displays when requested.',
  },
);

assert.equal(
  emptyQueryPostApprovalObservation.assessment?.status,
  'unverified',
  'post-approval window observation with an empty query and no target match must not verify the user action',
);
assert.notEqual(
  createAgentDecisionSummary(emptyQueryPostApprovalObservation, resolveAgentResultFollowUpActions(emptyQueryPostApprovalObservation)),
  '缁撴灉宸查獙璇侊紝鍙互浜ょ粰瑙掕壊鍥炲',
);

const loginButtonPreflightObservation = assessAgentCommandResult(
  createToolCommand('observe_windows_and_apps', {
    forceRefresh: true,
    includeActiveWindow: true,
    includeRunningApps: true,
  }),
  {
    observations: [
      'Tool: observe_windows_and_apps',
      'Goal: Locate login button in WeGame',
      'Windows/apps query:',
      'Running sample: 1. AI Desktop Pet pid=39172 title="AI Desktop Pet"',
      'Running sample: 2. Codex pid=1908 title="Codex"',
    ],
    ok: true,
    responseText: 'Observed apps/windows: installed=0, taskbarPinned=13, running=10. Active window: AI Desktop Pet.',
    verification: 'Window/app observation returned current installed entries, taskbar pins, windows, active window, and displays when requested.',
  },
);

const loginButtonPreflightActions = resolveAgentResultFollowUpActions(loginButtonPreflightObservation);
assert.equal(
  loginButtonPreflightObservation.assessment?.status,
  'unverified',
  'window/app preflight alone must not complete a login-button location request',
);
assert.equal(loginButtonPreflightActions[0]?.kind, 'run-command');
assert.equal(loginButtonPreflightActions[0]?.label, 'Locate login button');
if (loginButtonPreflightActions[0]?.kind === 'run-command') {
  assert.equal(loginButtonPreflightActions[0].command.toolCall?.name, 'locate_screen_elements');
  assert.equal(loginButtonPreflightActions[0].requiresApproval, undefined);
  assert.match(String(loginButtonPreflightActions[0].command.toolCall?.input.sourceQuery), /Example Launcher/u);
  assert.match(String(loginButtonPreflightActions[0].command.toolCall?.input.targetText), /Login|登录/u);
}

const agentCoreLoginLocatePreflightObservation = assessAgentCommandResult(
  createToolCommand('observe_windows_and_apps', {
    forceRefresh: true,
    includeActiveWindow: true,
    includeRunningApps: true,
    includeTaskbarPinned: true,
  }),
  {
    observations: [
      'Tool: observe_windows_and_apps',
      'Goal: locate the login button in WeGame',
      'Windows/apps query:',
      'Installed app entries: 0',
      'Taskbar pinned entries: 0',
      'Running sample: 1. AI Desktop Pet pid=16156 title="AI Desktop Pet"',
      'Running sample: 2. Codex pid=1908 title="Codex"',
    ],
    ok: true,
    responseText: 'Observed apps/windows: installed=0, taskbarPinned=0, running=10. Active window: AI Desktop Pet.',
    verification: 'Window/app observation returned current installed entries, taskbar pins, windows, active window, and displays when requested.',
  },
);

const agentCoreLoginLocateActions = resolveAgentResultFollowUpActions(agentCoreLoginLocatePreflightObservation);
assert.equal(
  agentCoreLoginLocatePreflightObservation.assessment?.status,
  'unverified',
  'Agent Core must not complete a login-button location request with only window/app observation evidence',
);
assert.equal(agentCoreLoginLocateActions[0]?.kind, 'run-command');
if (agentCoreLoginLocateActions[0]?.kind === 'run-command') {
  assert.equal(agentCoreLoginLocateActions[0].command.toolCall?.name, 'locate_screen_elements');
  assert.equal(agentCoreLoginLocateActions[0].requiresApproval, undefined);
}

const verifiedPostActionObservation = assessAgentCommandResult(
  createToolCommand('observe_windows_and_apps', {
    forceRefresh: true,
    includeRunningApps: true,
    query: 'Example Game',
    recoveryPostActionState: 'unknown',
  }),
  {
    observations: [
      'Tool: observe_windows_and_apps',
      'Windows/apps query: Example Game',
      'Running window: Example Game pid=1234',
    ],
    ok: true,
    responseText: 'Observed apps/windows: installed=4, taskbarPinned=0, running=1. Running window: Example Game.',
    stateSummary: {
      observedState: ['Running window: Example Game pid=1234'],
      structuredEvidence: {
        finalWindow: {
          processName: 'ExampleGame.exe',
          title: 'Example Game',
        },
        status: 'success',
        targetMatched: 'Example Game',
      },
      verificationEvidence: ['Running window: Example Game pid=1234'],
    },
    verification: 'Observed Example Game as a running window.',
  },
);

assert.equal(
  verifiedPostActionObservation.assessment?.status,
  'completed',
  'read-only observation may complete only when it carries concrete target-running/window evidence',
);

console.log('agent readonly observation action completion smoke ok');
