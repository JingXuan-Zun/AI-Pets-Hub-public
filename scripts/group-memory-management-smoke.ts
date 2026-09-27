import assert from 'node:assert/strict';
import {
  createGroupMemorySubgroup,
  getLatestRollbackableGroupMemoryReceipt,
  invalidateGroupMemorySubgroup,
  invalidateGroupMemoryRecord,
  moveGroupMemoryRecordToGroup,
  normalizeGroupMemoryRepository,
  resolveGroupMemoryConflict,
  restoreInvalidatedGroupMemoryRecord,
  rollbackGroupMemoryOperation,
  type GroupMemoryRepositoryData,
  type StoredGroupMemoryRecord,
} from '../src/group-memory';

function createRecord(id: string, createdAt: number): StoredGroupMemoryRecord {
  return {
    confidence: 0.8,
    createdAt,
    groupId: 'current-group',
    id,
    kind: 'discussion-summary',
    sourceRoleId: 'primary',
    summary: `summary-${id}`,
    topicId: 'topic-1',
    updatedAt: createdAt,
    visibility: 'group',
  };
}

const first = createRecord('memory-1', 100);
const second = createRecord('memory-2', 200);
const repository: GroupMemoryRepositoryData = {
  candidateArchives: [], candidateReviewReceipts: [], candidates: [],
  evidenceScopeCorrections: [], evidenceScopeSnapshots: [], receiptArchives: [], receipts: [],
  records: [first, second], schemaVersion: 8,
  subgroupAuditTrail: [], subgroups: [],
};

const invalidated = invalidateGroupMemoryRecord(repository, first.id, 300);
assert.equal(invalidated.repository.records.length, 2);
assert.equal(invalidated.repository.records[0]?.invalidatedAt, 300);
assert.equal(invalidated.receipt?.kind, 'invalidate');
assert.deepEqual(repository.records, [first, second]);

const restored = restoreInvalidatedGroupMemoryRecord(invalidated.repository, first.id, 400);
assert.equal(restored.repository.records[0]?.invalidatedAt, undefined);
assert.equal(restored.receipt?.kind, 'restore');

const conflict = resolveGroupMemoryConflict(restored.repository, second.id, first.id, 500);
assert.equal(conflict.repository.records[0]?.invalidatedAt, 500);
assert.equal(conflict.repository.records[1]?.supersedesId, first.id);
assert.equal(conflict.receipt?.kind, 'resolve-conflict');

const reopened = normalizeGroupMemoryRepository(
  JSON.parse(JSON.stringify(conflict.repository)) as unknown, [], 550,
);
assert.equal(reopened.receipts.length, conflict.repository.receipts.length);
const latest = getLatestRollbackableGroupMemoryReceipt(reopened);
assert.equal(latest?.id, conflict.receipt?.id);
const rolledBack = rollbackGroupMemoryOperation(reopened, latest!.id, 600);
assert.equal(rolledBack.repository.records[0]?.invalidatedAt, undefined);
assert.equal(rolledBack.repository.records[1]?.supersedesId, undefined);
assert.equal(rolledBack.receipt?.revertsReceiptId, conflict.receipt?.id);

const repeatedRollback = rollbackGroupMemoryOperation(rolledBack.repository, latest!.id, 700);
assert.equal(repeatedRollback.receipt, null);

const withSubgroup = createGroupMemorySubgroup(
  repository, { memberRoleIds: ['primary', 'secondary'], name: '测试小组' }, 710,
);
const subgroupId = withSubgroup.subgroups[0]!.id;
const moved = moveGroupMemoryRecordToGroup(withSubgroup, first.id, subgroupId, 720);
assert.equal(moved.receipt?.kind, 'move-group');
assert.equal(moved.repository.records[0]?.groupId, subgroupId);
const moveRollback = rollbackGroupMemoryOperation(moved.repository, moved.receipt!.id, 730);
assert.equal(moveRollback.repository.records[0]?.groupId, 'current-group');
assert.equal(moveRollback.receipt?.revertsReceiptId, moved.receipt?.id);
const movedThenChanged = {
  ...moved.repository,
  records: [{ ...moved.repository.records[0]!, summary: '迁移后又被修改。' }, second],
};
assert.equal(rollbackGroupMemoryOperation(movedThenChanged, moved.receipt!.id, 735).receipt, null);
assert.equal(moveGroupMemoryRecordToGroup(withSubgroup, first.id, 'missing', 740).receipt, null);
const disabledSubgroup = invalidateGroupMemorySubgroup(withSubgroup, subgroupId, 750);
assert.equal(moveGroupMemoryRecordToGroup(disabledSubgroup, first.id, subgroupId, 760).receipt, null);
assert.equal(moveGroupMemoryRecordToGroup(invalidated.repository, first.id, subgroupId, 770).receipt, null);

const missing = invalidateGroupMemoryRecord(repository, 'missing-memory', 800);
assert.equal(missing.receipt, null);
assert.equal(missing.repository, repository);

const migrated = normalizeGroupMemoryRepository({ records: [first], schemaVersion: 1 }, [], 900);
assert.equal(migrated.schemaVersion, 8);
assert.deepEqual(migrated.receipts, []);
assert.deepEqual(migrated.receiptArchives, []);
assert.deepEqual(migrated.candidates, []);
assert.deepEqual(migrated.candidateReviewReceipts, []);
assert.deepEqual(migrated.candidateArchives, []);
assert.deepEqual(migrated.evidenceScopeCorrections, []);
assert.deepEqual(migrated.evidenceScopeSnapshots, []);
const snapshotOverflow = normalizeGroupMemoryRepository({
  evidenceScopeSnapshots: Array.from({ length: 301 }, (_, index) => ({
    capturedAt: index + 1, groupId: 'current-group', id: `scope-${index}`,
    recordId: `record-${index}`, source: 'manual-save', sourceMessageId: `message-${index}`,
    sourceRoleId: 'primary', topicId: null,
  })),
  schemaVersion: 8,
}, [], 950);
assert.equal(snapshotOverflow.evidenceScopeSnapshots.length, 300);
assert.equal(snapshotOverflow.evidenceScopeSnapshots[0]?.id, 'scope-1');

let archiveRepository = repository;
const allReceipts = [] as NonNullable<ReturnType<typeof invalidateGroupMemoryRecord>['receipt']>[];
for (let index = 0; index < 51; index += 1) {
  const active = archiveRepository.records[0]?.invalidatedAt === undefined;
  const operation = active
    ? invalidateGroupMemoryRecord(archiveRepository, first.id, 1_000 + index)
    : restoreInvalidatedGroupMemoryRecord(archiveRepository, first.id, 1_000 + index);
  if (operation.receipt) allReceipts.push(operation.receipt);
  archiveRepository = operation.repository;
}
assert.equal(archiveRepository.receipts.length, 50);
assert.equal(archiveRepository.receiptArchives.length, 1);
assert.equal(archiveRepository.receiptArchives[0]?.count, 1);
assert.equal(archiveRepository.receiptArchives[0]?.operationCounts.invalidate, 1);
const reopenedArchive = normalizeGroupMemoryRepository(
  JSON.parse(JSON.stringify(archiveRepository)) as unknown, [], 2_000,
);
assert.equal(reopenedArchive.receiptArchives[0]?.count, 1);
assert.equal(reopenedArchive.schemaVersion, 8);
const migratedOverflow = normalizeGroupMemoryRepository({
  receipts: allReceipts, records: repository.records, schemaVersion: 2,
}, [], 2_100);
assert.equal(migratedOverflow.receipts.length, 50);
assert.equal(migratedOverflow.receiptArchives[0]?.count, 1);

console.log('group memory management smoke ok');
