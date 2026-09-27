import assert from 'node:assert/strict';
import {
  createRelationshipEvidenceShadowCorpusTemplate,
  evaluateRelationshipEvidenceShadowCorpusBatch,
  importRelationshipEvidenceShadowCorpus,
  serializeRelationshipEvidenceShadowDerivedReport,
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
  corpus('private-batch-alpha', 1), corpus('private-batch-beta', 2),
]);
const serialized = serializeRelationshipEvidenceShadowDerivedReport(batch, 123);
const report = JSON.parse(serialized) as Record<string, unknown>;
assert.equal(report.exportedAt, 123);
assert.equal(report.kind, 'relationship-evidence-shadow-derived-report');
assert.equal(serialized.endsWith('\n'), true);
assert.doesNotMatch(serialized, /private-batch-alpha|private-batch-beta|example-candidate|message-/u);
assert.doesNotMatch(serialized, /"createdAt"/u);
assert.match(serialized, /"batchId": "batch-1"/u);
assert.match(serialized, /"previousBatchId": "batch-1"/u);
assert.match(serialized, /"confidence":/u);
assert.match(serialized, /"reasonSummary":/u);
assert.match(serialized, /"reasonConfidence":/u);
assert.match(serialized, /"descriptive-reason-confidence-only"/u);
assert.match(serialized, /"reasonDriftComparisons":/u);
assert.match(serialized, /"descriptive-reason-drift-only"/u);
assert.match(serialized, /"reasonStability":/u);
assert.match(serialized, /"descriptive-reason-stability-only"/u);
assert.match(serialized, /"manualReviewReadiness":/u);
assert.match(serialized, /"manual-calibration-review-readiness-only"/u);
assert.match(serialized, /"minimumDenominator": 20/u);

const forbiddenKeys = new Set([
  'candidates', 'corpusId', 'currentCorpusId', 'evidenceExcerpt', 'mismatches',
  'previousCorpusId', 'repository', 'sampleId', 'samples', 'sourceMessageId',
]);
function inspect(value: unknown) {
  if (Array.isArray(value)) return value.forEach(inspect);
  if (!value || typeof value !== 'object') return;
  Object.entries(value).forEach(([key, child]) => {
    assert.equal(forbiddenKeys.has(key), false, `derived report leaked forbidden key ${key}`);
    inspect(child);
  });
}
inspect(report);
console.log('relationship evidence shadow derived report smoke ok');
