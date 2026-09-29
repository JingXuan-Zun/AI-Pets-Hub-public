import assert from 'node:assert/strict';
import {
  buildRelationshipEvidenceShadowReasonConfidenceReport,
  buildRelationshipEvidenceShadowReasonDriftComparisons,
  buildRelationshipEvidenceShadowReasonStabilityReport,
  MIN_RELATIONSHIP_EVIDENCE_SHADOW_REASON_STABILITY_BATCHES,
  RELATIONSHIP_EVIDENCE_WINDOW_REASON_VALUES,
  type RelationshipEvidenceShadowReasonConfidenceSource,
  type RelationshipEvidenceShadowReasonReport,
} from '../src/social-trend';

function source(id: string, createdAt: number, denominator: number,
  truePositiveCount: number): RelationshipEvidenceShadowReasonConfidenceSource {
  const reasonReport = {
    exactMatchCount: 0, labeledSampleCount: denominator,
    metrics: RELATIONSHIP_EVIDENCE_WINDOW_REASON_VALUES.map((reason) => ({
      actualCount: denominator, expectedCount: denominator,
      precision: denominator ? truePositiveCount / denominator : 0,
      reason, recall: denominator ? truePositiveCount / denominator : 0,
      truePositiveCount,
    })),
    mismatches: [], missingExpectedReasons: [], reasonCoverageRate: 1,
    unlabeledLegacySampleCount: 0,
  } satisfies RelationshipEvidenceShadowReasonReport;
  return {
    corpusId: id, createdAt,
    reasonConfidenceReport: buildRelationshipEvidenceShadowReasonConfidenceReport(reasonReport),
  };
}

function stability(counts: Array<[number, number]>) {
  const sources = counts.map(([denominator, truePositiveCount], index) => (
    source(`batch-${index}`, index, denominator, truePositiveCount)
  ));
  return buildRelationshipEvidenceShadowReasonStabilityReport(
    buildRelationshipEvidenceShadowReasonDriftComparisons(sources),
  );
}

const stable = stability([[20, 10], [20, 10], [20, 10]]);
assert.equal(stable.claimLevel, 'descriptive-reason-stability-only');
assert.equal(stable.minimumComparableBatches,
  MIN_RELATIONSHIP_EVIDENCE_SHADOW_REASON_STABILITY_BATCHES);
assert.equal(stable.status, 'reason-stability-ready');
assert.equal(stable.metrics.every((item) => (
  item.precision.status === 'no-non-overlapping-movement'
    && item.precision.comparableBatchCount === 3
)), true);

assert.equal(stability([[20, 0], [20, 10], [20, 20]])
  .metrics[0]?.precision.status, 'consistent-higher-movement');
assert.equal(stability([[20, 20], [20, 10], [20, 0]])
  .metrics[0]?.precision.status, 'consistent-lower-movement');
assert.equal(stability([[20, 0], [20, 20], [20, 0]])
  .metrics[0]?.precision.status, 'mixed-direction-movement');
assert.equal(stability([[20, 0], [20, 0], [20, 20]])
  .metrics[0]?.precision.status, 'intermittent-movement');

const tooShort = stability([[20, 10], [20, 10]]);
assert.equal(tooShort.status, 'insufficient-reason-stability');
assert.equal(tooShort.metrics[0]?.precision.comparableBatchCount, 2);
const interrupted = stability([[20, 10], [20, 10], [19, 10]]);
assert.equal(interrupted.metrics[0]?.precision.comparableBatchCount, 0);
assert.equal(interrupted.metrics[0]?.precision.status, 'insufficient-comparable-batches');
console.log('relationship evidence shadow reason stability smoke ok');
