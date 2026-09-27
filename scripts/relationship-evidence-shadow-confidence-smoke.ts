import assert from 'node:assert/strict';
import {
  buildRelationshipEvidenceShadowConfidenceReport,
  MIN_RELATIONSHIP_EVIDENCE_SHADOW_METRIC_DENOMINATOR,
  type RelationshipEvidenceShadowMetrics,
} from '../src/social-trend';

function metrics(perClass: number): RelationshipEvidenceShadowMetrics {
  return {
    classCounts: {
      'insufficient-evidence': perClass,
      'sustained-shadow': perClass,
      'volatile-shadow': perClass,
    },
    confusionMatrix: {
      'insufficient-evidence': {
        'insufficient-evidence': perClass, 'sustained-shadow': 0, 'volatile-shadow': 0,
      },
      'sustained-shadow': {
        'insufficient-evidence': 0, 'sustained-shadow': perClass, 'volatile-shadow': 0,
      },
      'volatile-shadow': {
        'insufficient-evidence': 0, 'sustained-shadow': 0, 'volatile-shadow': perClass,
      },
    },
    insufficientMisclassificationRate: 0, matchedCount: perClass * 3,
    sampleCount: perClass * 3, sustainedFalsePositiveRate: 0,
    sustainedRecall: 1, volatileMissRate: 0,
  };
}

const report = buildRelationshipEvidenceShadowConfidenceReport(metrics(20));
assert.equal(report.claimLevel, 'descriptive-confidence-only');
assert.equal(report.minimumDenominator, MIN_RELATIONSHIP_EVIDENCE_SHADOW_METRIC_DENOMINATOR);
assert.deepEqual(report.insufficientDenominatorMetrics, []);
const recall = report.intervals.find((item) => item.metric === 'sustained-recall')!;
assert.equal(recall.numerator, 20);
assert.equal(recall.denominator, 20);
assert.equal(Math.abs(recall.lowerBound - 0.838874841) < 0.000001, true);
assert.equal(recall.upperBound, 1);
const falsePositive = report.intervals.find(
  (item) => item.metric === 'sustained-false-positive',
)!;
assert.equal(falsePositive.denominator, 40);
assert.equal(falsePositive.observedRate, 0);
assert.equal(falsePositive.upperBound > 0 && falsePositive.upperBound < 0.1, true);

const small = buildRelationshipEvidenceShadowConfidenceReport(metrics(5));
assert.equal(small.insufficientDenominatorMetrics.length, 4);
assert.equal(small.intervals.every((item) => !item.denominatorSufficient), true);
const empty = buildRelationshipEvidenceShadowConfidenceReport(metrics(0));
assert.equal(empty.intervals.every((item) => item.lowerBound === 0 && item.upperBound === 1), true);
console.log('relationship evidence shadow confidence smoke ok');
