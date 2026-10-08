import assert from 'node:assert/strict';
import { resolveSpeakingMessageIndex, buildMessageKey } from '../src/components/chat/PetChatConversationMessageFeed';

type Message = Parameters<typeof buildMessageKey>[0];
const messages = [
  { id: 'u1', role: 'user', text: '你好' },
  { id: 'm1', role: 'model', text: '第一条回复', petId: 'primary' },
  { id: 'u2', role: 'user', text: '再说一句' },
  { id: 'm2', role: 'model', text: '第二条回复', petId: 'primary' },
  { id: 'm3', role: 'model', text: '另一个角色', petId: 'pet-b' },
] as unknown as Message[];

// Reply playback without a manual target: the speaking pet's latest message.
assert.equal(resolveSpeakingMessageIndex(messages, 'primary', null), 3);
assert.equal(resolveSpeakingMessageIndex(messages, 'pet-b', null), 4);
// A manually replayed older message keeps the badge even though newer messages exist.
assert.equal(resolveSpeakingMessageIndex(messages, 'primary', 'm1'), 1);
// A stale manual key (message gone) falls back to the latest message.
assert.equal(resolveSpeakingMessageIndex(messages, 'primary', 'deleted'), 3);
assert.equal(resolveSpeakingMessageIndex(messages, null, null), -1);
// Keys without ids follow the same shape the feed renders with.
assert.equal(buildMessageKey({ role: 'model', text: 'x' } as unknown as Message, 2), 'model-2-x');

console.log('chat voice playing indicator smoke passed');
