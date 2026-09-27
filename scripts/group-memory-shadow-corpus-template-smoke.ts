import assert from 'node:assert/strict';
import {
  createGroupMemoryShadowCorpusTemplate,
  evaluateGroupMemoryCandidateShadowCorpus,
  importGroupMemoryShadowCorpus,
  parseGroupMemoryShadowCorpusJson,
  serializeGroupMemoryShadowCorpusTemplate,
} from '../src/group-memory';

const template = createGroupMemoryShadowCorpusTemplate(1_000);
assert.equal(template.schemaVersion, 1);
assert.equal(template.redactionConfirmed, false);
assert.equal(template.samples.length, 3);
assert.deepEqual(
  template.samples.map((sample) => sample.expectedDecision),
  ['eligible', 'manual-review', 'blocked'],
);
assert.equal(new Set(template.samples.map((sample) => sample.id)).size, 3);
assert.equal(new Set(template.samples.map((sample) => sample.candidate.id)).size, 3);

assert.deepEqual(importGroupMemoryShadowCorpus(template, 2_000).issues, [
  { code: 'redaction-not-confirmed', path: '$.redactionConfirmed' },
]);
const imported = importGroupMemoryShadowCorpus({
  ...template, redactionConfirmed: true,
}, 2_000);
assert.deepEqual(imported.issues, []);
assert.ok(imported.corpus);
const report = evaluateGroupMemoryCandidateShadowCorpus(imported.corpus!.samples, 2_000);
assert.equal(report.matchedCount, 3);
assert.equal(report.mismatches.length, 0);
assert.equal(report.readiness, 'insufficient-samples');

const serialized = serializeGroupMemoryShadowCorpusTemplate(1_000);
assert.ok(serialized.endsWith('\n'));
assert.ok(parseGroupMemoryShadowCorpusJson(serialized).issues.some(
  (issue) => issue.code === 'redaction-not-confirmed',
));
assert.doesNotMatch(serialized, /chatHistory|attachments|repository|C:\\|\/Users\//iu);

console.log('group memory shadow corpus template smoke ok');
