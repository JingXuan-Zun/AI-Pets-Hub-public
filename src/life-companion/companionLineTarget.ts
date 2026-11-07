import { desktopPetChatStore } from '../chatStore';
import { DEFAULT_CHAT_ACTIVE_PET_ID } from '../chatState';
import { getDesktopPetSlot } from '../multiPetRoster';
import type { PetConfig } from '../types';

/** The character a companion line comes from: the one the user is chatting with. */
export function resolveLifeCompanionPromptTarget(config: PetConfig) {
  const chatState = desktopPetChatStore.getState();
  const activePetId = chatState.activePetId || DEFAULT_CHAT_ACTIVE_PET_ID;
  const slot = getDesktopPetSlot(config, activePetId)
    ?? getDesktopPetSlot(config, DEFAULT_CHAT_ACTIVE_PET_ID);

  return {
    chatMode: chatState.chatMode,
    petId: slot?.id ?? DEFAULT_CHAT_ACTIVE_PET_ID,
    petName: slot?.personality.name ?? config.personality.name,
  };
}
