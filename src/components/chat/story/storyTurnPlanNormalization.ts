import type {
  StoryEventRecord,
  StoryParticipantRuntimeStatus,
  StorySessionState,
  StoryStatePatch,
  StoryTaskStatus,
  StoryTurnPlan,
} from './storyTypes';
import { normalizeStoryActionSuggestions } from './storyActionSuggestions';
import {
  createFallbackStoryPublicAnalysis,
  normalizeStoryPublicAnalysis,
} from './storyPublicAnalysis';
import {
  enforceStoryTurnSemantics,
  normalizeStoryTurnPacingMode,
} from './storyTurnSemantics';

const MAX_TEXT = 1200;
const MAX_LIST_ITEM = 240;
const PARTICIPANT_STATUSES: StoryParticipantRuntimeStatus[] = [
  'locked', 'available', 'active', 'away', 'removed',
];
const EVENT_TYPES: StoryEventRecord['type'][] = [
  'action', 'arrival', 'departure', 'discovery', 'relationship', 'task', 'scene',
];

function text(value: unknown, limit = MAX_TEXT) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function ids(value: unknown, allowed: Set<string>, limit: number) {
  return Array.from(new Set((Array.isArray(value) ? value : [])
    .map((item) => text(item, 120))
    .filter((item) => allowed.has(item)))).slice(0, limit);
}

function numberInRange(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.round(parsed))) : fallback;
}

function normalizeStatus(value: unknown): StoryParticipantRuntimeStatus | undefined {
  return PARTICIPANT_STATUSES.includes(value as StoryParticipantRuntimeStatus)
    ? value as StoryParticipantRuntimeStatus : undefined;
}

function normalizeTaskStatus(value: unknown): StoryTaskStatus | null {
  return value === 'pending' || value === 'completed' || value === 'failed' || value === 'skipped'
    ? value : null;
}

function normalizeEvents(value: unknown, session: StorySessionState, scene: string) {
  const allowed = new Set(session.definition.participantIds);
  return (Array.isArray(value) ? value : []).map((item) => {
    const candidate = record(item);
    const eventType = EVENT_TYPES.includes(candidate.type as StoryEventRecord['type'])
      ? candidate.type as StoryEventRecord['type'] : 'action';
    const eventText = text(candidate.text, 500);
    if (!eventText) return null;
    return {
      participantIds: ids(candidate.participantIds, allowed, 4),
      scene: text(candidate.scene, 500) || scene,
      text: eventText,
      turn: session.currentTurn,
      type: eventType,
    } satisfies StoryEventRecord;
  }).filter((event): event is StoryEventRecord => event !== null).slice(0, 8);
}

function normalizeNarrativeBeats(value: unknown, allowedIds: Set<string>) {
  return (Array.isArray(value) ? value : []).map((item) => {
    const candidate = record(item);
    const participantId = text(candidate.participantId, 120);
    const action = text(candidate.action, 500);
    if (!allowedIds.has(participantId) || !action) return null;
    return {
      action,
      innerState: text(candidate.innerState, 500),
      participantId,
      visibleCue: text(candidate.visibleCue, 500),
    };
  }).filter((item): item is StoryTurnPlan['narrativeBeats'][number] => item !== null).slice(0, 4);
}

function normalizeCharacterUpdates(value: unknown, session: StorySessionState) {
  const allowed = new Set(session.definition.participantIds);
  return (Array.isArray(value) ? value : []).map((item) => {
    const entry = record(item);
    const participantId = text(entry.participantId, 120);
    if (!allowed.has(participantId)) return null;
    return {
      ...(text(entry.currentGoal, MAX_LIST_ITEM) ? { currentGoal: text(entry.currentGoal, MAX_LIST_ITEM) } : {}),
      ...(text(entry.currentLocation, MAX_LIST_ITEM) ? { currentLocation: text(entry.currentLocation, MAX_LIST_ITEM) } : {}),
      ...(text(entry.emotionalState, MAX_LIST_ITEM) ? { emotionalState: text(entry.emotionalState, MAX_LIST_ITEM) } : {}),
      ...(text(entry.knowledgeState, MAX_LIST_ITEM) ? { knowledgeState: text(entry.knowledgeState, MAX_LIST_ITEM) } : {}),
      participantId,
      ...(normalizeStatus(entry.status) ? { status: normalizeStatus(entry.status) } : {}),
    };
  }).filter((item): item is StoryStatePatch['characterUpdates'][number] => item !== null).slice(0, 8);
}

function normalizeRelationshipUpdates(value: unknown, session: StorySessionState) {
  const allowed = new Set(session.definition.participantIds);
  return (Array.isArray(value) ? value : []).map((item) => {
    const entry = record(item);
    const sourceParticipantId = text(entry.sourceParticipantId, 120);
    const targetParticipantId = text(entry.targetParticipantId, 120);
    if (!allowed.has(sourceParticipantId) || !allowed.has(targetParticipantId) || sourceParticipantId === targetParticipantId) return null;
    return {
      delta: numberInRange(entry.delta, -20, 20, 0),
      reason: text(entry.reason, MAX_LIST_ITEM), sourceParticipantId, targetParticipantId,
    };
  }).filter((item): item is StoryStatePatch['relationshipUpdates'][number] => item !== null).slice(0, 8);
}

function normalizeTaskUpdates(value: unknown, session: StorySessionState) {
  const taskIds = new Set(session.definition.tasks.map((task) => task.id));
  return (Array.isArray(value) ? value : []).map((item) => {
    const entry = record(item);
    const taskId = text(entry.taskId, 120);
    const status = normalizeTaskStatus(entry.status);
    return taskId && taskIds.has(taskId) && status
      ? { reason: text(entry.reason, MAX_LIST_ITEM), status, taskId } : null;
  }).filter((item): item is StoryStatePatch['taskUpdates'][number] => item !== null).slice(0, 8);
}

function normalizeGoalUpdates(value: unknown, session: StorySessionState) {
  const goalIds = new Set(session.definition.goals.map((goal) => goal.id));
  return (Array.isArray(value) ? value : []).map((item) => {
    const entry = record(item);
    const goalId = text(entry.goalId, 120);
    const progress = text(entry.progress, MAX_LIST_ITEM);
    return goalId && goalIds.has(goalId) && progress ? { goalId, progress } : null;
  }).filter((item): item is StoryStatePatch['goalUpdates'][number] => item !== null).slice(0, 8);
}

function normalizeStatePatch(value: unknown, session: StorySessionState, scene: string): StoryStatePatch {
  const candidate = record(value);
  const normalizeItems = (key: 'inventoryAdd' | 'inventoryRemove') => Array.from(new Set(
    (Array.isArray(candidate[key]) ? candidate[key] : []).map((item) => text(item, MAX_LIST_ITEM)).filter(Boolean),
  )).slice(0, 8);
  return {
    characterUpdates: normalizeCharacterUpdates(candidate.characterUpdates, session),
    ...(text(candidate.currentTime, 120) ? { currentTime: text(candidate.currentTime, 120) } : {}),
    events: normalizeEvents(candidate.events, session, scene),
    goalUpdates: normalizeGoalUpdates(candidate.goalUpdates, session),
    inventoryAdd: normalizeItems('inventoryAdd'),
    inventoryRemove: normalizeItems('inventoryRemove'),
    relationshipUpdates: normalizeRelationshipUpdates(candidate.relationshipUpdates, session),
    taskUpdates: normalizeTaskUpdates(candidate.taskUpdates, session),
  };
}

function normalizeSceneTransition(value: unknown, session: StorySessionState): StoryTurnPlan['sceneTransition'] {
  const candidate = record(value);
  const from = text(candidate.from, 1200) || session.currentScene;
  const to = text(candidate.to, 1200) || session.currentScene;
  return {
    changed: candidate.changed === true || to !== session.currentScene,
    from,
    process: text(candidate.process, 600),
    reason: text(candidate.reason, 600),
    to,
  };
}

export function createFallbackStoryTurnPlan(session: StorySessionState, userInput: string): StoryTurnPlan {
  const movement = /出发|前往|走向|赶往|离开|等待|休息|睡/.test(userInput);
  const elapsedMinutes = movement ? 5 : 1;
  const activeSpeakerIds = session.activeCast.slice(0, 1);
  const scene = session.currentScene || session.definition.openingScene || '当前场景';
  const plan: StoryTurnPlan = {
    actionResult: `用户行动已在${scene}中产生可继续观察的结果。`,
    activeSpeakerIds,
    elapsedMinutes,
    enteringParticipantIds: [],
    leavingParticipantIds: [],
    mediaHint: '',
    narrativeBeats: activeSpeakerIds.map((participantId) => ({
      action: '保持警觉，观察用户行动带来的变化。',
      innerState: '正在评估局势，暂不暴露全部判断。',
      participantId,
      visibleCue: '视线随着现场变化移动。',
    })),
    narrationFocus: '交代用户行动的可见结果，并为当前角色对白留下空间。',
    pacingMode: normalizeStoryTurnPacingMode(undefined, userInput),
    publicAnalysis: createFallbackStoryPublicAnalysis(session, userInput),
    sceneTransition: { changed: false, from: scene, process: '', reason: '', to: scene },
    statePatch: {
      characterUpdates: [], currentTime: undefined, events: [], goalUpdates: [], inventoryAdd: [],
      inventoryRemove: [], relationshipUpdates: [], taskUpdates: [],
    },
    suggestedActions: normalizeStoryActionSuggestions([], session),
  };
  return enforceStoryTurnSemantics(plan, session, userInput);
}

export function normalizeStoryTurnPlan(
  value: unknown,
  session: StorySessionState,
  userInput = '',
): StoryTurnPlan {
  const candidate = record(value);
  const allowed = new Set(session.definition.participantIds);
  const enteringParticipantIds = ids(candidate.enteringParticipantIds, allowed, 1)
    .filter((id) => !session.activeCast.includes(id));
  const leavingParticipantIds = ids(candidate.leavingParticipantIds, allowed, 2)
    .filter((id) => session.activeCast.includes(id) && session.activeCast.length > 1);
  const permittedSpeakers = new Set([...session.activeCast, ...enteringParticipantIds]);
  const activeSpeakerIds = ids(candidate.activeSpeakerIds, permittedSpeakers, 2);
  const nextSpeakers = activeSpeakerIds.length > 0 ? activeSpeakerIds : session.activeCast.slice(0, 1);
  const normalizedBeats = normalizeNarrativeBeats(candidate.narrativeBeats, permittedSpeakers);
  const narrativeBeats = normalizedBeats.length > 0 ? normalizedBeats : nextSpeakers.map((participantId) => ({
    action: '观察用户行动带来的变化。',
    innerState: '正在评估当前局势。',
    participantId,
    visibleCue: '神情随着现场变化而改变。',
  }));
  const sceneTransition = normalizeSceneTransition(candidate.sceneTransition, session);
  const plan: StoryTurnPlan = {
    actionResult: text(candidate.actionResult, 1600),
    activeSpeakerIds: nextSpeakers,
    elapsedMinutes: numberInRange(candidate.elapsedMinutes, 0, 1440, 1),
    enteringParticipantIds,
    leavingParticipantIds,
    mediaHint: text(candidate.mediaHint, 600),
    narrativeBeats,
    narrationFocus: text(candidate.narrationFocus, 600),
    pacingMode: normalizeStoryTurnPacingMode(candidate.pacingMode, userInput),
    publicAnalysis: normalizeStoryPublicAnalysis(
      candidate.publicAnalysis,
      createFallbackStoryPublicAnalysis(session, userInput),
    ),
    sceneTransition,
    statePatch: normalizeStatePatch(candidate.statePatch, session, sceneTransition.to),
    suggestedActions: normalizeStoryActionSuggestions(candidate.suggestedActions, session),
  };
  return enforceStoryTurnSemantics(plan, session, userInput);
}

export function parseStoryTurnPlanResponse(response: string) {
  const stripped = response.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return JSON.parse(stripped) as unknown;
  } catch {
    const start = stripped.indexOf('{');
    const end = stripped.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('故事导演没有返回有效计划。');
    return JSON.parse(stripped.slice(start, end + 1)) as unknown;
  }
}
