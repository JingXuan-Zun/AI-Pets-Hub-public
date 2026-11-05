import { subscribeAppEvents } from '../events/appEvents';
import type { ChatMessage } from '../types';
import { stripMessageDiagrams } from '../components/chat/message/messageDiagrams';

// Which chat lines go back to QQ after a message from the phone: every reply posted since,
// once it has finished, and every approval question the character asks meanwhile.

// Her replies that are complete, as the chat says so (reply.finished). Before this the relay
// guessed from the order of messages, and a task card or a drawing posted under an
// unfinished reply made it send the reply cut off.
const finishedReplyIds = new Set<string>();
const MAX_REMEMBERED_REPLIES = 500;
subscribeAppEvents((event) => {
  if (event.type !== 'reply.finished') return;
  finishedReplyIds.add(event.messageId);
  if (finishedReplyIds.size > MAX_REMEMBERED_REPLIES) finishedReplyIds.delete(finishedReplyIds.values().next().value!);
});

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
  /** Pictures attached to the reply (one she drew…), as data URLs; sent after the text. */
  imageDataUrls: string[];
  /** Who said it, for her voice; null for the approval questions. */
  petId: string | null;
  /** Only the words (no kaomoji, no speaker name): what a voice message would say. */
  speechText: string;
  stickerAssetIds: string[];
  text: string;
};

/** Plain text for QQ: no Markdown bold markers. */
export function formatQqReplyText(text: string) {
  // QQ cannot show the character's diagrams (```svg): they stay in the chat window on the computer.
  return stripMessageDiagrams(text, '（画了一张示意图，在电脑上的聊天窗口里看）').replace(/\*{2,3}/gu, '').trim();
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

/** The approval question read out in her voice, for family who listen rather than read. */
export function formatApprovalSpeech(title: string, irreversible = false) {
  const step = title.trim() || '这一步';
  return irreversible
    ? `${step}，需要你同意，这一步做了就撤不回。可以就回复“好”，不行就回复“不要”。`
    : `${step}，需要你同意。可以就回复“好”，今天都不用再问就回复“今天都好”，不行就回复“不要”。`;
}

/** Steps that cannot be taken back (sending, deleting…) only offer yes/no: they ask every time. */
export function formatQqApprovalQuestion(title: string, irreversible = false) {
  return irreversible
    ? `需要你确认：${title.trim() || '这一步'}\n这一步做了就撤不回，回复“好”就去做，“不要”就取消。`
    : `需要你确认：${title.trim() || '这一步'}\n回复“好”就去做，“今天都好”就今天都不再问，“不要”就取消。`;
}

function attachedImages(message: ChatMessage) {
  return (message.attachments ?? []).filter((attachment) => attachment.kind === 'image' && attachment.dataUrl).map((attachment) => attachment.dataUrl!);
}

/** A message that only shows pictures (a drawing) is complete when posted, and does not end the reply above it. */
function isPictureOnly(message: ChatMessage) {
  return message.role === 'model' && !message.text?.trim() && !(Array.isArray(message.content) && message.content.length) && attachedImages(message).length > 0;
}

/**
 * The lines to send now. A reply counts as finished once the character stopped typing or a
 * later message follows it; group replies carry the speaker's name.
 */
export function collectQqRelayOutgoing(messages: ChatMessage[], state: QqRelayState, isTyping: boolean) {
  const outgoing: QqOutgoing[] = [];
  const recent = messages.filter((message) => (message.createdAt ?? 0) >= state.since);
  recent.forEach((message) => {
    const pending = message.agentLoopRun?.pendingApproval;
    // Done when the chat says her reply finished, when nothing is being written any more, when
    // it waits for an approval (it stopped where it is), or when it only shows pictures.
    const finished = finishedReplyIds.has(message.id) || !isTyping || Boolean(pending) || isPictureOnly(message);
    // A task card is a record for the chat window ("【任务记录】…"); on QQ only its question matters.
    const isTaskCard = Boolean(message.agentLoopRun);
    if (message.role === 'model' && finished && !isTaskCard && !state.sentMessageIds.has(message.id)) {
      state.sentMessageIds.add(message.id);
      const reply = formatQqReply(message);
      const speaker = message.chatMode === 'group' && message.petName ? `${message.petName}：` : '';
      const imageDataUrls = attachedImages(message);
      if (reply.text || reply.stickerAssetIds.length || imageDataUrls.length) {
        outgoing.push({
          imageDataUrls,
          petId: message.petId ?? null,
          speechText: reply.speechText,
          stickerAssetIds: reply.stickerAssetIds,
          text: reply.text ? `${speaker}${reply.text}` : '',
        });
      }
    }
    if (pending?.id && !state.sentApprovalIds.has(pending.id)) {
      state.sentApprovalIds.add(pending.id);
      outgoing.push({ imageDataUrls: [], petId: null, speechText: formatApprovalSpeech(pending.title, pending.irreversible), stickerAssetIds: [], text: formatQqApprovalQuestion(pending.title, pending.irreversible) });
    }
  });
  return outgoing;
}
