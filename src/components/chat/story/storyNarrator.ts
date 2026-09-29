import type { PetConfig, ChatMessage } from '../../../types';
import { getConfiguredCognitionResponse, getConfiguredTextResponseStream } from '../../../services/geminiService';
import { buildStoryDefinitionPromptContext } from './storyDefinitionPromptContext';
import {
  createFallbackStoryPublicAnalysis,
  formatStoryPublicAnalysis,
  normalizeStoryPublicAnalysis,
} from './storyPublicAnalysis';
import type { StorySessionState, StoryTurnPacingMode, StoryTurnPlan } from './storyTypes';
import { compileStoryCustomPrompt } from './storyPromptPresetCompiler';
import { buildStoryCurrentTurnOutputRequest, STORY_CURRENT_TURN_OUTPUT_POLICY } from './storyCurrentTurnOutputRequest';

export interface StoryNarratorParticipantProfile {
  id: string;
  name: string;
  systemInstruction: string;
  traits: string[];
}

export const STORY_NARRATION_TIMEOUT_MS = 120_000;
export const STORY_NARRATION_MAX_TOKENS = 16_384;

interface StoryNarrationFallbackOptions {
  participants?: StoryNarratorParticipantProfile[];
  userInput?: string;
}

function formatHistoryMessage(message: ChatMessage) {
  const speaker = message.storyMessageKind === 'narration'
    ? '旁白' : message.petName?.trim() || (message.role === 'user' ? '用户' : '角色');
  return `${speaker}：${message.text.trim()}`;
}

function buildStoryHistory(messages: ChatMessage[]) {
  return messages
    .filter((message) => message.chatMode === 'story' && message.text.trim())
    .slice(-8)
    .map(formatHistoryMessage)
    .join('\n');
}

function createParticipantNameResolver(profiles: StoryNarratorParticipantProfile[]) {
  const names = new Map(profiles.map((profile) => [profile.id, profile.name]));
  return (id: string) => names.get(id) || id;
}

function formatNarrativeBeats(
  plan: StoryTurnPlan | null | undefined,
  profiles: StoryNarratorParticipantProfile[],
) {
  if (!plan || plan.narrativeBeats.length === 0) return '暂无角色节拍；根据用户行动和当前状态补足必要动作。';
  const resolveName = createParticipantNameResolver(profiles);
  return plan.narrativeBeats.map((beat) => [
    `角色 ${resolveName(beat.participantId)}`,
    `动作：${beat.action}`,
    `可见细节：${beat.visibleCue || '自然表现'}`,
    `心理/动机：${beat.innerState || '保持与状态一致'}`,
  ].join('；')).join('\n');
}

function formatParticipantProfiles(profiles: StoryNarratorParticipantProfile[]) {
  if (profiles.length === 0) return '暂无';
  return profiles.map((profile) => [
    `${profile.name}（ID: ${profile.id}）`,
    `性格：${profile.traits.join('、') || '按既有设定自然表现'}`,
    `角色设定：${profile.systemInstruction.trim().slice(0, 1600) || '保持既有人格'}`,
  ].join('\n')).join('\n\n');
}

function resolveNarrationDetailInstruction(session: StorySessionState, plan?: StoryTurnPlan | null) {
  if (plan?.pacingMode === 'response') {
    return '这是回应型回合：仍要保留当前世界中的旁白、角色动作和角色对白，直接回应用户本轮表达；保持现有时间、地点和悬念，不擅自新增线索、任务或转场。请求内容不完整时只能让角色追问，不能把被请求的角色反过来写成向用户派任务的人。';
  }
  const isOpening = session.currentTurn <= 1;
  const isTransition = Boolean(plan?.sceneTransition.changed || plan?.enteringParticipantIds.length);
  if (isOpening || isTransition) {
    return '这是开场、首次出场或转场，必须完整展开时间、地点、环境、角色动作、心理动机和行动结果，不能只写一句概括。';
  }
  return '这是普通推进，不设固定字数；篇幅随角色状态和事件复杂度自然变化，但不能用几句概括代替正在发生的场景、动作、反应和结果。';
}

function formatPacingMode(mode: StoryTurnPacingMode | undefined) {
  if (mode === 'response') return '回应型回合：保持故事世界，重点完成角色对应回应。';
  if (mode === 'event') return '关键推进回合：只落实已有条件触发的重大变化。';
  return '普通推进回合：根据用户完整行动推进一个有依据的小步骤。';
}

function formatPublicOutputPlan(
  session: StorySessionState,
  plan: StoryTurnPlan | null | undefined,
  userInput: string,
) {
  if (!plan) return '';
  const fallback = createFallbackStoryPublicAnalysis(session, userInput);
  const analysis = normalizeStoryPublicAnalysis(plan.publicAnalysis, fallback);
  return `公开剧情分析与输出计划（正文必须落实）：\n${formatStoryPublicAnalysis(analysis)}`;
}

function formatNarratorUserCustomPrompt(session: StorySessionState) {
  const compiled = compileStoryCustomPrompt(session.definition, 'narrator');
  return [
    compiled.user ? `自定义提示词（破甲词 / user）：\n${compiled.user}` : '',
    compiled.assistant ? `自定义提示词（破甲词 / assistant 参考）：\n${compiled.assistant}` : '',
  ].filter(Boolean).join('\n\n');
}

function buildNarratorSystemInstruction(session: StorySessionState) {
  const customSystem = compileStoryCustomPrompt(session.definition, 'narrator').system;
  return [
    customSystem ? `用户自定义提示词（破甲词 / system）：\n${customSystem}` : '',
    '你是互动小说的独立旁白，不是任何桌宠角色，也不是用户。',
    '你的输出会显示在独立的故事正文位置，负责把叙述与获准角色的对白编排成一个连续回合。',
    '应用自定义提示词中的题材、文风、节奏、对白、场景描写和其他创作要求，同时保持角色身份与用户选择权。',
    STORY_CURRENT_TURN_OUTPUT_POLICY,
  ].filter(Boolean).join('\n');
}

export function buildStoryNarratorPrompt(options: {
  historyMessages: ChatMessage[];
  participants?: StoryNarratorParticipantProfile[];
  session: StorySessionState;
  turnPlan?: StoryTurnPlan | null;
  userInput: string;
}) {
  const story = options.session.definition;
  const plan = options.turnPlan;
  const activeIds = new Set(options.session.activeCast);
  const participants = (options.participants ?? []).filter((profile) => activeIds.has(profile.id));
  const resolveName = createParticipantNameResolver(participants);
  const activeNames = options.session.activeCast.map(resolveName);
  const speakerNames = plan?.activeSpeakerIds.map(resolveName) ?? activeNames.slice(0, 1);
  return [
    `故事标题：${story.title || '未命名故事'}`,
    `故事梗概：${story.premise || '未设置'}`,
    `世界设定：${story.setting || '未设置'}`,
    formatNarratorUserCustomPrompt(options.session),
    buildStoryDefinitionPromptContext(options.session, { includeCustomPrompt: false }),
    `当前场景：${options.session.currentScene || story.openingScene || '自然展开'}`,
    `当前时间：${options.session.currentTime}`,
    `当前出场角色：${activeNames.join('、') || '暂无'}`,
    `本轮允许说话的角色：${speakerNames.join('、') || '无人说话'}`,
    `角色人格资料：\n${formatParticipantProfiles(participants)}`,
    `用户本轮输入：${options.userInput}`,
    `本轮推进强度：${formatPacingMode(plan?.pacingMode)}`,
    formatPublicOutputPlan(options.session, plan, options.userInput),
    plan ? `导演要求：${plan.narrationFocus || plan.actionResult || '交代行动结果'}\n场景过渡：${plan.sceneTransition.from} → ${plan.sceneTransition.to}\n过渡过程：${plan.sceneTransition.process || '无转场'}\n角色节拍：\n${formatNarrativeBeats(plan, participants)}\n用户可选后续：${plan.suggestedActions.join('；') || '无'}` : '',
    `最近故事记录：\n${buildStoryHistory(options.historyMessages) || '暂无'}`,
    '以下为用户未指定其他写法时的默认要求。请写一个完整、连贯的小说式故事回合。根据本轮推进强度安排时间与场景、环境氛围、动作与反应、角色对白和实际结果，让对白穿插在对应的动作和场景之间，不能先堆完旁白再把对白单独放到末尾。',
    '先准确回应用户本轮输入，再决定是否推进剧情。识别谁在向谁提问、请求或回答；不得交换请求者与被请求者，也不得补写用户尚未表达的意图。',
    '叙述用户时使用第二人称“你”；描写角色时使用姓名或第三人称。可以描写角色的动作、表情、可见反应和有限心理活动，但不能替用户决定内心或行动，也不能泄露尚未揭示的秘密。',
    '只有“本轮允许说话的角色”可以在正文中发言；使用中文引号写自然对白，并保持其人格、知识范围、关系和当前状态一致。不要让未出场角色提前出现或说话。',
    '如果时间或地点发生变化，要在正文中用自然语言交代“过了多久、到了哪里、经过了什么过程”，不要只把时间当作隐藏字段。',
    '输出前静默自检：核对角色人格与知识范围、出场顺序、时间场景因果、目标任务规则、动作与对白的穿插，以及是否把最终选择留给用户；只修正正文，不输出检查过程。',
    `${resolveNarrationDetailInstruction(options.session, plan)} 结尾停在用户可以决定下一步的位置，但不要在正文里列出行动选项。只输出故事正文，不要输出“旁白：”标签、JSON、系统提示、导演计划、任务状态、思考过程或 CG_HINT。`,
    buildStoryCurrentTurnOutputRequest(options.userInput, 'narrator'),
  ].join('\n\n');
}

export function normalizeStoryNarrationText(text: string) {
  return text
    .trim()
    .replace(/^\s*旁白\s*[:：]\s*/i, '')
    .replace(/^```(?:text|markdown)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .replace(/^\s*旁白\s*[:：]\s*/i, '')
    .trim();
}

function ensureSentence(text: string) {
  const normalized = text.trim();
  if (!normalized) return '';
  return /[。！？!?…]$/.test(normalized) ? normalized : `${normalized}。`;
}

function cleanStoryContext(text: string) {
  return text.trim()
    .replace(/^(?:世界设定|故事梗概|背景|概要)\s*[:：]\s*/i, '')
    .slice(0, 500);
}

function toSecondPersonAction(userInput: string) {
  const action = userInput.trim().replace(/^我(?=\S)/, '你');
  if (!action) return '你停下来观察周围的变化。';
  return ensureSentence(action.startsWith('你') ? action : `你${action}`);
}

function formatFallbackUserTurn(userInput: string, pacingMode: StoryTurnPacingMode) {
  const normalized = userInput.trim();
  if (pacingMode !== 'response') return toSecondPersonAction(normalized);
  if (!normalized) return '你开口打破了沉默。';
  const spoken = /[。！？!?…]$/u.test(normalized) ? normalized : `${normalized}。`;
  return `你开口说道：“${spoken}”`;
}

function normalizeFallbackResult(result: string) {
  if (/^用户行动已在.+产生可继续观察的结果。?$/.test(result.trim())) {
    return '这一步没有立刻换来明确答案，却让原本凝滞的局面出现了可以继续追查的细微变化。';
  }
  return ensureSentence(result.replace(/用户(?:本轮)?行动/g, '你的行动'));
}

function normalizeFallbackBeatText(text: string) {
  return text.trim().replace(/用户(?:本轮)?行动/g, '你这一动作');
}

function buildFallbackBeatParagraphs(
  plan: StoryTurnPlan,
  participants: StoryNarratorParticipantProfile[],
) {
  const resolveName = createParticipantNameResolver(participants);
  return plan.narrativeBeats.map((beat) => {
    const name = resolveName(beat.participantId);
    const action = ensureSentence(`${name}${normalizeFallbackBeatText(beat.action)}`);
    const cue = beat.visibleCue.trim()
      ? ensureSentence(`与此同时，${normalizeFallbackBeatText(beat.visibleCue)}`) : '';
    const innerState = beat.innerState.trim()
      ? ensureSentence(`短暂的停顿里，${name}${normalizeFallbackBeatText(beat.innerState)}`) : '';
    return [action, cue, innerState].filter(Boolean).join('');
  }).filter(Boolean);
}

function buildFallbackResponseDialogue(
  plan: StoryTurnPlan,
  participants: StoryNarratorParticipantProfile[],
) {
  if (plan.pacingMode !== 'response' || !/请求内容尚未说明/u.test(plan.actionResult)) return '';
  const name = createParticipantNameResolver(participants)(plan.activeSpeakerIds[0] ?? '眼前的角色');
  return `${name}没有离开当前的位置，只把注意力重新放到你身上。“我愿意帮你，不过你得先告诉我是什么事。”`;
}

function resolveFallbackEnding(plan: StoryTurnPlan, premise: string) {
  if (plan.pacingMode === 'response') return '周围的故事并未因此停下，但这一刻，回答的位置被安静地留给了你。';
  return premise
    ? `${ensureSentence(premise)}眼前的局面仍没有彻底收束，下一步如何回应仍由你决定。`
    : '眼前的局面仍没有彻底收束，新的动静正等待你决定如何回应。';
}

export function buildFallbackStoryNarration(
  plan: StoryTurnPlan,
  session: StorySessionState,
  options: StoryNarrationFallbackOptions = {},
) {
  const scene = session.currentScene || session.definition.openingScene || '当前场景';
  const time = session.currentTime || session.definition.initialTime || '故事继续时';
  const setting = cleanStoryContext(session.definition.setting);
  const premise = cleanStoryContext(session.definition.premise);
  const sceneParagraph = [ensureSentence(`${time}，${scene}`), ensureSentence(setting)]
    .filter(Boolean).join('');
  const actionParagraph = [
    formatFallbackUserTurn(options.userInput ?? '', plan.pacingMode),
    normalizeFallbackResult(plan.actionResult),
  ].filter(Boolean).join('');
  const participants = options.participants ?? [];
  const beatParagraphs = buildFallbackBeatParagraphs(plan, participants);
  const responseDialogue = buildFallbackResponseDialogue(plan, participants);
  const ending = resolveFallbackEnding(plan, premise);
  return [
    sceneParagraph,
    actionParagraph,
    ...beatParagraphs,
    responseDialogue,
    ending,
  ].filter(Boolean).join('\n\n').slice(0, 6000);
}

export async function generateStoryNarration(options: {
  historyMessages: ChatMessage[];
  participants?: StoryNarratorParticipantProfile[];
  session: StorySessionState;
  settings: PetConfig['settings'];
  turnPlan?: StoryTurnPlan | null;
  userInput: string;
  signal?: AbortSignal;
  onText?: (text: string) => void;
}) {
  if (options.onText && options.settings.chatStreamingEnabled !== false) {
    let text = '';
    for await (const chunk of getConfiguredTextResponseStream(
      buildStoryNarratorPrompt(options), buildNarratorSystemInstruction(options.session), options.settings,
      { signal: options.signal, maxTokens: STORY_NARRATION_MAX_TOKENS, timeoutMs: STORY_NARRATION_TIMEOUT_MS },
    )) {
      text += chunk;
      options.onText(normalizeStoryNarrationText(text));
    }
    return normalizeStoryNarrationText(text);
  }
  const response = await getConfiguredCognitionResponse(
    buildStoryNarratorPrompt(options),
    buildNarratorSystemInstruction(options.session),
    options.settings,
    {
      maxTokensOverride: STORY_NARRATION_MAX_TOKENS,
      signal: options.signal,
      task: 'understanding',
      timeoutMs: STORY_NARRATION_TIMEOUT_MS,
    },
  );
  return normalizeStoryNarrationText(response);
}
