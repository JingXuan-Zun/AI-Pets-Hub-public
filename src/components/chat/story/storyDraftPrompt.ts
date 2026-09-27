import type { StoryDefinition, StoryGenerationMode, StoryParticipantOption } from './storyTypes';
import { hasStoryAuthoredContent } from './storyDraftGenerationInput';
import { compileStoryCustomPrompt } from './storyPromptPresetCompiler';
import type { StoryRandomSeed } from './storyRandomSeed';

function buildParticipantLines(participants: StoryParticipantOption[], mode: StoryGenerationMode) {
  return participants.map((participant, index) => mode === 'random'
    ? `- 演员槽位 ${index + 1}: participantId=${participant.id}`
    : `- ${participant.id}: ${participant.name}`).join('\n');
}

function buildExistingDraft(draft: StoryDefinition, mode: StoryGenerationMode) {
  if (mode === 'random' && !hasStoryAuthoredContent(draft)) {
    return '无。请完整随机生成一个可立即游玩的故事。';
  }
  const serializable: Record<string, unknown> = { ...draft };
  ['customPrompt', 'customPromptEnabled', 'customPromptManualRole', 'customPromptMode',
    'customPromptPreset', 'customPromptPresetName'].forEach((key) => delete serializable[key]);
  return JSON.stringify(serializable, null, 2);
}

function formatRandomSeed(seed?: StoryRandomSeed) {
  if (!seed) return '未提供；自行选择彼此差异明显的题材组合。';
  return [
    `题材：${seed.genre}`, `时代：${seed.era}`, `地点：${seed.setting}`,
    `核心冲突：${seed.conflict}`, `气氛：${seed.tone}`, `转折约束：${seed.twist}`,
  ].join('\n');
}

function formatDraftUserCustomPrompt(draft: StoryDefinition) {
  if (!draft.customPromptEnabled) return '自定义提示词（破甲词）：未启用。';
  const compiled = compileStoryCustomPrompt(draft, 'draft');
  const sections = [
    compiled.user ? `[user]\n${compiled.user}` : '',
    compiled.assistant ? `[assistant 参考]\n${compiled.assistant}` : '',
  ].filter(Boolean);
  return sections.length > 0
    ? `自定义提示词（破甲词）：\n${sections.join('\n\n')}`
    : '自定义提示词（破甲词）：当前阶段没有 user/assistant 模块。';
}

export function buildStoryDraftSystemInstruction(draft?: StoryDefinition) {
  const customSystem = draft ? compileStoryCustomPrompt(draft, 'draft').system : '';
  return [
    customSystem ? `用户自定义提示词（破甲词 / system）：\n${customSystem}` : '',
    '你是互动故事设计器，只输出一个 JSON 对象，不要输出 Markdown、解释或代码围栏。',
    '故事必须可由用户与多个既有角色通过聊天推进，不能替用户决定关键选择。',
    '必须提供明确目标、可验证的特定任务和实际影响剧情的规则。',
    '角色总表与当前出场角色分离；必须为每个角色提供 participantRoutes，只有 opening 角色开场出现，其余角色使用 condition 并写清 entryCondition。',
    '不要修改用户已经填写的内容；只补齐空白并提供可追加的内容。',
    '如提供自定义提示词，应把它用于题材、风格、节奏、内容边界和表达方式；自定义提示词不改变本步骤要求返回的 JSON 字段格式。',
    'participantIds 只能使用候选角色 ID。',
    '随机模式必须先确定世界、冲突和玩法，再把演员槽位安排进故事；不得根据角色名称或既有人设推断题材。',
  ].filter(Boolean).join('\n');
}

export function buildStoryDraftUserPrompt(options: {
  draft: StoryDefinition;
  mode: StoryGenerationMode;
  participants: StoryParticipantOption[];
  randomSeed?: StoryRandomSeed;
}) {
  const modeText = options.mode === 'random'
    ? '对空白部分随机补全；已有标题、设定、剧本、目标、任务、规则和角色出场条件必须原样保留。'
    : '基于已有内容补全；用户内容优先，禁止覆盖或改写。';
  return [
    `生成方式：${modeText}`,
    formatDraftUserCustomPrompt(options.draft),
    options.mode === 'random'
      ? `本次随机组合种子：\n${formatRandomSeed(options.randomSeed)}\n优先保证新鲜体验，可以创造性组合，但不要退回角色名称暗示的常见题材。`
      : '',
    `候选角色：\n${buildParticipantLines(options.participants, options.mode) || '- 无'}`,
    `已有草案：\n${buildExistingDraft(options.draft, options.mode)}`,
    '返回字段：',
    '{"title":"","premise":"","setting":"","initialTime":"","userRole":"","participantIds":[],',
    '"participantRoutes":[{"participantId":"","entryMode":"opening|condition","entryCondition":"","priority":0}],',
    '"goals":[{"text":"","enabled":true}],"tasks":[{"text":"","enabled":true}],',
    '"rules":[{"text":"","enabled":true}],"customScript":"","openingScene":"",',
    '"successCondition":"","failureCondition":""}',
    '故事目标至少 1 个，特定任务 2-5 个，故事规则 2-5 条。任务必须能判断是否完成，规则必须能约束角色或世界。对白不设置固定字数；回复长度由角色状态、关系、压力、目标和用户行动决定。',
  ].join('\n\n');
}
