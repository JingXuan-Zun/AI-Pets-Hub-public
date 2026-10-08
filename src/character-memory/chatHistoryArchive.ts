import { resolveChatMessageMode, resolveChatMessagePetId } from '../components/chat/chatMessageScopeUtils';
import type { ChatMessage } from '../types';

/** Newest messages kept in the live history per private chat, group chat and story. */
export const CHAT_HISTORY_KEEP_PER_SCOPE = 500;

function scopeKey(message: ChatMessage) {
  const mode = resolveChatMessageMode(message);
  return mode === 'single' ? `single:${resolveChatMessagePetId(message) ?? ''}` : mode;
}

/**
 * Messages old enough to move out of the live history. A private-chat message
 * only goes once the role's conversation summary covers it, so nothing is ever
 * both outside the prompt window and missing from the summary.
 */
export function selectArchivableChatMessages(
  messages: ChatMessage[],
  coveredUntilByPetId: (petId: string) => number | null,
  keepPerScope = CHAT_HISTORY_KEEP_PER_SCOPE,
) {
  const keptCountByScope = new Map<string, number>();
  const archivable = new Set<ChatMessage>();
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    const key = scopeKey(message);
    const kept = keptCountByScope.get(key) ?? 0;
    if (kept < keepPerScope) {
      keptCountByScope.set(key, kept + 1);
      continue;
    }
    if (message.agentApproval) continue;
    if (key.startsWith('single:')) {
      const coveredUntil = coveredUntilByPetId(key.slice('single:'.length));
      if (coveredUntil === null || (message.createdAt ?? 0) > coveredUntil) continue;
    }
    archivable.add(message);
  }
  return messages.filter((message) => archivable.has(message));
}
