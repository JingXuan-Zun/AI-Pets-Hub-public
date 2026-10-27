import type { DesktopPetChatMode } from './types';

// Who the user was chatting with (character and mode), so a restart — or a phone message
// through QQ after one — carries on with her instead of falling back to the primary character.

const CHAT_TARGET_STORAGE_KEY = 'desktop-pet.chat-target.v1';

export type ChatTargetSnapshot = {
  activePetId?: string;
  chatMode?: DesktopPetChatMode;
};

export function loadChatTargetSnapshot(): ChatTargetSnapshot {
  try {
    const raw = globalThis.localStorage?.getItem(CHAT_TARGET_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object') return {};
    return {
      activePetId: typeof parsed.activePetId === 'string' ? parsed.activePetId : undefined,
      chatMode: parsed.chatMode === 'single' || parsed.chatMode === 'group' || parsed.chatMode === 'story' ? parsed.chatMode : undefined,
    };
  } catch {
    return {};
  }
}

export function saveChatTargetSnapshot(patch: ChatTargetSnapshot) {
  try {
    globalThis.localStorage?.setItem(CHAT_TARGET_STORAGE_KEY, JSON.stringify({ ...loadChatTargetSnapshot(), ...patch }));
  } catch {
    // Remembering the chat partner is a convenience; never break chatting over it.
  }
}
