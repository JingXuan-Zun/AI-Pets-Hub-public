import assert from 'node:assert/strict';
import {
  createRelationshipEvidenceShadowManualReviewReceipt,
  serializeRelationshipEvidenceShadowManualReviewReceipt,
  type RelationshipEvidenceShadowValidatedManualReviewDecision,
} from '../src/social-trend';

const decision: RelationshipEvidenceShadowValidatedManualReviewDecision = {
  acknowledgements: {
    evidenceReviewed: true,
    noAutomaticApplicationAcknowledged: true,
  },
  decision: 'needs-more-evidence',
  evidenceReference: {
    aggregateCalibrationStatus: 'insufficient-samples',
    calibrationProfileId: 'calibration-v1', corpusCount: 2,
    evidenceRevision: 'evidence-v1-0123456789abcdef', matchedCount: 4,
    reasonConfidenceStatus: 'insufficient-reason-denominators',
    reasonLabeledSampleCount: 6,
    reasonStabilityStatus: 'insufficient-reason-stability',
    reviewReadinessStatus: 'not-eligible-for-manual-review', sampleCount: 6,
  },
  rationale: 'private reviewer rationale that must not be exported',
  reviewedAt: 123,
};

const before = JSON.stringify(decision);
const receipt = createRelationshipEvidenceShadowManualReviewReceipt(decision, 456);
assert.equal(JSON.stringify(decision), before, 'receipt creation must stay read-only');
assert.equal(receipt.claimLevel, 'validated-manual-review-receipt-only');
assert.equal(receipt.kind, 'relationship-evidence-shadow-manual-review-receipt');
assert.equal(receipt.issuedAt, 456);
assert.match(receipt.receiptRevision, /^receipt-v1-[0-9a-f]{16}$/u);
assert.equal(receipt.rationaleSummary.included, false);
assert.equal(receipt.rationaleSummary.present, true);
assert.equal(receipt.rationaleSummary.length, decision.rationale.length);
assert.equal(receipt.validationBoundary.executable, false);
assert.equal(receipt.validationBoundary.persisted, false);
assert.equal(receipt.validationBoundary.productionThresholdsChanged, false);

const serialized = serializeRelationshipEvidenceShadowManualReviewReceipt(decision, 456);
assert.equal(serialized.endsWith('\n'), true);
assert.doesNotMatch(serialized, /private reviewer rationale/iu);
assert.doesNotMatch(serialized,
  /thresholds"|corpusId|sampleId|repository|candidate|sourceMessageId/iu);
const changed = createRelationshipEvidenceShadowManualReviewReceipt({
  ...decision, decision: 'reject-for-now',
}, 456);
assert.notEqual(changed.receiptRevision, receipt.receiptRevision);
const changedRationale = createRelationshipEvidenceShadowManualReviewReceipt({
  ...decision, rationale: `${decision.rationale} extended`,
}, 456);
assert.notEqual(changedRationale.receiptRevision, receipt.receiptRevision);
console.log('relationship evidence shadow manual review receipt smoke ok');
