import assert from 'node:assert/strict';
import { desktopPetChatStore } from '../src/chatStore';
import { shouldCancelActiveRequestForChatModeSwitch } from '../src/components/chat/chatSessionControlUtils';
import { finalizeStreamingReplyMessage } from '../src/components/chat/chatResponseTurnUtils';
import { filterConversationMessages } from '../src/components/chat/petChatConversationMessageUtils';
import type { ChatMessage } from '../src/types';

type ChatResponseTargetSlot = Parameters<typeof finalizeStreamingReplyMessage>[0]['targetSlot'];

const targetSlot: ChatResponseTargetSlot = {
  id: 'primary',
  slotNumber: 1,
  label: 'Test Pet',
  isPrimary: true,
  enabled: true,
  modelUrl: '',
  modelType: '2d',
  personality: {
    name: 'Test Pet',
    traits: [],
    greeting: 'Hello',
    systemInstruction: '',
    chatAvatarUrl: '',
    beginDialogs: [],
    customErrorMessage: '',
    userMemory: '',
    chatHistoryMemory: '',
    knowledgeBase: '',
    webSearchEnabled: false,
    webLearningEnabled: false,
  },
  stats: {
    affection: 50,
    fatigue: 0,
    hunger: 50,
  },
  position: {
    x: 0,
    y: 0,
  },
  scale: 1,
  currentAction: 'IDLE',
  autoMovementEnabled: true,
};

assert.equal(
  shouldCancelActiveRequestForChatModeSwitch({ isGroupChatRunning: false }, 'single'),
  false,
  'switching back to private chat must not cancel an in-flight private reply',
);
assert.equal(
  shouldCancelActiveRequestForChatModeSwitch({ isGroupChatRunning: true }, 'single'),
  true,
  'leaving an actively running infinite group chat should still cancel that group request',
);

desktopPetChatStore.reset();
desktopPetChatStore.addMessage({
  id: 'user-private',
  role: 'user',
  text: 'private prompt',
  chatMode: 'single',
  petId: targetSlot.id,
  petName: targetSlot.personality.name,
} satisfies ChatMessage);

desktopPetChatStore.setChatMode('group');
finalizeStreamingReplyMessage({
  chatMode: 'single',
  finalResponse: 'private reply survived the mode switch',
  hasModelMessage: false,
  modelMessageId: 'model-private',
  responseText: '',
  targetSlot,
});
desktopPetChatStore.setChatMode('single');

const visiblePrivateMessages = filterConversationMessages(
  desktopPetChatStore.getState().messages,
  'single',
  targetSlot.id,
);

assert.deepEqual(
  visiblePrivateMessages.map((message) => message.id),
  ['user-private', 'model-private'],
  'private reply should remain visible after switching private -> group -> private while it is completing',
);
assert.equal(
  visiblePrivateMessages.at(-1)?.text,
  'private reply survived the mode switch',
  'private reply text should not disappear after mode switching',
);

console.log('chat mode switch during reply smoke ok');
