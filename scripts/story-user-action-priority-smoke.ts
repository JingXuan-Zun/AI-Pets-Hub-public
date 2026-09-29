import assert from 'node:assert/strict';
import { createEmptyStorySessionForSmoke } from './story-narration-smoke-fixture';
import { normalizeStoryTurnPlan } from '../src/components/chat/story/storyTurnPlanNormalization';
import { buildStoryTurnDirectorPrompt } from '../src/components/chat/story/storyTurnDirector';

const session = createEmptyStorySessionForSmoke();
session.currentScene = '大厅';
const userInput = '先别讨论调查了，让角色带我回房间休息。';
const candidate = {
  pacingMode: 'response', elapsedMinutes: 5, activeSpeakerIds: ['primary'],
  actionResult: '角色带你离开大厅，回到房间休息。',
  sceneTransition: { changed: true, from: '大厅', to: '房间', process: '沿走廊走回房间。' },
  statePatch: { characterUpdates: [{ participantId: 'primary', currentLocation: '房间' }], events: [{ type: 'arrival', text: '回到房间。' }] },
};
const plan = normalizeStoryTurnPlan(candidate, session, userInput);
assert.equal(plan.sceneTransition.to, '房间', 'a response label must not erase an explicitly requested scene transition');
assert.equal(plan.sceneTransition.changed, true);
assert.equal(plan.elapsedMinutes, 5);
assert.equal(plan.pacingMode, 'progression');
for (const input of ['不要带我回房间休息。', '如果带我回房间会怎样？', '她说：“带我回房间休息。”', '你还记得房间在哪里吗？']) {
  assert.equal(normalizeStoryTurnPlan(candidate, session, input).sceneTransition.changed, false, input);
}
const prompt = buildStoryTurnDirectorPrompt({ session, userInput, participants: [], historyMessages: [] });
assert.match(prompt, /未完成的调查或主线任务不是行动前置条件/);
assert.match(prompt, /本轮就落实用户已作出的选择/);
console.log('story explicit action priority and response-transition preservation passed');
