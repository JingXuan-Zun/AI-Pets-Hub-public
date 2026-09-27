import {
  createRelationshipEvidenceShadowReviewRevision,
  type RelationshipEvidenceShadowValidatedManualReviewDecision,
} from './relationshipEvidenceShadowManualReviewDecision';

export function createRelationshipEvidenceShadowManualReviewReceipt(
  decision: RelationshipEvidenceShadowValidatedManualReviewDecision,
  issuedAt = Date.now(),
) {
  const receiptRevision = createRelationshipEvidenceShadowReviewRevision('receipt-v1', {
    acknowledgements: decision.acknowledgements,
    decision: decision.decision,
    evidenceRevision: decision.evidenceReference.evidenceRevision,
    rationaleLength: decision.rationale.length,
    reviewedAt: decision.reviewedAt,
  });
  return {
    acknowledgements: decision.acknowledgements,
    claimLevel: 'validated-manual-review-receipt-only',
    decision: decision.decision,
    evidenceReference: decision.evidenceReference,
    issuedAt,
    kind: 'relationship-evidence-shadow-manual-review-receipt',
    rationaleSummary: {
      included: false,
      length: decision.rationale.length,
      present: true,
    },
    receiptRevision,
    reviewedAt: decision.reviewedAt,
    schemaVersion: 1,
    validationBoundary: {
      executable: false,
      persisted: false,
      productionThresholdsChanged: false,
    },
  } as const;
}

export function serializeRelationshipEvidenceShadowManualReviewReceipt(
  decision: RelationshipEvidenceShadowValidatedManualReviewDecision,
  issuedAt = Date.now(),
) {
  return `${JSON.stringify(
    createRelationshipEvidenceShadowManualReviewReceipt(decision, issuedAt), null, 2,
  )}\n`;
}
