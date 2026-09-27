import {
  DIRECTED_RELATIONSHIP_SCHEMA_VERSION,
  EMPTY_DIRECTED_RELATIONSHIP_REPOSITORY,
  type DirectedRelationshipAuditEntry,
  type DirectedRelationshipCandidate,
  type DirectedRelationshipCandidateReviewReceipt,
  type DirectedRelationshipDimensions,
  type DirectedRelationshipRecord,
  type DirectedRelationshipRepositoryData,
  type DirectedRelationshipOperationKind,
  type DirectedRelationshipUpdateSource,
  type DirectedRelationshipShadowObservation,
} from './directedRelationshipTypes';
import { normalizeDirectedRelationshipBehaviorTraces } from './directedRelationshipBehaviorTrace';

const MAX_RECORDS = 200;
const MAX_AUDIT_ENTRIES = 200;
const MAX_CANDIDATES = 200;
const MAX_REVIEW_RECEIPTS = 300;
const MAX_SHADOW_OBSERVATIONS = 500;
const UPDATE_SOURCES = new Set<DirectedRelationshipUpdateSource>(['correction', 'import', 'manual']);
const OPERATION_KINDS = new Set<DirectedRelationshipOperationKind>([
  'invalidate', 'remove-role', 'restore', 'rollback', 'upsert',
]);

function text(value: unknown, maxLength = 240) {
  return typeof value === 'string' ? value.replace(/\s+/gu, ' ').trim().slice(0, maxLength) : '';
}

function score(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.min(100, Math.round(numeric))) : 50;
}

function dimensions(value: unknown): DirectedRelationshipDimensions {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return { intimacy: score(input.intimacy), trust: score(input.trust), vigilance: score(input.vigilance) };
}

function deltas(value: unknown): DirectedRelationshipDimensions {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const delta = (current: unknown) => {
    const numeric = Number(current);
    return Number.isFinite(numeric) ? Math.max(-10, Math.min(10, Math.round(numeric))) : 0;
  };
  return { intimacy: delta(input.intimacy), trust: delta(input.trust), vigilance: delta(input.vigilance) };
}

export function buildDirectedRelationshipId(sourceRoleId: string, targetRoleId: string) {
  return `${sourceRoleId.trim()}->${targetRoleId.trim()}`;
}

export function createDirectedRelationshipAuditId(
  repository: DirectedRelationshipRepositoryData,
  baseId: string,
) {
  let id = baseId;
  let suffix = 1;
  while (repository.auditTrail.some((entry) => entry.id === id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }
  return id;
}

function normalizeRecord(value: unknown): DirectedRelationshipRecord | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  const sourceRoleId = text(input.sourceRoleId, 120);
  const targetRoleId = text(input.targetRoleId, 120);
  if (!sourceRoleId || !targetRoleId || sourceRoleId === targetRoleId) return null;
  const createdAt = Number(input.createdAt);
  const updatedAt = Number(input.updatedAt);
  if (!Number.isFinite(createdAt) || !Number.isFinite(updatedAt)) return null;
  const invalidatedAt = Number(input.invalidatedAt);
  return {
    createdAt, dimensions: dimensions(input.dimensions), evidenceSummary: text(input.evidenceSummary),
    id: buildDirectedRelationshipId(sourceRoleId, targetRoleId),
    ...(Number.isFinite(invalidatedAt) ? { invalidatedAt } : {}),
    sourceRoleId, targetRoleId, ...(text(input.targetRoleName, 120) ? { targetRoleName: text(input.targetRoleName, 120) } : {}),
    updatedAt,
  };
}

function normalizeAudit(value: unknown): DirectedRelationshipAuditEntry | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  const relationshipId = text(input.relationshipId, 241);
  const id = text(input.id, 300);
  const kind = text(input.kind) as DirectedRelationshipOperationKind;
  const reason = text(input.reason);
  const source = text(input.source) as DirectedRelationshipUpdateSource;
  const recordedAt = Number(input.recordedAt);
  if (!id || !relationshipId || !reason || !OPERATION_KINDS.has(kind)
    || !UPDATE_SOURCES.has(source) || !Number.isFinite(recordedAt)) return null;
  const before = input.before === null ? null : normalizeRecord(input.before);
  const after = input.after === null ? null : normalizeRecord(input.after);
  if (!before && !after) return null;
  return {
    after, before, id, kind, reason, recordedAt, relationshipId,
    ...(text(input.revertsAuditId, 300) ? { revertsAuditId: text(input.revertsAuditId, 300) } : {}),
    source,
  };
}

function normalizeCandidate(value: unknown): DirectedRelationshipCandidate | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  const id = text(input.id, 300);
  const sourceRoleId = text(input.sourceRoleId, 120);
  const targetRoleId = text(input.targetRoleId, 120);
  const createdAt = Number(input.createdAt);
  const baseUpdatedAt = input.baseUpdatedAt === null ? null : Number(input.baseUpdatedAt);
  const status = text(input.status) as DirectedRelationshipCandidate['status'];
  const screeningDecision = text(input.screeningDecision) as DirectedRelationshipCandidate['screeningDecision'];
  if (!id || !sourceRoleId || !targetRoleId || sourceRoleId === targetRoleId
    || !Number.isFinite(createdAt) || (baseUpdatedAt !== null && !Number.isFinite(baseUpdatedAt))
    || !['approved', 'pending', 'rejected'].includes(status)
    || !['blocked', 'manual-review'].includes(screeningDecision)) return null;
  const reviewedAt = Number(input.reviewedAt);
  const allowedReasons = new Set([
    'empty-evidence', 'no-dimension-change', 'question-like', 'self-relationship',
    'target-not-active', 'transient-language', 'valid-change-requires-review',
  ]);
  const screeningReasons = (Array.isArray(input.screeningReasons) ? input.screeningReasons : [])
    .map((reason) => text(reason)).filter((reason) => allowedReasons.has(reason)) as DirectedRelationshipCandidate['screeningReasons'];
  return {
    baseDimensions: dimensions(input.baseDimensions), baseUpdatedAt, createdAt,
    deltas: deltas(input.deltas), evidenceExcerpt: text(input.evidenceExcerpt, 500), id,
    proposedDimensions: dimensions(input.proposedDimensions), reason: text(input.reason),
    ...(Number.isFinite(reviewedAt) ? { reviewedAt } : {}), screeningDecision, screeningReasons,
    sourceMessageId: text(input.sourceMessageId, 300), sourceRoleId,
    sourceRoleName: text(input.sourceRoleName, 120), status, targetRoleId,
    targetRoleName: text(input.targetRoleName, 120),
  };
}

function normalizeReviewReceipt(value: unknown): DirectedRelationshipCandidateReviewReceipt | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  const candidateId = text(input.candidateId, 300);
  const decision = text(input.decision) as DirectedRelationshipCandidateReviewReceipt['decision'];
  const id = text(input.id, 400);
  const occurredAt = Number(input.occurredAt);
  if (!candidateId || !id || !['approve', 'reject', 'rollback'].includes(decision) || !Number.isFinite(occurredAt)) return null;
  const previousStatus = (text(input.previousStatus) || 'pending') as DirectedRelationshipCandidateReviewReceipt['previousStatus'];
  const defaultNextStatus = decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'pending';
  const nextStatus = (text(input.nextStatus) || defaultNextStatus) as DirectedRelationshipCandidateReviewReceipt['nextStatus'];
  if (!['approved', 'pending', 'rejected'].includes(previousStatus)
    || !['approved', 'pending', 'rejected'].includes(nextStatus)) return null;
  return {
    candidateId, decision, id, nextStatus, occurredAt, previousStatus,
    recordAfter: input.recordAfter === null ? null : normalizeRecord(input.recordAfter),
    recordBefore: input.recordBefore === null ? null : normalizeRecord(input.recordBefore),
    ...(text(input.relationshipAuditId, 400) ? { relationshipAuditId: text(input.relationshipAuditId, 400) } : {}),
    ...(text(input.revertsReceiptId, 400) ? { revertsReceiptId: text(input.revertsReceiptId, 400) } : {}),
  };
}

function normalizeShadowObservation(value: unknown): DirectedRelationshipShadowObservation | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  const candidateId = text(input.candidateId, 300);
  const decision = text(input.decision) as DirectedRelationshipShadowObservation['decision'];
  const observedAt = Number(input.observedAt);
  if (!candidateId || !['blocked', 'manual-review'].includes(decision) || !Number.isFinite(observedAt)) return null;
  const reasons = (Array.isArray(input.reasons) ? input.reasons : [])
    .map((reason) => text(reason)).filter(Boolean) as DirectedRelationshipShadowObservation['reasons'];
  return { candidateId, decision, mode: 'shadow', observedAt, reasons };
}

export function normalizeDirectedRelationshipRepository(
  value: unknown,
): DirectedRelationshipRepositoryData {
  if (!value || typeof value !== 'object') return EMPTY_DIRECTED_RELATIONSHIP_REPOSITORY;
  const input = value as Record<string, unknown>;
  const records = (Array.isArray(input.records) ? input.records : [])
    .map(normalizeRecord).filter((record): record is DirectedRelationshipRecord => record !== null)
    .reduce<DirectedRelationshipRecord[]>((result, record) => [
      ...result.filter((item) => item.id !== record.id), record,
    ], []).slice(-MAX_RECORDS);
  const auditTrail = (Array.isArray(input.auditTrail) ? input.auditTrail : [])
    .map(normalizeAudit).filter((entry): entry is DirectedRelationshipAuditEntry => entry !== null)
    .slice(-MAX_AUDIT_ENTRIES);
  const candidates = (Array.isArray(input.candidates) ? input.candidates : [])
    .map(normalizeCandidate).filter((item): item is DirectedRelationshipCandidate => item !== null)
    .slice(-MAX_CANDIDATES);
  const candidateReviewReceipts = (Array.isArray(input.candidateReviewReceipts) ? input.candidateReviewReceipts : [])
    .map(normalizeReviewReceipt).filter((item): item is DirectedRelationshipCandidateReviewReceipt => item !== null)
    .slice(-MAX_REVIEW_RECEIPTS);
  const shadowObservations = (Array.isArray(input.shadowObservations) ? input.shadowObservations : [])
    .map(normalizeShadowObservation).filter((item): item is DirectedRelationshipShadowObservation => item !== null)
    .slice(-MAX_SHADOW_OBSERVATIONS);
  const behaviorTraces = normalizeDirectedRelationshipBehaviorTraces(input.behaviorTraces);
  return {
    auditTrail, behaviorTraces, candidateReviewReceipts, candidates, records,
    schemaVersion: DIRECTED_RELATIONSHIP_SCHEMA_VERSION, shadowObservations,
  };
}

export function upsertDirectedRelationship(
  repository: DirectedRelationshipRepositoryData,
  input: Omit<DirectedRelationshipRecord, 'createdAt' | 'id' | 'updatedAt'>,
  options: { now?: number; reason: string; source: DirectedRelationshipUpdateSource },
) {
  const now = options.now ?? Date.now();
  const normalized = normalizeRecord({ ...input, createdAt: now, updatedAt: now });
  const reason = text(options.reason);
  if (!normalized || !reason || !UPDATE_SOURCES.has(options.source)) return repository;
  const current = repository.records.find((record) => record.id === normalized.id);
  if (current && now < current.updatedAt) return repository;
  const record = {
    ...normalized, createdAt: current?.createdAt ?? now,
    updatedAt: Math.max(current?.updatedAt ?? now, now),
  };
  const audit: DirectedRelationshipAuditEntry = {
    after: record, before: current ?? null,
    id: createDirectedRelationshipAuditId(
      repository, `relationship-audit-${now}-upsert-${record.id}`,
    ),
    kind: 'upsert', reason, recordedAt: now, relationshipId: record.id, source: options.source,
  };
  return normalizeDirectedRelationshipRepository({
    ...repository,
    auditTrail: [...repository.auditTrail, audit],
    records: [...repository.records.filter((item) => item.id !== record.id), record],
  });
}

export function commitDirectedRelationshipOperation(
  repository: DirectedRelationshipRepositoryData,
  audit: DirectedRelationshipAuditEntry,
) {
  const records = audit.after
    ? [...repository.records.filter((record) => record.id !== audit.relationshipId), audit.after]
    : repository.records.filter((record) => record.id !== audit.relationshipId);
  return normalizeDirectedRelationshipRepository({
    ...repository,
    auditTrail: [...repository.auditTrail, audit], records,
  });
}
