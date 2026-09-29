import assert from 'node:assert/strict';
import { buildScopedChatHistory } from '../src/components/chat/chatScopedContextUtils';
import { resolveChatMessageMode } from '../src/components/chat/chatMessageScopeUtils';
import type { ChatMessage } from '../src/types';

const messages: ChatMessage[] = [
  { role: 'user', text: '旧故事', chatMode: 'story', storyId: 'story-old' },
  { role: 'model', text: '旧回复', chatMode: 'story', storyId: 'story-old', petId: 'primary', petName: '阿澈' },
  { role: 'user', text: '本轮行动', chatMode: 'story', storyId: 'story-new' },
  { role: 'model', text: '跟我来', chatMode: 'story', storyId: 'story-new', petId: 'primary', petName: '阿澈' },
  { role: 'model', text: '我守后方', chatMode: 'story', storyId: 'story-new', petId: 'companion-1', petName: '小满' },
  { role: 'user', text: '普通私聊', chatMode: 'single', petId: 'primary' },
];

assert.equal(resolveChatMessageMode({ role: 'user', text: 'x', chatMode: 'story' }), 'story');
const scoped = buildScopedChatHistory(messages, 'story', 'primary');
assert.equal(scoped.length, 3);
assert.equal(scoped.some((message) => message.text.includes('旧回复')), false);
assert.equal(scoped.some((message) => message.text.includes('阿澈')), true);
assert.equal(scoped.some((message) => message.text.includes('小满')), true);
assert.equal(scoped.some((message) => message.text.includes('普通私聊')), false);

console.log('story chat mode routing smoke: PASS');
