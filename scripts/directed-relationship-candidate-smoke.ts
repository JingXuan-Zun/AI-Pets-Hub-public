import assert from 'node:assert/strict';
import {
  approveDirectedRelationshipCandidate,
  buildDirectedRelationshipContextPacket,
  buildDirectedRelationshipShadowReport,
  createDirectedRelationshipCandidate,
  EMPTY_DIRECTED_RELATIONSHIP_REPOSITORY,
  enqueueDirectedRelationshipCandidate,
  normalizeDirectedRelationshipRepository,
  rejectDirectedRelationshipCandidate,
  upsertDirectedRelationship,
} from '../src/character-relationship';

const input = {
  activeRoleIds: ['alice', 'berry'],
  deltas: { intimacy: 2, trust: 3, vigilance: -1 },
  evidenceExcerpt: 'Berry helped Alice verify the result.',
  reason: 'verified help increased trust',
  sourceMessageId: 'turn-1', sourceRoleId: 'alice', sourceRoleName: 'Alice',
  targetRoleId: 'berry', targetRoleName: 'Berry',
};

let repository = EMPTY_DIRECTED_RELATIONSHIP_REPOSITORY;
const candidate = createDirectedRelationshipCandidate(repository, input, 100);
repository = enqueueDirectedRelationshipCandidate(repository, candidate);
assert.equal(repository.records.length, 0, 'enqueue must not write formal relationship');
assert.equal(buildDirectedRelationshipContextPacket({
  now: 150, repository, roleId: 'alice', targetRoleIds: ['berry'],
}).items.length, 0, 'pending candidate must not enter Character Context');
assert.equal(repository.candidates[0]?.screeningDecision, 'manual-review');
assert.equal(repository.shadowObservations.length, 1);
assert.equal(enqueueDirectedRelationshipCandidate(repository,
  createDirectedRelationshipCandidate(repository, input, 101)), repository, 'same turn must dedupe');

const approved = approveDirectedRelationshipCandidate(repository, candidate.id, 200);
assert.equal(approved.reason, 'applied');
repository = approved.repository;
assert.equal(repository.records[0]?.dimensions.trust, 53);
assert.equal(repository.records[0]?.dimensions.intimacy, 52);
assert.equal(buildDirectedRelationshipContextPacket({
  now: 250, repository, roleId: 'alice', targetRoleIds: ['berry'],
}).items.length, 1, 'approved relationship should enter Character Context');
assert.equal(approveDirectedRelationshipCandidate(repository, candidate.id, 201).reason, 'candidate-not-pending');

const rejectedCandidate = createDirectedRelationshipCandidate(repository, {
  ...input, sourceMessageId: 'turn-2', deltas: { intimacy: 0, trust: -2, vigilance: 2 },
}, 300);
repository = enqueueDirectedRelationshipCandidate(repository, rejectedCandidate);
const recordBeforeReject = repository.records[0];
repository = rejectDirectedRelationshipCandidate(repository, rejectedCandidate.id, 301).repository;
assert.deepEqual(repository.records[0], recordBeforeReject, 'reject must not change formal relationship');

const blocked = createDirectedRelationshipCandidate(repository, {
  ...input, sourceMessageId: 'turn-3', evidenceExcerpt: 'Is Berry trustworthy?',
}, 400);
repository = enqueueDirectedRelationshipCandidate(repository, blocked);
assert.equal(blocked.screeningDecision, 'blocked');
assert.equal(approveDirectedRelationshipCandidate(repository, blocked.id, 401).reason, 'blocked-candidate');

const stale = createDirectedRelationshipCandidate(repository, { ...input, sourceMessageId: 'turn-4' }, 500);
repository = enqueueDirectedRelationshipCandidate(repository, stale);
repository = upsertDirectedRelationship(repository, {
  dimensions: { intimacy: 60, trust: 70, vigilance: 20 }, evidenceSummary: 'new manual state',
  sourceRoleId: 'alice', targetRoleId: 'berry', targetRoleName: 'Berry',
}, { now: 501, reason: 'manual edit after candidate', source: 'manual' });
assert.equal(approveDirectedRelationshipCandidate(repository, stale.id, 502).reason, 'relationship-version-conflict');
assert.equal(repository.records[0]?.dimensions.trust, 70);

const normalized = normalizeDirectedRelationshipRepository(JSON.parse(JSON.stringify(repository)));
assert.equal(normalized.candidates.length, repository.candidates.length);
assert.equal(normalized.shadowObservations.length, repository.shadowObservations.length);
assert.equal(buildDirectedRelationshipShadowReport(normalized).writeMode, 'manual-approval-only');
console.log('directed relationship candidate smoke ok');
