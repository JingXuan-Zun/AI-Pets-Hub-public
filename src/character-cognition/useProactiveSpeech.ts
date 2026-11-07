import { useEffect, useRef, type MutableRefObject } from 'react';
import { desktopPetChatStore } from '../chatStore';
import { buildScopedChatHistory } from '../components/chat/chatScopedContextUtils';
import { createChatMessageId } from '../components/chat/multiPetChat';
import { pushFrontendRuntimeLog } from '../frontendRuntimeLogger';
import { speakCompanionLine } from '../life-companion/companionLineSpeech';
import { lifeCompanionRuntimeOverrideStore } from '../life-companion/lifeCompanionRuntimeOverride';
import { isLifeCompanionQuietHour } from '../life-companion/lifeCompanionScheduler';
import { getDesktopPetSlots, type DesktopPetSlot } from '../multiPetRoster';
import type { PetConfig } from '../types';
import { describeCognitionForReply } from './characterCognitionRules';
import { isCognitionPaused, readCharacterCognition, updateCharacterCognition } from './characterCognitionStore';
import {
  buildProactiveLineInstruction,
  decideProactiveSpeech,
  spendConcern,
  trackPresence,
  type ProactiveCandidate,
  type ProactiveSpeechDecision,
} from './proactiveSpeechRules';
import { readProactiveSpeechLog, recordProactiveSpeech, setProactiveWaitingReason } from './proactiveSpeechStore';

// The character speaks first when something on her mind has built up (cognition layer phase 2).
// A heartbeat checks once a minute; the line comes from her own persona and recent private chat,
// with the concern as the reason. No fixed lines: if the model gives nothing, she stays quiet.

const HEARTBEAT_MS = 60_000;
const FIRST_CHECK_DELAY_MS = 90_000;
const LINE_TIMEOUT_MS = 30_000;
const RECENT_PRIVATE_MESSAGES = 12;

function isEnabled(config: PetConfig) {
  const settings = config.settings.lifeCompanion;
  return Boolean(settings?.proactiveEnabled)
    && settings?.characterCognitionEnabled !== false
    && !isCognitionPaused()
    && !lifeCompanionRuntimeOverrideStore.getSnapshot().manualSuspended;
}

function lastUserMessageAt() {
  const messages = desktopPetChatStore.getState().messages;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === 'user') return messages[index].createdAt ?? null;
  }
  return null;
}

async function readIdleMs() {
  try {
    const seconds = await window.desktopPetShell?.getSystemIdleSeconds?.();
    return typeof seconds === 'number' && Number.isFinite(seconds) ? seconds * 1000 : null;
  } catch {
    return null;
  }
}

async function composeLine(config: PetConfig, slot: DesktopPetSlot, instruction: string) {
  const history = buildScopedChatHistory(desktopPetChatStore.getState().messages, 'single', slot.id).slice(-RECENT_PRIVATE_MESSAGES);
  const { getPetResponseStrict } = await import('../services/geminiService');
  const reply = await getPetResponseStrict(
    history,
    instruction,
    slot.personality,
    { ...config.settings, webSearchEnabled: false },
    'block',
    [],
    AbortSignal.timeout(LINE_TIMEOUT_MS),
  );
  return reply.replace(/\s+/gu, ' ').trim();
}

function postLine(slot: DesktopPetSlot, text: string) {
  const chat = desktopPetChatStore.getState();
  if (chat.isTyping || chat.isSpeaking) return false;
  desktopPetChatStore.addMessage({
    chatMode: 'single',
    createdAt: Date.now(),
    id: createChatMessageId(`proactive-${slot.id}`),
    petId: slot.id,
    petName: slot.personality.name,
    role: 'model',
    text,
  });
  speakCompanionLine(text, slot.id);
  return true;
}

/** Her line for this decision: composed by her persona, posted to her private chat and spoken. */
export async function deliverProactiveLine(
  config: PetConfig,
  slot: DesktopPetSlot,
  decision: Extract<ProactiveSpeechDecision, { speak: true }>,
): Promise<'spoken' | string> {
  const now = Date.now();
  const cognition = decision.candidate.cognition;
  const instruction = [
    buildProactiveLineInstruction({ concernText: decision.concern.text, kind: decision.kind, moodLabel: cognition.mood.label }),
    describeCognitionForReply(cognition, now),
  ].join('\n\n');
  const line = await composeLine(config, slot, instruction);
  if (!line) return '她想说的话没有生成出来，下次再试';
  if (!postLine(slot, line)) return '正在聊天或说话，等一下';
  const spokenAt = Date.now();
  updateCharacterCognition(slot.id, (current) => spendConcern(current, decision.concern.id, spokenAt));
  recordProactiveSpeech({ at: spokenAt, concernText: decision.concern.text, kind: decision.kind, name: slot.personality.name, roleId: slot.id });
  pushFrontendRuntimeLog('主动说话', `${slot.personality.name} 主动开口`, { charge: decision.charge, kind: decision.kind, petId: slot.id });
  return 'spoken';
}

export function useProactiveSpeech({ configRef }: { configRef: MutableRefObject<PetConfig> }) {
  const presence = useRef<{ awaySince: number | null }>({ awaySince: null });
  const running = useRef(false);

  useEffect(() => {
    let disposed = false;

    const beat = async () => {
      if (running.current || disposed) return;
      running.current = true;
      try {
        const config = configRef.current;
        const now = Date.now();
        const idleMs = await readIdleMs();
        const tracked = trackPresence(presence.current, idleMs, now);
        presence.current = { awaySince: tracked.awaySince };
        const slots = getDesktopPetSlots(config);
        const chat = desktopPetChatStore.getState();
        const candidates: ProactiveCandidate[] = slots.flatMap((slot) => {
          const cognition = readCharacterCognition(slot.id);
          return cognition ? [{ cognition, name: slot.personality.name, roleId: slot.id }] : [];
        });
        const decision = decideProactiveSpeech({
          candidates,
          chatBusy: chat.isTyping || chat.isSpeaking || chat.chatMode !== 'single',
          enabled: isEnabled(config),
          idleMs,
          justCameBack: tracked.justCameBack,
          lastUserMessageAt: lastUserMessageAt(),
          log: readProactiveSpeechLog(now),
          now,
          quietHours: isLifeCompanionQuietHour(config.settings.lifeCompanion, new Date(now)),
        });
        if ('reason' in decision) {
          setProactiveWaitingReason(decision.reason, now);
          return;
        }
        const slot = slots.find((item) => item.id === decision.candidate.roleId);
        if (!slot || disposed) return;
        const outcome = await deliverProactiveLine(config, slot, decision);
        if (outcome !== 'spoken') setProactiveWaitingReason(outcome, Date.now());
      } catch (error) {
        setProactiveWaitingReason('上次想开口时出错了，下次再试', Date.now());
        pushFrontendRuntimeLog('主动说话', '生成失败', { error: error instanceof Error ? error.message : String(error) });
      } finally {
        running.current = false;
      }
    };

    const first = window.setTimeout(() => { void beat(); }, FIRST_CHECK_DELAY_MS);
    const interval = window.setInterval(() => { void beat(); }, HEARTBEAT_MS);
    return () => {
      disposed = true;
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, [configRef]);
}
