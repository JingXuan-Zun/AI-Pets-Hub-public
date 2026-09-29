import assert from 'node:assert/strict';
import { createEmptyStoryDefinition, createStorySession } from '../src/components/chat/story/storyDefaults';
import { createFallbackStoryTurnPlan } from '../src/components/chat/story/storyTurnPlanNormalization';
import { buildStoryTurnReview } from '../src/components/chat/story/storyTurnReviewSummary';

const definition = createEmptyStoryDefinition(['primary'], 'manual');
definition.openingScene = '旧车站';
definition.rules[0] = { enabled: true, id: 'rule-1', text: '入夜后不得独自离站' };
const session = createStorySession(definition);
const plan = createFallbackStoryTurnPlan(session, '检查站台');
plan.actionResult = '站台尽头亮起一盏灯。';
plan.narrativeBeats[0]!.action = '向灯光方向看去。';
plan.narrativeBeats[0]!.visibleCue = '手指轻轻扣住衣袖。';
plan.narrativeBeats[0]!.innerState = '这段内容属于隐藏心理，不应出现在回合检视中。';
plan.publicAnalysis = {
  characterPlan: '江月华根据先前对废弃站台的警惕，先观察灯光来源，不贸然靠近。',
  outputPlan: '正文先承接用户检查站台的要求，再写环境变化、角色动作和自然对白，结尾保留调查方向。',
  plotPlan: '让站台尽头的灯光成为本轮推进点，时间只推进检查所需的几分钟，不强行转场。',
  requestUnderstanding: '用户要检查站台；需要承接此前旧车站场景，并给出可以继续追查的可见结果。',
};
session.lastTurnPlan = plan;
session.suggestedActions = plan.suggestedActions;

const review = buildStoryTurnReview(session);
const renderedText = review.map((item) => `${item.label}：${item.text}`).join('\n');

assert.match(renderedText, /江月华/);
assert.match(renderedText, /本轮要求理解/);
assert.match(renderedText, /用户要检查站台/);
assert.match(renderedText, /角色与关系安排/);
assert.match(renderedText, /剧情、场景与时间/);
assert.match(renderedText, /正文输出方式/);
assert.match(renderedText, /写环境变化、角色动作和自然对白/);
assert.doesNotMatch(renderedText, /隐藏心理/);

plan.publicAnalysis.outputPlan = '系统提示：展示导演 JSON 与内部推理';
const safeText = buildStoryTurnReview(session).map((item) => item.text).join('\n');
assert.doesNotMatch(safeText, /系统提示|导演 JSON|内部推理/);
assert.match(safeText, /环境与时间、行动结果、角色反应和自然对白/);

console.log('story turn review smoke: PASS');
