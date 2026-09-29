import type { StoryDefinition, StoryEntry } from './storyTypes';
import { getStoryPromptOrderList } from './storyPromptPresetSchema';
import type {
  CompiledStoryPrompt,
  StoryPromptPresetItem,
  StoryPromptRole,
  StoryPromptStage,
} from './storyPromptPresetTypes';

const STORY_STAGES = new Set<StoryPromptStage>(['character', 'director', 'draft', 'narrator']);

function formatEntries(entries: StoryEntry[]) {
  return entries.filter((entry) => entry.enabled && entry.text.trim())
    .map((entry, index) => `${index + 1}. ${entry.text.trim()}`).join('\n');
}

function buildMarkerMap(story: StoryDefinition) {
  return new Map<string, string>([
    ['storyTitle', story.title],
    ['storyPremise', story.premise],
    ['storySetting', story.setting],
    ['storyGoals', formatEntries(story.goals)],
    ['storyTasks', formatEntries(story.tasks)],
    ['storyRules', formatEntries(story.rules)],
    ['goals', formatEntries(story.goals)],
    ['tasks', formatEntries(story.tasks)],
    ['rules', formatEntries(story.rules)],
    ['storyScript', story.customScript],
    ['scenario', [story.premise, story.openingScene].filter(Boolean).join('\n')],
    ['worldInfoBefore', story.setting],
    ['worldInfoAfter', formatEntries(story.rules)],
  ]);
}

function replaceStoryMacros(content: string, story: StoryDefinition) {
  const macros = new Map<string, string>([
    ['story.title', story.title],
    ['story.premise', story.premise],
    ['story.setting', story.setting],
    ['story.goals', formatEntries(story.goals)],
    ['story.tasks', formatEntries(story.tasks)],
    ['story.rules', formatEntries(story.rules)],
    ['story.script', story.customScript],
    ['scenario', story.premise],
    ['user', '用户'],
  ]);
  return content.replace(/{{\s*([^{}]+?)\s*}}/g, (source, key: string) => (
    macros.has(key) ? macros.get(key) ?? '' : source
  ));
}

function shouldTrigger(prompt: StoryPromptPresetItem, stage: StoryPromptStage) {
  const triggers = prompt.injection_trigger ?? [];
  const storyTriggers = triggers.filter((trigger): trigger is StoryPromptStage => (
    STORY_STAGES.has(trigger as StoryPromptStage)
  ));
  return storyTriggers.length === 0 || storyTriggers.includes(stage);
}

function preparePromptContent(prompt: StoryPromptPresetItem, story: StoryDefinition) {
  const source = prompt.marker ? buildMarkerMap(story).get(prompt.identifier) ?? '' : prompt.content ?? '';
  return replaceStoryMacros(source, story).trim();
}

function appendRole(result: CompiledStoryPrompt, role: StoryPromptRole, content: string) {
  result[role] = [result[role], content].filter(Boolean).join('\n\n');
}

function compilePreset(story: StoryDefinition, stage: StoryPromptStage) {
  const result: CompiledStoryPrompt = { assistant: '', system: '', user: '' };
  const preset = story.customPromptPreset;
  if (!preset) return result;
  const promptMap = new Map(preset.prompts.map((prompt) => [prompt.identifier, prompt]));
  const order = getStoryPromptOrderList(preset)?.order ?? [];
  order.forEach((entry) => {
    const prompt = promptMap.get(entry.identifier);
    if (!entry.enabled || !prompt || !shouldTrigger(prompt, stage)) return;
    const content = preparePromptContent(prompt, story);
    if (content) appendRole(result, prompt.role, content);
  });
  return result;
}

export function compileStoryCustomPrompt(
  story: StoryDefinition,
  stage: StoryPromptStage,
): CompiledStoryPrompt {
  if (!story.customPromptEnabled) return { assistant: '', system: '', user: '' };
  if (story.customPromptMode === 'json') return compilePreset(story, stage);
  const content = story.customPrompt.trim();
  const result: CompiledStoryPrompt = { assistant: '', system: '', user: '' };
  if (content) appendRole(result, story.customPromptManualRole, content);
  return result;
}

export function formatCompiledStoryPrompt(compiled: CompiledStoryPrompt) {
  return (['system', 'user', 'assistant'] as StoryPromptRole[])
    .map((role) => compiled[role] ? `[${role}]\n${compiled[role]}` : '')
    .filter(Boolean).join('\n\n');
}
