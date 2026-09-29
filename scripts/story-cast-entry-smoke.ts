import assert from 'node:assert/strict';
import { applyStoryTurnPlan } from '../src/components/chat/story/storyCastState';
import { createEmptyStoryDefinition, createStorySession } from '../src/components/chat/story/storyDefaults';
import { normalizeStoryTurnPlan } from '../src/components/chat/story/storyTurnPlanNormalization';

const definition = createEmptyStoryDefinition(['a', 'b', 'c'], 'manual');
definition.openingScene = '港口入口';
definition.participantRoutes = [
  { participantId: 'a', entryMode: 'opening', entryCondition: '开场', priority: 0 },
  { participantId: 'b', entryMode: 'condition', entryCondition: '用户进入仓库后', priority: 1 },
  { participantId: 'c', entryMode: 'condition', entryCondition: '发现暗号后', priority: 2 },
];
const session = createStorySession(definition);
assert.deepEqual(session.activeCast, ['a']);
assert.equal(session.characterStates.b.status, 'locked');

const plan = normalizeStoryTurnPlan({
  activeSpeakerIds: ['b', 'c'],
  enteringParticipantIds: ['b', 'c'],
  sceneTransition: { to: '仓库门口', process: '沿着堆栈间的小路走来', reason: '用户进入仓库' },
}, session);
assert.deepEqual(plan.enteringParticipantIds, ['b']);
assert.deepEqual(plan.activeSpeakerIds, ['b']);
const next = applyStoryTurnPlan(session, plan);
assert.deepEqual(next.activeCast, ['a', 'b']);
assert.equal(next.characterStates.b.status, 'active');
assert.equal(next.characterStates.c.status, 'locked');

console.log('story cast entry smoke: PASS');
