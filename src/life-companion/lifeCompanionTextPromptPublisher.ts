import { desktopPetChatStore } from '../chatStore';
import { DEFAULT_CHAT_ACTIVE_PET_ID } from '../chatState';
import { createChatMessageId } from '../components/chat/multiPetChat';
import { getDesktopPetSlot } from '../multiPetRoster';
import type { PetConfig } from '../types';
import { speakCompanionLine } from './companionLineSpeech';
import { createLifeCompanionDraftFromState } from './lifeCompanionScheduler';

export interface LifeCompanionPromptPublishResult {
  petName: string;
  prompt: string;
  skippedTextReason: 'busy' | 'disabled' | null;
  statusSummary: string;
  textMessagePublished: boolean;
}

export function resolveLifeCompanionPromptTarget(config: PetConfig) {
  const chatState = desktopPetChatStore.getState();
  const activePetId = chatState.activePetId || DEFAULT_CHAT_ACTIVE_PET_ID;
  const slot = getDesktopPetSlot(config, activePetId)
    ?? getDesktopPetSlot(config, DEFAULT_CHAT_ACTIVE_PET_ID);

  return {
    chatMode: chatState.chatMode,
    petId: slot?.id ?? DEFAULT_CHAT_ACTIVE_PET_ID,
    petName: slot?.personality.name ?? config.personality.name,
  };
}

function publishTextMessage(config: PetConfig, prompt: string) {
  const chatState = desktopPetChatStore.getState();
  if (chatState.isTyping || chatState.isSpeaking) {
    return false;
  }

  const target = resolveLifeCompanionPromptTarget(config);
  desktopPetChatStore.addMessage({
    chatMode: target.chatMode,
    id: createChatMessageId(`life-companion-${target.petId}`),
    petId: target.petId,
    petName: target.petName,
    role: 'model',
    text: prompt,
  });
  speakCompanionLine(prompt, target.petId);

  return true;
}

export function publishLifeCompanionPrompt(options: {
  config: PetConfig;
  promptOverride?: string | null;
  textPromptAllowed: boolean;
}): LifeCompanionPromptPublishResult {
  const target = resolveLifeCompanionPromptTarget(options.config);
  const { prompt, status } = createLifeCompanionDraftFromState(
    options.config.stats,
    options.config.settings.lifeCompanion,
    target.petName,
  );
  const resolvedPrompt = options.promptOverride?.trim() || prompt;
  const chatState = desktopPetChatStore.getState();
  const shouldApplyDraft = chatState.inputValue.trim().length === 0;
  const busy = chatState.isTyping || chatState.isSpeaking;

  desktopPetChatStore.setStatusMessage(`life companion: ${resolvedPrompt}`);
  if (shouldApplyDraft && !options.textPromptAllowed) {
    desktopPetChatStore.setInputValue(resolvedPrompt);
  }

  const textMessagePublished = options.textPromptAllowed
    ? publishTextMessage(options.config, resolvedPrompt)
    : false;

  return {
    petName: target.petName,
    prompt: resolvedPrompt,
    skippedTextReason: options.textPromptAllowed
      ? (busy && !textMessagePublished ? 'busy' : null)
      : 'disabled',
    statusSummary: status.summary,
    textMessagePublished,
  };
}
