import assert from 'node:assert/strict';
import {
  createGroupUserTopicState,
  markGroupUserTopicRoleAnswered,
  normalizeGroupUserTopicState,
} from '../src/components/chat/group/topic/groupUserTopicState';

const created = createGroupUserTopicState({
  addressedRoleIds: ['c'],
  deferredTopicId: 'old-topic',
  roleIds: ['a', 'b', 'c'],
  sourceMessageId: 'user-1',
  topicId: 'user-1',
});
assert.deepEqual(created.remainingRoleIds, ['c', 'a', 'b']);
assert.equal(created.adoptionState, 'pending');
assert.equal(created.deferredTopicId, 'old-topic');

const afterC = markGroupUserTopicRoleAnswered(created, 'c');
assert.deepEqual(afterC.answeredRoleIds, ['c']);
assert.deepEqual(afterC.remainingRoleIds, ['a', 'b']);
assert.equal(afterC.adoptionState, 'adopted');

const completed = ['a', 'b'].reduce(
  (state, roleId) => markGroupUserTopicRoleAnswered(state, roleId), afterC,
);
assert.equal(completed.adoptionState, 'completed');
assert.deepEqual(completed.remainingRoleIds, []);
assert.deepEqual(normalizeGroupUserTopicState(completed), completed);
assert.equal(normalizeGroupUserTopicState({ topicId: 'missing-source' }), null);
console.log('group user topic state smoke ok');
