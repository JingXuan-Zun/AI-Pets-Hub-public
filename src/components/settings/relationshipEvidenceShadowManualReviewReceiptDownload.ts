import {
  serializeRelationshipEvidenceShadowManualReviewReceipt,
  type RelationshipEvidenceShadowValidatedManualReviewDecision,
} from '../../social-trend';

export const RELATIONSHIP_EVIDENCE_MANUAL_REVIEW_RECEIPT_FILE_NAME =
  'relationship-evidence-shadow-manual-review-receipt-v1.json';

export function downloadRelationshipEvidenceShadowManualReviewReceipt(
  decision: RelationshipEvidenceShadowValidatedManualReviewDecision,
) {
  const blob = new Blob([serializeRelationshipEvidenceShadowManualReviewReceipt(decision)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.download = RELATIONSHIP_EVIDENCE_MANUAL_REVIEW_RECEIPT_FILE_NAME;
  anchor.href = url;
  anchor.hidden = true;
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    URL.revokeObjectURL(url);
  }
}
