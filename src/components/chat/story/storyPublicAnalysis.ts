import type {
  StorySessionState,
  StoryTurnPublicAnalysis,
} from './storyTypes';

const MAX_PUBLIC_ANALYSIS_LENGTH = 600;
const INTERNAL_CONTENT_PATTERN = /系统提示|开发者消息|导演 JSON|导演数据|隐藏思维链|内部推理|推理过程|原始 Prompt|narrativeBeats|statePatch|```/i;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function cleanPublicAnalysisText(value: unknown) {
  if (typeof value !== 'string') return '';
  const normalized = value.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized || INTERNAL_CONTENT_PATTERN.test(normalized)) return '';
  return normalized.slice(0, MAX_PUBLIC_ANALYSIS_LENGTH);
}

export function createFallbackStoryPublicAnalysis(
  session: StorySessionState,
  userInput = '',
): StoryTurnPublicAnalysis {
  const request = cleanPublicAnalysisText(userInput);
  const scene = session.currentScene || session.definition.openingScene || '当前场景';
  return {
    characterPlan: '让当前出场角色依据既有人格、关系、知识和状态作出反应，不提前使用未出场角色。',
    outputPlan: '按环境与时间、行动结果、角色反应和自然对白的因果顺序组织正文，并把下一步选择留给用户。',
    plotPlan: `从${scene}承接本轮行动，只推进有事件依据的目标、任务和状态变化。`,
    requestUnderstanding: request
      ? `结合已有剧情承接用户本轮要求“${request.slice(0, 160)}”。`
      : '结合已有剧情、当前状态和用户本轮要求继续推进。',
  };
}

export function normalizeStoryPublicAnalysis(
  value: unknown,
  fallback: StoryTurnPublicAnalysis,
): StoryTurnPublicAnalysis {
  const candidate = record(value);
  return {
    characterPlan: cleanPublicAnalysisText(candidate.characterPlan) || fallback.characterPlan,
    outputPlan: cleanPublicAnalysisText(candidate.outputPlan) || fallback.outputPlan,
    plotPlan: cleanPublicAnalysisText(candidate.plotPlan) || fallback.plotPlan,
    requestUnderstanding: cleanPublicAnalysisText(candidate.requestUnderstanding)
      || fallback.requestUnderstanding,
  };
}

export function formatStoryPublicAnalysis(analysis: StoryTurnPublicAnalysis) {
  return [
    `本轮要求理解：${analysis.requestUnderstanding}`,
    `角色与关系安排：${analysis.characterPlan}`,
    `剧情、场景与时间：${analysis.plotPlan}`,
    `正文输出方式：${analysis.outputPlan}`,
  ].join('\n');
}
