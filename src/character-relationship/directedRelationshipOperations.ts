import {
  commitDirectedRelationshipOperation,
  createDirectedRelationshipAuditId,
  normalizeDirectedRelationshipRepository,
} from './directedRelationshipRepository';
import type {
  DirectedRelationshipAuditEntry,
  DirectedRelationshipOperationKind,
  DirectedRelationshipRecord,
  DirectedRelationshipRepositoryData,
} from './directedRelationshipTypes';

function auditId(now: number, kind: DirectedRelationshipOperationKind, relationshipId: string) {
  return `relationship-audit-${now}-${kind}-${relationshipId}`;
}

function commit(options: {
  after: DirectedRelationshipRecord | null;
  before: DirectedRelationshipRecord | null;
  kind: DirectedRelationshipOperationKind;
  now: number;
  reason: string;
  repository: DirectedRelationshipRepositoryData;
  revertsAuditId?: string;
}) {
  const relationshipId = options.after?.id ?? options.before?.id;
  if (!relationshipId) return options.repository;
  const audit: DirectedRelationshipAuditEntry = {
    after: options.after, before: options.before,
    id: createDirectedRelationshipAuditId(
      options.repository, auditId(options.now, options.kind, relationshipId),
    ), kind: options.kind,
    reason: options.reason, recordedAt: options.now, relationshipId,
    ...(options.revertsAuditId ? { revertsAuditId: options.revertsAuditId } : {}),
    source: 'correction',
  };
  return commitDirectedRelationshipOperation(options.repository, audit);
}

export function invalidateDirectedRelationship(
  repository: DirectedRelationshipRepositoryData,
  relationshipId: string,
  now = Date.now(),
) {
  const before = repository.records.find((record) => record.id === relationshipId);
  if (!before || before.invalidatedAt !== undefined) return repository;
  const after = { ...before, invalidatedAt: now, updatedAt: Math.max(before.updatedAt, now) };
  return commit({ after, before, kind: 'invalidate', now, reason: 'manual invalidation', repository });
}

export function restoreDirectedRelationship(
  repository: DirectedRelationshipRepositoryData,
  relationshipId: string,
  now = Date.now(),
) {
  const before = repository.records.find((record) => record.id === relationshipId);
  if (!before || before.invalidatedAt === undefined) return repository;
  const { invalidatedAt: _invalidatedAt, ...active } = before;
  const after = { ...active, updatedAt: Math.max(before.updatedAt, now) };
  return commit({ after, before, kind: 'restore', now, reason: 'manual restoration', repository });
}

export function getLatestRollbackableRelationshipAudit(
  repository: DirectedRelationshipRepositoryData,
) {
  const revertedIds = new Set(repository.auditTrail
    .filter((entry) => entry.kind === 'rollback' && entry.revertsAuditId)
    .map((entry) => entry.revertsAuditId));
  const latest = [...repository.auditTrail].reverse().find((entry) => (
    entry.kind !== 'rollback' && entry.kind !== 'remove-role' && !revertedIds.has(entry.id)
  ));
  return latest && !latest.reason.startsWith('approved relationship candidate ') ? latest : null;
}

export function rollbackDirectedRelationshipOperation(
  repository: DirectedRelationshipRepositoryData,
  auditIdToRevert: string,
  now = Date.now(),
) {
  const target = getLatestRollbackableRelationshipAudit(repository);
  if (!target || target.id !== auditIdToRevert) return repository;
  const before = repository.records.find((record) => record.id === target.relationshipId) ?? null;
  return commit({
    after: target.before, before, kind: 'rollback', now,
    reason: `rollback ${target.id}`, repository, revertsAuditId: target.id,
  });
}

export function pruneDirectedRelationshipsForRole(
  repository: DirectedRelationshipRepositoryData,
  roleId: string,
  now = Date.now(),
) {
  const withoutRecords = repository.records
    .filter((record) => record.sourceRoleId === roleId || record.targetRoleId === roleId)
    .reduce((current, before) => commit({
      after: null, before, kind: 'remove-role', now,
      reason: `removed role ${roleId}`, repository: current,
    }), repository);
  const removedCandidateIds = new Set(withoutRecords.candidates
    .filter((candidate) => candidate.sourceRoleId === roleId || candidate.targetRoleId === roleId)
    .map((candidate) => candidate.id));
  return normalizeDirectedRelationshipRepository({
    ...withoutRecords,
    behaviorTraces: withoutRecords.behaviorTraces.filter((trace) => (
      trace.sourceRoleId !== roleId
      && !trace.addressedRoleIds.includes(roleId)
      && !trace.policies.some((policy) => policy.targetRoleId === roleId)
    )),
    candidates: withoutRecords.candidates.filter((candidate) => !removedCandidateIds.has(candidate.id)),
    candidateReviewReceipts: withoutRecords.candidateReviewReceipts
      .filter((receipt) => !removedCandidateIds.has(receipt.candidateId)),
    shadowObservations: withoutRecords.shadowObservations
      .filter((observation) => !removedCandidateIds.has(observation.candidateId)),
  });
}
