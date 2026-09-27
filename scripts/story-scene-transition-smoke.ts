import assert from 'node:assert/strict';
import { applyStoryTurnPlan } from '../src/components/chat/story/storyCastState';
import { createEmptyStoryDefinition, createStorySession } from '../src/components/chat/story/storyDefaults';
import { normalizeStoryTurnPlan } from '../src/components/chat/story/storyTurnPlanNormalization';

const definition = createEmptyStoryDefinition(['a'], 'manual');
definition.openingScene = '公寓客厅';
definition.initialTime = '晚上八点';
const session = createStorySession(definition);
const plan = normalizeStoryTurnPlan({
  actionResult: '用户拿起钥匙并走向楼梯。',
  elapsedMinutes: 8,
  statePatch: { currentTime: '晚上八点零八分', events: [{ type: 'scene', text: '钥匙在门边被发现。' }] },
  sceneTransition: {
    changed: true,
    from: '公寓客厅',
    process: '穿过玄关并下楼',
    reason: '用户主动离开客厅',
    to: '楼道',
  },
}, session);
const next = applyStoryTurnPlan(session, plan);
assert.equal(next.currentScene, '楼道');
assert.equal(next.currentTime, '晚上八点零八分');
assert.equal(next.elapsedMinutes, 8);
assert.equal(next.eventLog[0]?.text, '钥匙在门边被发现。');

console.log('story scene transition smoke: PASS');
