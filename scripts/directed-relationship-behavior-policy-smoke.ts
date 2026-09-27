import assert from 'node:assert/strict';
import {
  buildDirectedRelationshipBehaviorPolicies,
  buildDirectedRelationshipBehaviorPromptLines,
  createDirectedRelationshipCandidate,
  deriveDirectedRelationshipBehaviorPolicy,
  EMPTY_DIRECTED_RELATIONSHIP_REPOSITORY,
  enqueueDirectedRelationshipCandidate,
  invalidateDirectedRelationship,
  upsertDirectedRelationship,
  type DirectedRelationshipRecord,
} from '../src/character-relationship';

function record(id: string, trust: number, intimacy: number, vigilance: number): DirectedRelationshipRecord {
  const [sourceRoleId, targetRoleId] = id.split('->');
  return {
    createdAt: 100, dimensions: { intimacy, trust, vigilance }, evidenceSummary: 'approved evidence',
    id, sourceRoleId: sourceRoleId!, targetRoleId: targetRoleId!, targetRoleName: targetRoleId,
    updatedAt: 100,
  };
}

const close = deriveDirectedRelationshipBehaviorPolicy(record('alice->berry', 85, 80, 20));
assert.equal(close.addressStyle, 'familiar-warm');
assert.equal(close.engagementStyle, 'acknowledge-and-build');
assert.equal(close.verificationStyle, 'cooperative-verify');
assert.equal(close.sharingStyle, 'open-with-boundaries');
assert.equal(close.supportStyle, 'support-with-evidence');
assert.equal(close.disagreementStyle, 'warm-clarification');
assert.equal(close.policyVersion, 1);
assert.equal(close.sourceUpdatedAt, 100);
assert.deepEqual(close.sourceDimensions, { intimacy: 80, trust: 85, vigilance: 20 });

const guarded = deriveDirectedRelationshipBehaviorPolicy(record('alice->cocoa', 20, 75, 80));
assert.equal(guarded.addressStyle, 'formal-distance', 'high vigilance must override intimacy');
assert.equal(guarded.engagementStyle, 'direct-and-limited');
assert.equal(guarded.verificationStyle, 'strict-verify');
assert.equal(guarded.sharingStyle, 'minimal');
assert.equal(guarded.supportStyle, 'withhold-automatic-defense');
assert.equal(guarded.disagreementStyle, 'firm-boundary');

const lines = buildDirectedRelationshipBehaviorPromptLines([close, guarded]).join('\n');
assert.match(lines, /已经被调度为本轮发言者后/u);
assert.match(lines, /不得据此抢占发言、插话、强制沉默或修改发言队列/u);
assert.match(lines, /不得覆盖 Persona Anchor/u);
assert.match(lines, /不得把角色观点升级成世界事实/u);
assert.match(lines, /不得降低工具审批、权限、证据或用户隐私边界/u);

let repository = upsertDirectedRelationship(EMPTY_DIRECTED_RELATIONSHIP_REPOSITORY, {
  dimensions: closeToDimensions(close), evidenceSummary: 'formal relation',
  sourceRoleId: 'alice', targetRoleId: 'berry', targetRoleName: 'Berry',
}, { now: 200, reason: 'manual formal relationship', source: 'manual' });
repository = upsertDirectedRelationship(repository, {
  dimensions: { intimacy: 20, trust: 20, vigilance: 80 }, evidenceSummary: 'reverse relation',
  sourceRoleId: 'berry', targetRoleId: 'alice', targetRoleName: 'Alice',
}, { now: 201, reason: 'reverse is independent', source: 'manual' });
let policies = buildDirectedRelationshipBehaviorPolicies({
  repository, roleId: 'alice', targetRoleIds: ['berry'],
});
assert.equal(policies.length, 1);
assert.equal(policies[0]?.targetRoleId, 'berry');
assert.equal(policies[0]?.addressStyle, 'familiar-warm');
assert.equal(buildDirectedRelationshipBehaviorPolicies({
  repository, roleId: 'alice', targetRoleIds: [],
}).length, 0, 'an explicit empty target list must disable relationship behavior');

const pending = createDirectedRelationshipCandidate(repository, {
  activeRoleIds: ['alice', 'cocoa'], deltas: { intimacy: 5, trust: 5, vigilance: -5 },
  evidenceExcerpt: 'Cocoa helped.', reason: 'pending only', sourceMessageId: 'turn-1',
  sourceRoleId: 'alice', sourceRoleName: 'Alice', targetRoleId: 'cocoa', targetRoleName: 'Cocoa',
}, 300);
repository = enqueueDirectedRelationshipCandidate(repository, pending);
assert.equal(buildDirectedRelationshipBehaviorPolicies({ repository, roleId: 'alice' }).length, 1,
  'pending candidates must not create behavior policies');
repository = invalidateDirectedRelationship(repository, 'alice->berry', 400);
policies = buildDirectedRelationshipBehaviorPolicies({ repository, roleId: 'alice' });
assert.equal(policies.length, 0, 'invalidated relationships must not affect behavior');
console.log('directed relationship behavior policy smoke ok');

function closeToDimensions(policy: typeof close) {
  void policy;
  return { intimacy: 80, trust: 85, vigilance: 20 };
}
