import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import { desktopPetChatStore } from '../chatStore';
import { buildScopedChatHistory } from '../components/chat/chatScopedContextUtils';
import { pushFrontendRuntimeLog } from '../frontendRuntimeLogger';
import { getDesktopPetSlots, type DesktopPetSlot } from '../multiPetRoster';
import type { NeuralMemoryReplyCompletedEvent } from '../neural-memory/useNeuralMemoryProposalCapture';
import type { ChatMessage, PetConfig } from '../types';
import type { CharacterCognition } from './characterCognitionTypes';
import {
  applyCognitionUpdate,
  buildCognitionInitPrompt,
  buildCognitionUpdatePrompt,
  parseCognitionInit,
  type CognitionPersonaInput,
} from './characterCognitionModel';
import { applyTurnToCognition } from './characterCognitionRules';
import { readCharacterCognition, saveCharacterCognition, updateCharacterCognition } from './characterCognitionStore';
import { addStatusFacts } from '../character-status/characterStatusBoard';
import { STATUS_EXTRACTION_INSTRUCTION, parseStatusFacts } from '../character-status/characterStatusExtraction';

// Keeps every character's "what is on her mind" up to date (docs/cognition-layer-design-20261106.md):
// reads each persona into a starting point once, feeds / spends concerns every turn (no model),
// and after a character's stretch of conversation goes quiet, updates her mood and concerns
// with one small model call. Runs in the window that holds the chat session.

const START_DELAY_MS = 20_000;
const INIT_GAP_MS = 6_000;
const INIT_RETRY_DELAY_MS = 60_000;
const QUIET_BEFORE_UPDATE_MS = 60_000;
const MESSAGES_BEFORE_UPDATE = 6;
const MODEL_TIMEOUT_MS = 60_000;
const MODEL_MAX_TOKENS = 1600;
const TASK_RECORD = /^【任务记录】/u;

/** The user's switch wins over what a persona reading found (2026-11-06). */
function withUserRules(cognition: CharacterCognition, config: PetConfig): CharacterCognition {
  const neverCold = config.settings.lifeCompanion?.feelingsNeverDrop !== false;
  return neverCold && !cognition.baseline.neverNegativeTowardUser
    ? { ...cognition, baseline: { ...cognition.baseline, neverNegativeTowardUser: true } }
    : cognition;
}

function isEnabled(config: PetConfig) {
  return config.settings.lifeCompanion?.characterCognitionEnabled !== false;
}

export function personaInput(slot: DesktopPetSlot, slots: DesktopPetSlot[]): CognitionPersonaInput {
  const personality = slot.personality;
  return {
    name: personality.name,
    otherNames: slots.filter((other) => other.id !== slot.id).map((other) => other.personality.name),
    persona: [personality.systemInstruction ?? '', (personality.traits ?? []).join('、'), (personality.knowledgeBase ?? '').slice(0, 3000)].filter(Boolean).join('\n\n'),
  };
}

export async function askModel(config: PetConfig, prompt: { payload: string; systemInstruction: string }) {
  const { getConfiguredCognitionResponse } = await import('../services/geminiService');
  return getConfiguredCognitionResponse(prompt.payload, prompt.systemInstruction, config.settings, {
    maxTokensOverride: MODEL_MAX_TOKENS,
    task: 'understanding',
    timeoutMs: MODEL_TIMEOUT_MS,
  });
}

/** The messages she took part in since her last update (private chat and group chat), oldest first. */
function recentDialogue(slot: DesktopPetSlot, slots: DesktopPetSlot[], since: number) {
  const messages = desktopPetChatStore.getState().messages;
  const seen = new Set<ChatMessage>();
  const lines = [...buildScopedChatHistory(messages, 'single', slot.id), ...buildScopedChatHistory(messages, 'group', slot.id)]
    .filter((message) => {
      if (seen.has(message) || (message.createdAt ?? 0) <= since || !message.text.trim() || TASK_RECORD.test(message.text)) return false;
      seen.add(message);
      return true;
    })
    .sort((left, right) => (left.createdAt ?? 0) - (right.createdAt ?? 0))
    .slice(-30);
  return lines.map((message) => ({
    speaker: message.role === 'user' ? '用户' : slots.find((item) => item.id === message.petId)?.personality.name ?? slot.personality.name,
    text: message.text,
  }));
}

export function useCharacterCognition({ configRef }: { configRef: MutableRefObject<PetConfig> }) {
  const busy = useRef(new Set<string>());
  const pending = useRef(new Map<string, { count: number; timer: ReturnType<typeof setTimeout> | null }>());

  const initialize = useCallback(async (slot: DesktopPetSlot) => {
    const config = configRef.current;
    if (!isEnabled(config) || readCharacterCognition(slot.id) || busy.current.has(slot.id)) return;
    busy.current.add(slot.id);
    try {
      const output = await askModel(config, buildCognitionInitPrompt(personaInput(slot, getDesktopPetSlots(config))));
      const parsed = parseCognitionInit(output, slot.id, Date.now());
      const cognition = parsed ? withUserRules(parsed, configRef.current) : null;
      if (cognition) saveCharacterCognition(cognition);
      pushFrontendRuntimeLog('认知', cognition ? '从人设读出了起点' : '没读懂模型的回答', {
        concerns: cognition?.concerns.length ?? 0, petId: slot.id, rules: cognition?.baseline.rules.length ?? 0,
      });
    } catch (error) {
      pushFrontendRuntimeLog('认知', '读人设失败', { error: error instanceof Error ? error.message : String(error), petId: slot.id });
    } finally {
      busy.current.delete(slot.id);
    }
  }, [configRef]);

  const update = useCallback(async (roleId: string) => {
    const config = configRef.current;
    const slots = getDesktopPetSlots(config);
    const slot = slots.find((item) => item.id === roleId);
    const current = readCharacterCognition(roleId);
    if (!isEnabled(config) || !slot || busy.current.has(roleId)) return;
    if (!current) {
      await initialize(slot);
      return;
    }
    const dialogue = recentDialogue(slot, slots, current.updatedAt);
    if (dialogue.length < 2) return;
    busy.current.add(roleId);
    try {
      const withStatus = config.settings.lifeCompanion?.crossChatAwarenessEnabled === true;
      const output = await askModel(config, buildCognitionUpdatePrompt({
        ...personaInput(slot, slots), current, dialogue, statusInstruction: withStatus ? STATUS_EXTRACTION_INSTRUCTION : undefined,
      }));
      if (withStatus) {
        const facts = parseStatusFacts(output, slots.map((item) => ({ id: item.id, name: item.personality.name })), Date.now());
        addStatusFacts(facts);
        if (facts.length) pushFrontendRuntimeLog('近况', '记下了角色近况', { count: facts.length, petId: roleId });
      }
      const latest = withUserRules(readCharacterCognition(roleId) ?? current, configRef.current);
      const next = applyCognitionUpdate(latest, output, Date.now());
      if (next) saveCharacterCognition(next);
      pushFrontendRuntimeLog('认知', next ? '更新了心情和惦记' : '没读懂模型的回答', {
        concerns: next?.concerns.length ?? 0, lines: dialogue.length, petId: roleId,
      });
    } catch (error) {
      pushFrontendRuntimeLog('认知', '更新失败', { error: error instanceof Error ? error.message : String(error), petId: roleId });
    } finally {
      busy.current.delete(roleId);
    }
  }, [configRef, initialize]);

  // Read every character's persona once, one after another, a little after start-up.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      // A second pass a minute later retries the ones whose reading failed (e.g. a cut-off answer).
      for (let pass = 0; pass < 2 && !cancelled; pass += 1) {
        if (pass > 0) await new Promise((resolve) => { setTimeout(resolve, INIT_RETRY_DELAY_MS); });
        for (const slot of getDesktopPetSlots(configRef.current)) {
          if (cancelled) return;
          const existing = readCharacterCognition(slot.id);
          if (existing) {
            // States read before the user's switch existed get its rule too.
            const ruled = withUserRules(existing, configRef.current);
            if (ruled !== existing) saveCharacterCognition(ruled);
            continue;
          }
          await initialize(slot);
          await new Promise((resolve) => { setTimeout(resolve, INIT_GAP_MS); });
        }
      }
    }, START_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      pending.current.forEach((entry) => { if (entry.timer) clearTimeout(entry.timer); });
    };
  }, [configRef, initialize]);

  /** After each reply: feed / spend concerns now; update with the model once the talk goes quiet. */
  return useCallback((event: NeuralMemoryReplyCompletedEvent) => {
    const config = configRef.current;
    if (!isEnabled(config)) return;
    const slots = getDesktopPetSlots(config);
    const now = Date.now();
    const herText = [...desktopPetChatStore.getState().messages].reverse().find((message) => message.role !== 'user' && message.petId === event.roleId)?.text ?? '';
    updateCharacterCognition(event.roleId, (current) => applyTurnToCognition(current, { herText, userText: event.userText }, now));
    // In group chat the ones who took part lately heard it too (not all eight every time).
    const recentGroupSpeakers = event.chatMode === 'group'
      ? new Set(desktopPetChatStore.getState().messages.filter((message) => message.chatMode === 'group').slice(-20)
        .map((message) => message.petId).filter((id): id is string => Boolean(id)))
      : new Set<string>();
    const involved = [event.roleId, ...slots.map((slot) => slot.id).filter((id) => id !== event.roleId && recentGroupSpeakers.has(id))];
    involved.forEach((roleId) => {
      if (roleId !== event.roleId) updateCharacterCognition(roleId, (current) => applyTurnToCognition(current, { userText: event.userText }, now));
      const entry = pending.current.get(roleId) ?? { count: 0, timer: null };
      if (entry.timer) clearTimeout(entry.timer);
      entry.count += 1;
      const run = () => {
        pending.current.delete(roleId);
        void update(roleId);
      };
      if (entry.count >= MESSAGES_BEFORE_UPDATE) {
        run();
        return;
      }
      entry.timer = setTimeout(run, QUIET_BEFORE_UPDATE_MS);
      pending.current.set(roleId, entry);
    });
  }, [configRef, update]);
}
