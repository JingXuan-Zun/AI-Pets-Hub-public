import assert from 'node:assert/strict';
import {
  advanceGroupTopicRepositoryTime,
  GROUP_TOPIC_CONCLUDED_ARCHIVE_AFTER_MS,
  GROUP_TOPIC_DECAY_AFTER_MS,
  GROUP_TOPIC_DECAYED_ARCHIVE_AFTER_MS,
  GROUP_TOPIC_WAITING_DECAY_AFTER_MS,
  type GroupTopicSnapshot,
} from '../src/group-topic';

function snapshot(status: GroupTopicSnapshot['topicStatus'], updatedAt = 100): GroupTopicSnapshot {
  return {
    currentTopicId: 'topic-1', currentTopicParentId: null, groupKey: 'a|b',
    groupSessionId: 'group-1', topicDerivationSequence: 0, topicHistory: [], topicAuditTrail: [],
    topicStatus: status, topicUpdatedAt: updatedAt,
  };
}

function advance(item: GroupTopicSnapshot, now: number, excludedGroupSessionId?: string) {
  const repository = { schemaVersion: 2 as const, snapshots: [item] };
  return advanceGroupTopicRepositoryTime({ excludedGroupSessionId, now, repository });
}

const beforeDecay = advance(snapshot('active'), 100 + GROUP_TOPIC_DECAY_AFTER_MS - 1);
assert.equal(beforeDecay.snapshots[0].topicStatus, 'active');
assert.equal(advance(snapshot('active'), 100 + GROUP_TOPIC_DECAY_AFTER_MS).snapshots[0].topicStatus, 'decaying');
assert.equal(advance(snapshot('waiting-information'), 100 + GROUP_TOPIC_WAITING_DECAY_AFTER_MS).snapshots[0].topicStatus, 'decaying');
assert.equal(advance(snapshot('concluded'), 100 + GROUP_TOPIC_CONCLUDED_ARCHIVE_AFTER_MS).snapshots[0].topicStatus, 'archived');
assert.equal(advance(snapshot('closed'), 100 + GROUP_TOPIC_CONCLUDED_ARCHIVE_AFTER_MS).snapshots[0].topicStatus, 'archived');
assert.equal(advance(snapshot('decaying'), 100 + GROUP_TOPIC_DECAYED_ARCHIVE_AFTER_MS).snapshots[0].topicStatus, 'archived');

const activeRuntimeRepository = advance(snapshot('active'), 100 + GROUP_TOPIC_DECAY_AFTER_MS, 'group-1');
assert.equal(activeRuntimeRepository.snapshots[0].topicStatus, 'active');

const repository = { schemaVersion: 2 as const, snapshots: [snapshot('archived')] };
assert.equal(advanceGroupTopicRepositoryTime({ now: Number.MAX_SAFE_INTEGER, repository }), repository);
const future = advance(snapshot('active', 500), 400);
assert.equal(future.snapshots[0].topicStatus, 'active');

const firstTransition = advance(snapshot('active'), 100 + GROUP_TOPIC_DECAY_AFTER_MS);
const repeatedTransition = advanceGroupTopicRepositoryTime({
  now: firstTransition.snapshots[0].topicUpdatedAt ?? 0,
  repository: firstTransition,
});
assert.equal(repeatedTransition, firstTransition);

const historySnapshot = snapshot('archived');
historySnapshot.topicHistory = [
  { id: 'old-active', parentTopicId: null, recordedAt: 100, status: 'active' },
];
const agedHistory = advance(historySnapshot, 100 + GROUP_TOPIC_DECAY_AFTER_MS);
assert.equal(agedHistory.snapshots[0].topicHistory[0].status, 'decaying');
assert.equal(agedHistory.snapshots[0].topicHistory[0].recordedAt, 100 + GROUP_TOPIC_DECAY_AFTER_MS);
assert.equal(agedHistory.snapshots[0].topicAuditTrail[0].source, 'inactivity');
assert.equal(agedHistory.snapshots[0].topicAuditTrail[0].topicId, 'old-active');
console.log('group topic aging policy smoke ok');
