import { useMemo, useState } from 'react';
import {
  getLatestRollbackableGroupMemoryReceipt,
  invalidateGroupMemoryRecord,
  moveGroupMemoryRecordToGroup,
  resolveGroupMemoryConflict,
  restoreInvalidatedGroupMemoryRecord,
  rollbackGroupMemoryOperation,
  type GroupMemoryOperationResult,
  type GroupMemoryRepositoryData,
  type StoredGroupMemoryRecord,
} from '../../group-memory';

export function useSettingsGroupMemoryManagement(
  repository: GroupMemoryRepositoryData,
  onChange: (repository: GroupMemoryRepositoryData) => void,
) {
  const [conflictIds, setConflictIds] = useState<string[]>([]);
  const rollbackableReceipt = getLatestRollbackableGroupMemoryReceipt(repository);
  const conflictRecords = useMemo(() => conflictIds
    .map((id) => repository.records.find((record) => record.id === id))
    .filter((record): record is StoredGroupMemoryRecord => (
      Boolean(record) && record?.invalidatedAt === undefined
    )), [conflictIds, repository.records]);

  const applyResult = (result: GroupMemoryOperationResult) => {
    if (result.receipt) onChange(result.repository);
  };
  const invalidate = (id: string) => {
    applyResult(invalidateGroupMemoryRecord(repository, id));
    setConflictIds((current) => current.filter((candidate) => candidate !== id));
  };
  const restore = (id: string) => applyResult(
    restoreInvalidatedGroupMemoryRecord(repository, id),
  );
  const moveToGroup = (id: string, groupId: string) => applyResult(
    moveGroupMemoryRecordToGroup(repository, id, groupId),
  );
  const toggleConflict = (id: string) => setConflictIds((current) => (
    current.includes(id)
      ? current.filter((candidate) => candidate !== id)
      : [...current.slice(-1), id]
  ));
  const selectConflictPair = (firstId: string, secondId: string) => {
    setConflictIds(firstId === secondId ? [firstId] : [firstId, secondId]);
  };
  const resolveConflict = (preferredId: string, rejectedId: string) => {
    applyResult(resolveGroupMemoryConflict(repository, preferredId, rejectedId));
    setConflictIds([]);
  };
  const rollback = () => {
    if (!rollbackableReceipt) return;
    applyResult(rollbackGroupMemoryOperation(repository, rollbackableReceipt.id));
    setConflictIds([]);
  };

  return {
    conflictIds, conflictRecords, invalidate, moveToGroup, resolveConflict, restore,
    repository, rollback, rollbackableReceipt, selectConflictPair, toggleConflict,
  };
}
