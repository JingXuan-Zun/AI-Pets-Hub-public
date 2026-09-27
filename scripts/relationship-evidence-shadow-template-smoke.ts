import assert from 'node:assert/strict';
import {
  createRelationshipEvidenceShadowCorpusTemplate,
  serializeRelationshipEvidenceShadowCorpusTemplate,
} from '../src/social-trend';

const template = createRelationshipEvidenceShadowCorpusTemplate(123);
assert.equal(template.schemaVersion, 2);
assert.equal(template.createdAt, 123);
assert.equal(template.redactionConfirmed, false,
  'downloaded template must require an explicit redaction confirmation');
assert.deepEqual(template.samples.map((sample) => sample.expectedReadiness), [
  'sustained-shadow', 'volatile-shadow', 'insufficient-evidence',
]);
assert.deepEqual(template.samples.map((sample) => sample.expectedReasons), [
  ['sustained-pattern'], ['contradictory-signals'],
  ['insufficient-signals', 'insufficient-distinct-messages'],
]);
const serialized = serializeRelationshipEvidenceShadowCorpusTemplate(123);
assert.equal(serialized.endsWith('\n'), true);
assert.doesNotMatch(serialized, /chatHistory|content|evidenceExcerpt|prompt|rawMessage/iu);
console.log('relationship evidence shadow template smoke ok');
