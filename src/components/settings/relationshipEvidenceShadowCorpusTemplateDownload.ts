import { serializeRelationshipEvidenceShadowCorpusTemplate } from '../../social-trend';

export const RELATIONSHIP_EVIDENCE_SHADOW_TEMPLATE_FILE_NAME =
  'relationship-evidence-shadow-corpus-template-v2.json';

export function downloadRelationshipEvidenceShadowCorpusTemplate() {
  const blob = new Blob([serializeRelationshipEvidenceShadowCorpusTemplate()], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.download = RELATIONSHIP_EVIDENCE_SHADOW_TEMPLATE_FILE_NAME;
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
