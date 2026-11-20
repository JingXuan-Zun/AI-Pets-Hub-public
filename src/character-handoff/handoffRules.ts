import { isMemoryRelevantChatMessage } from '../character-memory/conversationSummary';
import { messageDay } from '../character-memory/memoryTime';
import { buildScopedChatHistory } from '../components/chat/chatScopedContextUtils';
import type { ChatMessage } from '../types';

// Handing the conversation over when the user switches characters (2026-11-19, design §12 in
// docs/cross-chat-character-awareness-design-20261008.md). The new character learns what the
// user and the previous character talked about — the last three days, or only today when she
// runs the 知识记忆人格 (neural persona) conversation — speaks first in her own voice, and keeps
// knowing it in her next replies. The user agreed that their own words are passed on here.

export const HANDOFF_DAYS = 3;
/** She keeps the handover in mind this long (or until the next switch to her). */
export const HANDOFF_MEMORY_MS = 24 * 60 * 60_000;
/** Newest part of the previous chat passed word for word; anything older is summarized. */
export const HANDOFF_VERBATIM_CHARS = 4000;
export const HANDOFF_VERBATIM_MAX_MESSAGES = 30;
const LINE_CHARS = 300;

export type HandoffReason = 'asked' | 'switched' | 'woken';

export interface HandoffRecord {
  at: number;
  fromName: string;
  fromPetId: string;
  /** What she knows about the previous conversation (summary + recent lines). */
  note: string;
  toPetId: string;
}

/** Where the previous conversation she should know starts. */
export function handoffWindowStart(now: number, neuralPersona: boolean) {
  if (!neuralPersona) return now - HANDOFF_DAYS * 24 * 60 * 60_000;
  const day = new Date(now);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
}

/** The previous character's private chat with the user inside the window (oldest first). */
export function selectHandoffMessages(messages: ChatMessage[], fromPetId: string, windowStart: number) {
  return buildScopedChatHistory(messages, 'single', fromPetId)
    .filter((message) => isMemoryRelevantChatMessage(message) && (message.createdAt ?? 0) >= windowStart);
}

/** Newest messages within the word-for-word budget; the rest goes to a summary. */
export function splitForHandoff(messages: ChatMessage[], budget = HANDOFF_VERBATIM_CHARS, maxMessages = HANDOFF_VERBATIM_MAX_MESSAGES) {
  let used = 0;
  let index = messages.length;
  while (index > 0 && messages.length - index < maxMessages) {
    const size = Math.min(messages[index - 1].text.length, LINE_CHARS);
    if (used + size > budget) break;
    used += size;
    index -= 1;
  }
  return { older: messages.slice(0, index), recent: messages.slice(index) };
}

const compact = (text: string) => {
  const flat = text.replace(/\s+/gu, ' ').trim();
  return flat.length > LINE_CHARS ? `${flat.slice(0, LINE_CHARS)}…` : flat;
};

export function formatHandoffLines(messages: ChatMessage[], fromName: string) {
  return messages.map((message) => {
    const day = messageDay(message.createdAt);
    return `${day ? `[${day}] ` : ''}${message.role === 'user' ? '用户' : fromName}：${compact(message.text)}`;
  });
}

/** What the new character knows about the conversation she takes over. */
export function buildHandoffNote(input: { fromName: string; olderSummary: string; recentLines: string[]; windowLabel: string }) {
  const parts = [`【用户刚才和${input.fromName}的对话（${input.windowLabel}）】`];
  if (input.olderSummary) parts.push(`更早的部分（摘要）：${input.olderSummary}`);
  if (input.recentLines.length) parts.push(input.olderSummary ? '最近的对话：' : '对话：', ...input.recentLines);
  if (!input.olderSummary && !input.recentLines.length) parts.push(`（这段时间用户和${input.fromName}没有聊什么）`);
  return parts.join('\n');
}

const REASON_TEXT: Record<HandoffReason, (fromName: string) => string> = {
  asked: (fromName) => `${fromName}应用户的要求把你叫来，接着陪用户`,
  switched: (fromName) => `用户刚从${fromName}那边转过来找你`,
  woken: (fromName) => `用户刚才喊了你，本来在和${fromName}聊`,
};

/** The instruction for her first line: in her own voice, in the story, picking up where things were. */
export function buildEntranceInstruction(input: { fromName: string; handoverLine: string; note: string; reason: HandoffReason }) {
  return [
    `（这不是用户发来的消息。${REASON_TEXT[input.reason](input.fromName)}，现在轮到你先开口。）`,
    input.note,
    input.handoverLine ? `${input.fromName}交接时说的最后一句：${compact(input.handoverLine)}` : '',
    '请你主动说一两句登场的话：完全按你自己的人设和说话方式，自然地接上刚才在聊的事（不要复述整段对话，也不要假装你一直在场）。',
    `不要扮演${input.fromName}，不要用她的自称和口头禅。`,
    '你的人设里有场景或世界观时，就用场景里的方式出场，不要提桌面、窗口、聊天模式、单聊、切换、槽位这类软件用语。',
  ].filter(Boolean).join('\n\n');
}

/** For her next replies: what she was told when she took over (empty once it is old). */
export function describeHandoffForReply(record: HandoffRecord | null, now: number) {
  if (!record || now - record.at > HANDOFF_MEMORY_MS) return '';
  return [`你是从${record.fromName}那里接过和用户的对话的，你已经知道下面这些（不用再说一遍，需要时自然用上）：`, record.note].join('\n');
}
