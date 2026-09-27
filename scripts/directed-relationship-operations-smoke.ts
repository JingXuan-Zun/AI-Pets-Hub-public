import assert from 'node:assert/strict';
import {
  EMPTY_DIRECTED_RELATIONSHIP_REPOSITORY,
  getLatestRollbackableRelationshipAudit,
  invalidateDirectedRelationship,
  pruneDirectedRelationshipsForRole,
  restoreDirectedRelationship,
  rollbackDirectedRelationshipOperation,
  upsertDirectedRelationship,
} from '../src/character-relationship';

function add(sourceRoleId: string, targetRoleId: string, now: number) {
  return upsertDirectedRelationship(EMPTY_DIRECTED_RELATIONSHIP_REPOSITORY, {
    dimensions: { intimacy: 60, trust: 70, vigilance: 20 }, evidenceSummary: '',
    sourceRoleId, targetRoleId,
  }, { now, reason: 'manual setup', source: 'manual' });
}

let repository = add('alice', 'berry', 100);
repository = invalidateDirectedRelationship(repository, 'alice->berry', 200);
assert.equal(repository.records[0]?.invalidatedAt, 200);
assert.equal(repository.auditTrail.at(-1)?.kind, 'invalidate');

const invalidateAudit = getLatestRollbackableRelationshipAudit(repository);
assert.equal(invalidateAudit?.kind, 'invalidate');
repository = rollbackDirectedRelationshipOperation(repository, invalidateAudit!.id, 300);
assert.equal(repository.records[0]?.invalidatedAt, undefined);
assert.equal(repository.auditTrail.at(-1)?.revertsAuditId, invalidateAudit?.id);

repository = invalidateDirectedRelationship(repository, 'alice->berry', 400);
repository = restoreDirectedRelationship(repository, 'alice->berry', 500);
assert.equal(repository.records[0]?.invalidatedAt, undefined);
assert.equal(repository.auditTrail.at(-1)?.kind, 'restore');

let cleanupRepository = add('alice', 'berry', 100);
cleanupRepository = upsertDirectedRelationship(cleanupRepository, {
  dimensions: { intimacy: 30, trust: 20, vigilance: 80 }, evidenceSummary: '',
  sourceRoleId: 'charlie', targetRoleId: 'alice',
}, { now: 110, reason: 'second setup', source: 'manual' });
cleanupRepository = pruneDirectedRelationshipsForRole(cleanupRepository, 'alice', 600);
assert.equal(cleanupRepository.records.length, 0);
assert.equal(cleanupRepository.auditTrail.filter((entry) => entry.kind === 'remove-role').length, 2);
assert.equal(getLatestRollbackableRelationshipAudit(cleanupRepository)?.kind, 'upsert');

console.log('directed relationship operations smoke ok');
