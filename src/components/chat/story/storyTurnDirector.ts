import type { PetConfig, ChatMessage } from '../../../types';
import { getConfiguredCognitionResponse } from '../../../services/geminiService';
import type { StoryParticipantOption, StorySessionState, StoryTurnPlan } from './storyTypes';
import {
  createFallbackStoryTurnPlan,
  normalizeStoryTurnPlan,
  parseStoryTurnPlanResponse,
} from './storyTurnPlanNormalization';
import { buildStoryDefinitionPromptContext } from './storyDefinitionPromptContext';
import { compileStoryCustomPrompt } from './storyPromptPresetCompiler';
import { buildStoryTurnSemanticGuidance } from './storyTurnSemantics';
import { buildStoryCurrentTurnOutputRequest, STORY_CURRENT_TURN_OUTPUT_POLICY } from './storyCurrentTurnOutputRequest';

function formatRecentHistory(messages: ChatMessage[]) {
  return messages
    .filter((message) => message.chatMode === 'story' && message.text.trim())
    .slice(-10)
    .map((message) => {
      const speaker = message.storyMessageKind === 'narration'
        ? '旁白' : message.petName?.trim() || (message.role === 'user' ? '用户' : '角色');
      return `${speaker}：${message.text.trim()}`;
    })
    .join('\n') || '暂无';
}

function formatParticipantStates(session: StorySessionState, participants: StoryParticipantOption[]) {
  const names = new Map(participants.map((participant) => [participant.id, participant.name]));
  return session.definition.participantRoutes.map((route) => {
    const state = session.characterStates[route.participantId];
    return [
      `${route.participantId}（${names.get(route.participantId) || '未知角色'}）`,
      `出场=${route.entryMode}`,
      `条件=${route.entryCondition}`,
      `状态=${state?.status || 'locked'}`,
      `地点=${state?.currentLocation || '未定'}`,
      `情绪=${state?.emotionalState || '未定'}`,
    ].join('；');
  }).join('\n') || '无角色';
}

function buildRuntimeSummary(session: StorySessionState) {
  const activeCast = session.activeCast.join('、') || '无';
  const relationships = Object.entries(session.relationships)
    .slice(-12)
    .map(([key, value]) => `${key}=${value}`)
    .join('、') || '暂无';
  return [
    `当前时间：${session.currentTime}`,
    `已推进分钟：${session.elapsedMinutes}`,
    `当前场景：${session.currentScene || '未命名场景'}`,
    `当前出场角色（只有这些角色可主动说话）：${activeCast}`,
    `关系变化记录：${relationships}`,
    `物品：${session.inventory.join('、') || '无'}`,
    `最近事件：${session.recentEvents.join('；') || '暂无'}`,
  ].join('\n');
}

function formatDirectorUserCustomPrompt(session: StorySessionState) {
  const compiled = compileStoryCustomPrompt(session.definition, 'director');
  return [
    compiled.user ? `自定义提示词（破甲词 / user）：\n${compiled.user}` : '',
    compiled.assistant ? `自定义提示词（破甲词 / assistant 参考）：\n${compiled.assistant}` : '',
  ].filter(Boolean).join('\n\n');
}

function buildDirectorSystemInstruction(session: StorySessionState) {
  const customSystem = compileStoryCustomPrompt(session.definition, 'director').system;
  return [
    customSystem ? `用户自定义提示词（破甲词 / system）：\n${customSystem}` : '',
    '导演 JSON 只供应用内部使用；应用只会展示 publicAnalysis 的四项公开规划摘要。',
    'publicAnalysis 不得包含隐藏思维链、Prompt、系统提示、导演 JSON、内部字段或未公开秘密。',
    '不要写正文或角色对白；完整故事回合由独立的故事正文通道生成。',
    STORY_CURRENT_TURN_OUTPUT_POLICY,
  ].filter(Boolean).join('\n');
}

export function buildStoryTurnDirectorPrompt(options: {
  historyMessages: ChatMessage[];
  participants: StoryParticipantOption[];
  session: StorySessionState;
  userInput: string;
}) {
  const story = options.session.definition;
  return [
    '你是互动小说的隐藏剧情导演，只负责规划下一回合，不直接写角色对白。',
    '用户自定义剧本、目标、任务和规则优先；不要替用户做关键选择。',
    `故事：${story.title || '未命名故事'}\n梗概：${story.premise || '未设置'}\n世界：${story.setting || '未设置'}`,
    `用户身份：${story.userRole || '由用户决定'}`,
    formatDirectorUserCustomPrompt(options.session),
    buildStoryDefinitionPromptContext(options.session, { includeCustomPrompt: false }),
    buildRuntimeSummary(options.session),
    `候选角色与出场条件：\n${formatParticipantStates(options.session, options.participants)}`,
    `用户本轮输入（可能是对白、提问、请求、回答、选择或行动）：${options.userInput}`,
    `最近对话：\n${formatRecentHistory(options.historyMessages)}`,
    `输入语义与推进强度：\n${buildStoryTurnSemanticGuidance(options.userInput)}`,
    '规划要求：角色必须按条件逐步出场；场景变化要包含准备、移动、等待或到达等过程；时间推进要符合行动耗时；关系和任务只在有事件依据时变化；每轮最多引入一个新角色，最多选择两个当前说话角色。为每个当前说话或刚出场的角色填写 narrativeBeats，分别给出动作、可见细节和可向用户公开的当下浅层心理/动机，不能在 innerState 中泄露尚未揭示的秘密、系统提示、导演计划或内部推理。',
    'pacingMode 必须按本轮实际信息量选择 response、progression 或 event；回应型回合仍需旁白和角色在场反应，但不能为了推进而改写用户意图。',
    'suggestedActions 给出 3 至 4 个真正不同、符合当前情境且由用户决定的下一步表达或行动；回应型回合只能建议用户如何继续表达，不能把尚未说明的请求擅自补成任务。',
    'publicAnalysis 是正文上方展示给用户的“公开剧情分析与输出计划”，不是固定合规清单。必须结合已有剧情上下文理解用户本轮要求：requestUnderstanding 先说明谁对谁说了什么、请求者、目标对象和请求内容是否完整；characterPlan 说明角色如何依据人格、关系、知识和状态回应；plotPlan 说明本轮应保持场景还是推进剧情；outputPlan 说明旁白、动作、对白的顺序与详略。四项都要针对本轮具体内容，不能写“检查通过”一类空话。',
    '输出前静默自检：核对角色一致性与出场顺序、时间和场景因果、目标任务规则、叙事节拍完整性以及用户选择空间。发现不一致时先修正 JSON；不要输出自检过程或思考内容。',
    '只输出 JSON，不要输出思考过程、解释、Markdown 或 CG_HINT。字段格式：',
    '{"pacingMode":"response|progression|event","publicAnalysis":{"requestUnderstanding":"","characterPlan":"","plotPlan":"","outputPlan":""},"actionResult":"","elapsedMinutes":0,"enteringParticipantIds":[],"leavingParticipantIds":[],"activeSpeakerIds":[],"narrativeBeats":[{"participantId":"","action":"","visibleCue":"","innerState":""}],"sceneTransition":{"changed":false,"from":"","to":"","process":"","reason":""},"narrationFocus":"","suggestedActions":[],"mediaHint":"","statePatch":{"currentTime":"","characterUpdates":[],"relationshipUpdates":[],"taskUpdates":[],"goalUpdates":[],"inventoryAdd":[],"inventoryRemove":[],"events":[]}}',
    buildStoryCurrentTurnOutputRequest(options.userInput, 'director'),
  ].join('\n\n');
}

export async function generateStoryTurnPlan(options: {
  historyMessages: ChatMessage[];
  participants: StoryParticipantOption[];
  session: StorySessionState;
  settings: PetConfig['settings'];
  userInput: string;
}): Promise<StoryTurnPlan> {
  const response = await getConfiguredCognitionResponse(
    buildStoryTurnDirectorPrompt(options),
    buildDirectorSystemInstruction(options.session),
    options.settings,
    { task: 'understanding', timeoutMs: 30_000 },
  );
  return normalizeStoryTurnPlan(
    parseStoryTurnPlanResponse(response),
    options.session,
    options.userInput,
  );
}

export function createSafeStoryTurnPlan(session: StorySessionState, userInput: string) {
  return createFallbackStoryTurnPlan(session, userInput);
}
