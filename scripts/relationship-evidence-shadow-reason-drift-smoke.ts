import assert from 'node:assert/strict';
import {
  buildRelationshipEvidenceShadowReasonConfidenceReport,
  buildRelationshipEvidenceShadowReasonDriftComparisons,
  RELATIONSHIP_EVIDENCE_WINDOW_REASON_VALUES,
  type RelationshipEvidenceShadowReasonConfidenceSource,
  type RelationshipEvidenceShadowReasonReport,
} from '../src/social-trend';

function reasonReport(denominator: number, truePositiveCount: number) {
  return {
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
}

function source(corpusId: string, createdAt: number, denominator: number,
  truePositiveCount: number): RelationshipEvidenceShadowReasonConfidenceSource {
  return {
    corpusId, createdAt,
    reasonConfidenceReport: buildRelationshipEvidenceShadowReasonConfidenceReport(
      reasonReport(denominator, truePositiveCount),
    ),
  };
}

const reports = [source('later', 3, 20, 10), source('first', 1, 20, 10),
  source('middle', 2, 20, 20)];
const before = JSON.stringify(reports);
const comparisons = buildRelationshipEvidenceShadowReasonDriftComparisons(reports);
assert.equal(JSON.stringify(reports), before, 'reason drift must not mutate reports');
assert.deepEqual(comparisons.map((item) => item.currentCorpusId), ['middle', 'later']);
assert.equal(comparisons[0]?.metrics.every((item) => (
  item.precision.movement === 'higher-non-overlapping'
    && item.recall.movement === 'higher-non-overlapping'
)), true);
assert.equal(comparisons[1]?.metrics.every((item) => (
  item.precision.movement === 'lower-non-overlapping'
    && item.recall.movement === 'lower-non-overlapping'
)), true);
assert.equal(comparisons[0]?.claimLevel, 'descriptive-reason-drift-only');

const overlap = buildRelationshipEvidenceShadowReasonDriftComparisons([
  source('same-a', 1, 20, 10), source('same-b', 2, 20, 10),
]);
assert.equal(overlap[0]?.metrics.every((item) => (
  item.precision.movement === 'overlapping-intervals'
)), true);
const insufficient = buildRelationshipEvidenceShadowReasonDriftComparisons([
  source('ready', 1, 20, 20), source('rare', 2, 19, 19),
]);
assert.equal(insufficient[0]?.metrics.every((item) => (
  item.precision.movement === 'insufficient-denominator'
    && item.recall.movement === 'insufficient-denominator'
)), true);
console.log('relationship evidence shadow reason drift smoke ok');
