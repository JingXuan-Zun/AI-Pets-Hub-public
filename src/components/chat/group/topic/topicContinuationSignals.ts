import type { ChatMessage } from '../../../../types';
import { isChatMessageInMode } from '../../chatMessageScopeUtils';

function normalizeReply(text: string) {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function resolveRepeatedGroupReplyCount(messages: ChatMessage[]) {
  const recentReplies = messages
    .filter((message) => isChatMessageInMode(message, 'group') && message.role === 'model')
    .slice(-3)
    .map((message) => normalizeReply(message.text))
    .filter(Boolean);
  if (recentReplies.length < 2) {
    return 0;
  }

  const latestReply = recentReplies.at(-1)!;
  return recentReplies.filter((reply) => reply === latestReply).length - 1;
}
