import { hasExplicitStoryMovementRequest } from './storyExplicitActionIntent';
import type {
  StorySessionState,
  StoryStatePatch,
  StoryTurnPacingMode,
  StoryTurnPlan,
} from './storyTypes';

const INCOMPLETE_HELP_REQUEST_PATTERNS = [
  /^(?:你)?(?:能|可以|可不可以|能不能|愿意)?帮(?:帮)?(?:我)?(?:一个|个)?忙(?:吗|嘛|么|吧)?[?？。！!~～]*$/u,
  /^(?:我想|我能|我可以|可以|能不能)?请你帮(?:我)?(?:一个|个)?忙(?:吗|嘛|么|可以吗|行吗|好吗)?[?？。！!~～]*$/u,
  /^有(?:一件|件)事(?:想|要)?请你帮忙(?:吗|嘛|么|可以吗|行吗)?[?？。！!~～]*$/u,
];

const RESPONSE_SUGGESTIONS = [
  '直接说明希望对方帮忙的具体事情。',
  '先解释为什么需要对方的帮助。',
  '暂时保留细节，只说明这件事与当前异常有关。',
];

function emptyStatePatch(): StoryStatePatch {
  return {
    characterUpdates: [], events: [], goalUpdates: [], inventoryAdd: [],
    inventoryRemove: [], relationshipUpdates: [], taskUpdates: [],
  };
}

export function isIncompleteStoryHelpRequest(userInput: string) {
  const normalized = userInput.trim().replace(/\s+/gu, '');
  return INCOMPLETE_HELP_REQUEST_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function buildStoryTurnSemanticGuidance(userInput: string) {
  const detected = isIncompleteStoryHelpRequest(userInput)
    ? '本轮是尚未说明具体内容的帮忙请求，必须使用回应型回合。' : '';
  return [
    '先识别用户输入是对白、提问、请求、回答、选择、行动还是混合表达，并明确请求者、目标对象和请求内容。',
    '回应型回合：维持故事世界、旁白和角色状态，直接回应用户；不强行制造转场、线索、任务或重大事件。',
    '普通推进回合：用户已经给出可执行行动或完整意图，本轮落实该行动及自然结果；一个步骤可以包含离开、途中、到达，不能把明确选择拆成反复确认。',
    '关键推进回合：只有现有剧情条件确实触发登场、转场、任务变化或重大事件时使用。',
    '用户请求尚未说明具体内容时，角色只能在当前世界中回应并追问，不能猜测请求内容，也不能把被请求者写成向用户派任务的人。',
    detected,
  ].filter(Boolean).join('\n');
}

export function normalizeStoryTurnPacingMode(
  value: unknown,
  userInput: string,
): StoryTurnPacingMode {
  if (isIncompleteStoryHelpRequest(userInput)) return 'response';
  if (hasExplicitStoryMovementRequest(userInput)) return value === 'event' ? 'event' : 'progression';
  return value === 'response' || value === 'event' ? value : 'progression';
}

function enforceIncompleteRequest(
  plan: StoryTurnPlan,
  session: StorySessionState,
): StoryTurnPlan {
  const narrativeBeats = plan.activeSpeakerIds.map((participantId) => ({
    action: '听见用户的请求后停下当前动作，留在原处等待具体内容。',
    innerState: '先确认用户需要什么，不猜测尚未说出的请求。',
    participantId,
    visibleCue: '注意力回到用户身上，作出符合当前人格与情绪的自然反应。',
  }));
  return {
    ...plan,
    actionResult: '你的帮忙请求内容尚未说明，当前角色需要先回应并确认你希望得到什么帮助。',
    elapsedMinutes: 0,
    enteringParticipantIds: [],
    leavingParticipantIds: [],
    mediaHint: '',
    narrativeBeats,
    narrationFocus: '延续当前场景氛围，以旁白承载角色动作，并让角色直接回应和追问具体事项。',
    pacingMode: 'response',
    publicAnalysis: {
      characterPlan: '让当前出场角色依据人格和状态回应用户，并等待用户说明具体请求。',
      outputPlan: '保留小说式旁白、角色动作与自然对白，不脱离故事世界，也不替用户补写请求。',
      plotPlan: '保持当前时间与场景，不新增线索、任务、转场或人物登场。',
      requestUnderstanding: '用户正在请求当前角色提供帮助，但尚未说明需要帮助的具体事情。',
    },
    sceneTransition: {
      changed: false, from: session.currentScene, process: '', reason: '', to: session.currentScene,
    },
    statePatch: emptyStatePatch(),
    suggestedActions: RESPONSE_SUGGESTIONS,
  };
}

function limitResponsePacing(plan: StoryTurnPlan, session: StorySessionState): StoryTurnPlan {
  return {
    ...plan,
    elapsedMinutes: Math.min(plan.elapsedMinutes, 1),
    enteringParticipantIds: [],
    leavingParticipantIds: [],
    sceneTransition: {
      changed: false, from: session.currentScene, process: '', reason: '', to: session.currentScene,
    },
    statePatch: {
      ...emptyStatePatch(),
      characterUpdates: plan.statePatch.characterUpdates,
      relationshipUpdates: plan.statePatch.relationshipUpdates,
    },
  };
}

export function enforceStoryTurnSemantics(
  plan: StoryTurnPlan,
  session: StorySessionState,
  userInput: string,
) {
  if (isIncompleteStoryHelpRequest(userInput)) return enforceIncompleteRequest(plan, session);
  return plan.pacingMode === 'response' ? limitResponsePacing(plan, session) : plan;
}
