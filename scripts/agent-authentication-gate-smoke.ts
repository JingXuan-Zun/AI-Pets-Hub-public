import assert from 'node:assert/strict';
import {
  hasAgentAuthenticationHardGateCue,
  hasAgentAuthenticationManualVerificationCue,
  resolveAgentAuthenticationGate,
} from '../src/agent/runtime/agentAuthenticationGate.ts';

const ready = resolveAgentAuthenticationGate({
  controlText: '快速安全登录按钮',
  postActionState: 'login_required',
  text: '账号密码已填写，可以登录。',
});
assert.equal(ready.status, 'login-required-ready');
assert.equal(ready.canSubmit, true);
assert.equal(ready.requiresUser, false);

const explicitGateAbsence = resolveAgentAuthenticationGate({
  controlText: '快速安全登录按钮',
  postActionState: 'login_required',
  text: '账号已记住，未发现验证码、二维码、短信码、二次验证或 UAC。',
});
assert.equal(explicitGateAbsence.status, 'login-required-ready');
assert.equal(explicitGateAbsence.canSubmit, true);
assert.equal(explicitGateAbsence.requiresUser, false);
assert.equal(hasAgentAuthenticationManualVerificationCue('未发现验证码、二维码或 UAC。'), false);
assert.equal(hasAgentAuthenticationHardGateCue('未发现验证码、二维码或 UAC。'), false);
assert.equal(hasAgentAuthenticationManualVerificationCue('未发现验证码，但需要扫码验证。'), true);
assert.equal(hasAgentAuthenticationHardGateCue('账号已记住，未发现验证码、二维码或 UAC。'), false);

const missingCredentials = resolveAgentAuthenticationGate({
  controlText: '登录按钮',
  postActionState: 'login_required',
  text: '密码为空，请输入密码。',
});
assert.equal(missingCredentials.status, 'login-required-needs-user');
assert.equal(missingCredentials.canSubmit, false);
assert.equal(missingCredentials.requiresUser, true);

const manualVerification = resolveAgentAuthenticationGate({
  controlText: '登录按钮',
  postActionState: 'login_required',
  text: '账号密码已填写，但需要扫码验证。',
});
assert.equal(manualVerification.status, 'login-required-needs-user');
assert.equal(manualVerification.canSubmit, false);
assert.equal(manualVerification.requiresUser, true);

const mixedVerificationEvidence = resolveAgentAuthenticationGate({
  controlText: '登录按钮',
  postActionState: 'login_required',
  text: '未发现验证码，但需要扫码验证。',
});
assert.equal(mixedVerificationEvidence.status, 'login-required-needs-user');
assert.equal(mixedVerificationEvidence.canSubmit, false);
assert.equal(mixedVerificationEvidence.requiresUser, true);

const authenticated = resolveAgentAuthenticationGate({
  controlText: '登录按钮',
  text: '已登录，当前显示好友列表。',
});
assert.equal(authenticated.status, 'authenticated');
assert.equal(authenticated.canSubmit, false);

const missingControl = resolveAgentAuthenticationGate({
  postActionState: 'login_required',
  text: '当前是账号登录界面。',
});
assert.equal(missingControl.status, 'unknown');
assert.equal(missingControl.canSubmit, false);

console.log('agent authentication gate smoke ok');
