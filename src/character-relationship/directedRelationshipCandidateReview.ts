import {
  approveDirectedRelationshipCandidate,
  approveDirectedRelationshipCandidateAfterBatchPredecessor,
  rejectDirectedRelationshipCandidate,
  type DirectedRelationshipCandidateReviewReason,
  type DirectedRelationshipCandidateReviewResult,
} from './directedRelationshipCandidates';
import {
  buildDirectedRelationshipId,
  commitDirectedRelationshipOperation,
  createDirectedRelationshipAuditId,
} from './directedRelationshipRepository';
import type {
  DirectedRelationshipAuditEntry,
  DirectedRelationshipCandidate,
  DirectedRelationshipCandidateReviewReceipt,
  DirectedRelationshipRecord,
  DirectedRelationshipRepositoryData,
} from './directedRelationshipTypes';

export function getLatestDirectedRelationshipCandidateReview(
  repository: DirectedRelationshipRepositoryData,
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

function recordsMatch(left: DirectedRelationshipRecord | null, right: DirectedRelationshipRecord | null) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function unchanged(repository: DirectedRelationshipRepositoryData,
  reason: Exclude<DirectedRelationshipCandidateReviewReason, 'applied'>) {
  return { reason, repository } satisfies DirectedRelationshipCandidateReviewResult;
}

function restoreApprovedRecord(options: {
  candidate: DirectedRelationshipCandidate;
  current: DirectedRelationshipRecord | null;
  now: number;
  repository: DirectedRelationshipRepositoryData;
  review: DirectedRelationshipCandidateReviewReceipt;
}) {
  const relationshipId = buildDirectedRelationshipId(options.candidate.sourceRoleId, options.candidate.targetRoleId);
  const audit: DirectedRelationshipAuditEntry = {
    after: options.review.recordBefore, before: options.current,
    id: createDirectedRelationshipAuditId(
      options.repository, `relationship-audit-${options.now}-rollback-${relationshipId}`,
    ),
    kind: 'rollback', reason: `rollback candidate review ${options.review.id}`,
    recordedAt: options.now, relationshipId,
    ...(options.review.relationshipAuditId ? { revertsAuditId: options.review.relationshipAuditId } : {}),
    source: 'correction',
  };
  return { audit, repository: commitDirectedRelationshipOperation(options.repository, audit) };
}

function rollbackReceipt(options: {
  auditId?: string;
  candidate: DirectedRelationshipCandidate;
  current: DirectedRelationshipRecord | null;
  now: number;
  restored: DirectedRelationshipRecord | null;
  review: DirectedRelationshipCandidateReviewReceipt;
  repository: DirectedRelationshipRepositoryData;
}) {
  const baseId = `relationship-review-${options.now}-rollback-${options.candidate.id}`;
  let id = baseId;
  let suffix = 1;
  while (options.repository.candidateReviewReceipts.some((item) => item.id === id)) id = `${baseId}-${suffix++}`;
  return {
    candidateId: options.candidate.id, decision: 'rollback',
    id,
    nextStatus: 'pending', occurredAt: options.now, previousStatus: options.candidate.status,
    recordAfter: options.restored, recordBefore: options.current,
    ...(options.auditId ? { relationshipAuditId: options.auditId } : {}),
    revertsReceiptId: options.review.id,
  } satisfies DirectedRelationshipCandidateReviewReceipt;
}

export function rollbackDirectedRelationshipCandidateReview(
  repository: DirectedRelationshipRepositoryData,
  candidateId: string,
  now = Date.now(),
): DirectedRelationshipCandidateReviewResult {
  const candidate = repository.candidates.find((item) => item.id === candidateId);
  const review = getLatestDirectedRelationshipCandidateReview(repository, candidateId);
  if (!candidate) return unchanged(repository, 'candidate-not-found');
  if (!review) {
    const reviewed = repository.candidateReviewReceipts.some((item) => item.candidateId === candidateId);
    return unchanged(repository, reviewed ? 'already-reverted' : 'review-not-found');
  }
  if (candidate.status !== review.nextStatus) return unchanged(repository, 'candidate-status-changed');
  const relationshipId = buildDirectedRelationshipId(candidate.sourceRoleId, candidate.targetRoleId);
  const current = repository.records.find((record) => record.id === relationshipId) ?? null;
  if (review.decision === 'approve' && !recordsMatch(current, review.recordAfter)) {
    return unchanged(repository, 'record-changed-after-approval');
  }
  const restored = review.decision === 'approve' ? review.recordBefore : current;
  const result = review.decision === 'approve'
    ? restoreApprovedRecord({ candidate, current, now, repository, review })
    : { audit: undefined, repository };
  const { reviewedAt: _reviewedAt, ...withoutReview } = candidate;
  const pending = { ...withoutReview, status: 'pending' as const };
  const receipt = rollbackReceipt({
    auditId: result.audit?.id, candidate, current, now, restored, review, repository: result.repository,
  });
  return {
    reason: 'applied',
    repository: {
      ...result.repository,
      candidateReviewReceipts: [...result.repository.candidateReviewReceipts, receipt].slice(-300),
      candidates: result.repository.candidates.map((item) => item.id === candidate.id ? pending : item),
    },
  };
}

export type DirectedRelationshipBatchReviewResult = {
  appliedCount: number;
  outcomes: DirectedRelationshipCandidateReviewReason[];
  repository: DirectedRelationshipRepositoryData;
};

export function reviewDirectedRelationshipCandidateBatch(
  repository: DirectedRelationshipRepositoryData,
  candidateIds: string[],
  decision: 'approve' | 'reject',
  now = Date.now(),
): DirectedRelationshipBatchReviewResult {
  const uniqueIds = [...new Set(candidateIds)];
  const predecessors = new Map<string, string>();
  let state: DirectedRelationshipBatchReviewResult = {
    appliedCount: 0, outcomes: [], repository,
  };
  uniqueIds.forEach((candidateId, index) => {
    const candidate = state.repository.candidates.find((item) => item.id === candidateId);
    const relationshipId = candidate
      ? buildDirectedRelationshipId(candidate.sourceRoleId, candidate.targetRoleId) : '';
    const predecessor = predecessors.get(relationshipId);
    const result = decision === 'reject'
      ? rejectDirectedRelationshipCandidate(state.repository, candidateId, now + index)
      : predecessor
        ? approveDirectedRelationshipCandidateAfterBatchPredecessor(
          state.repository, candidateId, predecessor, now + index,
        )
        : approveDirectedRelationshipCandidate(state.repository, candidateId, now + index);
    state = { appliedCount: state.appliedCount + Number(result.reason === 'applied'),
      outcomes: [...state.outcomes, result.reason], repository: result.repository };
    if (decision === 'approve' && result.reason === 'applied' && relationshipId) {
      const auditId = result.repository.auditTrail.at(-1)?.id;
      if (auditId) predecessors.set(relationshipId, auditId);
    }
  });
  return state;
}
