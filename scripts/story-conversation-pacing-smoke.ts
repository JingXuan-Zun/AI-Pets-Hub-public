import assert from 'node:assert/strict';
import { createEmptyStoryDefinition, createStorySession } from '../src/components/chat/story/storyDefaults';
import {
  buildFallbackStoryNarration,
  buildStoryNarratorPrompt,
} from '../src/components/chat/story/storyNarrator';
import { buildStoryTurnDirectorPrompt } from '../src/components/chat/story/storyTurnDirector';
import { normalizeStoryTurnPlan } from '../src/components/chat/story/storyTurnPlanNormalization';

const definition = createEmptyStoryDefinition(['primary', 'locked'], 'random');
definition.title = '失落星灯';
definition.openingScene = '旧剧院舞台侧翼';
definition.setting = '深秋傍晚，废弃剧院里潮湿而昏暗。';
const session = createStorySession(definition);
session.currentScene = definition.openingScene;
session.currentTime = '深秋傍晚';

const userInput = '你能帮我一个忙嘛？';
const directorPrompt = buildStoryTurnDirectorPrompt({
  historyMessages: [],
  participants: [
    { id: 'primary', name: '曜鸢璇恋' },
    { id: 'locked', name: '尚未登场者' },
  ],
  session,
  userInput,
});
assert.match(directorPrompt, /回应型回合/);
assert.match(directorPrompt, /请求者、目标对象和请求内容/);
assert.match(directorPrompt, /尚未说明具体内容/);

const plan = normalizeStoryTurnPlan({
  actionResult: '曜鸢要求用户前往后台寻找登记册。',
  activeSpeakerIds: ['primary'],
  elapsedMinutes: 30,
  enteringParticipantIds: ['locked'],
  narrativeBeats: [{
    action: '曜鸢转身带用户去后台调查。',
    innerState: '想让用户替自己完成任务。',
    participantId: 'primary',
    visibleCue: '她指向后台。',
  }],
  pacingMode: 'event',
  sceneTransition: { changed: true, from: definition.openingScene, to: '后台仓库' },
  statePatch: { inventoryAdd: ['凭空出现的登记册'] },
  suggestedActions: ['前往后台调查'],
}, session, userInput);

assert.equal(plan.pacingMode, 'response');
assert.equal(plan.elapsedMinutes, 0);
assert.deepEqual(plan.enteringParticipantIds, []);
assert.deepEqual(plan.leavingParticipantIds, []);
assert.equal(plan.sceneTransition.changed, false);
assert.equal(plan.sceneTransition.to, definition.openingScene);
assert.deepEqual(plan.statePatch.inventoryAdd, []);
assert.doesNotMatch(plan.actionResult, /后台|登记册|曜鸢要求用户/);
assert.match(plan.actionResult, /请求内容尚未说明/);
assert.match(plan.narrativeBeats[0]?.action ?? '', /听见用户的请求/);
assert.equal(plan.suggestedActions.length, 3);

const questionPlan = normalizeStoryTurnPlan({
  pacingMode: 'response',
  sceneTransition: { changed: true, from: definition.openingScene, to: '凭空变化的场景' },
  statePatch: {
    characterUpdates: [{ participantId: 'primary', emotionalState: '正在回忆' }],
    inventoryAdd: ['凭空出现的物品'],
    taskUpdates: [],
  },
}, session, '你还记得那盏星灯吗？');
assert.equal(questionPlan.pacingMode, 'response');
assert.equal(questionPlan.sceneTransition.changed, false);
assert.deepEqual(questionPlan.statePatch.inventoryAdd, []);
assert.equal(questionPlan.statePatch.characterUpdates[0]?.emotionalState, '正在回忆');

const narratorPrompt = buildStoryNarratorPrompt({
  historyMessages: [],
  participants: [{
    id: 'primary', name: '曜鸢璇恋', systemInstruction: '说话柔和但保持警惕。', traits: ['细心'],
  }],
  session,
  turnPlan: plan,
  userInput,
});
assert.match(narratorPrompt, /回应型回合/);
assert.match(narratorPrompt, /旁白、角色动作和角色对白/);
assert.match(narratorPrompt, /不能把被请求的角色反过来写成向用户派任务/);

const fallback = buildFallbackStoryNarration(plan, session, {
  participants: [{
    id: 'primary', name: '曜鸢璇恋', systemInstruction: '', traits: [],
  }],
  userInput,
});
assert.match(fallback, /旧剧院舞台侧翼/);
assert.match(fallback, /你开口说道/);
assert.match(fallback, /曜鸢璇恋/);
assert.match(fallback, /先告诉我是什么事/);
assert.doesNotMatch(fallback, /后台|登记册/);

console.log('story conversation pacing smoke: PASS');
