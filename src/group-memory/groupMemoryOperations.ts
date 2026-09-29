import type {
  GroupMemoryOperationKind,
  GroupMemoryOperationReceipt,
  GroupMemoryRecordChange,
  GroupMemoryRepositoryData,
  StoredGroupMemoryRecord,
} from './groupMemoryTypes';
import {
  MAX_ACTIVE_GROUP_MEMORY_RECEIPTS,
  archiveGroupMemoryReceipts,
} from './groupMemoryReceiptArchive';
import { isWritableGroupMemoryGroup } from './groupMemorySubgroups';

export interface GroupMemoryOperationResult {
  receipt: GroupMemoryOperationReceipt | null;
  repository: GroupMemoryRepositoryData;
}

function createReceipt(
  repository: GroupMemoryRepositoryData,
  kind: GroupMemoryOperationKind,
  changes: GroupMemoryRecordChange[],
  occurredAt: number,
  revertsReceiptId?: string,
): GroupMemoryOperationReceipt {
  const baseId = `group-memory-op-${occurredAt}-${kind}-${changes.map((change) => change.recordId).join('-')}`;
  let id = baseId;
  let suffix = 1;
  while (repository.receipts.some((receipt) => receipt.id === id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }
  return {
    changes,
    id,
    kind,
    occurredAt,
    ...(revertsReceiptId ? { revertsReceiptId } : {}),
  };
}

function applyChanges(
  records: StoredGroupMemoryRecord[],
  changes: GroupMemoryRecordChange[],
) {
  const recordsById = new Map(records.map((record) => [record.id, record]));
  changes.forEach((change) => {
    if (change.after) recordsById.set(change.recordId, change.after);
    else recordsById.delete(change.recordId);
  });
  return [...recordsById.values()].sort((left, right) => left.createdAt - right.createdAt);
}

function commitOperation(
  repository: GroupMemoryRepositoryData,
  receipt: GroupMemoryOperationReceipt,
): GroupMemoryOperationResult {
  const nextReceipts = [...repository.receipts, receipt];
  const overflowCount = Math.max(0, nextReceipts.length - MAX_ACTIVE_GROUP_MEMORY_RECEIPTS);
  const archivedReceipts = nextReceipts.slice(0, overflowCount);
  return {
    receipt,
    repository: {
      ...repository,
      receiptArchives: archiveGroupMemoryReceipts(
        repository.receiptArchives, archivedReceipts, receipt.occurredAt,
      ),
      receipts: nextReceipts.slice(-MAX_ACTIVE_GROUP_MEMORY_RECEIPTS),
      records: applyChanges(repository.records, receipt.changes),
    },
  };
}

function unchanged(repository: GroupMemoryRepositoryData): GroupMemoryOperationResult {
  return { receipt: null, repository };
}

function recordsMatch(
  current: StoredGroupMemoryRecord | null,
  expected: StoredGroupMemoryRecord | null,
) {
  if (!current || !expected) return current === expected;
  return JSON.stringify(current) === JSON.stringify(expected);
}

function withInvalidatedAt(record: StoredGroupMemoryRecord, now: number) {
  return { ...record, invalidatedAt: now, updatedAt: Math.max(record.updatedAt, now) };
}

function withoutInvalidatedAt(record: StoredGroupMemoryRecord, now: number) {
  const { invalidatedAt: _invalidatedAt, ...activeRecord } = record;
  return { ...activeRecord, updatedAt: Math.max(record.updatedAt, now) };
}

export function invalidateGroupMemoryRecord(
  repository: GroupMemoryRepositoryData,
  recordId: string,
  now = Date.now(),
): GroupMemoryOperationResult {
  const record = repository.records.find((candidate) => candidate.id === recordId);
  if (!record || record.invalidatedAt !== undefined) return unchanged(repository);
  const after = withInvalidatedAt(record, now);
  const changes = [{ after, before: record, recordId }];
  return commitOperation(repository, createReceipt(repository, 'invalidate', changes, now));
}

export function restoreInvalidatedGroupMemoryRecord(
  repository: GroupMemoryRepositoryData,
  recordId: string,
  now = Date.now(),
): GroupMemoryOperationResult {
  const record = repository.records.find((candidate) => candidate.id === recordId);
  if (!record || record.invalidatedAt === undefined) return unchanged(repository);
  const after = withoutInvalidatedAt(record, now);
  const changes = [{ after, before: record, recordId }];
  return commitOperation(repository, createReceipt(repository, 'restore', changes, now));
}

export function moveGroupMemoryRecordToGroup(
  repository: GroupMemoryRepositoryData,
  recordId: string,
  targetGroupId: string,
  now = Date.now(),
): GroupMemoryOperationResult {
  const record = repository.records.find((candidate) => candidate.id === recordId);
  if (!record || record.invalidatedAt !== undefined || record.groupId === targetGroupId) {
    return unchanged(repository);
  }
  if (!isWritableGroupMemoryGroup(repository, targetGroupId)) return unchanged(repository);
  const after = { ...record, groupId: targetGroupId, updatedAt: Math.max(record.updatedAt, now) };
  const changes = [{ after, before: record, recordId }];
  return commitOperation(repository, createReceipt(repository, 'move-group', changes, now));
}

export function resolveGroupMemoryConflict(
  repository: GroupMemoryRepositoryData,
  preferredRecordId: string,
  rejectedRecordId: string,
  now = Date.now(),
): GroupMemoryOperationResult {
  const preferred = repository.records.find((record) => record.id === preferredRecordId);
  const rejected = repository.records.find((record) => record.id === rejectedRecordId);
  const invalidPair = !preferred || !rejected || preferred.id === rejected.id
    || preferred.groupId !== rejected.groupId || preferred.invalidatedAt !== undefined
    || rejected.invalidatedAt !== undefined;
  if (invalidPair || !preferred || !rejected) return unchanged(repository);
  const preferredAfter = {
    ...preferred, supersedesId: rejected.id, updatedAt: Math.max(preferred.updatedAt, now),
  };
  const rejectedAfter = withInvalidatedAt(rejected, now);
  const changes = [
    { after: preferredAfter, before: preferred, recordId: preferred.id },
    { after: rejectedAfter, before: rejected, recordId: rejected.id },
  ];
  return commitOperation(repository, createReceipt(repository, 'resolve-conflict', changes, now));
}

export function getLatestRollbackableGroupMemoryReceipt(
  repository: GroupMemoryRepositoryData,
) {
  const revertedIds = new Set(repository.receipts
    .filter((receipt) => receipt.kind === 'rollback' && receipt.revertsReceiptId)
    .map((receipt) => receipt.revertsReceiptId));
  return [...repository.receipts].reverse().find((receipt) => (
    receipt.kind !== 'rollback' && !revertedIds.has(receipt.id)
  )) ?? null;
}

export function rollbackGroupMemoryOperation(
  repository: GroupMemoryRepositoryData,
  receiptId: string,
  now = Date.now(),
): GroupMemoryOperationResult {
  const target = getLatestRollbackableGroupMemoryReceipt(repository);
  if (!target || target.id !== receiptId) return unchanged(repository);
  const currentMatches = target.changes.every((change) => recordsMatch(
    repository.records.find((record) => record.id === change.recordId) ?? null,
    change.after,
  ));
  if (!currentMatches) return unchanged(repository);
  const changes = target.changes.map((change) => ({
    after: change.before,
    before: repository.records.find((record) => record.id === change.recordId) ?? null,
    recordId: change.recordId,
  }));
  const receipt = createReceipt(repository, 'rollback', changes, now, target.id);
  return commitOperation(repository, receipt);
}
