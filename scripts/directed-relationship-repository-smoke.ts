import assert from 'node:assert/strict';
import {
  EMPTY_DIRECTED_RELATIONSHIP_REPOSITORY,
  normalizeDirectedRelationshipRepository,
  upsertDirectedRelationship,
} from '../src/character-relationship';

function relationship(sourceRoleId: string, targetRoleId: string, trust: number) {
  return {
    dimensions: { intimacy: 60, trust, vigilance: 20 }, evidenceSummary: 'manual evidence',
    sourceRoleId, targetRoleId, targetRoleName: targetRoleId.toUpperCase(),
  };
}

let repository = upsertDirectedRelationship(
  EMPTY_DIRECTED_RELATIONSHIP_REPOSITORY,
  relationship('alice', 'berry', 80),
  { now: 100, reason: 'initial manual relationship', source: 'manual' },
);
repository = upsertDirectedRelationship(repository, relationship('berry', 'alice', 25), {
  now: 200, reason: 'reverse relationship is independent', source: 'manual',
});

assert.equal(repository.records.length, 2);
assert.equal(repository.records.find((item) => item.id === 'alice->berry')?.dimensions.trust, 80);
assert.equal(repository.records.find((item) => item.id === 'berry->alice')?.dimensions.trust, 25);
assert.equal(repository.auditTrail.length, 2);

repository = upsertDirectedRelationship(repository, relationship('alice', 'berry', 120), {
  now: 300, reason: 'corrected after review', source: 'correction',
});
assert.equal(repository.records.find((item) => item.id === 'alice->berry')?.dimensions.trust, 100);
assert.equal(repository.auditTrail.at(-1)?.before?.dimensions.trust, 80);
assert.equal(repository.auditTrail.at(-1)?.after?.dimensions.trust, 100);

repository = upsertDirectedRelationship(repository, relationship('alice', 'berry', 90), {
  now: 300, reason: 'same millisecond edit', source: 'correction',
});
assert.equal(new Set(repository.auditTrail.map((entry) => entry.id)).size, repository.auditTrail.length);
assert.equal(repository.records.find((item) => item.id === 'alice->berry')?.updatedAt, 300);
repository = upsertDirectedRelationship(repository, relationship('alice', 'berry', 85), {
  now: 250, reason: 'older imported correction', source: 'import',
});
assert.equal(repository.records.find((item) => item.id === 'alice->berry')?.updatedAt, 300);
assert.equal(repository.records.find((item) => item.id === 'alice->berry')?.dimensions.trust, 90);

const normalized = normalizeDirectedRelationshipRepository({
  auditTrail: [...repository.auditTrail, { source: 'automatic' }],
  records: [...repository.records, relationship('same', 'same', 50)],
});
assert.equal(normalized.records.length, 2);
assert.equal(normalized.auditTrail.length, 4);
assert.equal(normalized.auditTrail.some((entry) => String(entry.source) === 'automatic'), false);

console.log('directed relationship repository smoke ok');
