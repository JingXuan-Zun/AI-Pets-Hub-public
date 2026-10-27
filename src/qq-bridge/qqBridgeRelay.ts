import type { ChatMessage } from '../types';

// Which chat lines go back to QQ after a message from the phone: every reply posted since,
// once it has finished, and every approval question the character asks meanwhile.

export type QqRelayState = {
  /** Replies posted at or after this moment belong to the phone conversation. */
  since: number;
  sentApprovalIds: Set<string>;
  sentMessageIds: Set<string>;
};

export function createQqRelayState(since: number): QqRelayState {
  return { since, sentApprovalIds: new Set(), sentMessageIds: new Set() };
}

/** One reply for QQ: its text (kaomoji and emoji inline) and its image stickers, sent after it. */
export type QqOutgoing = {
  /** Who said it, for her voice; null for the approval questions. */
  petId: string | null;
  /** Only the words (no kaomoji, no speaker name): what a voice message would say. */
  speechText: string;
  stickerAssetIds: string[];
  text: string;
};

/** Plain text for QQ: no Markdown bold markers. */
export function formatQqReplyText(text: string) {
  return text.replace(/\*{2,3}/gu, '').trim();
}

/** The reply as shown in the chat: text with kaomoji/emoji where they appear, image stickers apart. */
function formatQqReply(message: ChatMessage) {
  if (!Array.isArray(message.content) || !message.content.length) {
    const text = formatQqReplyText(message.text ?? '');
    return { speechText: text, stickerAssetIds: [] as string[], text };
  }
  const stickerAssetIds: string[] = [];
  const words = message.content.map((segment) => (segment.kind === 'text' ? segment.text : '')).join('');
  const parts = message.content.map((segment) => {
    if (segment.kind === 'text') return segment.text;
    if (segment.expressionKind === 'image') {
      if (segment.assetId) stickerAssetIds.push(segment.assetId);
      return '';
    }
    return segment.value ?? '';
  });
  return { speechText: formatQqReplyText(words), stickerAssetIds, text: formatQqReplyText(parts.join('')) };
}

export function formatQqApprovalQuestion(title: string) {
  return `需要你确认：${title.trim() || '这一步'}\n回复“好”就去做，“都好”就这个任务后面都不再问，“不要”就取消。`;
}

/**
 * The lines to send now. A reply counts as finished once the character stopped typing or a
 * later message follows it; group replies carry the speaker's name.
 */
export function collectQqRelayOutgoing(messages: ChatMessage[], state: QqRelayState, isTyping: boolean) {
  const outgoing: QqOutgoing[] = [];
  const recent = messages.filter((message) => (message.createdAt ?? 0) >= state.since);
  recent.forEach((message, index) => {
    const pending = message.agentLoopRun?.pendingApproval;
    // A message waiting for approval has stopped where it is: its text is complete.
    const finished = !isTyping || index < recent.length - 1 || Boolean(pending);
    // A task card is a record for the chat window ("【任务记录】…"); on QQ only its question matters.
    const isTaskCard = Boolean(message.agentLoopRun);
    if (message.role === 'model' && finished && !isTaskCard && !state.sentMessageIds.has(message.id)) {
      state.sentMessageIds.add(message.id);
      const reply = formatQqReply(message);
      const speaker = message.chatMode === 'group' && message.petName ? `${message.petName}：` : '';
      if (reply.text || reply.stickerAssetIds.length) {
        outgoing.push({
          petId: message.petId ?? null,
          speechText: reply.speechText,
          stickerAssetIds: reply.stickerAssetIds,
          text: reply.text ? `${speaker}${reply.text}` : '',
        });
      }
    }
    if (pending?.id && !state.sentApprovalIds.has(pending.id)) {
      state.sentApprovalIds.add(pending.id);
      outgoing.push({ petId: null, speechText: '', stickerAssetIds: [], text: formatQqApprovalQuestion(pending.title) });
    }
  });
  return outgoing;
}
