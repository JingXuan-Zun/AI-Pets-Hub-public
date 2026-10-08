import assert from 'node:assert/strict';
import {
  hasAgentPendingPostLoginTarget,
  resolveAgentPostLoginFollowUpTarget,
} from '../src/agent/runtime/agentPostLoginFollowUp';
import { findAgentRuntimeDesktopSequenceStaleClick, findAgentRuntimeDesktopSequenceStaleClickByHwnd } from '../src/agent/desktopSequence/sequenceClickTargetGuard';
import { desktopPetShellRuntime } from '../src/desktopShellRuntime';
import { resolveAgentExecutionStrategyExpectedWindowHwnd } from '../src/agent/agentExecutionStrategy';
import { resolveCaptureStillSize } from '../src/services/captureSourceFrameGrab';
import { createVisualSnapshotLauncherVerification } from '../src/agent/visual/visualSnapshotLauncherVerification';
import { resolveDesktopInputFocusRetryTarget } from '../src/agent/desktopTools/desktopInputFocusRetry';

// 1. "登录后启动 X": logging in or seeing the launcher is not the requested result.
assert.equal(resolveAgentPostLoginFollowUpTarget('我已经在 WeGame 输好了账号密码，请点击「快捷安全登录」，登录后启动里面的英雄联盟。'), '英雄联盟');
assert.equal(resolveAgentPostLoginFollowUpTarget('打开 WeGame，如果已经登录就启动里面的英雄联盟'), '英雄联盟');
assert.equal(resolveAgentPostLoginFollowUpTarget('打开 WeGame'), null, 'no post-login target: unchanged behaviour');
const goal = '登录后启动里面的英雄联盟';
assert.ok(hasAgentPendingPostLoginTarget({ goalText: goal, windowIdentities: ['WeGame', 'wegame'] }),
  'only the WeGame window is open: the task is not done (the live run wrongly said 打开/启动成功)');
assert.ok(!hasAgentPendingPostLoginTarget({ goalText: goal, windowIdentities: ['League of Legends', 'LeagueClientUx'] }),
  'the League client window counts, via its English title/process');
assert.ok(!hasAgentPendingPostLoginTarget({ goalText: '打开 WeGame', windowIdentities: ['WeGame'] }));

// 2. An approved click is blocked when the window no longer contains its point.
const click = { action: 'click', coordinateSpace: 'native-screen', x: 1280, y: 827 };
const loginWindow = { bounds: { coordinateSpace: 'native-screen', height: 670, width: 1191, x: 684, y: 355 }, title: 'WeGame' };
assert.equal(findAgentRuntimeDesktopSequenceStaleClick(click, loginWindow), null, 'point inside the located window: click proceeds');
const movedWindow = { bounds: { coordinateSpace: 'native-screen', height: 670, width: 1191, x: 1500, y: 900 }, title: 'WeGame' };
assert.ok(findAgentRuntimeDesktopSequenceStaleClick(click, movedWindow), 'window moved away from the point: click blocked');
assert.equal(findAgentRuntimeDesktopSequenceStaleClick({ ...click, action: 'send_keys' }, movedWindow), null, 'only clicks are checked');
assert.equal(findAgentRuntimeDesktopSequenceStaleClick(click, { title: 'WeGame' }), null, 'no bounds known: not blocked here');

// The located window's handle travels from the evidence into the click step.
assert.equal(resolveAgentExecutionStrategyExpectedWindowHwnd({ sourceBounds: { sourceId: 'window:791262:0' } }), 791262);
assert.equal(resolveAgentExecutionStrategyExpectedWindowHwnd({ sourceBounds: { sourceId: 'screen:0:0' } }), null);
const loginWindowEvidence = { finalWindow: { bounds: { height: 670, width: 1191, x: 685, y: 385 }, hwnd: 920340 }, sourceBounds: { sourceId: 'screen:0:0' } };
assert.equal(resolveAgentExecutionStrategyExpectedWindowHwnd(loginWindowEvidence, { x: 1280, y: 842 }), 920340,
  'screen-level read: the observed window holding the point becomes the expected window');
assert.equal(resolveAgentExecutionStrategyExpectedWindowHwnd(loginWindowEvidence, { x: 100, y: 100 }), null, 'point outside that window: no guess');

// 3. Main-process stills use the source's own size: never enlarged, capped when large.
assert.deepEqual(resolveCaptureStillSize(2560, { height: 670, width: 1191 }), { height: 670, width: 1191 }, 'small windows are not enlarged');
assert.deepEqual(resolveCaptureStillSize(2560, { height: 2160, width: 3840 }), { height: 1440, width: 2560 }, '4K is capped to the long side');
assert.deepEqual(resolveCaptureStillSize(2560, null), { height: 2560, width: 2560 }, 'unknown size falls back to the cap box');

// 4. The login button on a login gate does not have to belong to the final target.
const loginGate = (primaryAction: string, extra: Partial<Parameters<typeof createVisualSnapshotLauncherVerification>[0]> = {}) => createVisualSnapshotLauncherVerification({
  currentSelection: '', primaryAction, readiness: 'ready', relation: '橙色主按钮是当前选中账号的主要登录入口', relationRequired: true, targetMatched: '快捷安全登录', ...extra,
});
assert.equal(loginGate('快捷安全登录')?.status, 'ready', 'WeGame quick login is clickable on the way to League of Legends');
assert.equal(loginGate('QQ 账号密码登录')?.status === 'ready' && loginGate('QQ 账号密码登录')?.reason.includes('login gate'), false, 'a "use password instead" link is not a login continuation');
assert.notEqual(loginGate('退出登录')?.reason.includes('login gate'), true, 'logout is never treated as login');
assert.notEqual(loginGate('快捷安全登录', { readiness: 'low-confidence' })?.status, 'ready', 'low confidence still blocks');

// 5. Input refused only because the target was not in front: focus it and retry once.
assert.deepEqual(resolveDesktopInputFocusRetryTarget({ error: 'target_window_not_foreground', expectedForeground: { hwnd: 791262, pid: 4321, title: 'WeGame' } }),
  { hwnd: 791262, pid: 4321, query: 'WeGame' });
assert.equal(resolveDesktopInputFocusRetryTarget({ error: 'target_window_not_foreground', expectedForeground: null }), null, 'no known target: no retry');
assert.equal(resolveDesktopInputFocusRetryTarget({ error: 'target_requires_elevation', expectedForeground: { hwnd: 1 } }), null, 'other refusals are not retried');
assert.equal(resolveDesktopInputFocusRetryTarget({ ok: true }), null);

// 6. A login retry built from the pre-login read targets the login window by expectedForegroundHwnd.
// After login that window is gone (replaced by the main window), so the retry click is stale.
const mainWindowOnly = [{ bounds: { height: 1116, width: 1984, x: 288, y: 132 }, id: 'window:2034444:0', name: 'WeGame' }];
(desktopPetShellRuntime as { listCaptureSources: unknown }).listCaptureSources = async () => mainWindowOnly;
const retryClick = { action: 'click', coordinateSpace: 'native-screen', expectedForegroundHwnd: 2428700, x: 1280, y: 827 };
assert.ok(await findAgentRuntimeDesktopSequenceStaleClickByHwnd(retryClick), 'login window replaced: retry click blocked');
assert.equal(await findAgentRuntimeDesktopSequenceStaleClickByHwnd({ ...retryClick, expectedForegroundHwnd: 2034444 }), null,
  'click planned against the window that is still there proceeds');

console.log('agent launch follow-up and click guard smoke ok');
