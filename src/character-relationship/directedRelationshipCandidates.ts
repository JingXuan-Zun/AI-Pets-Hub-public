import { evaluateDirectedRelationshipCandidate } from './directedRelationshipCandidateScreening';
import { buildDirectedRelationshipId, upsertDirectedRelationship } from './directedRelationshipRepository';
import type {
  DirectedRelationshipCandidate,
  DirectedRelationshipCandidateReviewReceipt,
  DirectedRelationshipDimensions,
  DirectedRelationshipRepositoryData,
} from './directedRelationshipTypes';

export type DirectedRelationshipCandidateInput = {
  activeRoleIds: string[];
  deltas: DirectedRelationshipDimensions;
  evidenceExcerpt: string;
  reason: string;
  sourceMessageId: string;
  sourceRoleId: string;
  sourceRoleName: string;
  targetRoleId: string;
  targetRoleName: string;
};

export type DirectedRelationshipCandidateReviewReason =
  | 'applied'
  | 'blocked-candidate'
  | 'candidate-not-found'
  | 'candidate-not-pending'
  | 'candidate-status-changed'
  | 'already-reverted'
  | 'record-changed-after-approval'
  | 'review-not-found'
  | 'relationship-version-conflict';

export type DirectedRelationshipCandidateReviewResult = {
  reason: DirectedRelationshipCandidateReviewReason;
  repository: DirectedRelationshipRepositoryData;
};

const DEFAULT_DIMENSIONS: DirectedRelationshipDimensions = { intimacy: 50, trust: 50, vigilance: 50 };

function clampDelta(value: number) {
  return Number.isFinite(value) ? Math.max(-10, Math.min(10, Math.round(value))) : 0;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeDeltas(value: DirectedRelationshipDimensions) {
  return { intimacy: clampDelta(value.intimacy), trust: clampDelta(value.trust), vigilance: clampDelta(value.vigilance) };
}

function proposed(base: DirectedRelationshipDimensions, deltas: DirectedRelationshipDimensions) {
  return {
    intimacy: clampScore(base.intimacy + deltas.intimacy),
    trust: clampScore(base.trust + deltas.trust),
    vigilance: clampScore(base.vigilance + deltas.vigilance),
  };
}

function uniqueId(repository: DirectedRelationshipRepositoryData, baseId: string) {
  let id = baseId;
  let suffix = 1;
  while (repository.candidates.some((candidate) => candidate.id === id)) id = `${baseId}-${suffix++}`;
  return id;
}

export function createDirectedRelationshipCandidate(
  repository: DirectedRelationshipRepositoryData,
  input: DirectedRelationshipCandidateInput,
  now = Date.now(),
) {
  const relationshipId = buildDirectedRelationshipId(input.sourceRoleId, input.targetRoleId);
  const current = repository.records.find((record) => record.id === relationshipId && record.invalidatedAt === undefined);
  const deltas = normalizeDeltas(input.deltas);
  const screening = evaluateDirectedRelationshipCandidate({ ...input, deltas });
  const baseDimensions = current?.dimensions ?? DEFAULT_DIMENSIONS;
  const candidate: DirectedRelationshipCandidate = {
    baseDimensions: { ...baseDimensions }, baseUpdatedAt: current?.updatedAt ?? null, createdAt: now,
    deltas, evidenceExcerpt: input.evidenceExcerpt.trim().slice(0, 500),
    id: uniqueId(repository, `relationship-candidate-${now}-${relationshipId}`),
    proposedDimensions: proposed(baseDimensions, deltas), reason: input.reason.trim().slice(0, 240),
    screeningDecision: screening.decision, screeningReasons: screening.reasons,
    sourceMessageId: input.sourceMessageId, sourceRoleId: input.sourceRoleId,
    sourceRoleName: input.sourceRoleName, status: 'pending', targetRoleId: input.targetRoleId,
    targetRoleName: input.targetRoleName,
  };
  return candidate;
}

export function enqueueDirectedRelationshipCandidate(
  repository: DirectedRelationshipRepositoryData,
  candidate: DirectedRelationshipCandidate,
) {
  if (repository.candidates.some((item) => item.id === candidate.id || (
    item.sourceMessageId === candidate.sourceMessageId
    && item.sourceRoleId === candidate.sourceRoleId
    && item.targetRoleId === candidate.targetRoleId
  ))) return repository;
  const observation = {
    candidateId: candidate.id, decision: candidate.screeningDecision, mode: 'shadow' as const,
    observedAt: candidate.createdAt, reasons: [...candidate.screeningReasons],
  };
  return {
    ...repository,
    candidates: [...repository.candidates, candidate].slice(-200),
    shadowObservations: [...repository.shadowObservations, observation].slice(-500),
  };
}

function reviewReceiptId(repository: DirectedRelationshipRepositoryData, baseId: string) {
  let id = baseId;
  let suffix = 1;
  while (repository.candidateReviewReceipts.some((item) => item.id === id)) id = `${baseId}-${suffix++}`;
  return id;
}

function receipt(repository: DirectedRelationshipRepositoryData,
  candidate: DirectedRelationshipCandidate, decision: 'approve' | 'reject', now: number,
  recordBefore: DirectedRelationshipCandidateReviewReceipt['recordBefore'],
  recordAfter: DirectedRelationshipCandidateReviewReceipt['recordAfter'],
  relationshipAuditId?: string): DirectedRelationshipCandidateReviewReceipt {
  return { candidateId: candidate.id, decision,
    id: reviewReceiptId(repository, `relationship-review-${now}-${decision}-${candidate.id}`),
    nextStatus: decision === 'approve' ? 'approved' : 'rejected', occurredAt: now,
    previousStatus: candidate.status, recordAfter, recordBefore,
    ...(relationshipAuditId ? { relationshipAuditId } : {}) };
}

function replaceCandidate(repository: DirectedRelationshipRepositoryData,
  candidate: DirectedRelationshipCandidate, review: DirectedRelationshipCandidateReviewReceipt) {
  return { ...repository,
    candidateReviewReceipts: [...repository.candidateReviewReceipts, review].slice(-300),
    candidates: repository.candidates.map((item) => item.id === candidate.id ? candidate : item) };
}

function unchanged(repository: DirectedRelationshipRepositoryData,
  reason: Exclude<DirectedRelationshipCandidateReviewReason, 'applied'>) {
  return { reason, repository } satisfies DirectedRelationshipCandidateReviewResult;
}

function matchesCandidateBase(
  candidate: DirectedRelationshipCandidate,
  current: DirectedRelationshipCandidateReviewReceipt['recordBefore'],
) {
  if (candidate.baseUpdatedAt === null) return current === null;
  return current?.updatedAt === candidate.baseUpdatedAt
    && current.invalidatedAt === undefined
    && current.dimensions.intimacy === candidate.baseDimensions.intimacy
    && current.dimensions.trust === candidate.baseDimensions.trust
    && current.dimensions.vigilance === candidate.baseDimensions.vigilance;
}

export function approveDirectedRelationshipCandidate(repository: DirectedRelationshipRepositoryData,
  candidateId: string, now = Date.now()): DirectedRelationshipCandidateReviewResult {
  const candidate = repository.candidates.find((item) => item.id === candidateId);
  if (!candidate) return unchanged(repository, 'candidate-not-found');
  if (candidate.status !== 'pending') return unchanged(repository, 'candidate-not-pending');
  if (candidate.screeningDecision === 'blocked') return unchanged(repository, 'blocked-candidate');
  return applyApprovedCandidate(repository, candidate, now, false);
}

function applyApprovedCandidate(repository: DirectedRelationshipRepositoryData,
  candidate: DirectedRelationshipCandidate, now: number,
  rebase: boolean,
): DirectedRelationshipCandidateReviewResult {
  const relationshipId = buildDirectedRelationshipId(candidate.sourceRoleId, candidate.targetRoleId);
  const before = repository.records.find((record) => record.id === relationshipId) ?? null;
  if (!rebase && !matchesCandidateBase(candidate, before)) {
    return unchanged(repository, 'relationship-version-conflict');
  }
  const dimensions = rebase
    ? proposed(before?.dimensions ?? DEFAULT_DIMENSIONS, candidate.deltas)
    : candidate.proposedDimensions;
  const updated = upsertDirectedRelationship(repository, {
    dimensions, evidenceSummary: candidate.reason,
    sourceRoleId: candidate.sourceRoleId, targetRoleId: candidate.targetRoleId,
    targetRoleName: candidate.targetRoleName,
  }, { now, reason: `approved relationship candidate ${candidate.id}${rebase ? ' after batch predecessor' : ''}`,
    source: 'manual' });
  const after = updated.records.find((record) => record.id === relationshipId) ?? null;
  const relationshipAuditId = updated.auditTrail.at(-1)?.id;
  const reviewed = { ...candidate, reviewedAt: now, status: 'approved' as const };
  return { reason: 'applied', repository: replaceCandidate(
    updated, reviewed, receipt(updated, candidate, 'approve', now, before, after, relationshipAuditId),
  ) };
}

export function approveDirectedRelationshipCandidateAfterBatchPredecessor(
  repository: DirectedRelationshipRepositoryData,
  candidateId: string,
  predecessorAuditId: string,
  now = Date.now(),
): DirectedRelationshipCandidateReviewResult {
  const candidate = repository.candidates.find((item) => item.id === candidateId);
  if (!candidate) return unchanged(repository, 'candidate-not-found');
  if (candidate.status !== 'pending') return unchanged(repository, 'candidate-not-pending');
  if (candidate.screeningDecision === 'blocked') return unchanged(repository, 'blocked-candidate');
  const relationshipId = buildDirectedRelationshipId(candidate.sourceRoleId, candidate.targetRoleId);
  const predecessor = [...repository.auditTrail].reverse().find((item) => (
    item.relationshipId === relationshipId
  ));
  const current = repository.records.find((record) => record.id === relationshipId) ?? null;
  if (!predecessor || predecessor.id !== predecessorAuditId
    || predecessor.after?.updatedAt !== current?.updatedAt
    || !predecessor.reason.startsWith('approved relationship candidate ')) {
    return unchanged(repository, 'relationship-version-conflict');
  }
  return applyApprovedCandidate(repository, candidate, now, true);
}

export function rejectDirectedRelationshipCandidate(repository: DirectedRelationshipRepositoryData,
  candidateId: string, now = Date.now()): DirectedRelationshipCandidateReviewResult {
  const candidate = repository.candidates.find((item) => item.id === candidateId);
  if (!candidate) return unchanged(repository, 'candidate-not-found');
  if (candidate.status !== 'pending') return unchanged(repository, 'candidate-not-pending');
  const reviewed = { ...candidate, reviewedAt: now, status: 'rejected' as const };
  return { reason: 'applied', repository: replaceCandidate(
    repository, reviewed, receipt(repository, candidate, 'reject', now, null, null),
  ) };
}
