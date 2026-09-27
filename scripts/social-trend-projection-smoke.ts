import assert from 'node:assert/strict';
import {
  EMPTY_DIRECTED_RELATIONSHIP_REPOSITORY,
  type DirectedRelationshipBehaviorPolicy,
  type DirectedRelationshipRecord,
} from '../src/character-relationship';
import { EMPTY_GROUP_MEMORY_REPOSITORY, type StoredGroupMemoryRecord } from '../src/group-memory';
import { buildDirectedRelationshipSocialTrends } from '../src/social-trend';

const baseline: DirectedRelationshipRecord = {
  createdAt: 100, dimensions: { intimacy: 40, trust: 50, vigilance: 35 },
  evidenceSummary: 'initial formal record', id: 'alice->berry', sourceRoleId: 'alice',
  targetRoleId: 'berry', targetRoleName: 'Berry', updatedAt: 100,
};
const current: DirectedRelationshipRecord = {
  ...baseline, dimensions: { intimacy: 65, trust: 80, vigilance: 20 },
  evidenceSummary: 'later formal correction', updatedAt: 200,
};
const reverse: DirectedRelationshipRecord = {
  createdAt: 300, dimensions: { intimacy: 30, trust: 25, vigilance: 70 },
  evidenceSummary: 'reverse retained state', id: 'berry->alice', sourceRoleId: 'berry',
  targetRoleId: 'alice', targetRoleName: 'Alice', updatedAt: 300,
};

function policy(topicTarget = 'berry'): DirectedRelationshipBehaviorPolicy {
  return {
    addressStyle: 'familiar-warm', disagreementStyle: 'evidence-first',
    engagementStyle: 'acknowledge-and-build', policyVersion: 1,
    relationshipId: current.id, sharingStyle: 'selective', sourceDimensions: current.dimensions,
    sourceUpdatedAt: current.updatedAt, supportStyle: 'support-with-evidence',
    targetRoleId: topicTarget, targetRoleName: 'Berry', verificationStyle: 'cooperative-verify',
  };
}

function memory(
  id: string,
  topicId: string,
  groupId = 'current-group',
  invalidatedAt?: number,
): StoredGroupMemoryRecord {
  return {
    confidence: 0.9, createdAt: 100, groupId, id,
    ...(invalidatedAt ? { invalidatedAt } : {}), kind: 'discussion-summary',
    sourceRoleId: 'alice', summary: `memory ${id}`, topicId, updatedAt: invalidatedAt ?? 100,
    visibility: 'group',
  };
}

const relationshipRepository = {
  ...EMPTY_DIRECTED_RELATIONSHIP_REPOSITORY,
  auditTrail: [
    { after: baseline, before: null, id: 'audit-create', kind: 'upsert' as const,
      reason: 'manual create', recordedAt: 100, relationshipId: current.id, source: 'manual' as const },
    { after: current, before: baseline, id: 'audit-update', kind: 'upsert' as const,
      reason: 'manual update', recordedAt: 200, relationshipId: current.id, source: 'correction' as const },
    { after: current, before: baseline, id: 'audit-rollback', kind: 'rollback' as const,
      reason: 'rollback test', recordedAt: 220, relationshipId: current.id, source: 'correction' as const,
      revertsAuditId: 'audit-update' },
  ],
  behaviorTraces: ['topic-1', 'topic-2'].map((topicId, index) => ({
    addressedRoleIds: ['berry'], claimLevel: 'policy-supplied-only' as const,
    eventKind: 'relationship-behavior-context' as const, groupSessionId: 'group-1',
    id: `trace-${index}`, occurredAt: 240 + index, outputExcerpt: 'context supplied',
    policies: [policy()], sourceMessageId: `message-${index}`, sourceRoleId: 'alice',
    sourceRoleName: 'Alice', topicId,
  })),
  candidateReviewReceipts: [
    { candidateId: 'candidate-1', decision: 'approve' as const, id: 'review-approve',
      nextStatus: 'approved' as const, occurredAt: 210, previousStatus: 'pending' as const,
      recordAfter: current, recordBefore: baseline },
    { candidateId: 'candidate-1', decision: 'rollback' as const, id: 'review-rollback',
      nextStatus: 'pending' as const, occurredAt: 230, previousStatus: 'approved' as const,
      recordAfter: baseline, recordBefore: current, revertsReceiptId: 'review-approve' },
  ],
  records: [current, reverse],
};
const groupMemoryRepository = {
  ...EMPTY_GROUP_MEMORY_REPOSITORY,
  records: [
    memory('memory-1', 'topic-1'), memory('memory-2', 'topic-2', 'current-group', 400),
    memory('memory-3', 'topic-2', 'subgroup-1'), memory('memory-4', 'topic-1', 'subgroup-disabled'),
    memory('memory-5', 'topic-1', 'unknown-group'), memory('memory-6', 'topic-3'),
  ],
  subgroups: [
    { createdAt: 1, id: 'subgroup-1', memberRoleIds: ['alice', 'berry'],
      name: '调查小组', updatedAt: 1 },
    { createdAt: 1, id: 'subgroup-disabled', invalidatedAt: 2,
      memberRoleIds: ['alice', 'berry'], name: '停用小组', updatedAt: 2 },
  ],
};

const before = JSON.stringify({ groupMemoryRepository, relationshipRepository });
const trends = buildDirectedRelationshipSocialTrends({ groupMemoryRepository, relationshipRepository });
assert.equal(JSON.stringify({ groupMemoryRepository, relationshipRepository }), before);
assert.equal(trends.length, 2);
const forward = trends.find((trend) => trend.relationshipId === 'alice->berry')!;
assert.deepEqual(forward.delta, { intimacy: 25, trust: 30, vigilance: -15 });
assert.equal(forward.approvedReviewCount, 1);
assert.equal(forward.operationRollbackCount, 1);
assert.equal(forward.reviewRollbackCount, 1);
assert.equal(forward.policySuppliedCount, 2);
assert.deepEqual(forward.sharedTopicIds, ['topic-1', 'topic-2']);
assert.deepEqual(forward.sharedMemoryGroups, [
  { memoryGroupId: 'current-group', sharedTopicCount: 1, sharedTopicIds: ['topic-1'] },
  { memoryGroupId: 'subgroup-1', sharedTopicCount: 1, sharedTopicIds: ['topic-2'] },
]);
assert.equal(forward.historyTruncated, false);
const reverseTrend = trends.find((trend) => trend.relationshipId === 'berry->alice')!;
assert.equal(reverseTrend.historyTruncated, true);
assert.deepEqual(reverseTrend.sharedMemoryGroups, []);
assert.notDeepEqual(reverseTrend.currentDimensions, forward.currentDimensions);
console.log('social trend projection smoke ok');
