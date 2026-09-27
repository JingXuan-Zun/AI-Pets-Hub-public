import { desktopPetChatStore } from './chatStore';
import { pushFrontendRuntimeError, pushFrontendRuntimeLog } from './frontendRuntimeLogger';
import type { ChatMessage } from './types';

const PERSISTED_CHAT_HISTORY_KEY = 'desktop-pet:chat-history:v1';

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readLocalChatHistory() {
  if (!canUseLocalStorage()) return [];
  try {
    const rawHistory = window.localStorage.getItem(PERSISTED_CHAT_HISTORY_KEY);
    const parsedHistory = rawHistory ? JSON.parse(rawHistory) : [];
    return Array.isArray(parsedHistory) ? parsedHistory as ChatMessage[] : [];
  } catch (error) {
    pushFrontendRuntimeError('chat', '本地聊天记录读取失败', error);
    return [];
  }
}

function writeLocalChatHistory(messages: ChatMessage[]) {
  if (!canUseLocalStorage()) return false;
  try {
    window.localStorage.setItem(PERSISTED_CHAT_HISTORY_KEY, JSON.stringify(messages));
    return true;
  } catch (error) {
    pushFrontendRuntimeError('chat', '本地聊天记录保存失败', error);
    return false;
  }
}

export async function loadPersistedChatHistory() {
  if (window.desktopPetShell?.desktopMode && window.desktopPetShell.loadPersistedChatHistory) {
    try {
      const result = await window.desktopPetShell.loadPersistedChatHistory();
      if (result?.ok || Array.isArray(result?.messages)) {
        pushFrontendRuntimeLog('chat', '已恢复聊天记录', {
          messageCount: result.messages?.length ?? 0,
          source: result.source ?? 'desktop-file',
        });
        return result.messages ?? [];
      }
    } catch (error) {
      pushFrontendRuntimeError('chat', '桌面聊天记录读取失败', error);
    }
  }

  return readLocalChatHistory();
}

export async function persistChatHistory(messages: ChatMessage[]) {
  if (window.desktopPetShell?.desktopMode && window.desktopPetShell.savePersistedChatHistory) {
    try {
      const result = await window.desktopPetShell.savePersistedChatHistory(messages);
      if (result?.ok) return true;
      pushFrontendRuntimeLog('chat', '桌面聊天记录保存失败', {
        error: result?.error ?? 'unknown',
      });
      return false;
    } catch (error) {
      pushFrontendRuntimeError('chat', '桌面聊天记录保存失败', error);
      return false;
    }
  }

  return writeLocalChatHistory(messages);
}

export function restorePersistedChatHistory(messages: ChatMessage[]) {
  desktopPetChatStore.replaceMessages(messages);
}
