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
assert.equal(classifyVoiceApproval('都好'), 'approve-task', 'the task-only answer is unchanged');
assert.match(formatQqApprovalQuestion('打开浏览器'), /“今天都好”/u);
assert.doesNotMatch(formatQqApprovalQuestion('发送消息', true), /都好/u, 'irreversible steps offer only yes/no');

console.log('daily approval smoke ok');
process.exit(0);
