import assert from 'node:assert/strict';
import {
  buildGroupTopicKey,
  findGroupTopicSnapshot,
  normalizeGroupTopicRepository,
  upsertGroupTopicSnapshot,
} from '../src/group-topic';

assert.equal(buildGroupTopicKey(['b', 'a', 'a', '']), 'a|b');
assert.deepEqual(normalizeGroupTopicRepository(null), { schemaVersion: 3, snapshots: [] });

const repository = normalizeGroupTopicRepository({
  schemaVersion: 99,
  snapshots: [
    null,
    { groupKey: '', groupSessionId: 'bad' },
    {
      currentTopicId: ' topic-1 ',
      currentTopicParentId: null,
      groupKey: 'a|b',
      groupSessionId: 'group-1',
      topicDerivationSequence: -3,
      topicHistory: [
        { id: 'old', parentTopicId: null, recordedAt: 10, status: 'closed' },
        { id: 'old', parentTopicId: null, recordedAt: 11, status: 'archived' },
        { id: 'invalid', recordedAt: 'bad', status: 'active' },
      ],
      topicAuditTrail: [
        { fromStatus: 'starting', reason: 'role-turn-progress', recordedAt: 15,
          source: 'role-signal', toStatus: 'active', topicId: 'topic-1' },
        { fromStatus: 'active', reason: '', recordedAt: 16,
          source: 'invalid', toStatus: 'closed', topicId: 'topic-1' },
      ],
      topicStatus: 'active',
      topicUpdatedAt: 20,
    },
    {
      currentTopicId: 'topic-2', groupKey: 'a|b', groupSessionId: 'group-2',
      topicDerivationSequence: 1, topicHistory: [], topicStatus: 'starting', topicUpdatedAt: 30,
    },
  ],
});

assert.equal(repository.schemaVersion, 3);
assert.equal(repository.snapshots.length, 1);
assert.equal(repository.snapshots[0].currentTopicId, 'topic-2');
assert.equal(repository.snapshots[0].topicDerivationSequence, 1);
assert.deepEqual(repository.snapshots[0].topicAuditTrail, []);
assert.equal(findGroupTopicSnapshot(repository, 'missing'), null);
assert.equal(upsertGroupTopicSnapshot(repository, repository.snapshots[0]), repository);

const auditRepository = normalizeGroupTopicRepository({ snapshots: [{
  currentTopicId: 'topic-audit', groupKey: 'audit', groupSessionId: 'group-audit',
  topicAuditTrail: [
    { fromStatus: 'starting', reason: 'role-turn-progress', recordedAt: 15,
      source: 'role-signal', toStatus: 'active', topicId: 'topic-audit' },
    { fromStatus: 'invalid', reason: 'bad-status', recordedAt: 16,
      source: 'role-signal', toStatus: 'closed', topicId: 'topic-audit' },
  ],
  topicHistory: [], topicStatus: 'active', topicUpdatedAt: 20,
}] });
assert.equal(auditRepository.snapshots[0].topicAuditTrail.length, 1);
assert.equal(auditRepository.snapshots[0].topicAuditTrail[0].fromStatus, 'starting');

const historyRepository = normalizeGroupTopicRepository({
  snapshots: [{
    currentTopicId: null, groupKey: 'c|d', groupSessionId: 'group-history',
    topicHistory: Array.from({ length: 105 }, (_, index) => ({
      id: index === 104 ? 'topic-103' : `topic-${index}`,
      parentTopicId: null,
      recordedAt: index,
      status: index === 104 ? 'archived' : 'closed',
    })),
  }],
});
assert.equal(historyRepository.snapshots[0].topicHistory.length, 100);
assert.equal(historyRepository.snapshots[0].topicHistory.at(-1)?.status, 'archived');
console.log('group topic repository smoke ok');
