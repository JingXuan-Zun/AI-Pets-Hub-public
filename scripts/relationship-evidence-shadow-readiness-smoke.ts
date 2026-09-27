import assert from 'node:assert/strict';
import {
  createRelationshipEvidenceShadowCorpusTemplate,
  compareRelationshipEvidenceShadowCalibrationProfiles,
  evaluateRelationshipEvidenceShadowCorpus,
  importRelationshipEvidenceShadowCorpus,
  type RelationshipEvidenceShadowSample,
} from '../src/social-trend';

const imported = importRelationshipEvidenceShadowCorpus({
  ...createRelationshipEvidenceShadowCorpusTemplate(1), redactionConfirmed: true,
});
assert.ok(imported.corpus);
const base = imported.corpus.samples;

function corpus(mapper?: (
  sample: RelationshipEvidenceShadowSample,
  index: number,
) => RelationshipEvidenceShadowSample, length = 30) {
  return Array.from({ length }, (_, index) => {
    const original = base[index % base.length]!;
    const sample = { ...original, id: `${original.id}-${index}` };
    return mapper?.(sample, index) ?? sample;
  });
}

const ready = evaluateRelationshipEvidenceShadowCorpus(corpus());
assert.equal(ready.calibrationStatus, 'calibration-ready');
assert.deepEqual(ready.calibrationIssues, []);
assert.deepEqual(ready.classCounts, {
  'insufficient-evidence': 10, 'sustained-shadow': 10, 'volatile-shadow': 10,
});
const baseProfiles = compareRelationshipEvidenceShadowCalibrationProfiles(ready);
assert.deepEqual(baseProfiles.map((profile) => profile.profileId), [
  'calibration-v1', 'calibration-strict-v1',
]);
assert.equal(baseProfiles[0]?.status, 'calibration-ready');
assert.equal(baseProfiles[1]?.status, 'insufficient-samples');
const strictReady = evaluateRelationshipEvidenceShadowCorpus(corpus(undefined, 90));
assert.equal(compareRelationshipEvidenceShadowCalibrationProfiles(strictReady)[1]?.status,
  'calibration-ready');

const oneClass = corpus((sample) => ({ ...sample, expectedReadiness: 'sustained-shadow' }));
assert.equal(evaluateRelationshipEvidenceShadowCorpus(oneClass).calibrationStatus,
  'insufficient-class-coverage');

const falsePositive = corpus((sample, index) => index === 0
  ? { ...sample, expectedReadiness: 'insufficient-evidence' } : sample);
assert.equal(evaluateRelationshipEvidenceShadowCorpus(falsePositive).calibrationStatus,
  'unsafe-sustained-false-positive');

const lowRecall = corpus((sample, index) => index === 1 || index === 4
  ? { ...sample, expectedReadiness: 'sustained-shadow' } : sample);
assert.equal(evaluateRelationshipEvidenceShadowCorpus(lowRecall).calibrationStatus,
  'below-sustained-recall');

const volatileMiss = corpus((sample, index) => index === 2 || index === 5
  ? { ...sample, expectedReadiness: 'volatile-shadow' } : sample);
assert.equal(evaluateRelationshipEvidenceShadowCorpus(volatileMiss).calibrationStatus,
  'above-volatile-miss-rate');

const insufficientMiss = corpus((sample, index) => index === 1 || index === 4
  ? { ...sample, expectedReadiness: 'insufficient-evidence' } : sample);
assert.equal(evaluateRelationshipEvidenceShadowCorpus(insufficientMiss).calibrationStatus,
  'above-insufficient-misclassification');
console.log('relationship evidence shadow readiness smoke ok');
