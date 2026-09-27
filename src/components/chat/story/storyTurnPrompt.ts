import { buildStoryDefinitionPromptContext } from './storyDefinitionPromptContext';
import { buildStoryCurrentTurnOutputRequest } from './storyCurrentTurnOutputRequest';
import type { StorySessionState } from './storyTypes';

function buildRuntimeContext(session: StorySessionState) {
  const activeCast = session.activeCast.join('、') || '无';
  const stateLines = session.activeCast.map((id) => {
    const state = session.characterStates[id];
    return `${id}: 地点=${state?.currentLocation || '未定'}；情绪=${state?.emotionalState || '未定'}；目标=${state?.currentGoal || '未定'}`;
  });
  const narrativeBeats = session.lastTurnPlan?.narrativeBeats.map((beat) => (
    `${beat.participantId}: 动作=${beat.action}；可见=${beat.visibleCue || '自然反应'}；心理=${beat.innerState || '与状态一致'}`
  )).join('\n') || '暂无';
  return [
    `当前出场角色：${activeCast}`,
    `当前时间：${session.currentTime}（已推进 ${session.elapsedMinutes} 分钟）`,
    `角色运行状态：\n${stateLines.join('\n') || '暂无'}`,
    `关系值：${Object.entries(session.relationships).map(([key, value]) => `${key}=${value}`).join('、') || '暂无'}`,
    `物品：${session.inventory.join('、') || '无'}`,
    `行动建议：${session.suggestedActions.join('；') || '无'}`,
    `本回合旁白节拍：\n${narrativeBeats}`,
  ].join('\n');
}

export function buildStoryTurnPrompt(options: {
  basePrompt: string;
  participantNames: string[];
  session: StorySessionState;
  targetName: string;
}) {
  const story = options.session.definition;
  return [
    '【故事模式：最高优先级运行约束】',
    `故事：${story.title || '未命名故事'}`,
    `核心设定：${story.premise || '未设置'}`,
    `世界与场景：${story.setting || '未设置'}`,
    `用户身份：${story.userRole || '由用户自己决定'}`,
    `参与角色：${options.participantNames.join('、')}`,
    buildStoryDefinitionPromptContext(options.session, { stage: 'character' }),
    `当前场景：${options.session.currentScene || story.openingScene || '从设定自然开场'}`,
    buildRuntimeContext(options.session),
    `当前为第 ${options.session.currentTurn + 1} 轮。`,
    `你只扮演“${options.targetName}”的对白，保持该角色原有人格，不得代替用户或其他角色作出行动、选择或发言。`,
    '角色回复只输出自然对白；不要写动作、表情、场景、环境、氛围、转场或括号内内容。',
    '不要使用第一人称动作描写，不要写“（我……）”或“(我……)”。场景和氛围由独立旁白负责；旁白必须使用第三人称或客观叙述。',
    '旁白不是任何 AI 角色，显示在单独的“旁白”位置；角色不要冒充旁白。',
    '围绕目标推进一个有意义的小步骤；遵守规则，并为用户保留可以回应或选择的空间。对白不设固定字数，根据角色当前状态、关系、压力、目标、知识和用户行动自然决定长度；不要为了凑字数重复信息。',
    `用户本轮输入：${options.basePrompt}`,
    buildStoryCurrentTurnOutputRequest(options.basePrompt, 'character'),
  ].join('\n\n');
}
