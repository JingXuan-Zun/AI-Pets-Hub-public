import { createEmptyStoryDefinition } from './storyDefaults';
import type { StoryDefinition, StoryGenerationMode } from './storyTypes';

function createRandomReplacementBase(draft: StoryDefinition) {
  const replacement = createEmptyStoryDefinition(draft.participantIds, 'random');
  return {
    ...replacement,
    createdAt: draft.createdAt,
    customPrompt: draft.customPrompt,
    customPromptEnabled: draft.customPromptEnabled,
    customPromptManualRole: draft.customPromptManualRole,
    customPromptMode: draft.customPromptMode,
    customPromptPreset: draft.customPromptPreset,
    customPromptPresetName: draft.customPromptPresetName,
    id: draft.id,
    sections: draft.sections,
    // A random refresh may replace generated material, but it must not erase
    // the user's requested genre, premise, setting, or authored constraints.
    title: draft.title,
    premise: draft.premise,
    setting: draft.setting,
    customScript: draft.customScript,
    openingScene: draft.openingScene,
    userRole: draft.userRole,
    initialTime: draft.initialTime,
    successCondition: draft.successCondition,
    failureCondition: draft.failureCondition,
    goals: draft.goals,
    tasks: draft.tasks,
    rules: draft.rules,
    participantRoutes: draft.participantRoutes,
  };
}

export function prepareStoryDraftForGeneration(
  draft: StoryDefinition,
  mode: StoryGenerationMode,
) {
  return mode === 'random' && draft.source === 'random'
    ? createRandomReplacementBase(draft)
    : draft;
}

export function hasStoryAuthoredContent(draft: StoryDefinition) {
  const texts = [
    draft.title, draft.premise, draft.setting, draft.customScript, draft.openingScene,
    draft.userRole, draft.successCondition, draft.failureCondition,
  ];
  const entries = [...draft.goals, ...draft.tasks, ...draft.rules];
  const hasCustomRoute = draft.participantRoutes.some((route, index) => (
    route.entryCondition !== (index === 0
      ? '故事开场即可出现。' : '当剧情行动自然到达其出场条件时出现。')
  ));
  return texts.some((value) => value.trim())
    || entries.some((entry) => entry.text.trim())
    || (draft.initialTime.trim() !== '' && draft.initialTime !== '故事开场')
    || hasCustomRoute;
}
