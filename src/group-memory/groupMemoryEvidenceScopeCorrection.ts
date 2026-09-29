import type {
  GroupMemoryEvidenceScopeCorrection,
  GroupMemoryRepositoryData,
} from './groupMemoryTypes';
import { CURRENT_GROUP_MEMORY_GROUP_ID } from './groupMemoryTypes';
import { isObject, normalizeTimestamp } from './groupMemoryNormalizationUtils';

export const MAX_GROUP_MEMORY_EVIDENCE_SCOPE_CORRECTIONS = 300;

function text(value: unknown, maxLength = 240) {
  return typeof value === 'string'
    ? value.replace(/\s+/gu, ' ').trim().slice(0, maxLength) : '';
}

function normalizeCorrection(value: unknown, now: number) {
  if (!isObject(value)) return null;
  const correction = {
    correctedGroupId: text(value.correctedGroupId, 120),
    correctedRecordId: text(value.correctedRecordId), id: text(value.id),
    occurredAt: normalizeTimestamp(value.occurredAt, now), reason: text(value.reason, 500),
    snapshotId: text(value.snapshotId),
    ...(text(value.supersedesCorrectionId)
      ? { supersedesCorrectionId: text(value.supersedesCorrectionId) } : {}),
  };
  if (!correction.correctedGroupId || !correction.correctedRecordId || !correction.id
    || !correction.reason || !correction.snapshotId) return null;
  return correction satisfies GroupMemoryEvidenceScopeCorrection;
}

export function normalizeGroupMemoryEvidenceScopeCorrections(value: unknown, now: number) {
  const values = Array.isArray(value) ? value : [];
  const byId = new Map<string, GroupMemoryEvidenceScopeCorrection>();
  values.forEach((item) => {
    const correction = normalizeCorrection(item, now);
    if (correction && !byId.has(correction.id)) byId.set(correction.id, correction);
  });
  const corrections = [...byId.values()].slice(-MAX_GROUP_MEMORY_EVIDENCE_SCOPE_CORRECTIONS);
  const retainedById = new Map(corrections.map((item) => [item.id, item]));
  return corrections.map((item) => {
    const previous = item.supersedesCorrectionId
      ? retainedById.get(item.supersedesCorrectionId) : null;
    if (!previous || previous.snapshotId !== item.snapshotId
      || previous.occurredAt > item.occurredAt) {
      const { supersedesCorrectionId: _supersedesCorrectionId, ...unlinked } = item;
      return unlinked;
    }
    return item;
  });
}

export function latestEvidenceScopeCorrection(
  repository: GroupMemoryRepositoryData,
  snapshotId: string,
) {
  return repository.evidenceScopeCorrections.filter((item) => item.snapshotId === snapshotId)
    .sort((left, right) => right.occurredAt - left.occurredAt || right.id.localeCompare(left.id))[0]
    ?? null;
}

function knownGroup(repository: GroupMemoryRepositoryData, groupId: string) {
  return groupId === CURRENT_GROUP_MEMORY_GROUP_ID
    || repository.subgroups.some((item) => item.id === groupId);
}

export function appendGroupMemoryEvidenceScopeCorrection(
  repository: GroupMemoryRepositoryData,
  input: { correctedGroupId: string; correctedRecordId: string; reason: string; snapshotId: string },
  now = Date.now(),
) {
  const reason = text(input.reason, 500);
  const snapshot = repository.evidenceScopeSnapshots.find((item) => item.id === input.snapshotId);
  const record = repository.records.find((item) => item.id === input.correctedRecordId);
  if (!snapshot || !record || !reason || !knownGroup(repository, input.correctedGroupId)) {
    return repository;
  }
  const previous = latestEvidenceScopeCorrection(repository, snapshot.id);
  if (previous?.correctedGroupId === input.correctedGroupId
    && previous.correctedRecordId === input.correctedRecordId) return repository;
  const baseId = `group-memory-scope-correction-${now}-${snapshot.id}`;
  let id = baseId;
  let suffix = 1;
  while (repository.evidenceScopeCorrections.some((item) => item.id === id)) {
    id = `${baseId}-${suffix++}`;
  }
  const correction: GroupMemoryEvidenceScopeCorrection = {
    correctedGroupId: input.correctedGroupId, correctedRecordId: record.id,
    id, occurredAt: now, reason, snapshotId: snapshot.id,
    ...(previous ? { supersedesCorrectionId: previous.id } : {}),
  };
  return {
    ...repository,
    evidenceScopeCorrections: normalizeGroupMemoryEvidenceScopeCorrections(
      [...repository.evidenceScopeCorrections, correction], now,
    ),
  };
}
