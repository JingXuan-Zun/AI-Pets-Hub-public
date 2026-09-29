import assert from 'node:assert/strict';
import { desktopPetChatStore } from '../src/chatStore';
import { continueGroupChatConversation } from '../src/components/chat/chatGroupContinuation';
import { detectGroupUserAttention } from '../src/components/chat/group/attention/groupUserAttention';
import { GroupChatRuntime } from '../src/components/chat/group/runtime/groupChatRuntime';
import type { ChatMessage } from '../src/types';

function groupMessage(text: string, id = 'message-1'): ChatMessage {
  return {
    chatMode: 'group', id, petId: 'alice', petName: 'Alice', role: 'model', text,
  };
}

const options = { participantNames: ['Alice', 'Berry'], userDisplayName: '小明' };
const direct = detectGroupUserAttention(groupMessage('小明，你觉得我们选哪个？'), options);
assert.equal(direct?.roleId, 'alice');
assert.equal(direct?.sourceMessageKey, 'message-1');

assert.ok(detectGroupUserAttention(groupMessage('主人，你愿意来决定吗？'), options));
assert.equal(detectGroupUserAttention(groupMessage('小明，今天辛苦了。'), options), null);
assert.equal(detectGroupUserAttention(groupMessage('Berry，你觉得呢？'), options), null);
assert.equal(detectGroupUserAttention(groupMessage('你觉得呢？'), options), null);
assert.equal(detectGroupUserAttention(groupMessage('小明，你觉得呢？'), {
  ...options,
  handledMessageKey: 'message-1',
}), null);
assert.equal(detectGroupUserAttention(groupMessage('主人，你觉得呢？'), {
  participantNames: ['主人'],
}), null);

desktopPetChatStore.reset();
desktopPetChatStore.replaceMessages([groupMessage('小明，你想加入讨论吗？')]);
const runtime = new GroupChatRuntime({
  activeRoleIds: ['alice'], groupSessionId: 'attention-session', mode: 'infinite',
});
runtime.beginPlanning();
runtime.waitForNextSpeaker([]);
let waited = false;
const result = await continueGroupChatConversation({
  canContinue: () => runtime.canContinue(),
  participantNames: ['Alice'],
  playbackToken: 1,
  requestToken: 1,
  runtime,
  runPetResponseTurn: async () => ({ cancelled: false, finalResponse: '' }),
  targetSlots: [],
  userDisplayName: '小明',
  waitForNextGroupChatTurn: async () => { waited = true; },
});

assert.equal(result, 'paused-for-user');
assert.equal(waited, false);
assert.equal(runtime.controller.getSnapshot().status, 'waiting-next-speaker');
assert.equal(desktopPetChatStore.getState().groupUserAttention?.roleName, 'Alice');

desktopPetChatStore.resolveGroupUserAttention();
assert.equal(desktopPetChatStore.getState().groupUserAttention, null);
assert.equal(desktopPetChatStore.getState().groupUserAttentionHandledMessageKey, 'message-1');
desktopPetChatStore.reset();

console.log('group user attention smoke ok');
