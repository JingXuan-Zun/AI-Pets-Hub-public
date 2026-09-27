import assert from 'node:assert/strict';
import {
  createRelationshipEvidenceShadowCorpusTemplate,
  evaluateRelationshipEvidenceShadowCorpus,
  evaluateRelationshipEvidenceShadowReasons,
  importRelationshipEvidenceShadowCorpus,
  RELATIONSHIP_EVIDENCE_WINDOW_REASON_VALUES,
  type RelationshipEvidenceShadowObservation,
} from '../src/social-trend';

const imported = importRelationshipEvidenceShadowCorpus({
  ...createRelationshipEvidenceShadowCorpusTemplate(1), redactionConfirmed: true,
});
assert.ok(imported.corpus);
const report = evaluateRelationshipEvidenceShadowCorpus(imported.corpus.samples).reasonReport;
assert.equal(report.labeledSampleCount, 3);
assert.equal(report.unlabeledLegacySampleCount, 0);
assert.equal(report.exactMatchCount, 3);
assert.equal(report.reasonCoverageRate, 0.5);
assert.deepEqual(report.missingExpectedReasons, [
  'high-rejection-rate', 'high-rollback-rate', 'short-duration', 'unresolved-target',
]);
assert.deepEqual(report.mismatches, []);

const complete: RelationshipEvidenceShadowObservation[] =
  RELATIONSHIP_EVIDENCE_WINDOW_REASON_VALUES.map((reason, index) => ({
    actualReadiness: reason === 'sustained-pattern' ? 'sustained-shadow' : 'volatile-shadow',
    actualReasons: [reason],
    expectedReadiness: reason === 'sustained-pattern' ? 'sustained-shadow' : 'volatile-shadow',
    expectedReasons: [reason], sampleId: `reason-${index}`,
  }));
const completeReport = evaluateRelationshipEvidenceShadowReasons(complete);
assert.equal(completeReport.reasonCoverageRate, 1);
assert.equal(completeReport.exactMatchCount, RELATIONSHIP_EVIDENCE_WINDOW_REASON_VALUES.length);
assert.equal(completeReport.metrics.every((item) => item.precision === 1 && item.recall === 1), true);

const mismatch = structuredClone(complete);
mismatch[0]!.actualReasons = ['short-duration'];
const mismatchReport = evaluateRelationshipEvidenceShadowReasons(mismatch);
assert.equal(mismatchReport.exactMatchCount, complete.length - 1);
assert.equal(mismatchReport.mismatches[0]?.sampleId, 'reason-0');
assert.equal(mismatchReport.metrics[0]?.recall, 0);
const legacy = complete.map(({ expectedReasons: _expectedReasons, ...item }) => item);
assert.equal(evaluateRelationshipEvidenceShadowReasons(legacy).unlabeledLegacySampleCount,
  complete.length);
console.log('relationship evidence shadow reason evaluation smoke ok');
