import assert from 'node:assert/strict';
import { createEmptyStoryDefinition, createStorySession } from '../src/components/chat/story/storyDefaults';
import { buildStoryTurnDirectorPrompt } from '../src/components/chat/story/storyTurnDirector';
import { normalizeStoryTurnPlan, parseStoryTurnPlanResponse } from '../src/components/chat/story/storyTurnPlanNormalization';

const definition = createEmptyStoryDefinition(['a', 'b'], 'random');
definition.title = '雾中调查';
definition.premise = '用户需要找到失踪的信使。';
definition.goals[0]!.text = '找到失踪信使';
definition.tasks[0]!.text = '检查旧车站';
definition.rules[0]!.text = '不得替用户决定行动';
definition.participantRoutes[1].entryCondition = '用户抵达旧车站后';
const session = createStorySession(definition);
const prompt = buildStoryTurnDirectorPrompt({
  historyMessages: [],
  participants: [{ id: 'a', name: '甲' }, { id: 'b', name: '乙' }],
  session,
  userInput: '我沿着湿滑的石阶走向旧车站。',
});
assert.match(prompt, /隐藏剧情导演/);
assert.match(prompt, /当前出场角色/);
assert.match(prompt, /每轮最多引入一个新角色/);
assert.match(prompt, /narrativeBeats/);
assert.match(prompt, /publicAnalysis/);
assert.match(prompt, /公开剧情分析与输出计划/);
assert.match(prompt, /结合已有剧情上下文理解用户本轮要求/);
assert.match(prompt, /输出前静默自检/);
assert.match(prompt, /找到失踪信使/);
assert.match(prompt, /检查旧车站/);
assert.match(prompt, /不得替用户决定行动/);
assert.match(prompt, /可向用户公开/);
assert.doesNotMatch(prompt, /700 字/);
assert.doesNotMatch(prompt, /每轮.*图片/);

const parsed = parseStoryTurnPlanResponse('```json\n{"elapsedMinutes":5,"activeSpeakerIds":["a"],"publicAnalysis":{"requestUnderstanding":"用户要前往旧车站调查。","characterPlan":"甲保持警惕并先观察入口。","plotPlan":"沿石阶抵达车站，时间推进五分钟。","outputPlan":"按移动、环境、反应和对白的顺序输出。"}}\n```');
const plan = normalizeStoryTurnPlan(parsed, session);
assert.equal(plan.elapsedMinutes, 5);
assert.deepEqual(plan.activeSpeakerIds, ['a']);
assert.match(plan.publicAnalysis.requestUnderstanding, /前往旧车站/);
assert.match(plan.publicAnalysis.outputPlan, /移动、环境、反应和对白/);

console.log('story turn director smoke: PASS');
