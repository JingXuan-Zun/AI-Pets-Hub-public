import assert from 'node:assert/strict';
import {
  createRelationshipEvidenceShadowCorpusTemplate,
  createRelationshipEvidenceShadowManualReviewPacket,
  evaluateRelationshipEvidenceShadowCorpusBatch,
  importRelationshipEvidenceShadowCorpus,
  serializeRelationshipEvidenceShadowManualReviewPacket,
  type RelationshipEvidenceShadowCorpus,
} from '../src/social-trend';

function corpus(id: string, createdAt: number): RelationshipEvidenceShadowCorpus {
  const imported = importRelationshipEvidenceShadowCorpus({
    ...createRelationshipEvidenceShadowCorpusTemplate(createdAt), corpusId: id,
    redactionConfirmed: true,
  });
  assert.ok(imported.corpus);
  return imported.corpus;
}

const batch = evaluateRelationshipEvidenceShadowCorpusBatch([
  corpus('private-alpha', 1), corpus('private-beta', 2),
]);
const before = JSON.stringify(batch);
const packet = createRelationshipEvidenceShadowManualReviewPacket(batch, 123);
assert.equal(JSON.stringify(batch), before, 'packet creation must stay read-only');
assert.equal(packet.generatedAt, 123);
assert.equal(packet.kind, 'relationship-evidence-shadow-manual-review-packet');
assert.equal(packet.claimLevel, 'anonymous-manual-calibration-review-only');
assert.equal(packet.corpusCount, 2);
assert.equal(packet.evidenceReference.sampleCount, batch.sampleCount);
assert.equal(packet.evidenceReference.corpusCount, batch.corpusCount);
assert.equal(packet.reviewBoundary.automaticThresholdApplication, false);
assert.equal(packet.reviewBoundary.automaticThresholdRecommendation, false);
assert.equal(packet.reviewBoundary.humanDecisionRequired, true);
assert.equal(packet.reviewBoundary.productionReadinessClaimed, false);
assert.equal(packet.configuredProfileComparisons.length, 2);
assert.equal(packet.reasonConfidence.metrics.length, 8);
assert.equal(packet.reasonStability.metrics.length, 8);

const serialized = serializeRelationshipEvidenceShadowManualReviewPacket(batch, 123);
assert.equal(serialized.endsWith('\n'), true);
assert.doesNotMatch(serialized,
  /private-alpha|private-beta|example-candidate|message-|sourceMessageId/iu);
const forbiddenKeys = new Set([
  'batches', 'candidates', 'corpusId', 'createdAt', 'currentBatchId',
  'currentCorpusId', 'driftComparisons', 'evidenceExcerpt', 'mismatches',
  'previousBatchId', 'previousCorpusId', 'repository', 'sampleId', 'samples',
]);
function inspect(value: unknown) {
  if (Array.isArray(value)) return value.forEach(inspect);
  if (!value || typeof value !== 'object') return;
  Object.entries(value).forEach(([key, child]) => {
    assert.equal(forbiddenKeys.has(key), false, `manual review packet leaked ${key}`);
    inspect(child);
  });
}
inspect(JSON.parse(serialized) as unknown);
console.log('relationship evidence shadow manual review packet smoke ok');
