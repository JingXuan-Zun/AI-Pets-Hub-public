import { PRIMARY_DESKTOP_PET_SLOT_ID } from '../../multiPetRoster';
import type { ChatMessage, DesktopPetChatMode } from '../../types';

export function resolveChatMessageMode(message: ChatMessage): DesktopPetChatMode {
  if (message.chatMode === 'single' || message.chatMode === 'group' || message.chatMode === 'story') {
    return message.chatMode;
  }

  return message.role === 'user' && !message.petId ? 'group' : 'single';
}

export function resolveChatMessagePetId(message: ChatMessage) {
  if (message.role !== 'model') {
    return message.petId ?? null;
  }

  return message.petId ?? PRIMARY_DESKTOP_PET_SLOT_ID;
}

export function isChatMessageInMode(message: ChatMessage, chatMode: DesktopPetChatMode) {
  return resolveChatMessageMode(message) === chatMode;
}
