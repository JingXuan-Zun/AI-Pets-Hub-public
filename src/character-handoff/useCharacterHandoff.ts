import { useEffect, type MutableRefObject } from 'react';
import { buildConversationSummaryPrompt, parseConversationSummary } from '../character-memory/conversationSummary';
import { desktopPetChatStore } from '../chatStore';
import { buildScopedChatHistory } from '../components/chat/chatScopedContextUtils';
import { createChatMessageId } from '../components/chat/multiPetChat';
import { pushFrontendRuntimeLog } from '../frontendRuntimeLogger';
import { speakCompanionLine } from '../life-companion/companionLineSpeech';
import { getDesktopPetSlot, type DesktopPetSlot } from '../multiPetRoster';
import type { ChatMessage, PetConfig } from '../types';
import {
  buildEntranceInstruction,
  buildHandoffNote,
  formatHandoffLines,
  handoffWindowStart,
  selectHandoffMessages,
  splitForHandoff,
  type HandoffRecord,
} from './handoffRules';
import { onCharacterHandoffRequest, saveHandoffRecord, type HandoffRequest } from './handoffStore';

// Pet window: after a switch, the new character learns what the user and the previous one
// talked about and speaks first (handoffRules.ts). Waits until the previous character has
// finished her reply (her handover line is part of what the new one hears).

const IDLE_POLL_MS = 300;
const IDLE_WAIT_MS = 90_000;
const MODEL_TIMEOUT_MS = 45_000;
const OWN_RECENT_MESSAGES = 12;

const chatIdle = () => { const { isTyping, isSpeaking } = desktopPetChatStore.getState(); return !isTyping && !isSpeaking; };

async function waitUntilIdle(isCurrent: () => boolean) {
  const until = Date.now() + IDLE_WAIT_MS;
  while (Date.now() < until && isCurrent()) {
    if (chatIdle()) return true;
    await new Promise((resolve) => { setTimeout(resolve, IDLE_POLL_MS); });
  }
  return false;
}

async function summarizeOlder(config: PetConfig, older: ChatMessage[], fromName: string) {
  if (!older.length) return '';
  try {
    const prompt = buildConversationSummaryPrompt({ messages: older, previousSummary: '', roleName: fromName });
    const { getConfiguredCognitionResponse } = await import('../services/geminiService');
    const output = await getConfiguredCognitionResponse(prompt.payload, prompt.systemInstruction, config.settings, {
      allowReasoningContentFallback: true, task: 'memory-retrieval', timeoutMs: MODEL_TIMEOUT_MS,
    });
    return parseConversationSummary(output);
  } catch (error) {
    pushFrontendRuntimeLog('换人交接', '更早的对话没能整理成摘要', { error: error instanceof Error ? error.message : String(error) });
    return `（更早还聊了 ${older.length} 条，这次没能整理出来）`;
  }
}

/** What the new character should know about the conversation she takes over. */
async function buildHandoffRecord(config: PetConfig, from: DesktopPetSlot, to: DesktopPetSlot): Promise<HandoffRecord> {
  const neural = to.personality.neuralPersonaChatEnabled === true;
  const now = Date.now();
  const messages = selectHandoffMessages(desktopPetChatStore.getState().messages, from.id, handoffWindowStart(now, neural));
  const { older, recent } = splitForHandoff(messages);
  const fromName = from.personality.name;
  const olderSummary = await summarizeOlder(config, older, fromName);
  const note = buildHandoffNote({ fromName, olderSummary, recentLines: formatHandoffLines(recent, fromName), windowLabel: neural ? '今天' : '最近三天' });
  return { at: now, fromName, fromPetId: from.id, note, toPetId: to.id };
}

/** The previous character's last line since the switch was asked for (her handover). */
function handoverLineSince(fromPetId: string, since: number) {
  const own = buildScopedChatHistory(desktopPetChatStore.getState().messages, 'single', fromPetId);
  const last = [...own].reverse().find((message) => message.role === 'model' && (message.createdAt ?? 0) >= since);
  return last?.text ?? '';
}

/** True when the user already wrote to her: then she answers that instead of an entrance. */
function userSpokeSince(toPetId: string, since: number) {
  return buildScopedChatHistory(desktopPetChatStore.getState().messages, 'single', toPetId)
    .some((message) => message.role === 'user' && (message.createdAt ?? 0) >= since);
}

async function deliverEntrance(config: PetConfig, to: DesktopPetSlot, instruction: string) {
  const history = buildScopedChatHistory(desktopPetChatStore.getState().messages, 'single', to.id).slice(-OWN_RECENT_MESSAGES);
  const { getPetResponseStrict } = await import('../services/geminiService');
  const reply = await getPetResponseStrict(history, instruction, to.personality, { ...config.settings, webSearchEnabled: false }, 'block', [], AbortSignal.timeout(MODEL_TIMEOUT_MS));
  const text = reply.trim();
  if (!text || !chatIdle()) return false;
  desktopPetChatStore.addMessage({ chatMode: 'single', createdAt: Date.now(), id: createChatMessageId(`handoff-${to.id}`), petId: to.id, petName: to.personality.name, role: 'model', text });
  speakCompanionLine(text, to.id);
  return true;
}

async function handOver(config: PetConfig, request: HandoffRequest, isCurrent: () => boolean) {
  const from = getDesktopPetSlot(config, request.fromPetId);
  const to = getDesktopPetSlot(config, request.toPetId);
  if (!from || !to) return 'missing';
  if (!(await waitUntilIdle(isCurrent))) return 'busy';
  const { activePetId, chatMode } = desktopPetChatStore.getState();
  if (!isCurrent() || activePetId !== to.id || chatMode !== 'single') return 'moved-on';
  const record = await buildHandoffRecord(config, from, to);
  saveHandoffRecord(record);
  if (!isCurrent() || userSpokeSince(to.id, request.requestedAt)) return 'noted';
  const instruction = buildEntranceInstruction({ fromName: from.personality.name, handoverLine: handoverLineSince(from.id, request.requestedAt), note: record.note, reason: request.reason });
  return (await deliverEntrance(config, to, instruction)) ? 'spoke' : 'noted';
}

export function useCharacterHandoff({ configRef }: { configRef: MutableRefObject<PetConfig> }) {
  useEffect(() => {
    let latest = 0;
    return onCharacterHandoffRequest((request) => {
      const token = latest + 1;
      latest = token;
      const isCurrent = () => latest === token;
      void handOver(configRef.current, request, isCurrent)
        .then((outcome) => pushFrontendRuntimeLog('换人交接', `交接结果：${outcome}`, { from: request.fromPetId, reason: request.reason, to: request.toPetId }))
        .catch((error) => pushFrontendRuntimeLog('换人交接', '交接失败', { error: error instanceof Error ? error.message : String(error) }));
    });
  }, [configRef]);
}
