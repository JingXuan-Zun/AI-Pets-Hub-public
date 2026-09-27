import { createEmptyStoryDefinition, createStoryEntry, createStoryId } from './storyDefaults';
import { hasStoryAuthoredContent } from './storyDraftGenerationInput';
import { normalizeStoredStoryPromptPreset } from './storyPromptPresetSchema';
import type { StoryPromptInputMode, StoryPromptRole } from './storyPromptPresetTypes';
import type {
  StoryDefinition,
  StoryEntry,
  StoryParticipantEntryMode,
  StoryParticipantOption,
  StoryParticipantRoute,
  StorySource,
} from './storyTypes';

const MAX_ENTRY_COUNT = 20;
const MAX_ROUTE_COUNT = 30;

function normalizeText(value: unknown, maxLength = 4000) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function normalizeEntry(value: unknown): StoryEntry | null {
  if (typeof value === 'string') {
    const text = normalizeText(value, 500);
    return text ? createStoryEntry(text) : null;
  }
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<StoryEntry>;
  const text = normalizeText(candidate.text, 500);
  if (!text) return null;
  return {
    enabled: candidate.enabled !== false,
    id: normalizeText(candidate.id, 120) || createStoryId('story-entry'),
    text,
  };
}

function normalizeEntries(value: unknown, fallback: StoryEntry[] = []) {
  const entries = (Array.isArray(value) ? value : [])
    .map(normalizeEntry)
    .filter((entry): entry is StoryEntry => entry !== null)
    .slice(0, MAX_ENTRY_COUNT);
  return entries.length > 0 ? entries : fallback;
}

function normalizeParticipantIds(value: unknown, options: StoryParticipantOption[]) {
  const allowedIds = new Set(options.map((option) => option.id));
  const ids = (Array.isArray(value) ? value : [])
    .map((id) => normalizeText(id, 120))
    .filter((id, index, values) => allowedIds.has(id) && values.indexOf(id) === index);
  if (ids.length > 0) return ids;
  const defaultCount = Math.min(Math.max(options.length, 1), 4);
  return options.slice(0, defaultCount).map((option) => option.id);
}

function normalizeSource(value: unknown, fallback: StorySource): StorySource {
  return value === 'manual' || value === 'imported' || value === 'random' || value === 'hybrid'
    ? value : fallback;
}

function normalizePromptRole(value: unknown): StoryPromptRole {
  return value === 'assistant' || value === 'system' ? value : 'user';
}

function normalizePromptMode(value: unknown): StoryPromptInputMode {
  return value === 'json' ? 'json' : 'manual';
}

function normalizeEntryMode(value: unknown): StoryParticipantEntryMode {
  return value === 'opening' ? 'opening' : 'condition';
}

function createDefaultParticipantRoutes(participantIds: string[]) {
  return participantIds.map((participantId, index) => ({
    entryCondition: index === 0 ? '故事开场即可出现。' : '当剧情行动自然到达其出场条件时出现。',
    entryMode: index === 0 ? 'opening' : 'condition',
    participantId,
    priority: index,
  } satisfies StoryParticipantRoute));
}

function normalizeParticipantRoutes(
  value: unknown,
  participantIds: string[],
) {
  const allowedIds = new Set(participantIds);
  const routes = (Array.isArray(value) ? value : [])
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const candidate = item as Partial<StoryParticipantRoute>;
      const participantId = normalizeText(candidate.participantId, 120);
      if (!allowedIds.has(participantId)) return null;
      return {
        entryCondition: normalizeText(candidate.entryCondition, 500) || '当剧情行动自然到达其出场条件时出现。',
        entryMode: normalizeEntryMode(candidate.entryMode),
        participantId,
        priority: Number.isFinite(Number(candidate.priority)) ? Number(candidate.priority) : 0,
      } satisfies StoryParticipantRoute;
    })
    .filter((route): route is StoryParticipantRoute => route !== null);
  const knownIds = new Set(routes.map((route) => route.participantId));
  return [
    ...routes,
    ...createDefaultParticipantRoutes(participantIds.filter((id) => !knownIds.has(id))),
  ].slice(0, MAX_ROUTE_COUNT);
}

export function normalizeStoryDefinition(
  value: unknown,
  options: StoryParticipantOption[] = [],
  fallbackSource: StorySource = 'manual',
): StoryDefinition {
  const candidate = value && typeof value === 'object'
    ? value as Partial<StoryDefinition> : {};
  const fallback = createEmptyStoryDefinition([], fallbackSource);
  const customPrompt = typeof candidate.customPrompt === 'string'
    ? candidate.customPrompt.trim() : '';
  const customPromptPreset = normalizeStoredStoryPromptPreset(candidate.customPromptPreset);
  const now = Date.now();
  return {
    ...fallback,
    createdAt: Number.isFinite(candidate.createdAt) ? Number(candidate.createdAt) : now,
    customPrompt,
    customPromptEnabled: typeof candidate.customPromptEnabled === 'boolean'
      ? candidate.customPromptEnabled : Boolean(customPrompt),
    customPromptManualRole: normalizePromptRole(candidate.customPromptManualRole),
    customPromptMode: normalizePromptMode(candidate.customPromptMode),
    customPromptPreset,
    customPromptPresetName: normalizeText(candidate.customPromptPresetName, 200),
    customScript: normalizeText(candidate.customScript, 30000),
    failureCondition: normalizeText(candidate.failureCondition, 1000),
    goals: normalizeEntries(candidate.goals, fallback.goals),
    id: normalizeText(candidate.id, 120) || fallback.id,
    initialTime: normalizeText(candidate.initialTime, 120) || '故事开场',
    openingScene: normalizeText(candidate.openingScene, 4000),
    participantIds: normalizeParticipantIds(candidate.participantIds, options),
    participantRoutes: normalizeParticipantRoutes(candidate.participantRoutes, normalizeParticipantIds(candidate.participantIds, options)),
    premise: normalizeText(candidate.premise, 4000),
    rules: normalizeEntries(candidate.rules, fallback.rules),
    sections: {
      goals: candidate.sections?.goals !== false,
      rules: candidate.sections?.rules !== false,
      tasks: candidate.sections?.tasks !== false,
    },
    setting: normalizeText(candidate.setting, 4000),
    source: normalizeSource(candidate.source, fallbackSource),
    successCondition: normalizeText(candidate.successCondition, 1000),
    tasks: normalizeEntries(candidate.tasks, fallback.tasks),
    title: normalizeText(candidate.title, 200),
    updatedAt: now,
    userRole: normalizeText(candidate.userRole, 1000),
    version: 1,
  };
}

function mergeText(userValue: string, generatedValue: string) {
  return userValue.trim() ? userValue : generatedValue;
}

function mergeInitialTime(userValue: string, generatedValue: string) {
  return userValue.trim() && userValue !== '故事开场' ? userValue : generatedValue;
}

function mergeEntries(userEntries: StoryEntry[], generatedEntries: StoryEntry[]) {
  const filledUserEntries = userEntries.filter((entry) => entry.text.trim());
  if (filledUserEntries.length === 0) return generatedEntries;
  const knownTexts = new Set(filledUserEntries.map((entry) => entry.text.trim()));
  return [...filledUserEntries, ...generatedEntries.filter((entry) => !knownTexts.has(entry.text.trim()))]
    .slice(0, MAX_ENTRY_COUNT);
}

function isDefaultParticipantRoute(route: StoryParticipantRoute) {
  return route.entryCondition === '故事开场即可出现。'
    || route.entryCondition === '当剧情行动自然到达其出场条件时出现。';
}

function mergeParticipantRoutes(
  userRoutes: StoryParticipantRoute[],
  generatedRoutes: StoryParticipantRoute[],
) {
  if (userRoutes.length === 0) return generatedRoutes;
  const generatedById = new Map(generatedRoutes.map((route) => [route.participantId, route]));
  return userRoutes.map((route) => (
    isDefaultParticipantRoute(route) ? generatedById.get(route.participantId) ?? route : route
  ));
}

export function mergeStoryCompletion(
  userDraft: StoryDefinition,
  generatedDraft: StoryDefinition,
): StoryDefinition {
  return {
    ...generatedDraft,
    createdAt: userDraft.createdAt,
    customPrompt: userDraft.customPrompt,
    customPromptEnabled: userDraft.customPromptEnabled,
    customPromptManualRole: userDraft.customPromptManualRole,
    customPromptMode: userDraft.customPromptMode,
    customPromptPreset: userDraft.customPromptPreset,
    customPromptPresetName: userDraft.customPromptPresetName,
    customScript: mergeText(userDraft.customScript, generatedDraft.customScript),
    failureCondition: mergeText(userDraft.failureCondition, generatedDraft.failureCondition),
    goals: mergeEntries(userDraft.goals, generatedDraft.goals),
    id: userDraft.id,
    initialTime: mergeInitialTime(userDraft.initialTime, generatedDraft.initialTime),
    openingScene: mergeText(userDraft.openingScene, generatedDraft.openingScene),
    participantIds: userDraft.participantIds.length > 0
      ? userDraft.participantIds : generatedDraft.participantIds,
    participantRoutes: mergeParticipantRoutes(userDraft.participantRoutes, generatedDraft.participantRoutes),
    premise: mergeText(userDraft.premise, generatedDraft.premise),
    rules: mergeEntries(userDraft.rules, generatedDraft.rules),
    sections: userDraft.sections,
    setting: mergeText(userDraft.setting, generatedDraft.setting),
    source: hasStoryAuthoredContent(userDraft) ? 'hybrid' : generatedDraft.source,
    successCondition: mergeText(userDraft.successCondition, generatedDraft.successCondition),
    tasks: mergeEntries(userDraft.tasks, generatedDraft.tasks),
    title: mergeText(userDraft.title, generatedDraft.title),
    updatedAt: Date.now(),
    userRole: mergeText(userDraft.userRole, generatedDraft.userRole),
  };
}

export function isStoryDefinitionStartable(definition: StoryDefinition) {
  const hasEnabledText = (entries: StoryEntry[]) => entries.some(
    (entry) => entry.enabled && entry.text.trim(),
  );
  return Boolean(
    definition.participantIds.length > 0
    && (definition.title.trim() || definition.premise.trim() || definition.customScript.trim())
    && (!definition.sections.goals || hasEnabledText(definition.goals))
    && (!definition.sections.tasks || hasEnabledText(definition.tasks))
    && (!definition.sections.rules || hasEnabledText(definition.rules)),
  );
}
