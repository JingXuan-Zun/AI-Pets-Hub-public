import type { StoryDefinition, StoryEntry, StorySessionState, StorySource } from './storyTypes';
import { createInitialCharacterStates } from './storyCastState';
import { normalizeStoryActionSuggestions } from './storyActionSuggestions';

export function createStoryId(prefix = 'story') {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 100000)}`;
}

export function createStoryEntry(text = ''): StoryEntry {
  return { enabled: true, id: createStoryId('story-entry'), text };
}

export function createEmptyStoryDefinition(
  participantIds: string[] = [],
  source: StorySource = 'manual',
): StoryDefinition {
  const now = Date.now();
  return {
    createdAt: now,
    customPrompt: '',
    customPromptEnabled: false,
    customPromptManualRole: 'user',
    customPromptMode: 'manual',
    customPromptPreset: null,
    customPromptPresetName: '',
    customScript: '',
    failureCondition: '',
    goals: [createStoryEntry()],
    id: createStoryId(),
    initialTime: '故事开场',
    openingScene: '',
    participantIds,
    participantRoutes: participantIds.map((participantId, index) => ({
      entryCondition: index === 0 ? '故事开场即可出现。' : '当剧情行动自然到达其出场条件时出现。',
      entryMode: index === 0 ? 'opening' : 'condition',
      participantId,
      priority: index,
    })),
    premise: '',
    rules: [createStoryEntry()],
    sections: { goals: true, rules: true, tasks: true },
    setting: '',
    source,
    successCondition: '',
    tasks: [createStoryEntry()],
    title: '',
    updatedAt: now,
    userRole: '',
    version: 1,
  };
}

export function createStorySession(definition: StoryDefinition): StorySessionState {
  const openingCast = definition.participantRoutes
    .filter((route) => route.entryMode === 'opening')
    .sort((left, right) => left.priority - right.priority)
    .map((route) => route.participantId)
    .slice(0, 2);
  const activeCast = openingCast.length > 0
    ? openingCast
    : definition.participantIds.slice(0, 1);
  return {
    activeCast,
    characterStates: createInitialCharacterStates(
      definition.participantIds,
      activeCast,
      definition.openingScene,
    ),
    currentScene: definition.openingScene,
    currentTime: definition.initialTime,
    currentTurn: 0,
    definition,
    elapsedMinutes: 0,
    eventLog: [],
    goalProgress: Object.fromEntries(definition.goals.map((goal) => [goal.id, '未开始'])),
    inventory: [],
    lastTurnPlan: null,
    recentEvents: [],
    relationships: {},
    startedAt: Date.now(),
    status: 'active',
    suggestedActions: [],
    taskStatuses: Object.fromEntries(definition.tasks.map((task) => [task.id, 'pending'])),
    triggeredRuleIds: [],
  };
}

export function restoreStorySession(
  definition: StoryDefinition,
  snapshot: StorySessionState | null,
): StorySessionState {
  const fresh = createStorySession(definition);
  if (!snapshot || snapshot.definition.id !== definition.id) return fresh;
  const allowed = new Set(definition.participantIds);
  const activeCast = snapshot.activeCast.filter((id) => allowed.has(id)).slice(0, 3);
  const characterStates = Object.fromEntries(definition.participantIds.map((id) => [
    id,
    snapshot.characterStates[id] ?? fresh.characterStates[id],
  ]));
  const lastTurnPlan = snapshot.lastTurnPlan
    ? { ...snapshot.lastTurnPlan, pacingMode: snapshot.lastTurnPlan.pacingMode ?? 'progression' as const }
    : null;
  return {
    ...fresh,
    ...snapshot,
    activeCast: activeCast.length > 0 ? activeCast : fresh.activeCast,
    characterStates,
    definition,
    lastTurnPlan,
    suggestedActions: normalizeStoryActionSuggestions(snapshot.suggestedActions, fresh),
  };
}
