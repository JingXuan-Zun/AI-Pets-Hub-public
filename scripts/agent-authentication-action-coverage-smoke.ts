import assert from 'node:assert/strict';
import {
  createAgentAttemptedActionCoverage,
  createAgentRequestedActionCoverage,
  createAgentToolCommand,
} from '../src/agent/index.ts';

const dependencies = {
  getPostActionState: (entry: any) => entry.result.stateSummary?.structuredEvidence?.postActionState ?? '',
  hasDesktopOrganizationRequest: () => false,
  hasWindowMoveToDisplayRequest: () => false,
  isAutoRecoveryReadCommand: () => false,
  isAutoRecoveryWaitCommand: () => false,
  isPostApprovalVerificationCommand: (command: any) => command.toolCall?.name === 'observe_windows_and_apps',
  isVerifiedTargetWindowObservation: (entry: any) => entry.command.toolCall?.name === 'observe_windows_and_apps',
};

const requested = createAgentRequestedActionCoverage({
  dependencies,
  sourceText: '打开 WeGame 并登录',
  userGoal: '打开 WeGame 并登录',
});
assert.equal(requested.has('open-or-launch'), true);
assert.equal(requested.has('in-app-action'), true);

const launch = {
  command: createAgentToolCommand({
    args: { action: 'launch_local_app', target: 'WeGame' },
    sourceText: '打开 WeGame 并登录',
    toolName: 'execute_desktop_action',
    userGoal: '打开 WeGame 并登录',
  }),
  result: {
    ok: true,
    receipt: { status: 'success' },
    stateSummary: { structuredEvidence: { finalWindow: { hwnd: 10, pid: 20, processName: 'wegame', title: 'WeGame' }, status: 'success', targetMatched: 'WeGame' } },
  },
};
const observation = {
  command: createAgentToolCommand({
    args: { query: 'WeGame' },
    sourceText: '打开 WeGame 并登录',
    toolName: 'observe_windows_and_apps',
    userGoal: '打开 WeGame 并登录',
  }),
  result: {
    ok: true,
    receipt: { status: 'success' },
    stateSummary: { structuredEvidence: { finalWindow: { hwnd: 10, pid: 20, processName: 'wegame', title: 'WeGame' }, status: 'success', targetMatched: 'WeGame' } },
  },
};

const launchOnly = createAgentAttemptedActionCoverage({ dependencies, toolResults: [launch, observation] });
assert.equal(launchOnly.has('open-or-launch'), true);
assert.equal(launchOnly.has('in-app-action'), false);

const click = {
  command: createAgentToolCommand({
    actionScope: { targetRef: 'WeGame login continuation' },
    args: { action: 'click', x: 100, y: 100 },
    sourceText: '打开 WeGame 并登录',
    toolName: 'execute_desktop_input',
    userGoal: '打开 WeGame 并登录',
  }),
  result: { ok: true, receipt: { status: 'success' }, stateSummary: { actionEvidence: { outcome: 'changed' } } },
};
const launchAndClick = createAgentAttemptedActionCoverage({ dependencies, toolResults: [launch, click, observation] });
assert.equal(launchAndClick.has('in-app-action'), true);

const loginSequence = {
  command: createAgentToolCommand({
    args: {
      stepsJson: JSON.stringify([{
        args: { action: 'click', x: 400, y: 300 },
        tool: 'execute_desktop_input',
      }]),
    },
    sourceText: '打开 Example App 并登录',
    toolName: 'execute_desktop_sequence',
    userGoal: '打开 Example App 并登录',
  }),
  result: {
    ok: true,
    receipt: { status: 'success' },
    responseText: 'The main interface is visible and no login overlay remains.',
    stateSummary: {
      actionEvidence: {
        outcome: 'changed',
        tool: 'execute_desktop_sequence',
        timestamp: Date.now(),
      },
      structuredEvidence: {
        postActionState: 'launched',
      },
    },
  },
};
const loginCoverage = createAgentAttemptedActionCoverage({
  dependencies,
  toolResults: [loginSequence],
});
assert.equal(loginCoverage.has('in-app-action'), true);

const requestedFolderOpen = createAgentRequestedActionCoverage({
  dependencies,
  sourceText: '找到微信表情包保存文件夹后打开它',
  userGoal: '找到微信表情包保存文件夹后打开它',
});
assert.equal(requestedFolderOpen.has('open-or-launch'), true);

const folderPathRead = {
  command: createAgentToolCommand({
    args: { action: 'get_path_info', path: 'C:\\Users\\Zhou\\Documents\\WeChat Files' },
    sourceText: '找到微信表情包保存文件夹后打开它',
    toolName: 'execute_local_file_action',
    userGoal: '找到微信表情包保存文件夹后打开它',
  }),
  result: { ok: true, receipt: { status: 'success' } },
};
assert.equal(
  createAgentAttemptedActionCoverage({ dependencies, toolResults: [folderPathRead] }).has('open-or-launch'),
  false,
  'path observation alone must not be accepted as opening the folder',
);

const folderOpen = {
  command: createAgentToolCommand({
    args: {
      action: 'open_resource',
      resourceType: 'folder',
      target: 'C:\\Users\\Zhou\\Documents\\WeChat Files',
    },
    sourceText: '找到微信表情包保存文件夹后打开它',
    toolName: 'execute_desktop_action',
    userGoal: '找到微信表情包保存文件夹后打开它',
  }),
  result: { ok: true, receipt: { status: 'success' } },
};
assert.equal(
  createAgentAttemptedActionCoverage({ dependencies, toolResults: [folderPathRead, folderOpen] }).has('open-or-launch'),
  true,
  'open_resource with resourceType folder must cover the requested folder-open action',
);

console.log('agent authentication action coverage smoke ok');
