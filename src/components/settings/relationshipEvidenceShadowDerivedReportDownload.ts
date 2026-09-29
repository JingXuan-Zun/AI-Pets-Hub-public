import {
  serializeRelationshipEvidenceShadowDerivedReport,
  type RelationshipEvidenceShadowBatchReport,
} from '../../social-trend';

export const RELATIONSHIP_EVIDENCE_DERIVED_REPORT_FILE_NAME =
  'relationship-evidence-shadow-derived-report-v1.json';

export function downloadRelationshipEvidenceShadowDerivedReport(
  batchReport: RelationshipEvidenceShadowBatchReport,
) {
  const blob = new Blob([serializeRelationshipEvidenceShadowDerivedReport(batchReport)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.download = RELATIONSHIP_EVIDENCE_DERIVED_REPORT_FILE_NAME;
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
