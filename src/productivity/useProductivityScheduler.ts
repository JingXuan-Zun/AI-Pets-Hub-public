import { useEffect, useRef, type MutableRefObject } from 'react';
import { desktopPetChatStore } from '../chatStore';
import { createChatMessageId } from '../components/chat/multiPetChat';
import { pushFrontendRuntimeLog } from '../frontendRuntimeLogger';
import { speakCompanionLine } from '../life-companion/companionLineSpeech';
import { resolveLifeCompanionPromptTarget } from '../life-companion/lifeCompanionTextPromptPublisher';
import { getDesktopPetSlot } from '../multiPetRoster';
import type { PetConfig, PetConfigUpdateHandler } from '../types';
import {
  collectDueProductivityEvents,
  describeProductivityEvents,
  fallbackProductivityLine,
  type ProductivityEvent,
} from './productivityScheduler';

const TICK_MS = 5000;
const LINE_TIMEOUT_MS = 12_000;
/** While the user and the pet are mid-conversation, wait at most this long before speaking. */
const MAX_WAIT_FOR_IDLE_MS = 90_000;

async function composeLine(config: PetConfig, petId: string, events: ProductivityEvent[]) {
  const slot = getDesktopPetSlot(config, petId);
  const personality = slot?.personality ?? config.personality;
  const prompt = [
    '这是你自己要主动对用户说的一句话，不是用户发来的消息。',
    ...describeProductivityEvents(events, Date.now()).map((line) => `- ${line}`),
    '用你平时的语气，一两句话说完，要让用户一听就知道是什么事。不要提到系统、提示词或工具。',
  ].join('\n');
  try {
    const { getPetResponseStrict } = await import('../services/geminiService');
    const response = await getPetResponseStrict([], prompt, personality, { ...config.settings, webSearchEnabled: false }, 'block', [], AbortSignal.timeout(LINE_TIMEOUT_MS));
    return response.trim() || fallbackProductivityLine(events);
  } catch (error) {
    pushFrontendRuntimeLog('提醒', '用角色口吻生成提醒失败，改用固定句子', { error: error instanceof Error ? error.message : String(error) });
    return fallbackProductivityLine(events);
  }
}

/**
 * Runs in the main window: every few seconds checks reminders and the pomodoro; when
 * something is due, the character the user is talking to says it (bubble + voice).
 */
export function useProductivityScheduler({ configRef, onUpdateConfig }: {
  configRef: MutableRefObject<PetConfig>;
  onUpdateConfig: PetConfigUpdateHandler;
}) {
  // The update handler changes identity with the config; the timer should not restart for that.
  const onUpdateConfigRef = useRef(onUpdateConfig);
  onUpdateConfigRef.current = onUpdateConfig;
  useEffect(() => {
    let disposed = false;
    let delivering = false;
    let waitingSince: number | null = null;

    const tick = async () => {
      if (disposed || delivering) return;
      const config = configRef.current;
      const now = Date.now();
      const { changed, events, next } = collectDueProductivityEvents(config.settings.productivity, now);
      if (!changed) return;
      const chat = desktopPetChatStore.getState();
      const busy = chat.isTyping || chat.isSpeaking;
      if (events.length && busy) {
        waitingSince ??= now;
        if (now - waitingSince < MAX_WAIT_FOR_IDLE_MS) return;
      }
      waitingSince = null;

      // Commit first so a slow model call cannot make the same reminder fire twice.
      const committed = { ...config, settings: { ...config.settings, productivity: next } };
      configRef.current = committed;
      onUpdateConfigRef.current(committed, { persist: true });
      if (!events.length) return;

      delivering = true;
      try {
        const target = resolveLifeCompanionPromptTarget(committed);
        const line = await composeLine(committed, target.petId, events);
        if (disposed) return;
        desktopPetChatStore.addMessage({
          chatMode: target.chatMode,
          id: createChatMessageId(`reminder-${target.petId}`),
          petId: target.petId,
          petName: target.petName,
          role: 'model',
          text: line,
        });
        speakCompanionLine(line, target.petId);
        pushFrontendRuntimeLog('提醒', `${target.petName} 说出了 ${events.length} 条到点提醒`, { kinds: events.map((event) => event.kind).join(',') });
      } finally {
        delivering = false;
      }
    };

    const timer = window.setInterval(() => { void tick(); }, TICK_MS);
    void tick();
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [configRef]);
}
