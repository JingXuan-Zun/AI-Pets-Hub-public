import { getStoryPromptOrderList } from './storyPromptPresetSchema';
import type { StoryPromptPreset } from './storyPromptPresetTypes';

function clonePreset(preset: StoryPromptPreset): StoryPromptPreset {
  return structuredClone(preset);
}

export function setStoryPromptOrderEnabled(
  preset: StoryPromptPreset,
  identifier: string,
  enabled: boolean,
) {
  const next = clonePreset(preset);
  const entry = getStoryPromptOrderList(next)?.order.find((item) => item.identifier === identifier);
  if (entry) entry.enabled = enabled;
  return next;
}

export function moveStoryPromptOrderEntry(
  preset: StoryPromptPreset,
  index: number,
  offset: -1 | 1,
) {
  const next = clonePreset(preset);
  const order = getStoryPromptOrderList(next)?.order;
  const target = index + offset;
  if (!order || target < 0 || target >= order.length) return preset;
  [order[index], order[target]] = [order[target], order[index]];
  return next;
}
