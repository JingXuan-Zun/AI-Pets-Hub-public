import assert from 'node:assert/strict';
import {
  approveDirectedRelationshipCandidate,
  buildDirectedRelationshipCandidateGroups,
  buildDirectedRelationshipContextPacket,
  createDirectedRelationshipCandidate,
  EMPTY_DIRECTED_RELATIONSHIP_REPOSITORY,
  enqueueDirectedRelationshipCandidate,
  getLatestRollbackableRelationshipAudit,
  normalizeDirectedRelationshipRepository,
  rejectDirectedRelationshipCandidate,
  reviewDirectedRelationshipCandidateBatch,
  rollbackDirectedRelationshipCandidateReview,
  upsertDirectedRelationship,
  type DirectedRelationshipRepositoryData,
} from '../src/character-relationship';

function candidate(repository: DirectedRelationshipRepositoryData, options: {
  messageId: string; source?: string; target?: string; evidence?: string;
}, now: number) {
  const source = options.source ?? 'alice';
  const target = options.target ?? 'berry';
  return createDirectedRelationshipCandidate(repository, {
    activeRoleIds: ['alice', 'berry', 'cocoa'],
    deltas: { intimacy: 1, trust: 2, vigilance: -1 },
    evidenceExcerpt: options.evidence ?? `${target} provided clear help.`,
    reason: 'clear interaction evidence', sourceMessageId: options.messageId,
    sourceRoleId: source, sourceRoleName: source, targetRoleId: target, targetRoleName: target,
  }, now);
}

let repository = upsertDirectedRelationship(EMPTY_DIRECTED_RELATIONSHIP_REPOSITORY, {
  dimensions: { intimacy: 50, trust: 50, vigilance: 50 }, evidenceSummary: 'manual baseline',
  sourceRoleId: 'cocoa', targetRoleId: 'berry', targetRoleName: 'berry',
}, { now: 90, reason: 'older manual relationship', source: 'manual' });
const approvedCandidate = candidate(repository, { messageId: 'turn-1' }, 100);
repository = enqueueDirectedRelationshipCandidate(repository, approvedCandidate);
repository = approveDirectedRelationshipCandidate(repository, approvedCandidate.id, 110).repository;
assert.equal(repository.records.length, 2);
assert.equal(getLatestRollbackableRelationshipAudit(repository), null,
  'generic rollback must not bypass candidate review state');

let rollback = rollbackDirectedRelationshipCandidateReview(repository, approvedCandidate.id, 120);
assert.equal(rollback.reason, 'applied');
repository = rollback.repository;
assert.equal(repository.records.length, 1, 'approval rollback must restore prior formal state');
assert.equal(repository.candidates[0]?.status, 'pending');
assert.equal(repository.candidateReviewReceipts.at(-1)?.decision, 'rollback');
assert.equal(repository.auditTrail.at(-1)?.kind, 'rollback');
assert.equal(buildDirectedRelationshipContextPacket({ repository, roleId: 'alice' }).items.length, 0);
assert.equal(rollbackDirectedRelationshipCandidateReview(repository, approvedCandidate.id, 121).reason, 'already-reverted');

repository = approveDirectedRelationshipCandidate(repository, approvedCandidate.id, 130).repository;
repository = upsertDirectedRelationship(repository, {
  dimensions: { intimacy: 70, trust: 80, vigilance: 10 }, evidenceSummary: 'later manual edit',
  sourceRoleId: 'alice', targetRoleId: 'berry', targetRoleName: 'berry',
}, { now: 140, reason: 'manual edit after approval', source: 'manual' });
rollback = rollbackDirectedRelationshipCandidateReview(repository, approvedCandidate.id, 150);
assert.equal(rollback.reason, 'record-changed-after-approval');
assert.equal(rollback.repository.records.find((record) => record.id === 'alice->berry')?.dimensions.trust, 80);

let rejectionRepository = EMPTY_DIRECTED_RELATIONSHIP_REPOSITORY;
const rejected = candidate(rejectionRepository, { messageId: 'turn-reject' }, 200);
rejectionRepository = enqueueDirectedRelationshipCandidate(rejectionRepository, rejected);
rejectionRepository = rejectDirectedRelationshipCandidate(rejectionRepository, rejected.id, 201).repository;
rejectionRepository = rollbackDirectedRelationshipCandidateReview(rejectionRepository, rejected.id, 202).repository;
assert.equal(rejectionRepository.candidates[0]?.status, 'pending');
assert.equal(rejectionRepository.records.length, 0);

let batchRepository = EMPTY_DIRECTED_RELATIONSHIP_REPOSITORY;
const first = candidate(batchRepository, { messageId: 'batch-1', target: 'berry' }, 300);
batchRepository = enqueueDirectedRelationshipCandidate(batchRepository, first);
const second = candidate(batchRepository, { messageId: 'batch-2', target: 'cocoa' }, 301);
batchRepository = enqueueDirectedRelationshipCandidate(batchRepository, second);
const blocked = candidate(batchRepository, {
  messageId: 'batch-3', target: 'berry', evidence: 'Is this relationship real?',
}, 302);
batchRepository = enqueueDirectedRelationshipCandidate(batchRepository, blocked);
const batch = reviewDirectedRelationshipCandidateBatch(
  batchRepository, [first.id, second.id, blocked.id, first.id], 'approve', 310,
);
assert.equal(batch.appliedCount, 2);
assert.deepEqual(batch.outcomes, ['applied', 'applied', 'blocked-candidate']);
assert.equal(batch.repository.records.length, 2);
assert.equal(batch.repository.candidates.find((item) => item.id === blocked.id)?.status, 'pending');

let evolutionRepository = EMPTY_DIRECTED_RELATIONSHIP_REPOSITORY;
const evolutionFirst = candidate(evolutionRepository, { messageId: 'evolution-1' }, 400);
evolutionRepository = enqueueDirectedRelationshipCandidate(evolutionRepository, evolutionFirst);
const evolutionSecond = candidate(evolutionRepository, { messageId: 'evolution-2' }, 401);
evolutionRepository = enqueueDirectedRelationshipCandidate(evolutionRepository, evolutionSecond);
assert.equal(approveDirectedRelationshipCandidate(
  approveDirectedRelationshipCandidate(evolutionRepository, evolutionFirst.id, 410).repository,
  evolutionSecond.id, 411,
).reason, 'relationship-version-conflict', 'single review must retain stale-base protection');
const evolutionBatch = reviewDirectedRelationshipCandidateBatch(
  evolutionRepository, [evolutionFirst.id, evolutionSecond.id], 'approve', 420,
);
assert.equal(evolutionBatch.appliedCount, 2);
assert.deepEqual(evolutionBatch.outcomes, ['applied', 'applied']);
assert.deepEqual(evolutionBatch.repository.records[0]?.dimensions, {
  intimacy: 52, trust: 54, vigilance: 48,
});
assert.equal(evolutionBatch.repository.candidateReviewReceipts.length, 2);
assert.equal(evolutionBatch.repository.candidateReviewReceipts[1]?.recordBefore?.dimensions.trust, 52);
assert.match(evolutionBatch.repository.auditTrail[1]?.reason ?? '', /after batch predecessor/u);
const rollbackEvolutionSecond = rollbackDirectedRelationshipCandidateReview(
  evolutionBatch.repository, evolutionSecond.id, 430,
);
assert.equal(rollbackEvolutionSecond.reason, 'applied');
assert.equal(rollbackEvolutionSecond.repository.records[0]?.dimensions.trust, 52);
const rollbackEvolutionFirst = rollbackDirectedRelationshipCandidateReview(
  rollbackEvolutionSecond.repository, evolutionFirst.id, 431,
);
assert.equal(rollbackEvolutionFirst.reason, 'applied');
assert.equal(rollbackEvolutionFirst.repository.records.length, 0);

let groupedRepository = EMPTY_DIRECTED_RELATIONSHIP_REPOSITORY;
const groupedForward = candidate(groupedRepository, { messageId: 'group-forward' }, 500);
groupedRepository = enqueueDirectedRelationshipCandidate(groupedRepository, groupedForward);
const groupedReverse = candidate(groupedRepository, {
  messageId: 'group-reverse', source: 'berry', target: 'alice',
}, 501);
groupedRepository = enqueueDirectedRelationshipCandidate(groupedRepository, groupedReverse);
const groupedBlocked = candidate(groupedRepository, {
  messageId: 'group-blocked', evidence: 'Is this relationship real?',
}, 502);
groupedRepository = enqueueDirectedRelationshipCandidate(groupedRepository, groupedBlocked);
const groups = buildDirectedRelationshipCandidateGroups(groupedRepository.candidates);
assert.equal(groups.length, 2, 'forward and reverse relationships must remain separate groups');
const forwardGroup = groups.find((group) => group.id === 'alice->berry')!;
assert.deepEqual(forwardGroup.candidateIds, [groupedForward.id, groupedBlocked.id]);
assert.deepEqual(forwardGroup.approvableCandidateIds, [groupedForward.id]);
assert.equal(forwardGroup.blockedCount, 1);
assert.deepEqual(forwardGroup.deltas, { intimacy: 1, trust: 2, vigilance: -1 });

const restarted = normalizeDirectedRelationshipRepository(JSON.parse(JSON.stringify(repository)));
assert.equal(restarted.candidateReviewReceipts.some((receipt) => receipt.decision === 'rollback'), true);
assert.equal(restarted.candidateReviewReceipts.every((receipt) => Boolean(receipt.nextStatus)), true);
console.log('directed relationship candidate review smoke ok');
