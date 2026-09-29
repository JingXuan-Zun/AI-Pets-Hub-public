import type {
  GroupMemoryEvidenceScopeSnapshot,
  GroupMemoryEvidenceScopeSnapshotSource,
  GroupMemoryRepositoryData,
} from './groupMemoryTypes';
import { isObject, normalizeTimestamp } from './groupMemoryNormalizationUtils';

export const MAX_GROUP_MEMORY_EVIDENCE_SCOPE_SNAPSHOTS = 300;
const VALID_SOURCES = new Set<GroupMemoryEvidenceScopeSnapshotSource>([
  'candidate-approval', 'manual-save',
]);

function text(value: unknown, maxLength = 240) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function normalizeSnapshot(value: unknown, now: number): GroupMemoryEvidenceScopeSnapshot | null {
  if (!isObject(value)) return null;
  const source = VALID_SOURCES.has(value.source as GroupMemoryEvidenceScopeSnapshotSource)
    ? value.source as GroupMemoryEvidenceScopeSnapshotSource : null;
  const snapshot = {
    capturedAt: normalizeTimestamp(value.capturedAt, now), groupId: text(value.groupId, 120),
    id: text(value.id), recordId: text(value.recordId), source,
    sourceMessageId: text(value.sourceMessageId), sourceRoleId: text(value.sourceRoleId, 120),
    topicId: text(value.topicId, 120) || null,
  };
  if (!snapshot.id || !snapshot.groupId || !snapshot.recordId || !snapshot.source
    || !snapshot.sourceMessageId || !snapshot.sourceRoleId) return null;
  return snapshot as GroupMemoryEvidenceScopeSnapshot;
}

export function normalizeGroupMemoryEvidenceScopeSnapshots(value: unknown, now: number) {
  const values = Array.isArray(value) ? value : [];
  const byId = new Map<string, GroupMemoryEvidenceScopeSnapshot>();
  values.forEach((item) => {
    const snapshot = normalizeSnapshot(item, now);
    if (snapshot) byId.set(snapshot.id, snapshot);
  });
  return [...byId.values()].slice(-MAX_GROUP_MEMORY_EVIDENCE_SCOPE_SNAPSHOTS);
}

export function appendGroupMemoryEvidenceScopeSnapshot(
  repository: GroupMemoryRepositoryData,
  snapshot: GroupMemoryEvidenceScopeSnapshot,
) {
  const record = repository.records.find((item) => item.id === snapshot.recordId);
  if (!record || record.invalidatedAt !== undefined || record.groupId !== snapshot.groupId) {
    return repository;
  }
  return {
    ...repository,
    evidenceScopeSnapshots: normalizeGroupMemoryEvidenceScopeSnapshots(
      [...repository.evidenceScopeSnapshots, snapshot], snapshot.capturedAt,
    ),
  };
}
