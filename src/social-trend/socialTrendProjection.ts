import type {
  DirectedRelationshipAuditEntry,
  DirectedRelationshipCandidateReviewReceipt,
  DirectedRelationshipDimensions,
  DirectedRelationshipRecord,
  DirectedRelationshipRepositoryData,
} from '../character-relationship';
import {
  isWritableGroupMemoryGroup,
  type GroupMemoryRepositoryData,
} from '../group-memory';
import type { DirectedRelationshipSocialTrend } from './socialTrendTypes';

function dimensionsDelta(
  current: DirectedRelationshipDimensions,
  baseline: DirectedRelationshipDimensions,
) {
  return {
    intimacy: current.intimacy - baseline.intimacy,
    trust: current.trust - baseline.trust,
    vigilance: current.vigilance - baseline.vigilance,
  };
}

function relationshipAudits(repository: DirectedRelationshipRepositoryData, relationshipId: string) {
  return repository.auditTrail.filter((audit) => audit.relationshipId === relationshipId)
    .sort((left, right) => left.recordedAt - right.recordedAt);
}

function reviewRelationshipId(receipt: DirectedRelationshipCandidateReviewReceipt,
  repository: DirectedRelationshipRepositoryData) {
  const record = receipt.recordAfter ?? receipt.recordBefore;
  if (record) return record.id;
  const candidate = repository.candidates.find((item) => item.id === receipt.candidateId);
  return candidate ? `${candidate.sourceRoleId}->${candidate.targetRoleId}` : null;
}

function relationshipReviews(repository: DirectedRelationshipRepositoryData, relationshipId: string) {
  return repository.candidateReviewReceipts.filter((receipt) => (
    reviewRelationshipId(receipt, repository) === relationshipId
  ));
}

function relationshipBehaviorTraces(
  repository: DirectedRelationshipRepositoryData,
  relationshipId: string,
) {
  return repository.behaviorTraces.filter((trace) => (
    trace.policies.some((policy) => policy.relationshipId === relationshipId)
  ));
}

function sharedMemoryGroups(options: {
  behaviorTraces: DirectedRelationshipRepositoryData['behaviorTraces'];
  groupMemoryRepository: GroupMemoryRepositoryData;
}) {
  const traceTopics = new Set(options.behaviorTraces
    .flatMap((trace) => trace.topicId ? [trace.topicId] : []));
  const topicsByGroup = new Map<string, Set<string>>();
  options.groupMemoryRepository.records.forEach((record) => {
    const eligible = record.invalidatedAt === undefined && record.topicId
      && traceTopics.has(record.topicId)
      && isWritableGroupMemoryGroup(options.groupMemoryRepository, record.groupId);
    if (!eligible || !record.topicId) return;
    const topics = topicsByGroup.get(record.groupId) ?? new Set<string>();
    topics.add(record.topicId);
    topicsByGroup.set(record.groupId, topics);
  });
  return [...topicsByGroup.entries()].map(([memoryGroupId, topics]) => ({
    memoryGroupId, sharedTopicCount: topics.size, sharedTopicIds: [...topics].sort(),
  })).sort((left, right) => left.memoryGroupId.localeCompare(right.memoryGroupId));
}

function baselineSnapshot(record: DirectedRelationshipRecord, audits: DirectedRelationshipAuditEntry[]) {
  const first = audits[0];
  return {
    dimensions: { ...(first?.before ?? first?.after ?? record).dimensions },
    historyTruncated: !first || !(first.kind === 'upsert' && first.before === null),
    startedAt: first?.recordedAt ?? record.createdAt,
  };
}

function buildTrend(options: {
  groupMemoryRepository: GroupMemoryRepositoryData;
  record: DirectedRelationshipRecord;
  relationshipRepository: DirectedRelationshipRepositoryData;
}): DirectedRelationshipSocialTrend {
  const audits = relationshipAudits(options.relationshipRepository, options.record.id);
  const reviews = relationshipReviews(options.relationshipRepository, options.record.id);
  const traces = relationshipBehaviorTraces(options.relationshipRepository, options.record.id);
  const baseline = baselineSnapshot(options.record, audits);
  const sharedGroups = sharedMemoryGroups({
    behaviorTraces: traces, groupMemoryRepository: options.groupMemoryRepository,
  });
  const topicIds = [...new Set(sharedGroups.flatMap((group) => group.sharedTopicIds))].sort();
  return {
    active: options.record.invalidatedAt === undefined,
    approvedReviewCount: reviews.filter((receipt) => receipt.decision === 'approve').length,
    baselineDimensions: baseline.dimensions, claimLevel: 'shadow-readonly',
    currentDimensions: { ...options.record.dimensions },
    delta: dimensionsDelta(options.record.dimensions, baseline.dimensions),
    formalAuditCount: audits.length, historyTruncated: baseline.historyTruncated,
    operationRollbackCount: audits.filter((audit) => audit.kind === 'rollback').length,
    policySuppliedCount: traces.length, relationshipId: options.record.id,
    reviewRollbackCount: reviews.filter((receipt) => receipt.decision === 'rollback').length,
    sharedMemoryGroups: sharedGroups,
    sharedTopicCount: topicIds.length, sharedTopicIds: topicIds,
    sourceRoleId: options.record.sourceRoleId, targetRoleId: options.record.targetRoleId,
    targetRoleName: options.record.targetRoleName || options.record.targetRoleId,
    windowEndAt: Math.max(options.record.updatedAt, audits.at(-1)?.recordedAt ?? 0,
      ...traces.map((trace) => trace.occurredAt)),
    windowStartAt: baseline.startedAt,
  };
}

export function buildDirectedRelationshipSocialTrends(options: {
  groupMemoryRepository: GroupMemoryRepositoryData;
  relationshipRepository: DirectedRelationshipRepositoryData;
}) {
  return options.relationshipRepository.records.map((record) => buildTrend({ ...options, record }))
    .sort((left, right) => right.windowEndAt - left.windowEndAt
      || left.relationshipId.localeCompare(right.relationshipId));
}
