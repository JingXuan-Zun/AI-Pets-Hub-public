import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { PetConfig } from '../../../types';
import { createEmptyStoryDefinition } from './storyDefaults';
import { generateStoryDraft } from './storyDraftGenerator';
import { isStoryDefinitionStartable, normalizeStoryDefinition } from './storyDraftNormalization';
import type { StoryDefinition, StoryGenerationMode, StoryParticipantOption, StorySource } from './storyTypes';

function useStoryDraftState(options: {
  initialDraft?: StoryDefinition | null;
  participants: StoryParticipantOption[];
}) {
  const defaultIds = useMemo(
    () => options.participants.slice(0, Math.min(options.participants.length, 4)).map((item) => item.id),
    [options.participants],
  );
  const [draft, setDraft] = useState(() => options.initialDraft
    ? normalizeStoryDefinition(options.initialDraft, options.participants, options.initialDraft.source)
    : createEmptyStoryDefinition(defaultIds));
  useEffect(() => {
    const allowedIds = new Set(options.participants.map((participant) => participant.id));
    setDraft((current) => ({
      ...current,
      participantIds: current.participantIds.filter((id) => allowedIds.has(id)),
    }));
  }, [options.participants]);
  return { draft, setDraft };
}

function useStoryGenerator(options: {
  config: PetConfig;
  draft: StoryDefinition;
  participants: StoryParticipantOption[];
  setDraft: Dispatch<SetStateAction<StoryDefinition>>;
}) {
  const [error, setError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const requestControllerRef = useRef<AbortController | null>(null);
  useEffect(() => () => requestControllerRef.current?.abort(), []);
  const cancelGeneration = () => requestControllerRef.current?.abort();
  const generate = async (mode: StoryGenerationMode) => {
    if (isGenerating) return false;
    const requestController = new AbortController();
    requestControllerRef.current = requestController;
    setIsGenerating(true);
    setError('');
    try {
      const nextDraft = await generateStoryDraft({
        draft: normalizeStoryDefinition(options.draft, options.participants, options.draft.source),
        mode,
        participants: options.participants,
        settings: options.config.settings,
        signal: requestController.signal,
      });
      options.setDraft(nextDraft);
      return true;
    } catch (generationError) {
      const message = generationError instanceof Error ? generationError.message : '';
      setError(/cancelled|取消/iu.test(message)
        ? '已取消故事生成。'
        : /timed out|超时/iu.test(message)
          ? '故事生成超过 5 分钟仍未完成，请重试或切换响应更快的模型。'
          : message || '故事生成失败，请重试。');
      return false;
    } finally {
      if (requestControllerRef.current === requestController) {
        requestControllerRef.current = null;
      }
      setIsGenerating(false);
    }
  };
  return { cancelGeneration, error, generate, isGenerating, setError };
}

export function useStorySetupController(options: {
  config: PetConfig;
  initialDraft?: StoryDefinition | null;
  onStart: (definition: StoryDefinition) => void | Promise<void>;
  participants: StoryParticipantOption[];
}) {
  const { draft, setDraft } = useStoryDraftState(options);
  const generation = useStoryGenerator({ ...options, draft, setDraft });
  const [isPreviewing, setIsPreviewing] = useState(false);
  const updateDraft = (patch: Partial<StoryDefinition>) => {
    setDraft((current) => normalizeStoryDefinition({ ...current, ...patch, updatedAt: Date.now() }, options.participants, current.source));
    generation.setError('');
  };
  const setSource = (source: StorySource) => {
    updateDraft({ source });
    setIsPreviewing(false);
  };
  const generate = async (mode: StoryGenerationMode) => {
    if (await generation.generate(mode)) setIsPreviewing(true);
  };
  const start = async () => {
    if (!isStoryDefinitionStartable(draft)) {
      generation.setError('请至少选择一个角色、填写故事内容，并为所有已启用的目标/任务/规则各填写一项。');
      return;
    }
    const normalized = normalizeStoryDefinition(draft, options.participants, draft.source);
    generation.setError('');
    await options.onStart(normalized);
    setIsPreviewing(false);
  };
  return {
    cancelGeneration: generation.cancelGeneration,
    draft, error: generation.error, generate, isGenerating: generation.isGenerating,
    isPreviewing, setDraft, setIsPreviewing, setSource, start, updateDraft,
  };
}
