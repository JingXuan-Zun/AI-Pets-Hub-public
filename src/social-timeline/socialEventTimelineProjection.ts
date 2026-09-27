import type {
  DirectedRelationshipCandidateReviewReceipt,
  DirectedRelationshipRepositoryData,
} from '../character-relationship';
import type { GroupMemoryCandidateReviewReceipt, GroupMemoryRepositoryData } from '../group-memory';
import type { GroupTopicRepositoryData } from '../group-topic';
import type {
  SocialEventEvidenceReference,
  SocialEventLink,
  SocialEventTimelineEntry,
  SocialEventTimelineRepositories,
} from './socialEventTimelineTypes';
import { resolveSocialEventTimelineLinks } from './socialEventTimelineLinks';
import {
  projectMemoryEvidenceScopeCorrectionEvents,
  projectMemoryEvidenceScopeEvents,
} from './socialEventMemoryScopeProjection';

const DEFAULT_TIMELINE_LIMIT = 300;

function uniqueIds(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => value?.trim() ?? '').filter(Boolean))];
}

function link(relation: SocialEventLink['relation'], targetReferenceId: string,
  targetEventId: string | null = null): SocialEventLink {
  return { relation, targetEventId, targetReferenceId };
}

function topicParentId(repository: GroupTopicRepositoryData, groupKey: string, topicId: string) {
  const snapshot = repository.snapshots.find((item) => item.groupKey === groupKey);
  if (!snapshot) return null;
  if (snapshot.currentTopicId === topicId) return snapshot.currentTopicParentId;
  return snapshot.topicHistory.find((item) => item.id === topicId)?.parentTopicId ?? null;
}

function projectTopicEvents(repository: GroupTopicRepositoryData): SocialEventTimelineEntry[] {
  return repository.snapshots.flatMap((snapshot) => snapshot.topicAuditTrail.map((audit, index) => ({
    claimLevel: 'audited-operation' as const,
    evidence: [{ excerpt: audit.reason, kind: 'transition-reason' as const, referenceId: audit.topicId }],
    groupSessionId: snapshot.groupSessionId,
    id: `topic:${snapshot.groupKey}:${audit.topicId}:${audit.recordedAt}:${index}`,
    kind: 'topic-transition' as const,
    links: topicParentId(repository, snapshot.groupKey, audit.topicId)
      ? [link('derived-from', topicParentId(repository, snapshot.groupKey, audit.topicId)!)] : [],
    memoryGroupIds: [], occurredAt: audit.recordedAt,
    roleIds: uniqueIds(snapshot.groupKey.split('|')),
    source: 'topic' as const,
    summary: audit.reason,
    title: `${audit.fromStatus ?? 'none'} → ${audit.toStatus} · ${audit.source}`,
    topicId: audit.topicId,
  })));
}

function memoryOperationLinks(receipt: GroupMemoryRepositoryData['receipts'][number]) {
  const links = receipt.revertsReceiptId
    ? [link('reverts', receipt.revertsReceiptId, `group-memory-operation:${receipt.revertsReceiptId}`)] : [];
  receipt.changes.forEach((change) => {
    const supersedesId = (change.after ?? change.before)?.supersedesId;
    if (supersedesId) links.push(link('supersedes', supersedesId));
  });
  return links;
}

function memoryChangeEvidence(repository: GroupMemoryRepositoryData, receiptId: string) {
  const receipt = repository.receipts.find((item) => item.id === receiptId);
  if (!receipt) return [];
  return receipt.changes.flatMap((change) => {
    const record = change.after ?? change.before;
    return record ? [{
      excerpt: record.summary, kind: 'record-snapshot' as const, referenceId: record.id,
    }] : [];
  });
}

function memoryOperationGroupIds(receipt: GroupMemoryRepositoryData['receipts'][number]) {
  return uniqueIds(receipt.changes.flatMap((change) => [
    change.before?.groupId, change.after?.groupId,
  ]));
}

function projectMemoryOperations(repository: GroupMemoryRepositoryData): SocialEventTimelineEntry[] {
  return repository.receipts.map((receipt) => ({
    claimLevel: 'audited-operation',
    evidence: memoryChangeEvidence(repository, receipt.id),
    groupSessionId: null,
    id: `group-memory-operation:${receipt.id}`,
    kind: 'group-memory-operation',
    links: memoryOperationLinks(receipt),
    memoryGroupIds: memoryOperationGroupIds(receipt),
    occurredAt: receipt.occurredAt,
    roleIds: uniqueIds(receipt.changes.flatMap((change) => [
      change.after?.sourceRoleId, change.before?.sourceRoleId,
    ])),
    source: 'group-memory',
    summary: receipt.changes.map((change) => change.recordId).join(', '),
    title: receipt.kind,
    topicId: receipt.changes.find((change) => change.after?.topicId || change.before?.topicId)
      ?.after?.topicId ?? receipt.changes.find((change) => change.before?.topicId)?.before?.topicId ?? null,
  }));
}

function memoryReviewEvidence(receipt: GroupMemoryCandidateReviewReceipt,
  repository: GroupMemoryRepositoryData): SocialEventEvidenceReference[] {
  const candidate = repository.candidates.find((item) => item.id === receipt.candidateId);
  const evidence: SocialEventEvidenceReference[] = [{
    excerpt: candidate?.proposedRecord.summary ?? '',
    kind: 'candidate-reference', referenceId: receipt.candidateId,
  }];
  if (candidate) evidence.push({
    excerpt: candidate.evidence.excerpt,
    kind: candidate.evidence.kind,
    referenceId: candidate.evidence.sourceMessageId,
  });
  const record = receipt.recordAfter ?? receipt.recordBefore;
  if (record) evidence.push({
    excerpt: record.summary, kind: 'record-snapshot', referenceId: record.id,
  });
  return evidence;
}

function memoryReviewLinks(receipt: GroupMemoryCandidateReviewReceipt) {
  const links = receipt.revertsReceiptId
    ? [link('reverts', receipt.revertsReceiptId, `group-memory-review:${receipt.revertsReceiptId}`)] : [];
  const supersedesId = (receipt.recordAfter ?? receipt.recordBefore)?.supersedesId;
  if (supersedesId) links.push(link('supersedes', supersedesId));
  return links;
}

function memoryReviewRoles(receipt: GroupMemoryCandidateReviewReceipt,
  repository: GroupMemoryRepositoryData) {
  const candidate = repository.candidates.find((item) => item.id === receipt.candidateId);
  return uniqueIds([
    receipt.recordAfter?.sourceRoleId, receipt.recordBefore?.sourceRoleId,
    candidate?.evidence.sourceRoleId, candidate?.proposedRecord.sourceRoleId,
  ]);
}

function memoryReviewGroupIds(receipt: GroupMemoryCandidateReviewReceipt) {
  return uniqueIds([receipt.recordBefore?.groupId, receipt.recordAfter?.groupId]);
}

function projectMemoryReviews(repository: GroupMemoryRepositoryData): SocialEventTimelineEntry[] {
  return repository.candidateReviewReceipts.map((receipt) => {
    const candidate = repository.candidates.find((item) => item.id === receipt.candidateId);
    return {
      claimLevel: 'audited-operation', groupSessionId: null,
      evidence: memoryReviewEvidence(receipt, repository),
      id: `group-memory-review:${receipt.id}`, kind: 'group-memory-review',
      links: memoryReviewLinks(receipt),
      memoryGroupIds: memoryReviewGroupIds(receipt),
      occurredAt: receipt.occurredAt, roleIds: memoryReviewRoles(receipt, repository),
      source: 'group-memory', summary: receipt.candidateId,
      title: `${receipt.decision}: ${receipt.previousStatus} → ${receipt.nextStatus}`,
      topicId: receipt.recordAfter?.topicId ?? receipt.recordBefore?.topicId
        ?? candidate?.evidence.topicId ?? null,
    };
  });
}

function relationshipReviewEvidence(receipt: DirectedRelationshipCandidateReviewReceipt,
  repository: DirectedRelationshipRepositoryData): SocialEventEvidenceReference[] {
  const candidate = repository.candidates.find((item) => item.id === receipt.candidateId);
  const record = receipt.recordAfter ?? receipt.recordBefore;
  const evidence: SocialEventEvidenceReference[] = [{
    excerpt: candidate?.reason ?? '', kind: 'candidate-reference', referenceId: receipt.candidateId,
  }];
  if (candidate) evidence.push({
    excerpt: candidate.evidenceExcerpt, kind: 'chat-message', referenceId: candidate.sourceMessageId,
  });
  if (record) evidence.push({
    excerpt: record.evidenceSummary, kind: 'record-snapshot', referenceId: record.id,
  });
  return evidence;
}

function behaviorEvidence(trace: DirectedRelationshipRepositoryData['behaviorTraces'][number]) {
  const supplied: SocialEventEvidenceReference[] = trace.policies.map((policy) => ({
    excerpt: `trust=${policy.sourceDimensions.trust}, intimacy=${policy.sourceDimensions.intimacy}, vigilance=${policy.sourceDimensions.vigilance}, policyVersion=${policy.policyVersion}`,
    kind: 'relationship-policy', referenceId: policy.relationshipId,
  }));
  if (trace.outputExcerpt) supplied.unshift({
    excerpt: trace.outputExcerpt, kind: 'chat-message', referenceId: trace.sourceMessageId,
  });
  return supplied;
}

function relationshipOperationLinks(audit: DirectedRelationshipRepositoryData['auditTrail'][number]) {
  return audit.revertsAuditId
    ? [link('reverts', audit.revertsAuditId, `relationship-operation:${audit.revertsAuditId}`)] : [];
}

function relationshipReviewLinks(receipt: DirectedRelationshipCandidateReviewReceipt) {
  return receipt.revertsReceiptId
    ? [link('reverts', receipt.revertsReceiptId, `relationship-review:${receipt.revertsReceiptId}`)] : [];
}

function relationshipReviewRoles(receipt: DirectedRelationshipCandidateReviewReceipt,
  repository: DirectedRelationshipRepositoryData) {
  const candidate = repository.candidates.find((item) => item.id === receipt.candidateId);
  const record = receipt.recordAfter ?? receipt.recordBefore;
  return uniqueIds([
    record?.sourceRoleId, record?.targetRoleId, candidate?.sourceRoleId, candidate?.targetRoleId,
  ]);
}

function projectRelationshipEvents(repository: DirectedRelationshipRepositoryData) {
  const operations: SocialEventTimelineEntry[] = repository.auditTrail.map((audit) => ({
    claimLevel: 'audited-operation', groupSessionId: null,
    evidence: (audit.after ?? audit.before) ? [{
      excerpt: (audit.after ?? audit.before)?.evidenceSummary ?? '',
      kind: 'record-snapshot', referenceId: audit.relationshipId,
    }] : [],
    id: `relationship-operation:${audit.id}`, kind: 'relationship-operation',
    links: relationshipOperationLinks(audit),
    memoryGroupIds: [],
    occurredAt: audit.recordedAt,
    roleIds: uniqueIds([
      audit.after?.sourceRoleId, audit.after?.targetRoleId,
      audit.before?.sourceRoleId, audit.before?.targetRoleId,
    ]),
    source: 'relationship', summary: audit.reason, title: `${audit.kind} · ${audit.source}`,
    topicId: null,
  }));
  const reviews = repository.candidateReviewReceipts.map((receipt) => ({
    claimLevel: 'audited-operation' as const, groupSessionId: null,
    evidence: relationshipReviewEvidence(receipt, repository),
    id: `relationship-review:${receipt.id}`, kind: 'relationship-review' as const,
    links: relationshipReviewLinks(receipt),
    memoryGroupIds: [],
    occurredAt: receipt.occurredAt, roleIds: relationshipReviewRoles(receipt, repository),
    source: 'relationship' as const, summary: receipt.candidateId,
    title: `${receipt.decision}: ${receipt.previousStatus} → ${receipt.nextStatus}`,
    topicId: null,
  }));
  const behavior = repository.behaviorTraces.map((trace) => ({
    claimLevel: 'policy-supplied-only' as const, groupSessionId: trace.groupSessionId,
    evidence: behaviorEvidence(trace),
    id: `relationship-behavior:${trace.id}`, kind: 'relationship-behavior-context' as const,
    links: [],
    memoryGroupIds: [],
    occurredAt: trace.occurredAt,
    roleIds: uniqueIds([trace.sourceRoleId, ...trace.addressedRoleIds,
      ...trace.policies.map((policy) => policy.targetRoleId)]),
    source: 'relationship' as const, summary: trace.outputExcerpt,
    title: `${trace.sourceRoleName || trace.sourceRoleId} · policy supplied`, topicId: trace.topicId,
  }));
  return [...operations, ...reviews, ...behavior];
}

export function buildSocialEventTimeline(
  repositories: SocialEventTimelineRepositories,
  limit = DEFAULT_TIMELINE_LIMIT,
) {
  const entries = [
    ...projectTopicEvents(repositories.groupTopicRepository),
    ...projectMemoryOperations(repositories.groupMemoryRepository),
    ...projectMemoryReviews(repositories.groupMemoryRepository),
    ...projectMemoryEvidenceScopeEvents(repositories.groupMemoryRepository),
    ...projectMemoryEvidenceScopeCorrectionEvents(repositories.groupMemoryRepository),
    ...projectRelationshipEvents(repositories.directedRelationshipRepository),
  ];
  const boundedLimit = Math.max(0, Math.floor(Number.isFinite(limit) ? limit : DEFAULT_TIMELINE_LIMIT));
  return resolveSocialEventTimelineLinks(entries)
    .sort((left, right) => right.occurredAt - left.occurredAt
    || left.id.localeCompare(right.id)).slice(0, boundedLimit);
}
