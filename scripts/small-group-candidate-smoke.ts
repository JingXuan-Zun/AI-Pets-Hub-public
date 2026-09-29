import assert from 'node:assert/strict';
import {
  EMPTY_DIRECTED_RELATIONSHIP_REPOSITORY,
  invalidateDirectedRelationship,
  upsertDirectedRelationship,
} from '../src/character-relationship';
import {
  CURRENT_GROUP_MEMORY_GROUP_ID,
  EMPTY_GROUP_MEMORY_REPOSITORY,
  type GroupMemoryRepositoryData,
  type StoredGroupMemoryRecord,
} from '../src/group-memory';
import { buildSmallGroupCandidates } from '../src/social-group';

function memory(id: string, roleId: string, topicId: string,
  groupId = CURRENT_GROUP_MEMORY_GROUP_ID): StoredGroupMemoryRecord {
  return { confidence: 1, createdAt: 1, groupId, id, kind: 'discussion-summary',
    sourceRoleId: roleId, summary: `private-${id}`, topicId, updatedAt: 1,
    visibility: 'group' };
}

function relationships(reverseDimensions = { intimacy: 75, trust: 80, vigilance: 20 }) {
  let repository = upsertDirectedRelationship(EMPTY_DIRECTED_RELATIONSHIP_REPOSITORY, {
    dimensions: { intimacy: 70, trust: 75, vigilance: 25 }, evidenceSummary: 'approved forward',
    sourceRoleId: 'alice', targetRoleId: 'berry', targetRoleName: 'Berry',
  }, { now: 10, reason: 'manual approved forward', source: 'manual' });
  repository = upsertDirectedRelationship(repository, {
    dimensions: reverseDimensions, evidenceSummary: 'approved reverse',
    sourceRoleId: 'berry', targetRoleId: 'alice', targetRoleName: 'Alice',
  }, { now: 11, reason: 'manual approved reverse', source: 'manual' });
  return repository;
}

function groupMemory(records: StoredGroupMemoryRecord[]): GroupMemoryRepositoryData {
  return { ...EMPTY_GROUP_MEMORY_REPOSITORY, records };
}

const publicMemory = groupMemory([
  memory('alice-1', 'alice', 'topic-1'), memory('berry-1', 'berry', 'topic-1'),
  memory('alice-2', 'alice', 'topic-2'), memory('berry-2', 'berry', 'topic-2'),
]);
const options = { activeRoleIds: ['alice', 'berry'], groupMemoryRepository: publicMemory,
  relationshipRepository: relationships(), roleNames: { alice: 'Alice', berry: 'Berry' } };
const candidates = buildSmallGroupCandidates(options);
assert.equal(candidates.length, 1);
assert.deepEqual(candidates[0]?.memberRoleIds, ['alice', 'berry']);
assert.deepEqual(candidates[0]?.memberRoleNames, ['Alice', 'Berry']);
assert.equal(candidates[0]?.sharedTopicCount, 2);
assert.equal(candidates[0]?.publicMemoryRecordCount, 4);
assert.equal(candidates[0]?.claimLevel, 'read-only-candidate');
assert.doesNotMatch(JSON.stringify(candidates), /private-alice|private-berry|summary|excerpt/u);

assert.equal(buildSmallGroupCandidates({ ...options,
  relationshipRepository: { ...relationships(), records: relationships().records.slice(0, 1) },
}).length, 0, 'one-way relationships must not create a subgroup candidate');
assert.equal(buildSmallGroupCandidates({ ...options,
  relationshipRepository: relationships({ intimacy: 59, trust: 80, vigilance: 20 }),
}).length, 0, 'both relationship directions must meet every threshold');
assert.equal(buildSmallGroupCandidates({ ...options,
  relationshipRepository: invalidateDirectedRelationship(relationships(), 'berry->alice', 20),
}).length, 0, 'invalidated relationships must be ignored');

const privateOnly = groupMemory([
  memory('alice-private', 'alice', 'topic-1', 'subgroup-private'),
  memory('berry-private', 'berry', 'topic-1', 'subgroup-private'),
]);
assert.equal(buildSmallGroupCandidates({ ...options, groupMemoryRepository: privateOnly }).length, 0,
  'existing subgroup memory must not be used to infer new membership');
const invalidatedPublic = groupMemory([
  memory('alice-public', 'alice', 'topic-only'),
  { ...memory('berry-public', 'berry', 'topic-only'), invalidatedAt: 2 },
]);
assert.equal(buildSmallGroupCandidates({
  ...options, groupMemoryRepository: invalidatedPublic,
}).length, 0, 'invalidated public memory must not support a subgroup candidate');
assert.equal(buildSmallGroupCandidates({ ...options, activeRoleIds: ['alice'] }).length, 0);
assert.equal(buildSmallGroupCandidates({ ...options, groupMemoryRepository: {
  ...publicMemory, subgroups: [{ createdAt: 1, id: 'existing', memberRoleIds: ['alice', 'berry'],
    name: 'Existing', updatedAt: 1 }],
} }).length, 0, 'existing active subgroup members must not be proposed again');

console.log('small group candidate smoke ok');
