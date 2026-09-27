import type {
  DirectedRelationshipCandidate,
  DirectedRelationshipCandidateReviewReceipt,
  DirectedRelationshipRepositoryData,
} from '../character-relationship';
import {
  isWritableGroupMemoryGroup,
  latestEvidenceScopeCorrection,
  type GroupMemoryRepositoryData,
} from '../group-memory';
import type {
  RelationshipEvidenceDimensionSummary,
  RelationshipEvidenceWindow,
  RelationshipEvidenceWindowReason,
  RelationshipEvidenceWindowScopeReason,
  ScopedRelationshipEvidenceWindow,
} from './relationshipEvidenceWindowTypes';

export const DEFAULT_RELATIONSHIP_EVIDENCE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const MIN_SUSTAINED_DURATION_MS = 24 * 60 * 60 * 1000;
const MIN_SUSTAINED_SIGNALS = 3;
const MAX_REJECTION_RATE = 0.5;
const MAX_ROLLBACK_RATE = 0.25;
const MIN_DIRECTION_CONSISTENCY = 2 / 3;

function relationshipId(candidate: DirectedRelationshipCandidate) {
  return `${candidate.sourceRoleId}->${candidate.targetRoleId}`;
}

function groupCandidates(candidates: DirectedRelationshipCandidate[]) {
  const groups = new Map<string, DirectedRelationshipCandidate[]>();
  candidates.forEach((candidate) => {
    const id = relationshipId(candidate);
    groups.set(id, [...(groups.get(id) ?? []), candidate]);
  });
  return [...groups.values()];
}

function dimensionSummary(values: number[]): RelationshipEvidenceDimensionSummary {
  const positiveCount = values.filter((value) => value > 0).length;
  const negativeCount = values.filter((value) => value < 0).length;
  const neutralCount = values.length - positiveCount - negativeCount;
  const directionalCount = positiveCount + negativeCount;
  return {
    consistency: directionalCount ? Math.max(positiveCount, negativeCount) / directionalCount : 1,
    negativeCount, netDelta: values.reduce((sum, value) => sum + value, 0),
    neutralCount, positiveCount,
  };
}

function relevantReceipts(
  receipts: DirectedRelationshipCandidateReviewReceipt[],
  candidateIds: Set<string>,
  windowStartAt: number,
  windowEndAt: number,
) {
  return receipts.filter((receipt) => candidateIds.has(receipt.candidateId)
    && receipt.occurredAt >= windowStartAt && receipt.occurredAt <= windowEndAt);
}

function rates(receipts: DirectedRelationshipCandidateReviewReceipt[]) {
  const approvalCount = receipts.filter((receipt) => receipt.decision === 'approve').length;
  const rejectionCount = receipts.filter((receipt) => receipt.decision === 'reject').length;
  const rollbackCount = receipts.filter((receipt) => receipt.decision === 'rollback').length;
  return {
    approvalCount, rejectionCount,
    rejectionRate: rejectionCount / Math.max(1, approvalCount + rejectionCount),
    rollbackCount, rollbackRate: Math.min(1, rollbackCount / Math.max(1, approvalCount)),
  };
}

function hasContradiction(dimensions: RelationshipEvidenceWindow['dimensions']) {
  return Object.values(dimensions).some((dimension) => (
    dimension.positiveCount > 0 && dimension.negativeCount > 0
    && dimension.consistency < MIN_DIRECTION_CONSISTENCY
  ));
}

function readinessReasons(input: {
  distinctMessageCount: number;
  durationMs: number;
  hasContradictorySignals: boolean;
  rejectionRate: number;
  rollbackRate: number;
  signalCount: number;
  targetResolved: boolean;
}) {
  const reasons: RelationshipEvidenceWindowReason[] = [];
  if (!input.targetResolved) reasons.push('unresolved-target');
  if (input.signalCount < MIN_SUSTAINED_SIGNALS) reasons.push('insufficient-signals');
  if (input.distinctMessageCount < MIN_SUSTAINED_SIGNALS) reasons.push('insufficient-distinct-messages');
  if (input.durationMs < MIN_SUSTAINED_DURATION_MS) reasons.push('short-duration');
  if (input.hasContradictorySignals) reasons.push('contradictory-signals');
  if (input.rejectionRate > MAX_REJECTION_RATE) reasons.push('high-rejection-rate');
  if (input.rollbackRate > MAX_ROLLBACK_RATE) reasons.push('high-rollback-rate');
  if (!reasons.length) reasons.push('sustained-pattern');
  return reasons;
}

function buildWindow(options: {
  candidates: DirectedRelationshipCandidate[];
  repository: DirectedRelationshipRepositoryData;
  windowEndAt: number;
  windowStartAt: number;
}): RelationshipEvidenceWindow {
  const first = options.candidates[0]!;
  const eligible = options.candidates.filter((item) => item.screeningDecision === 'manual-review');
  const candidateIds = new Set(options.candidates.map((item) => item.id));
  const receipts = relevantReceipts(options.repository.candidateReviewReceipts, candidateIds,
    options.windowStartAt, options.windowEndAt);
  const dimensions = {
    intimacy: dimensionSummary(eligible.map((item) => item.deltas.intimacy)),
    trust: dimensionSummary(eligible.map((item) => item.deltas.trust)),
    vigilance: dimensionSummary(eligible.map((item) => item.deltas.vigilance)),
  };
  const reviewRates = rates(receipts);
  const times = eligible.map((item) => item.createdAt);
  const durationMs = times.length > 1 ? Math.max(...times) - Math.min(...times) : 0;
  const distinctSourceMessageCount = new Set(eligible.map((item) => item.sourceMessageId)).size;
  const targetResolved = !first.targetRoleId.startsWith('unresolved:');
  const reasons = readinessReasons({
    distinctMessageCount: distinctSourceMessageCount, durationMs,
    hasContradictorySignals: hasContradiction(dimensions),
    rejectionRate: reviewRates.rejectionRate, rollbackRate: reviewRates.rollbackRate,
    signalCount: eligible.length, targetResolved,
  });
  const hasInsufficient = reasons.some((reason) => reason.startsWith('insufficient-')
    || reason === 'short-duration' || reason === 'unresolved-target');
  return {
    ...reviewRates, blockedCount: options.candidates.length - eligible.length,
    claimLevel: 'shadow-observation-only',
    correctionAuditCount: options.repository.auditTrail.filter((audit) => (
      audit.relationshipId === relationshipId(first) && audit.source === 'correction'
      && audit.recordedAt >= options.windowStartAt && audit.recordedAt <= options.windowEndAt
    )).length,
    dimensions, distinctSourceMessageCount, durationMs, eligibleSignalCount: eligible.length,
    readiness: reasons.includes('sustained-pattern') ? 'sustained-shadow'
      : (hasInsufficient ? 'insufficient-evidence' : 'volatile-shadow'),
    reasons, relationshipId: relationshipId(first),
    retainedHistoryMayBeTruncated: options.repository.candidates.length >= 200
      || options.repository.candidateReviewReceipts.length >= 300
      || options.repository.auditTrail.length >= 200,
    sampleCount: options.candidates.length,
    sourceRoleId: first.sourceRoleId, sourceRoleName: first.sourceRoleName,
    targetResolved, targetRoleId: first.targetRoleId, targetRoleName: first.targetRoleName,
    windowEndAt: options.windowEndAt, windowStartAt: options.windowStartAt,
  };
}

export function buildRelationshipEvidenceWindows(options: {
  now?: number;
  repository: DirectedRelationshipRepositoryData;
  windowMs?: number;
}) {
  const { windowEndAt, windowStartAt } = resolveWindowBounds(options.now, options.windowMs);
  const candidates = options.repository.candidates.filter((candidate) => (
    candidate.createdAt >= windowStartAt && candidate.createdAt <= windowEndAt
  )).sort((left, right) => left.createdAt - right.createdAt);
  return groupCandidates(candidates).map((group) => buildWindow({
    candidates: group, repository: options.repository, windowEndAt, windowStartAt,
  })).sort((left, right) => right.eligibleSignalCount - left.eligibleSignalCount
    || left.relationshipId.localeCompare(right.relationshipId));
}

function resolveWindowBounds(now?: number, requestedWindowMs?: number) {
  const windowEndAt = Number.isFinite(now) ? now! : Date.now();
  const requestedWindow = Number(requestedWindowMs ?? DEFAULT_RELATIONSHIP_EVIDENCE_WINDOW_MS);
  const windowMs = Number.isFinite(requestedWindow) && requestedWindow > 0
    ? requestedWindow : DEFAULT_RELATIONSHIP_EVIDENCE_WINDOW_MS;
  return { windowEndAt, windowStartAt: windowEndAt - windowMs };
}

function formalMemoryGroupsForMessage(
  repository: GroupMemoryRepositoryData,
  sourceMessageId: string,
) {
  const snapshots = repository.evidenceScopeSnapshots.filter((snapshot) => (
    snapshot.sourceMessageId === sourceMessageId
  ));
  const linkedRecordIds = snapshots.length
    ? snapshots.map((snapshot) => (
      latestEvidenceScopeCorrection(repository, snapshot.id)?.correctedRecordId ?? snapshot.recordId
    ))
    : repository.candidates.filter((candidate) => (
      candidate.evidence.sourceMessageId === sourceMessageId
    )).map((candidate) => candidate.proposedRecord.id);
  const candidateRecordIds = new Set(linkedRecordIds);
  const directRecordId = `group-memory-${sourceMessageId}`;
  return [...new Set(repository.records.filter((record) => (
    record.invalidatedAt === undefined
    && (candidateRecordIds.has(record.id) || (!snapshots.length && record.id === directRecordId))
    && isWritableGroupMemoryGroup(repository, record.groupId)
  )).map((record) => record.groupId))];
}

function candidateMemoryScope(
  candidate: DirectedRelationshipCandidate,
  repository: GroupMemoryRepositoryData,
) {
  const groupIds = formalMemoryGroupsForMessage(repository, candidate.sourceMessageId);
  if (groupIds.length === 1) {
    return { memoryGroupId: groupIds[0]!, reason: 'formal-memory-link' as const };
  }
  return {
    memoryGroupId: null,
    reason: (groupIds.length ? 'ambiguous-formal-memory-link' : 'no-formal-memory-link') as
      RelationshipEvidenceWindowScopeReason,
  };
}

function scopedCandidateGroups(
  candidates: DirectedRelationshipCandidate[],
  repository: GroupMemoryRepositoryData,
) {
  const groups = new Map<string, {
    candidates: DirectedRelationshipCandidate[];
    memoryGroupId: string | null;
    reason: RelationshipEvidenceWindowScopeReason;
  }>();
  candidates.forEach((candidate) => {
    const scope = candidateMemoryScope(candidate, repository);
    const key = `${relationshipId(candidate)}:${scope.memoryGroupId ?? `unlinked:${scope.reason}`}`;
    const current = groups.get(key);
    groups.set(key, { ...scope, candidates: [...(current?.candidates ?? []), candidate] });
  });
  return [...groups.entries()];
}

function scopeProvenance(
  candidates: DirectedRelationshipCandidate[],
  repository: GroupMemoryRepositoryData,
) {
  const messageIds = new Set(candidates.map((candidate) => candidate.sourceMessageId));
  return repository.evidenceScopeSnapshots.filter((snapshot) => (
    messageIds.has(snapshot.sourceMessageId)
  )).map((snapshot) => {
    const correction = latestEvidenceScopeCorrection(repository, snapshot.id);
    return {
      capturedAt: snapshot.capturedAt,
      effectiveGroupId: correction?.correctedGroupId ?? snapshot.groupId,
      effectiveRecordId: correction?.correctedRecordId ?? snapshot.recordId,
      latestCorrectionId: correction?.id ?? null,
      originalGroupId: snapshot.groupId, recordId: snapshot.recordId,
      source: snapshot.source, sourceMessageId: snapshot.sourceMessageId,
    };
  });
}

export function buildScopedRelationshipEvidenceWindows(options: {
  groupMemoryRepository: GroupMemoryRepositoryData;
  now?: number;
  repository: DirectedRelationshipRepositoryData;
  windowMs?: number;
}): ScopedRelationshipEvidenceWindow[] {
  const { windowEndAt, windowStartAt } = resolveWindowBounds(options.now, options.windowMs);
  const candidates = options.repository.candidates.filter((candidate) => (
    candidate.createdAt >= windowStartAt && candidate.createdAt <= windowEndAt
  )).sort((left, right) => left.createdAt - right.createdAt);
  return scopedCandidateGroups(candidates, options.groupMemoryRepository).map(([windowId, group]) => ({
    ...buildWindow({ candidates: group.candidates, repository: options.repository,
      windowEndAt, windowStartAt }),
    correctionAuditScope: 'relationship-wide-not-grouped' as const,
    memoryGroupId: group.memoryGroupId, scopeReason: group.reason, windowId,
    scopeProvenance: scopeProvenance(group.candidates, options.groupMemoryRepository),
  })).sort((left, right) => right.eligibleSignalCount - left.eligibleSignalCount
    || left.windowId.localeCompare(right.windowId));
}
