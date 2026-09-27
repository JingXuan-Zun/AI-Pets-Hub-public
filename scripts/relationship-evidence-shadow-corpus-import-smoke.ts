import assert from 'node:assert/strict';
import {
  createRelationshipEvidenceShadowCorpusTemplate,
  importRelationshipEvidenceShadowCorpus,
  MAX_RELATIONSHIP_EVIDENCE_SHADOW_CORPUS_FILE_BYTES,
  parseRelationshipEvidenceShadowCorpusJson,
} from '../src/social-trend';

function validCorpus() {
  return { ...createRelationshipEvidenceShadowCorpusTemplate(1), redactionConfirmed: true };
}

const imported = importRelationshipEvidenceShadowCorpus(validCorpus());
assert.deepEqual(imported.issues, []);
assert.equal(imported.corpus?.samples.length, 3);
assert.equal(imported.corpus?.schemaVersion, 2);
assert.equal(imported.corpus?.samples[0]?.repository.records.length, 0);
assert.equal(imported.corpus?.samples[0]?.repository.candidates[0]?.evidenceExcerpt,
  'redacted structural signal');

const notRedacted = importRelationshipEvidenceShadowCorpus(
  createRelationshipEvidenceShadowCorpusTemplate(1),
);
assert.equal(notRedacted.corpus, null);
assert.equal(notRedacted.issues.some((issue) => issue.code === 'redaction-not-confirmed'), true);

const unexpected = structuredClone(validCorpus()) as Record<string, unknown>;
unexpected.prompt = 'hidden project prompt';
const unexpectedResult = importRelationshipEvidenceShadowCorpus(unexpected);
assert.equal(unexpectedResult.corpus, null);
assert.equal(unexpectedResult.issues.some((issue) => issue.code === 'forbidden-field'), true);
assert.equal(unexpectedResult.issues.some((issue) => issue.code === 'unexpected-field'), true);

const sensitive = structuredClone(validCorpus());
sensitive.corpusId = 'person@example.com';
assert.equal(importRelationshipEvidenceShadowCorpus(sensitive).issues
  .some((issue) => issue.code === 'sensitive-content'), true);

const duplicate = structuredClone(validCorpus());
duplicate.samples[0]!.candidates.push({ ...duplicate.samples[0]!.candidates[0]! });
assert.equal(importRelationshipEvidenceShadowCorpus(duplicate).issues
  .some((issue) => issue.code === 'duplicate-candidate-id'), true);

const mixed = structuredClone(validCorpus());
mixed.samples[0]!.candidates[0]!.targetRoleId = 'role-c';
assert.equal(importRelationshipEvidenceShadowCorpus(mixed).issues
  .some((issue) => issue.code === 'invalid-sample'), true);

const legacy = structuredClone(validCorpus());
legacy.schemaVersion = 1;
legacy.samples.forEach((sample) => { delete (sample as { expectedReasons?: unknown }).expectedReasons; });
const legacyImported = importRelationshipEvidenceShadowCorpus(legacy);
assert.equal(legacyImported.corpus?.schemaVersion, 1);
assert.equal(legacyImported.corpus?.samples.every((sample) => !sample.expectedReasons), true);
const missingReasons = structuredClone(validCorpus());
delete (missingReasons.samples[0] as { expectedReasons?: unknown }).expectedReasons;
assert.equal(importRelationshipEvidenceShadowCorpus(missingReasons).issues
  .some((issue) => issue.code === 'invalid-sample'), true);
const duplicateReason = structuredClone(validCorpus());
duplicateReason.samples[0]!.expectedReasons.push('sustained-pattern');
assert.equal(importRelationshipEvidenceShadowCorpus(duplicateReason).issues
  .some((issue) => issue.code === 'invalid-sample'), true);

assert.equal(parseRelationshipEvidenceShadowCorpusJson('{').issues[0]?.code, 'invalid-json');
assert.equal(parseRelationshipEvidenceShadowCorpusJson(
  ' '.repeat(MAX_RELATIONSHIP_EVIDENCE_SHADOW_CORPUS_FILE_BYTES + 1),
).issues[0]?.code, 'corpus-too-large');
console.log('relationship evidence shadow corpus import smoke ok');
