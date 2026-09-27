import assert from 'node:assert/strict';
import {
  advanceGroupTopicRepositoryTime,
  GROUP_TOPIC_CONCLUDED_ARCHIVE_AFTER_MS,
  GROUP_TOPIC_DECAY_AFTER_MS,
  GROUP_TOPIC_DECAYED_ARCHIVE_AFTER_MS,
  GROUP_TOPIC_WAITING_DECAY_AFTER_MS,
  normalizeGroupTopicRepository,
  type GroupTopicSnapshot,
} from '../src/group-topic';

function createSnapshot(
  status: GroupTopicSnapshot['topicStatus'],
  topicId: string,
  updatedAt = 1_000,
): GroupTopicSnapshot {
  return {
    currentTopicId: topicId, currentTopicParentId: null, groupKey: topicId,
    groupSessionId: `group-${topicId}`, topicAuditTrail: [],
    topicDerivationSequence: 0, topicHistory: [], topicStatus: status, topicUpdatedAt: updatedAt,
  };
}

function simulateRestart(snapshot: GroupTopicSnapshot) {
  return normalizeGroupTopicRepository(JSON.parse(JSON.stringify({
    schemaVersion: 2, snapshots: [snapshot],
  }))).snapshots[0];
}

function advance(snapshot: GroupTopicSnapshot, now: number) {
  return advanceGroupTopicRepositoryTime({
    now, repository: { schemaVersion: 2, snapshots: [snapshot] },
  }).snapshots[0];
}

const active = createSnapshot('active', 'active-topic');
const decayed = advance(active, 1_000 + GROUP_TOPIC_DECAY_AFTER_MS);
assert.equal(decayed.topicStatus, 'decaying');
assert.equal(decayed.topicAuditTrail.at(-1)?.reason, 'discussion-inactive');

const restartedDecay = simulateRestart(decayed);
const archived = advance(
  restartedDecay,
  (restartedDecay.topicUpdatedAt ?? 0) + GROUP_TOPIC_DECAYED_ARCHIVE_AFTER_MS,
);
assert.equal(archived.topicStatus, 'archived');
assert.deepEqual(archived.topicAuditTrail.map((entry) => entry.toStatus), ['decaying', 'archived']);
assert.equal(advance(archived, Number.MAX_SAFE_INTEGER), archived);

const waiting = createSnapshot('waiting-information', 'waiting-topic');
const waitingDecay = advance(waiting, 1_000 + GROUP_TOPIC_WAITING_DECAY_AFTER_MS);
assert.equal(waitingDecay.topicStatus, 'decaying');
assert.equal(waitingDecay.topicAuditTrail[0].reason, 'waiting-information-timeout');

const concluded = createSnapshot('concluded', 'concluded-topic');
const concludedArchive = advance(concluded, 1_000 + GROUP_TOPIC_CONCLUDED_ARCHIVE_AFTER_MS);
assert.equal(concludedArchive.topicStatus, 'archived');
assert.equal(concludedArchive.topicAuditTrail[0].reason, 'conclusion-retention-expired');

const history = createSnapshot('archived', 'current-archived');
history.topicHistory = [{
  id: 'history-active', parentTopicId: null, recordedAt: 1_000, status: 'active',
}];
const historyDecay = advance(history, 1_000 + GROUP_TOPIC_DECAY_AFTER_MS);
const historyRestart = simulateRestart(historyDecay);
const historyArchive = advance(
  historyRestart,
  historyRestart.topicHistory[0].recordedAt + GROUP_TOPIC_DECAYED_ARCHIVE_AFTER_MS,
);
assert.equal(historyArchive.topicHistory[0].status, 'archived');
assert.deepEqual(historyArchive.topicAuditTrail.map((entry) => entry.toStatus), ['decaying', 'archived']);

console.log('group topic long duration smoke ok');
