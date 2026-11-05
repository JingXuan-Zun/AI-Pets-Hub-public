import assert from 'node:assert/strict';

// "今天都允许": one yes covers everyday steps for the rest of the day; a "no" or midnight ends
// it; steps that cannot be taken back still ask. (The task card and the pill are checked in the app.)

const store = new Map<string, string>();
const storageEvents: Array<(event: { key: string }) => void> = [];
Object.assign(globalThis, {
  window: {
    addEventListener: (_: string, listener: (event: { key: string }) => void) => storageEvents.push(listener),
    clearInterval,
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      removeItem: (key: string) => { store.delete(key); },
      setItem: (key: string, value: string) => { store.set(key, value); },
    },
    removeEventListener: () => undefined,
    setInterval,
  },
});

const { grantDailyApproval, isDailyApprovalActive, isIrreversibleApproval, revokeDailyApproval } = await import('../src/agent/approval/dailyApproval');
const { resolveAgentApprovalDecisionFromText } = await import('../src/components/chat/runController/approvalDecisionText');
const { classifyVoiceApproval } = await import('../src/components/chat/voiceApproval');
const { formatQqApprovalQuestion } = await import('../src/qq-bridge/qqBridgeRelay');

// Granted for today only; a "no" (revoke) ends it.
assert.equal(isDailyApprovalActive(), false);
grantDailyApproval();
assert.equal(isDailyApprovalActive(), true);
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
assert.equal(isDailyApprovalActive(tomorrow), false, 'it ends at midnight');
revokeDailyApproval();
assert.equal(isDailyApprovalActive(), false, 'a refusal ends it');

// What still asks every time.
for (const text of ['发送消息给张三', '把 a.txt 移到回收站：删除', '付款 30 元', '关闭窗口「记事本」', '让所有角色忘掉「关于你」里和“生日”有关的记忆', '目标位置已有同名文件，会被覆盖']) {
  assert.equal(isIrreversibleApproval(text), true, text);
}
for (const text of ['让我操作你的电脑', '打开 记事本', '把桌面图标「微信」挪到副屏左上', '新建文件夹：D:/a', '搜索 今天的天气']) {
  assert.equal(isIrreversibleApproval(text), false, text);
}

// Spoken, typed and phone answers.
for (const text of ['今天都允许', '今天都好', '今天别问了', '今天都可以吧']) {
  assert.equal(classifyVoiceApproval(text), 'approve-day', `voice: ${text}`);
  assert.equal(resolveAgentApprovalDecisionFromText(text), 'approve-day', `typed: ${text}`);
}
// “这次都允许” was dropped (2026-11-03): “都好”“别问了”“这次都允许” and the like now mean today.
for (const text of ['都同意', '都同意吧', '这次都允许', '全部允许！', '不用问了', '都好']) assert.equal(classifyVoiceApproval(text), 'approve-day', `voice: ${text}`);
for (const text of ['都同意', '都好吧', '别问了']) assert.equal(resolveAgentApprovalDecisionFromText(text), 'approve-day', `typed: ${text}`);
assert.equal(classifyVoiceApproval('同意'), 'approve', 'a plain yes is still one step');
assert.doesNotMatch(formatQqApprovalQuestion('打开浏览器'), /“都好”|这个任务/u, 'QQ / WeChat only offer 好 / 今天都好 / 不要');
assert.match(formatQqApprovalQuestion('打开浏览器'), /“今天都好”/u);
assert.doesNotMatch(formatQqApprovalQuestion('发送消息', true), /都好/u, 'irreversible steps offer only yes/no');

// The question read out on WeChat says what to answer.
const { formatApprovalSpeech } = await import('../src/qq-bridge/qqBridgeRelay');
assert.match(formatApprovalSpeech('让我操作你的电脑'), /让我操作你的电脑.*“好”.*“今天都好”.*“不要”/u);
assert.doesNotMatch(formatApprovalSpeech('发送消息', true), /今天都好/u);

// An answer typed on the phone counts even while she is still asking out loud on the computer
// (it used to be dropped as "maybe her own voice", so it took several answers).
const { waitForAgentLoopDecision } = await import('../src/components/chat/runController/agentLoopApprovalRegistry');
const { resolvePendingApprovalBySpeech } = await import('../src/components/chat/voiceApproval');
const waiting = waitForAgentLoopDecision('phone-1');
assert.equal(await resolvePendingApprovalBySpeech('好', async () => null, () => true), null, 'the microphone still ignores answers while she talks');
assert.equal(await resolvePendingApprovalBySpeech('今天都好', async () => null, () => false), 'approve-day');
assert.equal(await waiting, 'approve-day');

console.log('daily approval smoke ok');
process.exit(0);
