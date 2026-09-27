import type { StoryPromptPreset } from './storyPromptPresetTypes';

export function shouldShowStoryPromptJsonSource(
  preset: StoryPromptPreset | null | undefined,
) {
  return !preset;
}
