import type { PetConfig } from '../types';
import {
  applyLifeCompanionLlmBackoffFailure,
  clearLifeCompanionLlmBackoff,
  isLifeCompanionLlmBackoffActive,
  type LifeCompanionLlmBackoffState,
} from './lifeCompanionLlmBackoff';
import { generateLifeCompanionLlmPrompt } from './lifeCompanionLlmPrompt';
import { shouldGenerateLifeCompanionLlmTextPrompt } from './lifeCompanionScheduler';

export interface LifeCompanionLlmPromptResult {
  backoffState: LifeCompanionLlmBackoffState;
  errorMessage: string | null;
  lastLlmTextPromptAt: number | null;
  promptOverride: string | null;
  skippedByBackoff: boolean;
}

export async function resolveLifeCompanionLlmPrompt(options: {
  backoffState: LifeCompanionLlmBackoffState;
  config: PetConfig;
  lastLlmTextPromptAt: number | null;
  petName: string;
  textPromptAllowed: boolean;
}) {
  if (!options.textPromptAllowed) {
    return {
      backoffState: options.backoffState,
      errorMessage: null,
      lastLlmTextPromptAt: options.lastLlmTextPromptAt,
      promptOverride: null,
      skippedByBackoff: false,
    } satisfies LifeCompanionLlmPromptResult;
  }

  if (isLifeCompanionLlmBackoffActive(options.backoffState)) {
    return {
      backoffState: options.backoffState,
      errorMessage: null,
      lastLlmTextPromptAt: options.lastLlmTextPromptAt,
      promptOverride: null,
      skippedByBackoff: true,
    } satisfies LifeCompanionLlmPromptResult;
  }

  if (!shouldGenerateLifeCompanionLlmTextPrompt({
    lastPromptAt: options.lastLlmTextPromptAt,
    settings: options.config.settings.lifeCompanion,
  })) {
    return {
      backoffState: options.backoffState,
      errorMessage: null,
      lastLlmTextPromptAt: options.lastLlmTextPromptAt,
      promptOverride: null,
      skippedByBackoff: false,
    } satisfies LifeCompanionLlmPromptResult;
  }

  try {
    const promptOverride = await generateLifeCompanionLlmPrompt({
      config: options.config,
      petName: options.petName,
    });

    return {
      backoffState: clearLifeCompanionLlmBackoff(),
      errorMessage: null,
      lastLlmTextPromptAt: Date.now(),
      promptOverride,
      skippedByBackoff: false,
    } satisfies LifeCompanionLlmPromptResult;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      backoffState: applyLifeCompanionLlmBackoffFailure(options.backoffState, errorMessage),
      errorMessage,
      lastLlmTextPromptAt: Date.now(),
      promptOverride: null,
      skippedByBackoff: false,
    } satisfies LifeCompanionLlmPromptResult;
  }
}
