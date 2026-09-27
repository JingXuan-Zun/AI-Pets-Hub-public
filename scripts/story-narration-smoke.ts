import assert from 'node:assert/strict';
import {
  buildFallbackStoryNarration,
  buildStoryNarratorPrompt,
  normalizeStoryNarrationText,
  STORY_NARRATION_MAX_TOKENS,
  STORY_NARRATION_TIMEOUT_MS,
} from '../src/components/chat/story/storyNarrator';
import { createFallbackStoryTurnPlan } from '../src/components/chat/story/storyTurnPlanNormalization';
import { createEmptyStorySessionForSmoke } from './story-narration-smoke-fixture';

const session = createEmptyStorySessionForSmoke();
session.definition.participantIds.push('locked');
session.definition.setting = '冷雨浸透了废弃车站，远处信号灯忽明忽暗。';
session.definition.premise = '你需要在封锁前找到失踪信使留下的线索。';
session.currentScene = '旧车站月台';
session.currentTime = '深夜十一点';
const turnPlan = createFallbackStoryTurnPlan(session, '我检查门锁。');
turnPlan.actionResult = '门锁边缘留下了新鲜的划痕。';
turnPlan.publicAnalysis.outputPlan = '先写门锁细节，再写江月华的观察与对白。';
const prompt = buildStoryNarratorPrompt({
  historyMessages: [],
  participants: [
    { id: 'primary', name: '江月华', systemInstruction: '说话克制，观察敏锐。', traits: ['冷静'] },
    { id: 'locked', name: '尚未登场者', systemInstruction: '不得提前出场。', traits: ['神秘'] },
  ],
  session,
  turnPlan,
  userInput: '我检查门锁。',
});

assert.match(prompt, /完整、连贯的小说式故事回合/);
assert.match(prompt, /第三人称/);
assert.match(prompt, /对白.*穿插/);
assert.match(prompt, /第二人称/);
assert.doesNotMatch(prompt, /不写角色对白/);
assert.match(prompt, /江月华/);
assert.doesNotMatch(prompt, /尚未登场者/);
assert.match(prompt, /角色动作/);
assert.match(prompt, /心理(?:活动|动机)/);
assert.match(prompt, /输出前静默自检/);
assert.match(prompt, /公开剧情分析与输出计划/);
assert.match(prompt, /先写门锁细节，再写江月华的观察与对白/);
assert.doesNotMatch(prompt, /你只扮演/);
assert.equal(normalizeStoryNarrationText('旁白：\n```text\n夜色落下。\n```'), '夜色落下。');
const fallbackNarration = buildFallbackStoryNarration(turnPlan, session, {
  participants: [{ id: 'primary', name: '江月华', systemInstruction: '', traits: [] }],
  userInput: '我检查门锁。',
});
assert.match(fallbackNarration, /深夜十一点/);
assert.match(fallbackNarration, /旧车站月台/);
assert.match(fallbackNarration, /你检查门锁/);
assert.match(fallbackNarration, /门锁/);
assert.match(fallbackNarration, /江月华/);
assert.match(fallbackNarration, /保持警觉/);
assert.match(fallbackNarration, /正在评估局势/);
assert.doesNotMatch(fallbackNarration, /用户行动/);
assert.equal(STORY_NARRATION_TIMEOUT_MS, 120_000);
assert.equal(STORY_NARRATION_MAX_TOKENS, 16_384);

console.log('story narration smoke: PASS');
