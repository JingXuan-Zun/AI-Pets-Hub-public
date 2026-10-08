import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { assertImplementationModuleGraph } from './implementationModuleGuard';
import { PetChatConversationMessageBubble } from '../src/components/chat/PetChatConversationMessageBubble';
import { resolveAgentApprovalCollapsedSummary } from '../src/components/chat/message/AgentMessageCollapsedNotice';
import type { ChatMessage, PetConfig } from '../src/types';

const config = {
  personality: { name: '测试桌宠' },
  companionPets: [],
  settings: {
    chatAvatarsEnabled: true,
    chatUserDisplayName: '测试用户',
    chatFontSize: 14,
    chatFontWeight: 500,
    chatBubbleTransparency: 0,
  },
} as PetConfig;

const plan = { goal: '读取当前屏幕', instruction: '', steps: [], commandKind: 'tool-call' };
const base = { id: 'message-1', role: 'model', text: '你好（动作）', petName: '测试桌宠' } as ChatMessage;
function render(message: ChatMessage, extra = {}) {
  return renderToStaticMarkup(createElement(PetChatConversationMessageBubble, {
    config, message, messageKey: message.id!, chatBracketOuterTextColor: '#123456',
    onSendMessage: () => {}, onStopAgentRun: () => {}, onResolveAgentApproval: () => {},
    ...extra,
  }));
}

const plain = render(base);
assert.ok(plain.includes('测试桌宠') && plain.includes('你好') && plain.includes('（动作）'));
assert.ok(plain.includes('语音') && !plain.includes('确认这一步'));
const user = render({ ...base, role: 'user' });
assert.ok(user.includes('测试用户') && !user.includes('播放语音'));
const narration = render({ ...base, storyMessageKind: 'narration' }, { embeddedStoryNarration: true });
assert.ok(!narration.includes('播放语音') && !narration.includes('测试桌宠'));
const image = render({ ...base, text: '', attachments: [{
  id: 'image-1', kind: 'image', name: '截图', dataUrl: 'data:image/png;base64,AA==',
}] } as ChatMessage);
assert.ok(image.includes('alt="截图"') && image.includes('data:image/png;base64,AA=='));
const ordered = render({ ...base, content: [{ kind: 'text', text: '有序正文' }] } as ChatMessage);
assert.ok(ordered.includes('有序正文') && !ordered.includes('你好'));

for (const status of ['pending', 'running', 'denied', 'completed'] as const) {
  const message = { ...base, agentApproval: { id: 'approval-1', status, plan } } as ChatMessage;
  const markup = render(message);
  assert.ok(markup.includes('确认这一步：读取当前屏幕'));
  assert.equal(markup.includes('title="允许这一步"'), status === 'pending' || status === 'running');
  assert.equal(markup.includes('title="终止当前 Agent 执行"'), status === 'pending' || status === 'running');
  if (status === 'pending') assert.ok(markup.indexOf('准备执行') < markup.indexOf('title="允许这一步"'));
}
for (const status of ['planned', 'running', 'completed', 'failed'] as const) {
  const markup = render({ ...base, agentRun: { id: 'run-1', status, plan } } as ChatMessage);
  assert.ok(markup.includes('读取当前屏幕'));
  assert.equal(markup.includes('title="终止当前 Agent 执行"'), status === 'planned' || status === 'running');
}

// A pending approval without an optional summary must still explain why it waits.
assert.ok(resolveAgentApprovalCollapsedSummary({ id: 'approval-1', status: 'pending', plan } as
  NonNullable<ChatMessage['agentApproval']>, '等待确认').length > 0);
assert.equal(resolveAgentApprovalCollapsedSummary({
  id: 'approval-1', status: 'pending', plan,
  approvalSummary: { title: '待确认的窗口操作', lines: [] },
} as NonNullable<ChatMessage['agentApproval']>, '等待确认'), '待确认的窗口操作');

assertImplementationModuleGraph({
  entry: 'src/components/chat/PetChatConversationMessageBubble.tsx',
  directory: 'src/components/chat/message',
});
console.log('chat message module smoke: PASS (rendering, approval states, budgets, acyclic dependencies)');
