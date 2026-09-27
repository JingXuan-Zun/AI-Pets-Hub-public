import type { PetConfig } from '../types';
import type { LifeCompanionLlmBackoffState } from './lifeCompanionLlmBackoff';
import { resolveLifeCompanionLlmPrompt } from './lifeCompanionLlmPromptController';
import { shouldPublishLifeCompanionTextPrompt } from './lifeCompanionScheduler';
import {
  publishLifeCompanionPrompt,
  resolveLifeCompanionPromptTarget,
} from './lifeCompanionTextPromptPublisher';

export interface LifeCompanionInteractionRunResult {
  event: 'draft-ready' | 'llm-backoff' | 'llm-error' | 'llm-published' | 'text-busy' | 'text-published';
  llmBackoffState: LifeCompanionLlmBackoffState;
  lastLlmTextPromptAt: number | null;
  lastTextPromptAt: number | null;
  statusSummary: string;
}

export async function runLifeCompanionInteraction(options: {
  llmBackoffState: LifeCompanionLlmBackoffState;
  config: PetConfig;
  lastLlmTextPromptAt: number | null;
  lastTextPromptAt: number | null;
}) {
  const textPromptAllowed = shouldPublishLifeCompanionTextPrompt({
    lastPromptAt: options.lastTextPromptAt,
    settings: options.config.settings.lifeCompanion,
  });
  const promptTarget = resolveLifeCompanionPromptTarget(options.config);
  const llmResult = await resolveLifeCompanionLlmPrompt({
    backoffState: options.llmBackoffState,
    config: options.config,
    lastLlmTextPromptAt: options.lastLlmTextPromptAt,
    petName: promptTarget.petName,
    textPromptAllowed,
  });
  const publishResult = publishLifeCompanionPrompt({
    config: options.config,
    promptOverride: llmResult.promptOverride,
    textPromptAllowed,
  });
  const lastTextPromptAt = publishResult.textMessagePublished ? Date.now() : options.lastTextPromptAt;

  return {
    event: llmResult.skippedByBackoff
      ? 'llm-backoff'
      : llmResult.errorMessage
      ? 'llm-error'
      : llmResult.promptOverride && publishResult.textMessagePublished
        ? 'llm-published'
        : publishResult.textMessagePublished
          ? 'text-published'
          : publishResult.skippedTextReason === 'busy'
            ? 'text-busy'
            : 'draft-ready',
    llmBackoffState: llmResult.backoffState,
    lastLlmTextPromptAt: llmResult.lastLlmTextPromptAt,
    lastTextPromptAt,
    statusSummary: publishResult.statusSummary,
  } satisfies LifeCompanionInteractionRunResult;
}
