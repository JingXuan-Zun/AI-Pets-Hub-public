import type { PetConfig } from '../../../types';
import { getConfiguredCognitionResponse } from '../../../services/geminiService';
import { mergeStoryCompletion, normalizeStoryDefinition } from './storyDraftNormalization';
import { buildStoryDraftSystemInstruction, buildStoryDraftUserPrompt } from './storyDraftPrompt';
import { prepareStoryDraftForGeneration } from './storyDraftGenerationInput';
import { parseStoryDraftResponse } from './storyDraftResponseParser';
import { createStoryRandomSeed } from './storyRandomSeed';
import type {
  StoryDefinition,
  StoryGenerationMode,
  StoryParticipantOption,
} from './storyTypes';

export const STORY_DRAFT_GENERATION_TIMEOUT_MS = 300_000;
export const STORY_DRAFT_GENERATION_MAX_TOKENS = 16_384;

export async function generateStoryDraft(options: {
  draft: StoryDefinition;
  mode: StoryGenerationMode;
  participants: StoryParticipantOption[];
  settings: PetConfig['settings'];
  signal?: AbortSignal;
}) {
  if (options.participants.length === 0) {
    throw new Error('当前没有可参与故事的桌宠角色。');
  }
  const generationDraft = prepareStoryDraftForGeneration(options.draft, options.mode);
  const randomSeed = options.mode === 'random' ? createStoryRandomSeed() : undefined;
  const response = await getConfiguredCognitionResponse(
    buildStoryDraftUserPrompt({ ...options, draft: generationDraft, randomSeed }),
    buildStoryDraftSystemInstruction(generationDraft),
    options.settings,
    {
      allowReasoningContentFallback: true,
      includeReasoningContentWhenPresent: true,
      maxTokensOverride: STORY_DRAFT_GENERATION_MAX_TOKENS,
      signal: options.signal,
      task: 'understanding',
      timeoutMs: STORY_DRAFT_GENERATION_TIMEOUT_MS,
    },
  );
  const source = options.mode === 'random' ? 'random' : 'hybrid';
  const generated = normalizeStoryDefinition(parseStoryDraftResponse(response), options.participants, source);
  return mergeStoryCompletion(generationDraft, generated);
}
