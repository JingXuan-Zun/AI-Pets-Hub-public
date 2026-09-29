import assert from 'node:assert/strict';
import { buildScopedChatHistory } from '../src/components/chat/chatScopedContextUtils';
import type { ChatMessage } from '../src/types';

const singleHistory: ChatMessage[] = [
  {
    id: 'user-a',
    role: 'user',
    text: 'Role A, do you know the first answer?',
    chatMode: 'single',
    petId: 'pet-a',
    petName: 'Role A',
  },
  {
    id: 'model-a',
    role: 'model',
    text: 'The first answer is A.',
    chatMode: 'single',
    petId: 'pet-a',
    petName: 'Role A',
  },
  {
    id: 'user-b',
    role: 'user',
    text: 'Role B, what should we eat today?',
    chatMode: 'single',
    petId: 'pet-b',
    petName: 'Role B',
  },
];

const petBHistory = buildScopedChatHistory(singleHistory, 'single', 'pet-b');

assert.deepEqual(
  petBHistory.map((message) => message.id),
  ['user-b'],
  'single chat history should not leak another pet user prompt into the active pet prompt',
);
assert.ok(
  !petBHistory.some((message) => message.text.includes('first answer')),
  'single chat history should not include another pet topic',
);

const groupHistory: ChatMessage[] = singleHistory.map((message) => ({
  ...message,
  chatMode: 'group',
}));
const scopedGroupHistory = buildScopedChatHistory(groupHistory, 'group', 'pet-b');

assert.deepEqual(
  scopedGroupHistory.map((message) => message.id),
  ['user-a', 'model-a', 'user-b'],
  'group chat should still keep shared conversation context',
);

console.log('chat scoped history smoke ok');
