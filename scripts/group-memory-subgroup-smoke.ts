import assert from 'node:assert/strict';
import {
  createGroupMemorySubgroup,
  EMPTY_GROUP_MEMORY_REPOSITORY,
  getReadableGroupMemoryGroupIds,
  invalidateGroupMemorySubgroup,
  normalizeGroupMemoryRepository,
  restoreGroupMemorySubgroup,
  upsertGroupMemoryRecord,
  updateGroupMemorySubgroupMembers,
} from '../src/group-memory';
import { buildGroupMemoryContextPacket } from '../src/components/chat/group/memory/groupMemoryGraphAdapter';

let repository = createGroupMemorySubgroup(EMPTY_GROUP_MEMORY_REPOSITORY, {
  memberRoleIds: ['alice', 'berry', 'alice'], name: '调查小组',
}, 100);
assert.equal(repository.schemaVersion, 8);
assert.equal(repository.subgroups.length, 1);
assert.deepEqual(repository.subgroups[0]?.memberRoleIds, ['alice', 'berry']);
assert.equal(repository.subgroupAuditTrail[0]?.kind, 'create');
const subgroupId = repository.subgroups[0]!.id;

repository = updateGroupMemorySubgroupMembers(repository, subgroupId, ['alice', 'charlie'], 110);
assert.deepEqual(repository.subgroups[0]?.memberRoleIds, ['alice', 'charlie']);
assert.equal(repository.subgroupAuditTrail.at(-1)?.kind, 'update-members');
assert.equal(updateGroupMemorySubgroupMembers(repository, subgroupId, ['alice'], 111), repository,
  'a subgroup must keep at least two members');

repository = {
  ...repository,
  records: [{
    confidence: 1, createdAt: 120, groupId: subgroupId, id: 'secret-1',
    kind: 'verified-fact', sourceRoleId: 'alice', summary: '调查小组确认了隐藏入口。',
    topicId: 'topic-1', updatedAt: 120, visibility: 'group',
  }],
};
assert.deepEqual(getReadableGroupMemoryGroupIds(repository, 'alice'), ['current-group', subgroupId]);
assert.deepEqual(getReadableGroupMemoryGroupIds(repository, 'berry'), ['current-group']);

const alicePacket = buildGroupMemoryContextPacket({
  groupId: 'current-group', now: 130, query: '隐藏入口', repository, roleId: 'alice',
});
const berryPacket = buildGroupMemoryContextPacket({
  groupId: 'current-group', now: 130, query: '隐藏入口', repository, roleId: 'berry',
});
assert.equal(alicePacket.items[0]?.summary, '调查小组确认了隐藏入口。');
assert.equal(berryPacket.items.length, 0, 'non-members must not read subgroup memory');

repository = invalidateGroupMemorySubgroup(repository, subgroupId, 140);
assert.deepEqual(getReadableGroupMemoryGroupIds(repository, 'alice'), ['current-group']);
const rejectedRecord = { ...repository.records[0]!, id: 'rejected', groupId: subgroupId };
assert.equal(upsertGroupMemoryRecord(repository, rejectedRecord).records.length, 1,
  'inactive subgroups must reject writes');
repository = restoreGroupMemorySubgroup(repository, subgroupId, 150);
assert.deepEqual(getReadableGroupMemoryGroupIds(repository, 'alice'), ['current-group', subgroupId]);

const migrated = normalizeGroupMemoryRepository({ schemaVersion: 5, records: [] }, [], 200);
assert.equal(migrated.schemaVersion, 8);
assert.deepEqual(migrated.subgroups, []);
assert.deepEqual(migrated.subgroupAuditTrail, []);
assert.equal(upsertGroupMemoryRecord(migrated, {
  ...rejectedRecord, id: 'orphan', groupId: 'unknown-subgroup',
}).records.length, 0, 'unknown group ids must reject writes');

console.log('group memory subgroup smoke ok');
