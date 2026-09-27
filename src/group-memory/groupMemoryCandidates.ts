import type {
  GroupMemoryCandidate,
  GroupMemoryCandidateReviewDecision,
  GroupMemoryCandidateReviewReceipt,
  GroupMemoryRepositoryData,
  StoredGroupMemoryRecord,
} from './groupMemoryTypes';
import { archiveReviewedGroupMemoryCandidates } from './groupMemoryCandidateArchive';
import { CURRENT_GROUP_MEMORY_GROUP_ID } from './groupMemoryTypes';
import { isWritableGroupMemoryGroup } from './groupMemorySubgroups';
import { appendGroupMemoryEvidenceScopeSnapshot } from './groupMemoryEvidenceScope';

export type GroupMemoryCandidateReviewReason =
  | 'applied'
  | 'candidate-not-found'
  | 'candidate-not-pending'
  | 'evidence-mismatch'
  | 'group-not-writable'
  | 'record-conflict'
  | 'review-not-found'
  | 'candidate-status-changed'
  | 'record-changed-after-approval'
  | 'already-reverted';

export interface GroupMemoryCandidateReviewResult {
  reason: GroupMemoryCandidateReviewReason;
  receipt: GroupMemoryCandidateReviewReceipt | null;
  repository: GroupMemoryRepositoryData;
}

function replaceCandidate(
  candidates: GroupMemoryCandidate[],
  replacement: GroupMemoryCandidate,
) {
  return candidates.map((candidate) => candidate.id === replacement.id ? replacement : candidate);
}

function replaceRecord(
  records: StoredGroupMemoryRecord[],
  recordId: string,
  replacement: StoredGroupMemoryRecord | null,
) {
  const recordsById = new Map(records.map((record) => [record.id, record]));
  if (replacement) recordsById.set(recordId, replacement);
  else recordsById.delete(recordId);
  return [...recordsById.values()].sort((left, right) => left.createdAt - right.createdAt);
}

function unchanged(
  repository: GroupMemoryRepositoryData,
  reason: Exclude<GroupMemoryCandidateReviewReason, 'applied'>,
): GroupMemoryCandidateReviewResult {
  return { reason, receipt: null, repository };
}

function createReviewReceipt(options: {
  candidate: GroupMemoryCandidate;
  decision: GroupMemoryCandidateReviewDecision;
  nextStatus: GroupMemoryCandidate['status'];
  now: number;
  recordAfter: StoredGroupMemoryRecord | null;
  recordBefore: StoredGroupMemoryRecord | null;
  repository: GroupMemoryRepositoryData;
  revertsReceiptId?: string;
}) {
  const baseId = `group-memory-candidate-review-${options.now}-${options.decision}-${options.candidate.id}`;
  let id = baseId;
  let suffix = 1;
  while (options.repository.candidateReviewReceipts.some((receipt) => receipt.id === id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }
  return {
    candidateId: options.candidate.id, decision: options.decision, id,
    nextStatus: options.nextStatus, occurredAt: options.now,
    previousStatus: options.candidate.status,
    recordAfter: options.recordAfter, recordBefore: options.recordBefore,
    ...(options.revertsReceiptId ? { revertsReceiptId: options.revertsReceiptId } : {}),
  } satisfies GroupMemoryCandidateReviewReceipt;
}

function commitReview(
  repository: GroupMemoryRepositoryData,
  candidate: GroupMemoryCandidate,
  receipt: GroupMemoryCandidateReviewReceipt,
): GroupMemoryCandidateReviewResult {
  const nextRepository = {
    ...repository,
    candidateReviewReceipts: [...repository.candidateReviewReceipts, receipt],
    candidates: replaceCandidate(repository.candidates, candidate),
    records: receipt.decision === 'reject'
      ? repository.records
      : replaceRecord(repository.records, candidate.proposedRecord.id, receipt.recordAfter),
  };
  const withScope = receipt.decision === 'approve' && receipt.recordAfter
    ? appendGroupMemoryEvidenceScopeSnapshot(nextRepository, {
      capturedAt: receipt.occurredAt, groupId: receipt.recordAfter.groupId,
      id: `group-memory-scope-${receipt.id}`, recordId: receipt.recordAfter.id,
      source: 'candidate-approval', sourceMessageId: candidate.evidence.sourceMessageId,
      sourceRoleId: candidate.evidence.sourceRoleId, topicId: candidate.evidence.topicId,
    })
    : nextRepository;
  return {
    reason: 'applied',
    receipt,
    repository: archiveReviewedGroupMemoryCandidates(withScope, receipt.occurredAt),
  };
}

export function enqueueGroupMemoryCandidate(
  repository: GroupMemoryRepositoryData,
  candidate: GroupMemoryCandidate,
) {
  if (repository.candidates.some((current) => current.id === candidate.id)) return repository;
  return { ...repository, candidates: [...repository.candidates, candidate] };
}

export function approveGroupMemoryCandidate(
  repository: GroupMemoryRepositoryData,
  candidateId: string,
  now = Date.now(),
  targetGroupId = CURRENT_GROUP_MEMORY_GROUP_ID,
): GroupMemoryCandidateReviewResult {
  const candidate = repository.candidates.find((current) => current.id === candidateId);
  if (!candidate) return unchanged(repository, 'candidate-not-found');
  if (candidate.status !== 'pending') return unchanged(repository, 'candidate-not-pending');
  if (!isWritableGroupMemoryGroup(repository, targetGroupId)) {
    return unchanged(repository, 'group-not-writable');
  }
  const recordBefore = repository.records.find((record) => record.id === candidate.proposedRecord.id) ?? null;
  const approvedRecord = { ...candidate.proposedRecord, groupId: targetGroupId };
  const evidenceMismatch = candidate.evidence.sourceRoleId !== candidate.proposedRecord.sourceRoleId
    || candidate.evidence.topicId !== candidate.proposedRecord.topicId
    || candidate.proposedRecord.invalidatedAt !== undefined;
  const conflictingRecord = recordBefore
    && (recordBefore.updatedAt > candidate.proposedRecord.updatedAt
      || (recordBefore.updatedAt === candidate.proposedRecord.updatedAt
        && !recordsMatch(recordBefore, approvedRecord)));
  if (evidenceMismatch) return unchanged(repository, 'evidence-mismatch');
  if (conflictingRecord) return unchanged(repository, 'record-conflict');
  const approvedCandidate = { ...candidate, reviewedAt: now, status: 'approved' as const };
  const receipt = createReviewReceipt({
    candidate, decision: 'approve', nextStatus: 'approved', now,
    recordAfter: approvedRecord, recordBefore, repository,
  });
  return commitReview(repository, approvedCandidate, receipt);
}

export function rejectGroupMemoryCandidate(
  repository: GroupMemoryRepositoryData,
  candidateId: string,
  now = Date.now(),
): GroupMemoryCandidateReviewResult {
  const candidate = repository.candidates.find((current) => current.id === candidateId);
  if (!candidate) return unchanged(repository, 'candidate-not-found');
  if (candidate.status !== 'pending') return unchanged(repository, 'candidate-not-pending');
  const rejectedCandidate = { ...candidate, reviewedAt: now, status: 'rejected' as const };
  const receipt = createReviewReceipt({
    candidate, decision: 'reject', nextStatus: 'rejected', now,
    recordAfter: null, recordBefore: null, repository,
  });
  return commitReview(repository, rejectedCandidate, receipt);
}

export function getLatestGroupMemoryCandidateReview(
  repository: GroupMemoryRepositoryData,
  candidateId: string,
) {
  const revertedIds = new Set(repository.candidateReviewReceipts
    .filter((receipt) => receipt.decision === 'rollback' && receipt.revertsReceiptId)
    .map((receipt) => receipt.revertsReceiptId));
  return [...repository.candidateReviewReceipts].reverse().find((receipt) => (
    receipt.candidateId === candidateId && receipt.decision !== 'rollback'
      && !revertedIds.has(receipt.id)
  )) ?? null;
}

function recordsMatch(
  current: StoredGroupMemoryRecord | null,
  expected: StoredGroupMemoryRecord | null,
) {
  if (!current || !expected) return current === expected;
  return JSON.stringify(current) === JSON.stringify(expected);
}

export function rollbackGroupMemoryCandidateReview(
  repository: GroupMemoryRepositoryData,
  candidateId: string,
  now = Date.now(),
): GroupMemoryCandidateReviewResult {
  const candidate = repository.candidates.find((current) => current.id === candidateId);
  const target = getLatestGroupMemoryCandidateReview(repository, candidateId);
  if (!candidate) return unchanged(repository, 'candidate-not-found');
  if (!target) {
    const hasReview = repository.candidateReviewReceipts.some((item) => item.candidateId === candidateId);
    return unchanged(repository, hasReview ? 'already-reverted' : 'review-not-found');
  }
  if (candidate.status !== target.nextStatus) {
    return unchanged(repository, 'candidate-status-changed');
  }
  const currentRecord = repository.records.find((record) => record.id === candidate.proposedRecord.id) ?? null;
  if (target.decision === 'approve' && !recordsMatch(currentRecord, target.recordAfter)) {
    return unchanged(repository, 'record-changed-after-approval');
  }
  const pendingCandidate = { ...candidate, reviewedAt: undefined, status: 'pending' as const };
  const recordAfter = target.decision === 'approve' ? target.recordBefore : currentRecord;
  const receipt = createReviewReceipt({
    candidate, decision: 'rollback', nextStatus: 'pending', now,
    recordAfter, recordBefore: currentRecord,
    repository, revertsReceiptId: target.id,
  });
  return commitReview(repository, pendingCandidate, receipt);
}
