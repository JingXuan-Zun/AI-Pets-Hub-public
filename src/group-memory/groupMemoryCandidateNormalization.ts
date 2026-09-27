import type {
  GroupMemoryCandidate,
  GroupMemoryCandidateEvidence,
  GroupMemoryCandidateEvidenceKind,
  GroupMemoryCandidateReviewDecision,
  GroupMemoryCandidateReviewReceipt,
  GroupMemoryCandidateStatus,
} from './groupMemoryTypes';
import {
  isObject,
  normalizeStoredGroupMemoryRecord,
  normalizeTimestamp,
} from './groupMemoryNormalizationUtils';

const VALID_STATUSES = new Set<GroupMemoryCandidateStatus>(['pending', 'approved', 'rejected']);
const VALID_EVIDENCE_KINDS = new Set<GroupMemoryCandidateEvidenceKind>([
  'chat-message', 'task-result',
]);
const VALID_DECISIONS = new Set<GroupMemoryCandidateReviewDecision>([
  'approve', 'reject', 'rollback',
]);
const MAX_EVIDENCE_LENGTH = 500;

function normalizeEvidence(value: unknown, now: number): GroupMemoryCandidateEvidence | null {
  if (!isObject(value)) return null;
  const excerpt = typeof value.excerpt === 'string'
    ? value.excerpt.replace(/\s+/gu, ' ').trim().slice(0, MAX_EVIDENCE_LENGTH) : '';
  const sourceMessageId = typeof value.sourceMessageId === 'string' ? value.sourceMessageId.trim() : '';
  const sourceRoleId = typeof value.sourceRoleId === 'string' ? value.sourceRoleId.trim() : '';
  const kind = VALID_EVIDENCE_KINDS.has(value.kind as GroupMemoryCandidateEvidenceKind)
    ? value.kind as GroupMemoryCandidateEvidenceKind : null;
  if (!excerpt || !sourceMessageId || !sourceRoleId || !kind) return null;
  return {
    capturedAt: normalizeTimestamp(value.capturedAt, now), excerpt, kind, sourceMessageId,
    sourceRoleId,
    topicId: typeof value.topicId === 'string' && value.topicId.trim() ? value.topicId.trim() : null,
  };
}

function normalizeCandidate(value: unknown, now: number): GroupMemoryCandidate | null {
  if (!isObject(value)) return null;
  const id = typeof value.id === 'string' ? value.id.trim() : '';
  const evidence = normalizeEvidence(value.evidence, now);
  const proposedRecord = normalizeStoredGroupMemoryRecord(value.proposedRecord, now);
  const status = VALID_STATUSES.has(value.status as GroupMemoryCandidateStatus)
    ? value.status as GroupMemoryCandidateStatus : null;
  if (!id || !evidence || !proposedRecord || !status) return null;
  return {
    createdAt: normalizeTimestamp(value.createdAt, now), evidence, id, proposedRecord, status,
    ...(value.reviewedAt !== null && value.reviewedAt !== undefined
      ? { reviewedAt: normalizeTimestamp(value.reviewedAt, now) } : {}),
  };
}

function normalizeReviewReceipt(
  value: unknown,
  now: number,
): GroupMemoryCandidateReviewReceipt | null {
  if (!isObject(value)) return null;
  const candidateId = typeof value.candidateId === 'string' ? value.candidateId.trim() : '';
  const id = typeof value.id === 'string' ? value.id.trim() : '';
  const decision = VALID_DECISIONS.has(value.decision as GroupMemoryCandidateReviewDecision)
    ? value.decision as GroupMemoryCandidateReviewDecision : null;
  const previousStatus = VALID_STATUSES.has(value.previousStatus as GroupMemoryCandidateStatus)
    ? value.previousStatus as GroupMemoryCandidateStatus : null;
  const nextStatus = VALID_STATUSES.has(value.nextStatus as GroupMemoryCandidateStatus)
    ? value.nextStatus as GroupMemoryCandidateStatus : null;
  if (!candidateId || !id || !decision || !previousStatus || !nextStatus) return null;
  return {
    candidateId, decision, id, nextStatus, previousStatus,
    occurredAt: normalizeTimestamp(value.occurredAt, now),
    recordAfter: value.recordAfter === null
      ? null : normalizeStoredGroupMemoryRecord(value.recordAfter, now),
    recordBefore: value.recordBefore === null
      ? null : normalizeStoredGroupMemoryRecord(value.recordBefore, now),
    ...(typeof value.revertsReceiptId === 'string' && value.revertsReceiptId.trim()
      ? { revertsReceiptId: value.revertsReceiptId.trim() } : {}),
  };
}

function dedupeById<T extends { id: string }>(values: T[]) {
  return [...new Map(values.map((value) => [value.id, value])).values()];
}

export function normalizeGroupMemoryCandidates(value: unknown, now: number) {
  if (!Array.isArray(value)) return [];
  return dedupeById(value.map((item) => normalizeCandidate(item, now))
    .filter((item): item is GroupMemoryCandidate => Boolean(item)));
}

export function normalizeGroupMemoryCandidateReviewReceipts(value: unknown, now: number) {
  if (!Array.isArray(value)) return [];
  return dedupeById(value.map((item) => normalizeReviewReceipt(item, now))
    .filter((item): item is GroupMemoryCandidateReviewReceipt => Boolean(item)));
}
