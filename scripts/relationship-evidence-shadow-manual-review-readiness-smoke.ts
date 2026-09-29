import assert from 'node:assert/strict';
import {
  buildRelationshipEvidenceShadowManualReviewReadiness,
  type RelationshipEvidenceShadowManualReviewReadinessInput,
} from '../src/social-trend';

const ready: RelationshipEvidenceShadowManualReviewReadinessInput = {
  aggregateCalibrationStatus: 'calibration-ready',
  aggregateDenominatorsReady: true,
  duplicateCorpusCount: 0,
  reasonConfidenceReady: true,
  reasonStabilityReady: true,
};

const report = buildRelationshipEvidenceShadowManualReviewReadiness(ready);
assert.equal(report.claimLevel, 'manual-calibration-review-readiness-only');
assert.equal(report.status, 'eligible-for-manual-review');
assert.equal(report.eligibleForManualReview, true);
assert.deepEqual(report.issues, []);

const blocked = buildRelationshipEvidenceShadowManualReviewReadiness({
  aggregateCalibrationStatus: 'insufficient-samples',
  aggregateDenominatorsReady: false,
  duplicateCorpusCount: 2,
  reasonConfidenceReady: false,
  reasonStabilityReady: false,
});
assert.equal(blocked.status, 'not-eligible-for-manual-review');
assert.equal(blocked.eligibleForManualReview, false);
assert.deepEqual(blocked.issues, [
  'aggregate-calibration-not-ready',
  'aggregate-denominators-insufficient',
  'reason-denominators-insufficient',
  'reason-stability-insufficient',
  'duplicate-corpus-ids',
]);
assert.equal(blocked.duplicateCorpusCount, 2);
assert.doesNotMatch(JSON.stringify(blocked), /threshold|corpusId|sampleId|repository/iu);

for (const field of [
  'aggregateDenominatorsReady', 'reasonConfidenceReady', 'reasonStabilityReady',
] as const) {
  const input = { ...ready, [field]: false };
  assert.equal(buildRelationshipEvidenceShadowManualReviewReadiness(input)
    .eligibleForManualReview, false, `${field} must block manual review`);
}
console.log('relationship evidence shadow manual review readiness smoke ok');
