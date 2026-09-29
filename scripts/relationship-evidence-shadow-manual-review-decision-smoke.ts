import assert from 'node:assert/strict';
import {
  createRelationshipEvidenceShadowCorpusTemplate,
  createRelationshipEvidenceShadowManualReviewDecisionTemplate,
  createRelationshipEvidenceShadowManualReviewEvidenceReference,
  evaluateRelationshipEvidenceShadowCorpusBatch,
  importRelationshipEvidenceShadowCorpus,
  parseRelationshipEvidenceShadowManualReviewDecisionJson,
  validateRelationshipEvidenceShadowManualReviewDecision,
} from '../src/social-trend';

const imported = importRelationshipEvidenceShadowCorpus({
  ...createRelationshipEvidenceShadowCorpusTemplate(1), redactionConfirmed: true,
});
assert.ok(imported.corpus);
const batch = evaluateRelationshipEvidenceShadowCorpusBatch([imported.corpus]);
const reference = createRelationshipEvidenceShadowManualReviewEvidenceReference(batch);
assert.match(reference.evidenceRevision, /^evidence-v1-[0-9a-f]{16}$/u);
const template = createRelationshipEvidenceShadowManualReviewDecisionTemplate(batch);
assert.equal(template.decision, 'needs-more-evidence');
assert.equal(template.acknowledgements.evidenceReviewed, false);
assert.equal(template.acknowledgements.noAutomaticApplicationAcknowledged, true);

const valid = {
  ...template,
  acknowledgements: {
    evidenceReviewed: true, noAutomaticApplicationAcknowledged: true,
  },
  rationale: '当前语料不足，继续补充八类原因样本。', reviewedAt: 123,
};
const validResult = validateRelationshipEvidenceShadowManualReviewDecision(valid, reference);
assert.equal(validResult.issues.length, 0);
assert.equal(validResult.decision?.decision, 'needs-more-evidence');
assert.equal(validResult.decision?.rationale, valid.rationale);

const stale = structuredClone(valid);
stale.evidenceReference.sampleCount += 1;
assert.equal(validateRelationshipEvidenceShadowManualReviewDecision(stale, reference)
  .issues.some((item) => item.code === 'stale-evidence-reference'), true);
const incomplete = validateRelationshipEvidenceShadowManualReviewDecision(template, reference);
assert.equal(incomplete.issues.some((item) => item.code === 'invalid-rationale'), true);
assert.equal(incomplete.issues.some((item) => item.code === 'invalid-reviewed-at'), true);
assert.equal(incomplete.issues.some((item) => item.code === 'acknowledgements-required'), true);

const accept = { ...valid, decision: 'accept-for-further-manual-work' };
assert.equal(validateRelationshipEvidenceShadowManualReviewDecision(accept, reference)
  .issues.some((item) => item.code === 'accept-not-eligible'), true);
const eligibleReference = { ...reference,
  reviewReadinessStatus: 'eligible-for-manual-review' };
const eligibleAccept = { ...accept, evidenceReference: eligibleReference };
assert.equal(validateRelationshipEvidenceShadowManualReviewDecision(
  eligibleAccept, eligibleReference,
).issues.length, 0);

assert.equal(parseRelationshipEvidenceShadowManualReviewDecisionJson('{', reference)
  .issues[0]?.code, 'invalid-json');
assert.equal(parseRelationshipEvidenceShadowManualReviewDecisionJson(
  '界'.repeat(7_000), reference,
).issues[0]?.code, 'decision-file-too-large');
assert.equal(validateRelationshipEvidenceShadowManualReviewDecision(
  { ...valid, forbidden: true }, reference,
).issues.some((item) => item.code === 'unexpected-field'), true);
assert.doesNotMatch(JSON.stringify(validResult),
  /threshold|apply|persist|repository|candidate|sourceMessageId/iu);
console.log('relationship evidence shadow manual review decision smoke ok');
