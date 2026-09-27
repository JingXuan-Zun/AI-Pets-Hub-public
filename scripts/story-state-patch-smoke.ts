import assert from 'node:assert/strict';
import { applyStoryTurnPlan } from '../src/components/chat/story/storyCastState';
import { createEmptyStoryDefinition, createStoryEntry, createStorySession } from '../src/components/chat/story/storyDefaults';
import { normalizeStoryTurnPlan } from '../src/components/chat/story/storyTurnPlanNormalization';

const definition = createEmptyStoryDefinition(['a', 'b'], 'manual');
definition.goals = [createStoryEntry('确认信使是否安全')];
definition.tasks = [createStoryEntry('检查车站公告')];
const session = createStorySession(definition);
const plan = normalizeStoryTurnPlan({
  statePatch: {
    goalUpdates: [{ goalId: definition.goals[0].id, progress: '已找到线索' }, { goalId: 'forged', progress: '错误' }],
    inventoryAdd: ['旧车票'],
    relationshipUpdates: [{ sourceParticipantId: 'a', targetParticipantId: 'b', delta: 12, reason: '共同调查' }, { sourceParticipantId: 'forged', targetParticipantId: 'b', delta: 99 }],
    taskUpdates: [{ taskId: definition.tasks[0].id, status: 'completed', reason: '公告已核对' }, { taskId: 'forged', status: 'failed' }],
  },
}, session);
const next = applyStoryTurnPlan(session, plan);
assert.equal(next.goalProgress[definition.goals[0].id], '已找到线索');
assert.equal(next.taskStatuses[definition.tasks[0].id], 'completed');
assert.equal(next.inventory[0], '旧车票');
assert.equal(next.relationships[`a->b`], 12);
assert.equal(next.relationships.forged, undefined);

console.log('story state patch smoke: PASS');
