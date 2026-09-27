import assert from 'node:assert/strict';
import {
  buildGroupTopicTimeline,
  formatGroupTopicMembers,
  type GroupTopicSnapshot,
} from '../src/group-topic';

const snapshot: GroupTopicSnapshot = {
  currentTopicId: 'child-2',
  currentTopicParentId: 'child-1',
  groupKey: 'a|b',
  groupSessionId: 'group-1',
  topicDerivationSequence: 2,
  topicAuditTrail: [
    { fromStatus: null, reason: 'topic-derived', recordedAt: 29,
      source: 'derivation', toStatus: 'starting', topicId: 'child-2' },
    { fromStatus: 'starting', reason: 'role-turn-progress', recordedAt: 30,
      source: 'role-signal', toStatus: 'active', topicId: 'child-2' },
  ],
  topicHistory: [
    { id: 'root', parentTopicId: null, recordedAt: 10, status: 'closed' },
    { id: 'child-1', parentTopicId: 'root', recordedAt: 20, status: 'closed' },
    { id: 'orphan', parentTopicId: 'missing', recordedAt: 25, status: 'archived' },
  ],
  topicStatus: 'active',
  topicUpdatedAt: 30,
};

const rows = buildGroupTopicTimeline(snapshot);
assert.deepEqual(rows.map((row) => row.id), ['root', 'child-1', 'orphan', 'child-2']);
assert.equal(rows.find((row) => row.id === 'root')?.depth, 0);
assert.equal(rows.find((row) => row.id === 'child-1')?.depth, 1);
assert.equal(rows.find((row) => row.id === 'child-2')?.depth, 2);
assert.equal(rows.find((row) => row.id === 'child-2')?.isCurrent, true);
assert.equal(rows.find((row) => row.id === 'child-2')?.transitions.length, 2);
assert.equal(rows.find((row) => row.id === 'orphan')?.parentMissing, true);
assert.equal(formatGroupTopicMembers('a|b|removed', { a: '阿青', b: '小白' }), '阿青、小白、removed');

const cycleRows = buildGroupTopicTimeline({
  ...snapshot,
  currentTopicId: null,
  topicStatus: null,
  topicHistory: [
    { id: 'cycle-a', parentTopicId: 'cycle-b', recordedAt: 1, status: 'closed' },
    { id: 'cycle-b', parentTopicId: 'cycle-a', recordedAt: 2, status: 'closed' },
  ],
});
assert.equal(cycleRows.length, 2);
assert.ok(cycleRows.every((row) => row.depth <= 12));
assert.ok(cycleRows.every((row) => row.relationCycle));
console.log('group topic timeline smoke ok');
