import assert from 'node:assert/strict';
import {
  clearPrivateChatMessages,
  resolveChatResetScope,
  resolvePrivateChatResetScopeChoice,
} from '../src/components/chat/chatSessionControlUtils';
import type { ChatMessage } from '../src/types';
import { readProjectSources } from './smokeTestHarness';

const messages: ChatMessage[] = [
  { id: 'primary-user', role: 'user', text: 'primary user', chatMode: 'single', petId: 'primary' },
  { id: 'primary-model', role: 'model', text: 'primary model', chatMode: 'single', petId: 'primary' },
  { id: 'legacy-primary', role: 'model', text: 'legacy primary', chatMode: 'single' },
  { id: 'secondary-user', role: 'user', text: 'secondary user', chatMode: 'single', petId: 'secondary' },
  { id: 'group', role: 'model', text: 'group', chatMode: 'group', petId: 'primary' },
  { id: 'story', role: 'model', text: 'story', chatMode: 'story', petId: 'primary' },
];

assert.deepEqual(
  clearPrivateChatMessages(messages, 'primary', 'current-private').map((message) => message.id),
  ['secondary-user', 'group', 'story'],
  'current reset must remove only the active role’s private conversation',
);
assert.deepEqual(
  clearPrivateChatMessages(messages, 'primary', 'all-private').map((message) => message.id),
  ['group', 'story'],
  'all-private reset must preserve group and story messages',
);
assert.equal(resolvePrivateChatResetScopeChoice('1'), 'current-private');
assert.equal(resolvePrivateChatResetScopeChoice('当前'), 'current-private');
assert.equal(resolvePrivateChatResetScopeChoice('2'), 'all-private');
assert.equal(resolvePrivateChatResetScopeChoice('全部'), 'all-private');
assert.equal(resolvePrivateChatResetScopeChoice(null), null);
assert.equal(resolveChatResetScope('/reset', 'single'), 'current-private');
assert.equal(resolveChatResetScope('/reset', 'group'), 'group');
assert.equal(resolveChatResetScope('/reset', 'story'), null);

const { controlsSource, senderSource } = readProjectSources({
  controlsSource: 'src/components/chat/usePetChatSessionControls.ts',
  senderSource: 'src/components/chat/petChatMessageSendExecution.ts',
});
assert.match(senderSource, /resolveChatResetScope\(input\.outgoingText, currentChatState\.chatMode\)/u);
assert.match(senderSource, /if \(resetScope\) context\.resetChatSession\(resetScope\);/u);
assert.match(controlsSource, /clearPrivateChatMessages\(state\.messages, state\.activePetId, scope\)/u);
assert.match(controlsSource, /getPrivateChatResetCompletedMessage\(scope\)/u);
assert.doesNotMatch(controlsSource, /replaceMessages\(\[\]\)/u);

console.log('scoped private chat reset selection passed');
