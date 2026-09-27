import {
  serializeRelationshipEvidenceShadowManualReviewPacket,
  type RelationshipEvidenceShadowBatchReport,
} from '../../social-trend';

export const RELATIONSHIP_EVIDENCE_MANUAL_REVIEW_PACKET_FILE_NAME =
  'relationship-evidence-shadow-manual-review-packet-v1.json';

export function downloadRelationshipEvidenceShadowManualReviewPacket(
  batchReport: RelationshipEvidenceShadowBatchReport,
) {
  const blob = new Blob([serializeRelationshipEvidenceShadowManualReviewPacket(batchReport)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.download = RELATIONSHIP_EVIDENCE_MANUAL_REVIEW_PACKET_FILE_NAME;
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
