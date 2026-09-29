import assert from 'node:assert/strict';
import {
  EMPTY_DIRECTED_RELATIONSHIP_REPOSITORY,
  type DirectedRelationshipRecord,
} from '../src/character-relationship';
import { EMPTY_GROUP_MEMORY_REPOSITORY, type StoredGroupMemoryRecord } from '../src/group-memory';
import { EMPTY_GROUP_TOPIC_REPOSITORY } from '../src/group-topic';
import { buildSocialEventTimeline, type SocialEventTimelineRepositories } from '../src/social-timeline';

const relationship: DirectedRelationshipRecord = {
  createdAt: 1, dimensions: { intimacy: 70, trust: 80, vigilance: 20 },
  evidenceSummary: 'manual evidence', id: 'alice->berry', sourceRoleId: 'alice',
  targetRoleId: 'berry', targetRoleName: 'Berry', updatedAt: 1,
};
const memory: StoredGroupMemoryRecord = {
  confidence: 0.9, createdAt: 1, groupId: 'current-group', id: 'memory-1',
  kind: 'discussion-summary', sourceRoleId: 'alice', summary: 'shared result',
  topicId: 'topic-1', updatedAt: 1, visibility: 'group',
};

const repositories: SocialEventTimelineRepositories = {
  directedRelationshipRepository: {
    ...EMPTY_DIRECTED_RELATIONSHIP_REPOSITORY,
    auditTrail: [{
      after: relationship, before: null, id: 'relationship-audit-1', kind: 'upsert',
      reason: 'manual create', recordedAt: 40, relationshipId: relationship.id, source: 'manual',
    }],
    behaviorTraces: [{
      addressedRoleIds: ['berry'], claimLevel: 'policy-supplied-only',
      eventKind: 'relationship-behavior-context', groupSessionId: 'group-session-1',
      id: 'behavior-1', occurredAt: 60, outputExcerpt: 'I will verify it.',
      policies: [{
        addressStyle: 'familiar-warm', disagreementStyle: 'evidence-first',
        engagementStyle: 'acknowledge-and-build', policyVersion: 1,
        relationshipId: relationship.id, sharingStyle: 'open-with-boundaries',
        sourceDimensions: relationship.dimensions, sourceUpdatedAt: 1,
        supportStyle: 'support-with-evidence', targetRoleId: 'berry', targetRoleName: 'Berry',
        verificationStyle: 'cooperative-verify',
      }],
      sourceMessageId: 'message-1', sourceRoleId: 'alice', sourceRoleName: 'Alice',
      topicId: 'topic-1',
    }],
    candidates: [{
      baseDimensions: { intimacy: 0, trust: 0, vigilance: 0 }, baseUpdatedAt: null,
      createdAt: 2, deltas: { intimacy: 1, trust: 2, vigilance: 0 },
      evidenceExcerpt: 'Berry provided support.', id: 'relationship-candidate-1',
      proposedDimensions: { intimacy: 1, trust: 2, vigilance: 0 }, reason: 'observed support',
      reviewedAt: 50, screeningDecision: 'manual-review',
      screeningReasons: ['valid-change-requires-review'], sourceMessageId: 'message-relationship-1',
      sourceRoleId: 'alice', sourceRoleName: 'Alice', status: 'approved',
      targetRoleId: 'berry', targetRoleName: 'Berry',
    }],
    candidateReviewReceipts: [{
      candidateId: 'relationship-candidate-1', decision: 'approve', id: 'relationship-review-1',
      nextStatus: 'approved', occurredAt: 50, previousStatus: 'pending',
      recordAfter: relationship, recordBefore: null, relationshipAuditId: 'relationship-audit-1',
    }],
  },
  groupMemoryRepository: {
    ...EMPTY_GROUP_MEMORY_REPOSITORY,
    evidenceScopeSnapshots: [{
      capturedAt: 35, groupId: 'current-group', id: 'scope-1', recordId: memory.id,
      source: 'candidate-approval', sourceMessageId: 'message-task-1',
      sourceRoleId: 'alice', topicId: 'topic-1',
    }],
    records: [memory],
    subgroups: [{
      createdAt: 1, id: 'subgroup-1', memberRoleIds: ['alice', 'berry'],
      name: '调查小组', updatedAt: 1,
    }],
    candidates: [{
      createdAt: 2, evidence: {
        capturedAt: 2, excerpt: 'Desktop task completed successfully.', kind: 'task-result',
        sourceMessageId: 'message-task-1', sourceRoleId: 'alice', topicId: 'topic-1',
      },
      id: 'memory-candidate-1', proposedRecord: memory, reviewedAt: 30, status: 'approved',
    }],
    candidateReviewReceipts: [{
      candidateId: 'memory-candidate-1', decision: 'approve', id: 'memory-review-1',
      nextStatus: 'approved', occurredAt: 30, previousStatus: 'pending',
      recordAfter: memory, recordBefore: null,
    }],
    receipts: [{
      changes: [{ after: null, before: memory, recordId: memory.id }],
      id: 'memory-operation-1', kind: 'invalidate', occurredAt: 20,
    }],
  },
  groupTopicRepository: {
    ...EMPTY_GROUP_TOPIC_REPOSITORY,
    snapshots: [{
      currentTopicId: 'topic-1', currentTopicParentId: null, groupKey: 'alice|berry',
      groupSessionId: 'group-session-1', topicDerivationSequence: 0,
      topicAuditTrail: [{
        fromStatus: 'starting', reason: 'new information', recordedAt: 10,
        source: 'role-signal', toStatus: 'active', topicId: 'topic-1',
      }],
      topicHistory: [], topicStatus: 'active', topicUpdatedAt: 10,
    }],
  },
};

const before = JSON.stringify(repositories);
const timeline = buildSocialEventTimeline(repositories);
assert.equal(JSON.stringify(repositories), before, 'projection must not mutate source repositories');
assert.deepEqual(timeline.map((entry) => entry.kind), [
  'relationship-behavior-context', 'relationship-review', 'relationship-operation',
  'group-memory-evidence-scope', 'group-memory-review', 'group-memory-operation',
  'topic-transition',
]);
assert.equal(timeline[0]?.claimLevel, 'policy-supplied-only');
assert.deepEqual(timeline[0]?.memoryGroupIds, []);
assert.deepEqual(timeline[0]?.roleIds, ['alice', 'berry']);
assert.equal(timeline.at(-1)?.groupSessionId, 'group-session-1');
assert.deepEqual(timeline.at(-1)?.memoryGroupIds, []);
assert.equal(timeline[0]?.evidence.some((item) => item.kind === 'relationship-policy'), true);
const scopeEvent = timeline.find((entry) => entry.kind === 'group-memory-evidence-scope');
assert.deepEqual(scopeEvent?.memoryScope, {
  capturedGroupId: 'current-group', currentGroupId: 'current-group',
  currentScopeStatus: 'active', effectiveGroupId: 'current-group',
  effectiveRecordId: 'memory-1', latestCorrectionId: null, recordId: 'memory-1',
  snapshotSource: 'candidate-approval',
});
assert.deepEqual(scopeEvent?.memoryGroupIds, ['current-group']);
assert.equal(scopeEvent?.evidence.some((item) => (
  item.kind === 'chat-message' && item.referenceId === 'message-task-1'
)), true);
const memoryReview = timeline.find((entry) => entry.kind === 'group-memory-review');
assert.deepEqual(memoryReview?.memoryGroupIds, ['current-group']);
assert.deepEqual(memoryReview?.evidence.find((item) => item.kind === 'task-result'), {
  excerpt: 'Desktop task completed successfully.', kind: 'task-result', referenceId: 'message-task-1',
});
const relationshipReview = timeline.find((entry) => entry.kind === 'relationship-review');
assert.equal(relationshipReview?.evidence.some((item) => (
  item.kind === 'chat-message' && item.referenceId === 'message-relationship-1'
)), true);
assert.equal(buildSocialEventTimeline(repositories, 2).length, 2);
assert.equal(buildSocialEventTimeline(repositories, -1).length, 0);
assert.equal(new Set(timeline.map((entry) => entry.id)).size, timeline.length);

const chained = JSON.parse(JSON.stringify(repositories)) as SocialEventTimelineRepositories;
chained.directedRelationshipRepository.auditTrail.push({
  after: null, before: relationship, id: 'relationship-audit-rollback', kind: 'rollback',
  reason: 'undo manual create', recordedAt: 80, relationshipId: relationship.id,
  revertsAuditId: 'relationship-audit-1', source: 'correction',
});
chained.directedRelationshipRepository.candidateReviewReceipts.push({
  candidateId: 'relationship-candidate-1', decision: 'rollback', id: 'relationship-review-rollback',
  nextStatus: 'pending', occurredAt: 82, previousStatus: 'approved',
  recordAfter: null, recordBefore: relationship, revertsReceiptId: 'relationship-review-1',
});
chained.groupMemoryRepository.receipts.push({
  changes: [{ after: memory, before: null, recordId: memory.id }], id: 'memory-operation-rollback',
  kind: 'rollback', occurredAt: 75, revertsReceiptId: 'memory-operation-1',
});
chained.groupMemoryRepository.candidateReviewReceipts.push({
  candidateId: 'memory-candidate-1', decision: 'rollback', id: 'memory-review-rollback',
  nextStatus: 'pending', occurredAt: 70, previousStatus: 'approved', recordAfter: null,
  recordBefore: memory, revertsReceiptId: 'memory-review-1',
});
const subgroupMemory = { ...memory, groupId: 'subgroup-1', updatedAt: 84 };
chained.groupMemoryRepository.receipts.push({
  changes: [{ after: subgroupMemory, before: memory, recordId: memory.id }],
  id: 'memory-operation-move-group', kind: 'move-group', occurredAt: 84,
});
const replacement = { ...memory, id: 'memory-2', summary: 'corrected shared result',
  supersedesId: memory.id, updatedAt: 85 };
chained.groupMemoryRepository.records.push(replacement);
chained.groupMemoryRepository.receipts.push({
  changes: [{ after: replacement, before: memory, recordId: replacement.id }],
  id: 'memory-operation-supersede', kind: 'resolve-conflict', occurredAt: 85,
});
const snapshot = chained.groupTopicRepository.snapshots[0]!;
snapshot.currentTopicId = 'topic-2';
snapshot.currentTopicParentId = 'topic-1';
snapshot.topicHistory = [{ id: 'topic-1', parentTopicId: null, recordedAt: 10, status: 'active' }];
snapshot.topicAuditTrail.push({
  fromStatus: 'active', reason: 'derived discussion', recordedAt: 90,
  source: 'derivation', toStatus: 'starting', topicId: 'topic-2',
});
chained.groupMemoryRepository.evidenceScopeCorrections = [{
  correctedGroupId: 'subgroup-1', correctedRecordId: memory.id, id: 'scope-correction-1',
  occurredAt: 95, reason: 'original group was incorrect', snapshotId: 'scope-1',
}, {
  correctedGroupId: 'subgroup-1', correctedRecordId: replacement.id, id: 'scope-correction-2',
  occurredAt: 96, reason: 'corrected formal record association', snapshotId: 'scope-1',
  supersedesCorrectionId: 'scope-correction-1',
}];

const linked = buildSocialEventTimeline(chained);
const movedMemoryEvent = linked.find((entry) => (
  entry.id === 'group-memory-operation:memory-operation-move-group'
));
assert.deepEqual(movedMemoryEvent?.memoryGroupIds, ['current-group', 'subgroup-1']);
const originalRelationshipOperation = linked.find((entry) => (
  entry.id === 'relationship-operation:relationship-audit-1'
));
assert.equal(originalRelationshipOperation?.links.some((item) => (
  item.relation === 'reverted-by'
  && item.targetEventId === 'relationship-operation:relationship-audit-rollback'
)), true);
const originalMemoryReview = linked.find((entry) => entry.id === 'group-memory-review:memory-review-1');
assert.equal(originalMemoryReview?.links.some((item) => item.relation === 'reverted-by'), true);
const supersedeEvent = linked.find((entry) => entry.id === 'group-memory-operation:memory-operation-supersede');
const supersedeLink = supersedeEvent?.links.find((item) => item.relation === 'supersedes');
assert.equal(supersedeLink?.targetReferenceId, 'memory-1');
assert.ok(supersedeLink?.targetEventId, 'superseded record should resolve to its latest active event');
const supersededEvent = linked.find((entry) => entry.id === supersedeLink?.targetEventId);
assert.equal(supersededEvent?.links.some((item) => (
  item.relation === 'superseded-by' && item.targetEventId === supersedeEvent?.id
)), true);
const derivedTopic = linked.find((entry) => entry.topicId === 'topic-2');
assert.equal(derivedTopic?.links.some((item) => (
  item.relation === 'derived-from' && item.targetEventId !== null
)), true);
const rollbackReview = linked.find((entry) => (
  entry.id === 'relationship-review:relationship-review-rollback'
));
assert.equal(rollbackReview?.links.some((item) => (
  item.relation === 'reverts' && item.targetEventId === 'relationship-review:relationship-review-1'
)), true);
const correctionEvent = linked.find((entry) => (
  entry.id === 'group-memory-evidence-scope-correction:scope-correction-2'
));
assert.equal(correctionEvent?.links.some((item) => (
  item.relation === 'corrects'
  && item.targetEventId === 'group-memory-evidence-scope:scope-1'
)), true);
assert.equal(correctionEvent?.links.some((item) => (
  item.relation === 'supersedes'
  && item.targetEventId === 'group-memory-evidence-scope-correction:scope-correction-1'
)), true);
const correctedScopeEvent = linked.find((entry) => (
  entry.id === 'group-memory-evidence-scope:scope-1'
));
assert.equal(correctedScopeEvent?.links.some((item) => (
  item.relation === 'corrected-by' && item.targetEventId === correctionEvent?.id
)), true);
assert.equal(correctedScopeEvent?.memoryScope?.effectiveRecordId, replacement.id);
assert.equal(correctedScopeEvent?.memoryScope?.effectiveGroupId, 'subgroup-1');
const archivedCandidateSource = JSON.parse(JSON.stringify(repositories)) as SocialEventTimelineRepositories;
archivedCandidateSource.groupMemoryRepository.candidates = [];
archivedCandidateSource.groupMemoryRepository.candidateReviewReceipts = [];
const archivedScope = buildSocialEventTimeline(archivedCandidateSource).find((entry) => (
  entry.id === 'group-memory-evidence-scope:scope-1'
));
assert.equal(archivedScope?.memoryScope?.capturedGroupId, 'current-group');
archivedCandidateSource.groupMemoryRepository.records = [{
  ...memory, groupId: 'subgroup-1', updatedAt: 100,
}];
const movedScope = buildSocialEventTimeline(archivedCandidateSource).find((entry) => (
  entry.id === 'group-memory-evidence-scope:scope-1'
));
assert.equal(movedScope?.memoryScope?.capturedGroupId, 'current-group');
assert.equal(movedScope?.memoryScope?.currentGroupId, 'subgroup-1');
assert.deepEqual(movedScope?.memoryGroupIds, ['current-group', 'subgroup-1']);
archivedCandidateSource.groupMemoryRepository.subgroups[0] = {
  ...archivedCandidateSource.groupMemoryRepository.subgroups[0]!, invalidatedAt: 110,
};
const disabledScope = buildSocialEventTimeline(archivedCandidateSource).find((entry) => (
  entry.id === 'group-memory-evidence-scope:scope-1'
));
assert.equal(disabledScope?.memoryScope?.currentScopeStatus, 'group-disabled');
archivedCandidateSource.groupMemoryRepository.records[0] = {
  ...archivedCandidateSource.groupMemoryRepository.records[0]!, invalidatedAt: 120,
};
const invalidatedScope = buildSocialEventTimeline(archivedCandidateSource).find((entry) => (
  entry.id === 'group-memory-evidence-scope:scope-1'
));
assert.equal(invalidatedScope?.memoryScope?.currentScopeStatus, 'record-invalidated');
archivedCandidateSource.groupMemoryRepository.records = [];
const unavailableScope = buildSocialEventTimeline(archivedCandidateSource).find((entry) => (
  entry.id === 'group-memory-evidence-scope:scope-1'
));
assert.equal(unavailableScope?.memoryScope?.currentScopeStatus, 'record-unavailable');
console.log('social event timeline projection smoke ok');
