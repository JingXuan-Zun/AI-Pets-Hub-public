import assert from 'node:assert/strict';
import {
  createDirectedRelationshipCandidate,
  EMPTY_DIRECTED_RELATIONSHIP_REPOSITORY,
  enqueueDirectedRelationshipCandidate,
  normalizeDirectedRelationshipRepository,
  recordDirectedRelationshipBehaviorTrace,
  upsertDirectedRelationship,
} from '../src/character-relationship';

const input = {
  addressedRoleIds: ['berry'], behaviorTargetRoleIds: ['berry'], groupSessionId: 'group-1',
  sourceMessageId: 'turn-1', sourceRoleId: 'alice', sourceRoleName: 'Alice', topicId: 'topic-1',
};

assert.equal(recordDirectedRelationshipBehaviorTrace(
  EMPTY_DIRECTED_RELATIONSHIP_REPOSITORY, input, 100,
), EMPTY_DIRECTED_RELATIONSHIP_REPOSITORY, 'no formal relationship means no behavior trace');

let repository = upsertDirectedRelationship(EMPTY_DIRECTED_RELATIONSHIP_REPOSITORY, {
  dimensions: { intimacy: 80, trust: 85, vigilance: 20 }, evidenceSummary: 'formal relationship',
  sourceRoleId: 'alice', targetRoleId: 'berry', targetRoleName: 'Berry',
}, { now: 100, reason: 'manual relationship', source: 'manual' });
repository = upsertDirectedRelationship(repository, {
  dimensions: { intimacy: 40, trust: 45, vigilance: 50 }, evidenceSummary: 'other relationship',
  sourceRoleId: 'alice', targetRoleId: 'charlie', targetRoleName: 'Charlie',
}, { now: 101, reason: 'other manual relationship', source: 'manual' });
repository = recordDirectedRelationshipBehaviorTrace(repository, input, 110);
assert.equal(repository.behaviorTraces.length, 1);
const first = repository.behaviorTraces[0]!;
assert.equal(first.claimLevel, 'policy-supplied-only');
assert.equal(first.eventKind, 'relationship-behavior-context');
assert.equal(first.policies[0]?.sourceDimensions.trust, 85);
assert.equal(first.policies[0]?.sourceUpdatedAt, 100);
assert.deepEqual(first.policies.map((item) => item.targetRoleId), ['berry'],
  'trace must only retain policies supplied for this turn');
assert.deepEqual(first.addressedRoleIds, ['berry']);
assert.equal(first.outputExcerpt, '', 'behavior traces must not retain conversation text');
assert.equal(first.topicId, 'topic-1');
assert.equal(recordDirectedRelationshipBehaviorTrace(repository, input, 111), repository,
  'same role and turn must dedupe');

repository = upsertDirectedRelationship(repository, {
  dimensions: { intimacy: 30, trust: 25, vigilance: 80 }, evidenceSummary: 'later correction',
  sourceRoleId: 'alice', targetRoleId: 'berry', targetRoleName: 'Berry',
}, { now: 200, reason: 'manual correction', source: 'correction' });
repository = recordDirectedRelationshipBehaviorTrace(repository, {
  ...input, sourceMessageId: 'turn-2',
}, 210);
assert.equal(repository.behaviorTraces.length, 2);
assert.equal(repository.behaviorTraces[0]?.policies[0]?.sourceDimensions.trust, 85,
  'historical trace must keep original policy snapshot');
assert.equal(repository.behaviorTraces[1]?.policies[0]?.sourceDimensions.trust, 25);

const pending = createDirectedRelationshipCandidate(EMPTY_DIRECTED_RELATIONSHIP_REPOSITORY, {
  activeRoleIds: ['alice', 'berry'], deltas: { intimacy: 2, trust: 2, vigilance: -2 },
  evidenceExcerpt: 'Berry helped.', reason: 'pending candidate', sourceMessageId: 'candidate-turn',
  sourceRoleId: 'alice', sourceRoleName: 'Alice', targetRoleId: 'berry', targetRoleName: 'Berry',
}, 300);
const pendingOnly = enqueueDirectedRelationshipCandidate(EMPTY_DIRECTED_RELATIONSHIP_REPOSITORY, pending);
assert.equal(recordDirectedRelationshipBehaviorTrace(pendingOnly, input, 310), pendingOnly,
  'pending candidate must not create behavior trace');

const persisted = JSON.parse(JSON.stringify(repository));
persisted.behaviorTraces[0].outputExcerpt = '可能包含用户原文';
persisted.behaviorTraces[0].addressedRoleIds = ['berry', ' berry ', '', 'berry'];
persisted.behaviorTraces.push({ ...persisted.behaviorTraces[0], id: 'invalid-session', groupSessionId: '' });
persisted.behaviorTraces.push({ ...persisted.behaviorTraces[0], id: 'invalid-turn', sourceMessageId: '' });
persisted.behaviorTraces.push({
  ...persisted.behaviorTraces[0], id: 'invalid-policy',
  policies: [{ ...persisted.behaviorTraces[0].policies[0], addressStyle: 'invented-style' }],
});
const restarted = normalizeDirectedRelationshipRepository(persisted);
assert.equal(restarted.behaviorTraces.length, 2);
assert.deepEqual(restarted.behaviorTraces[0]?.addressedRoleIds, ['berry']);
assert.equal(restarted.behaviorTraces[0]?.outputExcerpt, '', 'restart must remove legacy excerpts');
assert.equal(restarted.behaviorTraces[0]?.claimLevel, 'policy-supplied-only');
assert.equal(restarted.behaviorTraces[1]?.policies[0]?.policyVersion, 1);
assert.equal(recordDirectedRelationshipBehaviorTrace(repository, { ...input, groupSessionId: '' }, 320), repository);
assert.equal(recordDirectedRelationshipBehaviorTrace(repository, { ...input, sourceMessageId: '' }, 321), repository);

const overflow = JSON.parse(JSON.stringify(repository));
overflow.behaviorTraces = Array.from({ length: 302 }, (_, index) => ({
  ...overflow.behaviorTraces[0], id: `trace-${index}`, sourceMessageId: `turn-${index}`,
}));
const bounded = normalizeDirectedRelationshipRepository(overflow);
assert.equal(bounded.behaviorTraces.length, 300);
assert.equal(bounded.behaviorTraces[0]?.id, 'trace-2', 'oldest traces must be evicted first');
console.log('directed relationship behavior trace smoke ok');
