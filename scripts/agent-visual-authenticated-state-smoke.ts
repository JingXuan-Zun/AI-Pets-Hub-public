import assert from 'node:assert/strict';
import { isVisualSnapshotAuthenticatedState } from '../src/agent/agentRuntimeVisualTools.ts';

assert.equal(isVisualSnapshotAuthenticatedState('QQ main interface. Friends list is visible. The account is already logged in.'), true);
assert.equal(isVisualSnapshotAuthenticatedState('QQ login page with a visible Login button.'), false);
assert.equal(isVisualSnapshotAuthenticatedState('The account is logged in, but a captcha is required.'), false);
assert.equal(isVisualSnapshotAuthenticatedState('已登录，当前显示主界面和好友列表，无需登录。'), true);
assert.equal(isVisualSnapshotAuthenticatedState('QQ main interface is visible; the login page, password, captcha, and QR code are not shown.'), true);

console.log('agent visual authenticated state smoke ok');
