import assert from 'node:assert/strict';
import {
  createRelationshipEvidenceShadowCorpusTemplate,
  evaluateRelationshipEvidenceShadowCorpusBatch,
  importRelationshipEvidenceShadowCorpus,
  type RelationshipEvidenceShadowCorpus,
} from '../src/social-trend';

function corpus(id: string): RelationshipEvidenceShadowCorpus {
  const source = {
    ...createRelationshipEvidenceShadowCorpusTemplate(1), corpusId: id, redactionConfirmed: true,
  };
  const imported = importRelationshipEvidenceShadowCorpus(source);
  assert.ok(imported.corpus);
  return imported.corpus;
}

const first = corpus('batch-a');
const second = corpus('batch-b');
const before = JSON.stringify([first, second]);
const report = evaluateRelationshipEvidenceShadowCorpusBatch([first, second]);
assert.equal(JSON.stringify([first, second]), before, 'batch evaluation must stay read-only');
assert.equal(report.claimLevel, 'offline-batch-calibration-only');
assert.equal(report.corpusCount, 2);
assert.equal(report.sampleCount, 6);
assert.equal(report.aggregateReport.sampleCount, 6);
assert.deepEqual(report.corpusReports.map((item) => item.corpusId), ['batch-a', 'batch-b']);
assert.deepEqual(report.profileComparisons.map((item) => item.profileId), [
  'calibration-v1', 'calibration-strict-v1',
]);
assert.deepEqual(report.duplicateCorpusIds, []);
assert.equal(report.driftComparisons.length, 1);
assert.equal(report.driftComparisons[0]?.movement, 'insufficient-denominator');
assert.equal(report.confidenceReport.insufficientDenominatorMetrics.length, 4);
assert.equal(report.reasonConfidenceReport.status, 'insufficient-reason-denominators');
assert.equal(report.reasonConfidenceReport.metrics.length, 8);
assert.equal(report.reasonDriftComparisons.length, 1);
assert.equal(report.corpusReports.every((item) => item.reasonConfidenceReport.metrics.length === 8),
  true);
assert.equal(report.reasonStabilityReport.status, 'insufficient-reason-stability');
assert.equal(report.manualReviewReadiness.eligibleForManualReview, false);

const duplicate = evaluateRelationshipEvidenceShadowCorpusBatch([first, first, second]);
assert.deepEqual(duplicate.duplicateCorpusIds, ['batch-a']);
assert.equal(duplicate.corpusCount, 2, 'later duplicate corpus must not inflate aggregate metrics');
assert.equal(duplicate.sampleCount, 6);
console.log('relationship evidence shadow batch smoke ok');
