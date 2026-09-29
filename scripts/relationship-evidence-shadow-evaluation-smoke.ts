import assert from 'node:assert/strict';
import {
  createRelationshipEvidenceShadowCorpusTemplate,
  evaluateRelationshipEvidenceShadowCorpus,
  importRelationshipEvidenceShadowCorpus,
} from '../src/social-trend';

function samples() {
  const source = { ...createRelationshipEvidenceShadowCorpusTemplate(1), redactionConfirmed: true };
  const imported = importRelationshipEvidenceShadowCorpus(source);
  assert.ok(imported.corpus);
  return imported.corpus.samples;
}

const original = samples();
const before = JSON.stringify(original);
const report = evaluateRelationshipEvidenceShadowCorpus(original);
assert.equal(JSON.stringify(original), before, 'evaluation must not mutate imported samples');
assert.equal(report.sampleCount, 3);
assert.equal(report.matchedCount, 3);
assert.equal(report.mismatches.length, 0);
assert.equal(report.sustainedRecall, 1);
assert.equal(report.sustainedFalsePositiveRate, 0);
assert.equal(report.volatileMissRate, 0);
assert.equal(report.insufficientMisclassificationRate, 0);
assert.equal(report.calibrationStatus, 'insufficient-samples');
assert.deepEqual(report.calibrationIssues, ['insufficient-samples']);
assert.equal(report.claimLevel, 'offline-calibration-only');
assert.deepEqual(report.classCounts, {
  'insufficient-evidence': 1, 'sustained-shadow': 1, 'volatile-shadow': 1,
});
assert.equal(report.confusionMatrix['sustained-shadow']['sustained-shadow'], 1);
assert.equal(report.confusionMatrix['volatile-shadow']['volatile-shadow'], 1);
assert.equal(report.confusionMatrix['insufficient-evidence']['insufficient-evidence'], 1);

const falsePositive = original.map((sample, index) => index === 0
  ? { ...sample, expectedReadiness: 'insufficient-evidence' as const } : sample);
const falsePositiveReport = evaluateRelationshipEvidenceShadowCorpus(falsePositive);
assert.equal(falsePositiveReport.sustainedFalsePositiveRate, 1 / 3);
assert.equal(falsePositiveReport.insufficientMisclassificationRate, 1 / 2);
assert.equal(falsePositiveReport.mismatches[0]?.actualReadiness, 'sustained-shadow');

const missedSustained = original.map((sample, index) => index === 1
  ? { ...sample, expectedReadiness: 'sustained-shadow' as const } : sample);
assert.equal(evaluateRelationshipEvidenceShadowCorpus(missedSustained).sustainedRecall, 1 / 2);
console.log('relationship evidence shadow evaluation smoke ok');
