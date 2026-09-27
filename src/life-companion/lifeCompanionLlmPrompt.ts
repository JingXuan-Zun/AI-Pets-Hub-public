import { desktopPetChatStore } from '../chatStore';
import { getPetResponse } from '../services/geminiService';
import type { PetConfig } from '../types';
import { createLifeCompanionDraftFromState } from './lifeCompanionScheduler';
import type { LifeCompanionStatus } from './lifeCompanionSettings';

const MAX_LLM_PROMPT_LENGTH = 600;
const MAX_LLM_RESPONSE_LENGTH = 180;

function truncateText(text: string, maxLength: number) {
  const normalized = text.replace(/\s+/gu, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function buildStatusPrompt(status: LifeCompanionStatus) {
  return [
    `mood=${status.mood}`,
    `affection=${status.affectionLevel}`,
    `hunger=${status.hungerLevel}`,
    `ready=${status.proactiveReady ? 'yes' : 'no'}`,
  ].join(', ');
}

export function buildLifeCompanionLlmUserPrompt(
  config: PetConfig,
  petName: string,
) {
  const draft = createLifeCompanionDraftFromState(
    config.stats,
    config.settings.lifeCompanion,
    petName,
  );

  return truncateText([
    `You are the desktop pet named ${petName}.`,
    'Proactively send one low-interruption companion message to the user.',
    'Reply in Chinese, in character, in exactly one short sentence.',
    'Do not mention systems, timers, cooldowns, rules, prompts, or tools.',
    'Do not ask to search the web, open apps, run commands, play voice, or trigger skills.',
    `Current state: ${buildStatusPrompt(draft.status)}.`,
    `Local intent draft: ${draft.prompt}`,
  ].join('\n'), MAX_LLM_PROMPT_LENGTH);
}

export function sanitizeLifeCompanionLlmResponse(text: string) {
  return truncateText(text, MAX_LLM_RESPONSE_LENGTH);
}

export async function generateLifeCompanionLlmPrompt(options: {
  config: PetConfig;
  petName: string;
}) {
  const response = await getPetResponse(
    desktopPetChatStore.getState().messages,
    buildLifeCompanionLlmUserPrompt(options.config, options.petName),
    options.config.personality,
    options.config.settings,
    'block',
  );

  return sanitizeLifeCompanionLlmResponse(response);
}
