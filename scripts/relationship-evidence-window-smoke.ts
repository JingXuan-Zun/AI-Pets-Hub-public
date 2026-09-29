import assert from 'node:assert/strict';
import {
  EMPTY_DIRECTED_RELATIONSHIP_REPOSITORY,
  type DirectedRelationshipCandidate,
  type DirectedRelationshipCandidateReviewReceipt,
} from '../src/character-relationship';
import {
  buildRelationshipEvidenceWindows,
  buildScopedRelationshipEvidenceWindows,
  DEFAULT_RELATIONSHIP_EVIDENCE_WINDOW_MS,
} from '../src/social-trend';
import {
  EMPTY_GROUP_MEMORY_REPOSITORY,
  type GroupMemoryCandidate,
  type StoredGroupMemoryRecord,
} from '../src/group-memory';

const DAY = 24 * 60 * 60 * 1000;
const now = 40 * DAY;

function candidate(options: {
  ageDays: number;
  deltas: { intimacy: number; trust: number; vigilance: number };
  id: string;
  relationship?: 'stable' | 'unresolved' | 'volatile';
  screeningDecision?: 'blocked' | 'manual-review';
}): DirectedRelationshipCandidate {
  const relationship = options.relationship ?? 'stable';
  const sourceRoleId = relationship === 'volatile' ? 'berry' : 'alice';
  const targetRoleId = relationship === 'unresolved' ? 'unresolved:Unknown'
    : (relationship === 'volatile' ? 'alice' : 'berry');
  const createdAt = now - options.ageDays * DAY;
  return {
    baseDimensions: { intimacy: 50, trust: 50, vigilance: 50 }, baseUpdatedAt: null,
    createdAt, deltas: options.deltas, evidenceExcerpt: `evidence ${options.id}`,
    id: options.id, proposedDimensions: {
      intimacy: 50 + options.deltas.intimacy, trust: 50 + options.deltas.trust,
      vigilance: 50 + options.deltas.vigilance,
    },
    reason: `reason ${options.id}`, screeningDecision: options.screeningDecision ?? 'manual-review',
    screeningReasons: options.screeningDecision === 'blocked'
      ? ['target-not-active'] : ['valid-change-requires-review'],
    sourceMessageId: `message-${options.id}`, sourceRoleId,
    sourceRoleName: sourceRoleId === 'alice' ? 'Alice' : 'Berry', status: 'pending',
    targetRoleId, targetRoleName: targetRoleId,
  };
}

function receipt(candidateId: string, decision: 'approve' | 'reject' | 'rollback', ageDays: number,
  suffix = ''): DirectedRelationshipCandidateReviewReceipt {
  return {
    candidateId, decision, id: `receipt-${candidateId}-${decision}${suffix}`,
    nextStatus: decision === 'approve' ? 'approved' : (decision === 'reject' ? 'rejected' : 'pending'),
    occurredAt: now - ageDays * DAY, previousStatus: decision === 'rollback' ? 'approved' : 'pending',
    recordAfter: null, recordBefore: null,
    ...(decision === 'rollback' ? { revertsReceiptId: `receipt-${candidateId}-approve` } : {}),
  };
}

const stable = [
  candidate({ ageDays: 3, deltas: { intimacy: 2, trust: 3, vigilance: -1 }, id: 'stable-1' }),
  candidate({ ageDays: 2, deltas: { intimacy: 1, trust: 2, vigilance: -2 }, id: 'stable-2' }),
  candidate({ ageDays: 1, deltas: { intimacy: 2, trust: 2, vigilance: -1 }, id: 'stable-3' }),
];
const volatile = [3, 2.5, 2, 1].map((ageDays, index) => candidate({
  ageDays, deltas: { intimacy: index % 2 ? -2 : 2, trust: index % 2 ? -3 : 3, vigilance: 0 },
  id: `volatile-${index + 1}`, relationship: 'volatile',
}));
const unresolved = candidate({
  ageDays: 1, deltas: { intimacy: 1, trust: 1, vigilance: 0 }, id: 'unresolved-1',
  relationship: 'unresolved', screeningDecision: 'blocked',
});
const old = candidate({ ageDays: 35, deltas: { intimacy: 9, trust: 9, vigilance: -9 }, id: 'old' });
const repository = {
  ...EMPTY_DIRECTED_RELATIONSHIP_REPOSITORY,
  auditTrail: [{
    after: null, before: null, id: 'correction-audit', kind: 'rollback' as const,
    reason: 'correction', recordedAt: now - DAY, relationshipId: 'alice->berry',
    source: 'correction' as const,
  }],
  candidateReviewReceipts: [
    receipt('stable-1', 'approve', 2.9),
    receipt('volatile-1', 'approve', 2.9), receipt('volatile-1', 'rollback', 2.8),
    receipt('volatile-2', 'reject', 2.4), receipt('volatile-2', 'rollback', 2.3),
    receipt('volatile-3', 'reject', 1.9),
    receipt('volatile-4', 'reject', 0.9),
  ],
  candidates: [...stable, ...volatile, unresolved, old],
};

const before = JSON.stringify(repository);
const windows = buildRelationshipEvidenceWindows({ now, repository });
assert.equal(JSON.stringify(repository), before, 'shadow projection must not mutate repository');
assert.equal(windows.length, 3, 'candidate outside the 30-day window must be excluded');
const stableWindow = windows.find((window) => window.relationshipId === 'alice->berry')!;
assert.equal(stableWindow.readiness, 'sustained-shadow');
assert.deepEqual(stableWindow.reasons, ['sustained-pattern']);
assert.equal(stableWindow.distinctSourceMessageCount, 3);
assert.equal(stableWindow.dimensions.trust.consistency, 1);
assert.equal(stableWindow.correctionAuditCount, 1);
const volatileWindow = windows.find((window) => window.relationshipId === 'berry->alice')!;
assert.equal(volatileWindow.readiness, 'volatile-shadow');
assert.equal(volatileWindow.reasons.includes('contradictory-signals'), true);
assert.equal(volatileWindow.reasons.includes('high-rejection-rate'), true);
assert.equal(volatileWindow.reasons.includes('high-rollback-rate'), true);
assert.equal(volatileWindow.rollbackRate, 1, 'rollback rate must be capped at 100%');
const unresolvedWindow = windows.find((window) => window.relationshipId.startsWith('alice->unresolved:'))!;
assert.equal(unresolvedWindow.readiness, 'insufficient-evidence');
assert.equal(unresolvedWindow.eligibleSignalCount, 0);
assert.equal(unresolvedWindow.blockedCount, 1);
assert.equal(unresolvedWindow.reasons.includes('unresolved-target'), true);
const cappedRepository = {
  ...repository,
  candidates: Array.from({ length: 200 }, (_, index) => ({
    ...stable[0]!, id: `capped-${index}`, sourceMessageId: `capped-message-${index}`,
  })),
};
assert.equal(buildRelationshipEvidenceWindows({ now, repository: cappedRepository })[0]
  ?.retainedHistoryMayBeTruncated, true);
assert.equal(buildRelationshipEvidenceWindows({ now, repository,
  windowMs: Number.NaN })[0]?.windowStartAt, now - DEFAULT_RELATIONSHIP_EVIDENCE_WINDOW_MS);

function groupRecord(id: string, groupId: string): StoredGroupMemoryRecord {
  return {
    confidence: 1, createdAt: now - DAY, groupId, id, kind: 'discussion-summary',
    sourceRoleId: 'alice', summary: id, updatedAt: now - DAY, visibility: 'group',
  };
}

function groupCandidate(id: string, recordId: string): GroupMemoryCandidate {
  return {
    createdAt: now - DAY, evidence: {
      capturedAt: now - DAY, excerpt: id, kind: 'chat-message',
      sourceMessageId: 'message-volatile-1', sourceRoleId: 'berry', topicId: null,
    },
    id, proposedRecord: groupRecord(recordId, 'current-group'), status: 'approved',
  };
}

const groupMemoryRepository = {
  ...EMPTY_GROUP_MEMORY_REPOSITORY,
  candidates: [groupCandidate('group-candidate-a', 'group-record-a'),
    groupCandidate('group-candidate-b', 'group-record-b')],
  records: [
    groupRecord('group-memory-message-stable-1', 'current-group'),
    groupRecord('archived-record-stable-2', 'subgroup-1'),
    groupRecord('group-memory-message-stable-3', 'subgroup-disabled'),
    groupRecord('group-record-a', 'current-group'), groupRecord('group-record-b', 'subgroup-1'),
  ],
  evidenceScopeSnapshots: [{
    capturedAt: now - 2 * DAY, groupId: 'current-group', id: 'scope-stable-2',
    recordId: 'archived-record-stable-2', source: 'candidate-approval' as const,
    sourceMessageId: 'message-stable-2', sourceRoleId: 'alice', topicId: null,
  }],
  subgroups: [
    { createdAt: 1, id: 'subgroup-1', memberRoleIds: ['alice', 'berry'],
      name: '调查小组', updatedAt: 1 },
    { createdAt: 1, id: 'subgroup-disabled', invalidatedAt: 2,
      memberRoleIds: ['alice', 'berry'], name: '停用小组', updatedAt: 2 },
  ],
};
const scoped = buildScopedRelationshipEvidenceWindows({
  groupMemoryRepository, now, repository,
});
assert.equal(scoped.length, 6);
const publicStable = scoped.find((window) => (
  window.relationshipId === 'alice->berry' && window.memoryGroupId === 'current-group'
))!;
assert.equal(publicStable.eligibleSignalCount, 1);
assert.equal(publicStable.correctionAuditScope, 'relationship-wide-not-grouped');
assert.equal(publicStable.readiness, 'insufficient-evidence');
const subgroupStable = scoped.find((window) => window.memoryGroupId === 'subgroup-1'
  && window.relationshipId === 'alice->berry')!;
assert.equal(subgroupStable.eligibleSignalCount, 1);
assert.equal(subgroupStable.scopeProvenance[0]?.originalGroupId, 'current-group',
  'migrated record must keep its original approval scope provenance');
const unlinkedStable = scoped.find((window) => window.relationshipId === 'alice->berry'
  && window.scopeReason === 'no-formal-memory-link')!;
assert.equal(unlinkedStable.eligibleSignalCount, 1, 'disabled subgroup must remain unlinked');
const ambiguousVolatile = scoped.find((window) => (
  window.relationshipId === 'berry->alice'
  && window.scopeReason === 'ambiguous-formal-memory-link'
))!;
assert.equal(ambiguousVolatile.eligibleSignalCount, 1);
const correctedScopes = buildScopedRelationshipEvidenceWindows({
  groupMemoryRepository: {
    ...groupMemoryRepository,
    evidenceScopeCorrections: [{
      correctedGroupId: 'current-group',
      correctedRecordId: 'group-memory-message-stable-1', id: 'scope-correction-stable-2',
      occurredAt: now, reason: '关联到了错误的正式记录', snapshotId: 'scope-stable-2',
    }],
  },
  now,
  repository,
});
const correctedPublicStable = correctedScopes.find((window) => (
  window.relationshipId === 'alice->berry' && window.memoryGroupId === 'current-group'
))!;
assert.equal(correctedPublicStable.eligibleSignalCount, 2);
const correctedProvenance = correctedPublicStable.scopeProvenance.find((item) => (
  item.latestCorrectionId === 'scope-correction-stable-2'
));
assert.equal(correctedProvenance?.originalGroupId, 'current-group');
assert.equal(correctedProvenance?.effectiveRecordId, 'group-memory-message-stable-1');
assert.equal(correctedProvenance?.effectiveGroupId, 'current-group');
console.log('relationship evidence window smoke ok');
