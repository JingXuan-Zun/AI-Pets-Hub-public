import assert from 'node:assert/strict';
import {
  buildRelationshipEvidenceShadowDriftComparisons,
  buildRelationshipEvidenceShadowConfidenceReport,
  buildRelationshipEvidenceShadowReasonConfidenceReport,
  createRelationshipEvidenceShadowCorpusTemplate,
  evaluateRelationshipEvidenceShadowCorpus,
  importRelationshipEvidenceShadowCorpus,
  type RelationshipEvidenceShadowCorpusReport,
} from '../src/social-trend';

const imported = importRelationshipEvidenceShadowCorpus({
  ...createRelationshipEvidenceShadowCorpusTemplate(1), redactionConfirmed: true,
});
assert.ok(imported.corpus);
const expandedSamples = Array.from({ length: 60 }, (_, index) => {
  const sample = imported.corpus!.samples[index % imported.corpus!.samples.length]!;
  return { ...sample, id: `${sample.id}-${index}` };
});
const base = evaluateRelationshipEvidenceShadowCorpus(expandedSamples);

function corpusReport(corpusId: string, createdAt: number,
  rates: Partial<typeof base> = {}): RelationshipEvidenceShadowCorpusReport {
  const report = { ...base, ...rates };
  return {
    confidenceReport: buildRelationshipEvidenceShadowConfidenceReport(report),
    corpusId, createdAt, report,
    reasonConfidenceReport: buildRelationshipEvidenceShadowReasonConfidenceReport(
      report.reasonReport,
    ),
  };
}

const ordered = [
  corpusReport('later', 3, { sustainedFalsePositiveRate: 0.2 }),
  corpusReport('first', 1),
  corpusReport('middle', 2, { sustainedFalsePositiveRate: 0.1 }),
];
const before = JSON.stringify(ordered);
const increasing = buildRelationshipEvidenceShadowDriftComparisons(ordered);
assert.equal(JSON.stringify(ordered), before, 'drift projection must not mutate reports');
assert.deepEqual(increasing.map((item) => item.currentCorpusId), ['middle', 'later']);
assert.equal(increasing.every((item) => item.movement === 'increased-risk'), true);
assert.equal(increasing[0]?.claimLevel, 'descriptive-drift-only');

const decreased = buildRelationshipEvidenceShadowDriftComparisons([
  corpusReport('risk', 1, { volatileMissRate: 0.2 }), corpusReport('better', 2),
]);
assert.equal(decreased[0]?.movement, 'decreased-risk');
const mixed = buildRelationshipEvidenceShadowDriftComparisons([
  corpusReport('old', 1, { sustainedFalsePositiveRate: 0.2, sustainedRecall: 1 }),
  corpusReport('new', 2, { sustainedFalsePositiveRate: 0.1, sustainedRecall: 0.5 }),
]);
assert.equal(mixed[0]?.movement, 'mixed');
const incomplete = corpusReport('incomplete', 2);
incomplete.report.classCounts = {
  'insufficient-evidence': 1, 'sustained-shadow': 0, 'volatile-shadow': 1,
};
assert.equal(buildRelationshipEvidenceShadowDriftComparisons([
  corpusReport('complete', 1), incomplete,
])[0]?.movement, 'insufficient-class-coverage');
console.log('relationship evidence shadow drift smoke ok');
