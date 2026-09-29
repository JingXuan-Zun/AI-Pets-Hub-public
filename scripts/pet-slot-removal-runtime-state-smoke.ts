import { strict as assert } from 'node:assert';
import { desktopPetChatStore } from '../src/chatStore.ts';

desktopPetChatStore.reset();
desktopPetChatStore.setActivePetId('companion-pet-2');
desktopPetChatStore.setTyping(true);
desktopPetChatStore.setTypingPetId('companion-pet-2');
desktopPetChatStore.setSpeaking(true);
desktopPetChatStore.setSpeakingPetId('companion-pet-2');
desktopPetChatStore.rememberGroupPetAliases({ 'companion-pet-2': ['旧桌宠'] });
desktopPetChatStore.queueAnimationToolTrigger('companion-pet-2', ['wave']);
desktopPetChatStore.removePetRuntimeState('companion-pet-2');

const state = desktopPetChatStore.getState();
assert.equal(state.activePetId, 'primary');
assert.equal(state.typingPetId, null);
assert.equal(state.speakingPetId, null);
assert.equal(state.isTyping, false);
assert.equal(state.isSpeaking, false);
assert.equal(state.groupPetAliasesById['companion-pet-2'], undefined);
assert.equal(state.animationToolTriggersByPetId['companion-pet-2'], undefined);
assert.equal(state.lastReplayableAnimationToolTriggersByPetId['companion-pet-2'], undefined);

console.log('pet slot removal runtime state smoke passed');
