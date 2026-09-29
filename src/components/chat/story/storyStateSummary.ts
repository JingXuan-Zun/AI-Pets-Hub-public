import type { StoryParticipantOption, StorySessionState } from './storyTypes';

const TASK_STATUS_LABELS: Record<string, string> = {
  completed: '已完成',
  failed: '失败',
  pending: '进行中',
  skipped: '已跳过',
};

const MAX_CHARACTER_THOUGHT_LENGTH = 160;
const INTERNAL_CONTENT_PATTERN = /(?:系统|开发者|导演)(?:提示|指令|计划|消息)|(?:隐藏)?思维链|内部推理|推理过程|narrativeBeats|statePatch|prompt|```/i;

export interface StoryStateSummary {
  activeCharacters: string[];
  characterThoughts: string[];
  characters: string[];
  elapsedTime: string;
  goals: string[];
  inventory: string[];
  recentEvents: string[];
  relationships: string[];
  scene: string;
  tasks: string[];
  time: string;
}

function sanitizeCharacterThought(value: string) {
  const normalized = value
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^(?:心理(?:\/动机)?|内心(?:想法)?|想法)\s*[:：]\s*/i, '')
    .trim();
  if (!normalized || INTERNAL_CONTENT_PATTERN.test(normalized)) return '';
  return normalized.slice(0, MAX_CHARACTER_THOUGHT_LENGTH);
}

function createNameResolver(participants: StoryParticipantOption[]) {
  const names = new Map(participants.map((participant) => [participant.id, participant.name]));
  return (id: string) => names.get(id) || id;
}

function buildCharacterLines(session: StorySessionState, resolveName: (id: string) => string) {
  return session.activeCast.map((id) => {
    const state = session.characterStates[id];
    const details = [
      state?.currentLocation ? `位置：${state.currentLocation}` : '',
      state?.emotionalState ? `情绪：${state.emotionalState}` : '',
      state?.currentGoal ? `当前目标：${state.currentGoal}` : '',
    ]
      .map((value) => value?.trim())
      .filter(Boolean);
    return `${resolveName(id)}${details.length ? `：${details.join('；')}` : ''}`;
  });
}

function buildFallbackThought(session: StorySessionState, participantId: string) {
  const state = session.characterStates[participantId];
  const details = [
    state?.emotionalState ? `情绪：${state.emotionalState}` : '',
    state?.currentGoal ? `当前关注：${state.currentGoal}` : '',
  ].filter(Boolean);
  return details.join('；') || '暂未显露明确想法';
}

function buildCharacterThoughts(session: StorySessionState, resolveName: (id: string) => string) {
  const activeIds = new Set(session.activeCast);
  const planThoughts = new Map<string, string>();
  session.lastTurnPlan?.narrativeBeats.forEach((beat) => {
    if (!activeIds.has(beat.participantId) || planThoughts.has(beat.participantId)) return;
    const thought = sanitizeCharacterThought(beat.innerState);
    if (thought) planThoughts.set(beat.participantId, thought);
  });
  return session.activeCast.map((id) => {
    const thought = planThoughts.get(id) || buildFallbackThought(session, id);
    return `${resolveName(id)}：${thought}`;
  });
}

function buildEntryLines(
  entries: StorySessionState['definition']['tasks'],
  resolveValue: (id: string) => string,
) {
  return entries
    .filter((entry) => entry.enabled && entry.text.trim())
    .map((entry) => `${entry.text}：${resolveValue(entry.id)}`);
}

function buildRelationshipLines(session: StorySessionState, resolveName: (id: string) => string) {
  return Object.entries(session.relationships).map(([key, value]) => {
    const [source = '', target = ''] = key.split('->');
    return `${resolveName(source)} → ${resolveName(target)}：${value >= 0 ? '+' : ''}${value}`;
  });
}

export function buildStoryStateSummary(
  session: StorySessionState,
  participants: StoryParticipantOption[],
): StoryStateSummary {
  const resolveName = createNameResolver(participants);
  return {
    activeCharacters: session.activeCast.map(resolveName),
    characterThoughts: buildCharacterThoughts(session, resolveName),
    characters: buildCharacterLines(session, resolveName),
    elapsedTime: session.elapsedMinutes > 0 ? `约 ${session.elapsedMinutes} 分钟` : '故事刚开始',
    goals: buildEntryLines(session.definition.goals, (id) => session.goalProgress[id] || '进行中'),
    inventory: session.inventory,
    relationships: buildRelationshipLines(session, resolveName),
    recentEvents: session.recentEvents.slice(-3),
    scene: session.currentScene || session.definition.openingScene || '尚未确定',
    tasks: buildEntryLines(session.definition.tasks, (id) => (
      TASK_STATUS_LABELS[session.taskStatuses[id] || 'pending'] || '进行中'
    )),
    time: session.currentTime || session.definition.initialTime || '故事开场',
  };
}
