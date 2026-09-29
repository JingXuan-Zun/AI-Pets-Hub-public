import {
  serializeRelationshipEvidenceShadowManualReviewDecisionTemplate,
  type RelationshipEvidenceShadowBatchReport,
} from '../../social-trend';

export const RELATIONSHIP_EVIDENCE_MANUAL_REVIEW_DECISION_FILE_NAME =
  'relationship-evidence-shadow-manual-review-decision-v1.json';

export function downloadRelationshipEvidenceShadowManualReviewDecisionTemplate(
  batchReport: RelationshipEvidenceShadowBatchReport,
) {
  const blob = new Blob([
    serializeRelationshipEvidenceShadowManualReviewDecisionTemplate(batchReport),
  ], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.download = RELATIONSHIP_EVIDENCE_MANUAL_REVIEW_DECISION_FILE_NAME;
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
