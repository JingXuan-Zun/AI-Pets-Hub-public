import assert from 'node:assert/strict';
import {
  buildRelationshipEvidenceShadowReasonConfidenceReport,
  MIN_RELATIONSHIP_EVIDENCE_SHADOW_REASON_DENOMINATOR,
  RELATIONSHIP_EVIDENCE_WINDOW_REASON_VALUES,
  type RelationshipEvidenceShadowReasonReport,
} from '../src/social-trend';

function reasonReport(actualCount: number, expectedCount: number, truePositiveCount: number) {
  return {
    exactMatchCount: 0,
    labeledSampleCount: 0,
    metrics: RELATIONSHIP_EVIDENCE_WINDOW_REASON_VALUES.map((reason) => ({
      actualCount, expectedCount,
      precision: actualCount ? truePositiveCount / actualCount : 0,
      reason,
      recall: expectedCount ? truePositiveCount / expectedCount : 0,
      truePositiveCount,
    })),
    mismatches: [], missingExpectedReasons: [], reasonCoverageRate: 1,
    unlabeledLegacySampleCount: 0,
  } satisfies RelationshipEvidenceShadowReasonReport;
}

const ready = buildRelationshipEvidenceShadowReasonConfidenceReport(reasonReport(20, 20, 20));
assert.equal(ready.claimLevel, 'descriptive-reason-confidence-only');
assert.equal(ready.minimumDenominator, MIN_RELATIONSHIP_EVIDENCE_SHADOW_REASON_DENOMINATOR);
assert.equal(ready.status, 'reason-confidence-ready');
assert.deepEqual(ready.insufficientPrecisionReasons, []);
assert.deepEqual(ready.insufficientRecallReasons, []);
assert.equal(Math.abs(ready.metrics[0]!.precision.lowerBound - 0.838874841) < 0.000001, true);
assert.equal(ready.metrics[0]!.recall.upperBound, 1);

const failed = buildRelationshipEvidenceShadowReasonConfidenceReport(reasonReport(20, 20, 0));
assert.equal(Math.abs(failed.metrics[0]!.precision.upperBound - 0.161125159) < 0.000001, true);
const empty = buildRelationshipEvidenceShadowReasonConfidenceReport(reasonReport(0, 0, 0));
assert.equal(empty.status, 'insufficient-reason-denominators');
assert.equal(empty.metrics.every((item) => item.precision.lowerBound === 0
  && item.precision.upperBound === 1 && item.recall.lowerBound === 0
  && item.recall.upperBound === 1), true);

const rare = buildRelationshipEvidenceShadowReasonConfidenceReport(reasonReport(19, 20, 19));
assert.equal(rare.insufficientPrecisionReasons.length,
  RELATIONSHIP_EVIDENCE_WINDOW_REASON_VALUES.length);
assert.deepEqual(rare.insufficientRecallReasons, []);
console.log('relationship evidence shadow reason confidence smoke ok');
