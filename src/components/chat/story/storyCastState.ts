import type {
  StoryParticipantRuntimeState,
  StorySessionState,
  StoryTurnPlan,
} from './storyTypes';

const MAX_ACTIVE_CAST = 3;
const MAX_EVENT_LOG = 80;
const MAX_RECENT_EVENTS = 12;

function uniqueAllowedIds(ids: string[], allowedIds: Set<string>, limit = MAX_ACTIVE_CAST) {
  return Array.from(new Set(ids.filter((id) => allowedIds.has(id)))).slice(0, limit);
}

function createRuntimeState(
  participantId: string,
  status: StoryParticipantRuntimeState['status'],
  currentLocation: string,
): StoryParticipantRuntimeState {
  return {
    currentGoal: '',
    currentLocation,
    emotionalState: '',
    introducedTurn: status === 'active' ? 0 : null,
    knowledgeState: '',
    lastSeenTurn: status === 'active' ? 0 : null,
    participantId,
    status,
  };
}

export function createInitialCharacterStates(
  participantIds: string[],
  openingCast: string[],
  openingScene: string,
) {
  const activeIds = new Set(openingCast);
  return Object.fromEntries(participantIds.map((id) => [
    id,
    createRuntimeState(id, activeIds.has(id) ? 'active' : 'locked', openingScene),
  ]));
}

function applyCharacterUpdates(
  states: Record<string, StoryParticipantRuntimeState>,
  updates: StoryTurnPlan['statePatch']['characterUpdates'],
  currentTurn: number,
) {
  const next = { ...states };
  updates.forEach((update) => {
    const current = next[update.participantId];
    if (!current) return;
    next[update.participantId] = {
      ...current,
      ...(update.currentGoal !== undefined ? { currentGoal: update.currentGoal } : {}),
      ...(update.currentLocation !== undefined ? { currentLocation: update.currentLocation } : {}),
      ...(update.emotionalState !== undefined ? { emotionalState: update.emotionalState } : {}),
      ...(update.knowledgeState !== undefined ? { knowledgeState: update.knowledgeState } : {}),
      ...(update.status !== undefined ? { status: update.status } : {}),
      lastSeenTurn: update.status === 'away' || update.status === 'removed'
        ? current.lastSeenTurn : currentTurn,
    };
  });
  return next;
}

function applyCastTransitions(
  session: StorySessionState,
  plan: StoryTurnPlan,
  allowedIds: Set<string>,
) {
  const entering = uniqueAllowedIds(plan.enteringParticipantIds, allowedIds, 1)
    .filter((id) => !session.activeCast.includes(id));
  const leaving = uniqueAllowedIds(plan.leavingParticipantIds, allowedIds)
    .filter((id) => session.activeCast.includes(id));
  const remaining = session.activeCast.filter((id) => !leaving.includes(id));
  const activeCast = Array.from(new Set([...remaining, ...entering])).slice(0, MAX_ACTIVE_CAST);
  if (activeCast.length > 0) return { activeCast, entering, leaving };
  const fallback = session.activeCast[0] ?? [...allowedIds][0];
  return { activeCast: fallback ? [fallback] : [], entering: [], leaving: [] };
}

function updateCastStatuses(
  states: Record<string, StoryParticipantRuntimeState>,
  transitions: ReturnType<typeof applyCastTransitions>,
  currentTurn: number,
) {
  const next = { ...states };
  transitions.leaving.forEach((id) => {
    const state = next[id];
    if (state) next[id] = { ...state, status: 'away', lastSeenTurn: currentTurn };
  });
  transitions.entering.forEach((id) => {
    const state = next[id];
    if (state) next[id] = { ...state, status: 'active', introducedTurn: currentTurn, lastSeenTurn: currentTurn };
  });
  transitions.activeCast.forEach((id) => {
    const state = next[id];
    if (state) next[id] = { ...state, status: 'active', lastSeenTurn: currentTurn };
  });
  return next;
}

function applyRelationships(
  relationships: Record<string, number>,
  updates: StoryTurnPlan['statePatch']['relationshipUpdates'],
) {
  const next = { ...relationships };
  updates.forEach((update) => {
    const key = `${update.sourceParticipantId}->${update.targetParticipantId}`;
    const current = Number(next[key] ?? 0);
    next[key] = Math.max(-100, Math.min(100, current + update.delta));
  });
  return next;
}

function applyTaskUpdates(session: StorySessionState, plan: StoryTurnPlan) {
  const allowed = new Set(session.definition.tasks.map((task) => task.id));
  const taskStatuses = { ...session.taskStatuses };
  plan.statePatch.taskUpdates.forEach((update) => {
    if (allowed.has(update.taskId)) taskStatuses[update.taskId] = update.status;
  });
  return taskStatuses;
}

function applyGoalUpdates(session: StorySessionState, plan: StoryTurnPlan) {
  const allowed = new Set(session.definition.goals.map((goal) => goal.id));
  const goalProgress = { ...session.goalProgress };
  plan.statePatch.goalUpdates.forEach((update) => {
    if (allowed.has(update.goalId)) goalProgress[update.goalId] = update.progress.slice(0, 240);
  });
  return goalProgress;
}

function resolveCurrentTime(session: StorySessionState, plan: StoryTurnPlan) {
  const explicit = plan.statePatch.currentTime?.trim();
  if (explicit) return explicit.slice(0, 120);
  if (plan.elapsedMinutes <= 0) return session.currentTime;
  return `${session.currentTime}（约 ${plan.elapsedMinutes} 分钟后）`.slice(0, 120);
}

function resolvePlanEvents(session: StorySessionState, plan: StoryTurnPlan) {
  if (plan.statePatch.events.length > 0) return plan.statePatch.events;
  if (!plan.actionResult.trim()) return [];
  return [{
    participantIds: plan.activeSpeakerIds,
    scene: plan.sceneTransition.to || session.currentScene,
    text: plan.actionResult.trim().slice(0, 500),
    turn: session.currentTurn,
    type: 'action' as const,
  }];
}

export function applyStoryTurnPlan(session: StorySessionState, plan: StoryTurnPlan): StorySessionState {
  const allowedIds = new Set(session.definition.participantIds);
  const transitions = applyCastTransitions(session, plan, allowedIds);
  const transitionedStates = updateCastStatuses(session.characterStates, transitions, session.currentTurn);
  const characterStates = applyCharacterUpdates(
    transitionedStates,
    plan.statePatch.characterUpdates,
    session.currentTurn,
  );
  const eventLog = [...session.eventLog, ...resolvePlanEvents(session, plan)].slice(-MAX_EVENT_LOG);
  const recentEvents = eventLog.slice(-MAX_RECENT_EVENTS).map((event) => event.text).filter(Boolean);
  return {
    ...session,
    activeCast: transitions.activeCast,
    characterStates,
    currentScene: (plan.sceneTransition.to || session.currentScene).slice(0, 2400),
    currentTime: resolveCurrentTime(session, plan),
    elapsedMinutes: session.elapsedMinutes + plan.elapsedMinutes,
    eventLog,
    goalProgress: applyGoalUpdates(session, plan),
    inventory: Array.from(new Set([
      ...session.inventory.filter((item) => !plan.statePatch.inventoryRemove.includes(item)),
      ...plan.statePatch.inventoryAdd,
    ])).slice(0, 80),
    lastTurnPlan: plan,
    recentEvents,
    relationships: applyRelationships(session.relationships, plan.statePatch.relationshipUpdates),
    suggestedActions: plan.suggestedActions.slice(0, 4),
    taskStatuses: applyTaskUpdates(session, plan),
  };
}
