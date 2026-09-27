import type { StoryEntry, StorySessionState } from './storyTypes';
import { compileStoryCustomPrompt, formatCompiledStoryPrompt } from './storyPromptPresetCompiler';
import type { StoryPromptStage } from './storyPromptPresetTypes';

const TASK_STATUS_LABELS: Record<string, string> = {
  completed: '已完成',
  failed: '失败',
  pending: '进行中',
  skipped: '已跳过',
};

function buildEntrySection(
  label: string,
  enabled: boolean,
  entries: StoryEntry[],
  resolveState?: (id: string) => string,
) {
  if (!enabled) return `${label}：本故事未启用。`;
  const activeEntries = entries.filter((entry) => entry.enabled && entry.text.trim());
  if (activeEntries.length === 0) return `${label}：未设置。`;
  const lines = activeEntries.map((entry, index) => {
    const state = resolveState?.(entry.id);
    return `${index + 1}. ${entry.text}${state ? ` [${state}]` : ''}`;
  });
  return `${label}：\n${lines.join('\n')}`;
}

function buildCustomPromptSection(session: StorySessionState, stage: StoryPromptStage) {
  if (!session.definition.customPromptEnabled) return '自定义提示词（破甲词）：未启用。';
  const normalized = formatCompiledStoryPrompt(
    compileStoryCustomPrompt(session.definition, stage),
  );
  if (!normalized) return '自定义提示词（破甲词）：未设置可用于当前阶段的模块。';
  return [
    '自定义提示词（破甲词）：',
    normalized,
  ].join('\n');
}

export function buildStoryDefinitionPromptContext(
  session: StorySessionState,
  options: { includeCustomPrompt?: boolean; stage?: StoryPromptStage } = {},
) {
  const story = session.definition;
  return [
    options.includeCustomPrompt === false
      ? '' : buildCustomPromptSection(session, options.stage ?? 'director'),
    buildEntrySection('故事目标', story.sections.goals, story.goals, (id) => (
      session.goalProgress[id] || '未开始'
    )),
    buildEntrySection('特定任务', story.sections.tasks, story.tasks, (id) => (
      TASK_STATUS_LABELS[session.taskStatuses[id] || 'pending'] || '进行中'
    )),
    buildEntrySection('故事规则', story.sections.rules, story.rules),
    `成功条件：${story.successCondition || '完成主要目标与任务'}`,
    `失败条件：${story.failureCondition || '未设置明确失败条件'}`,
    `用户剧本（必须优先遵守）：\n${story.customScript || '无'}`,
  ].filter(Boolean).join('\n');
}
