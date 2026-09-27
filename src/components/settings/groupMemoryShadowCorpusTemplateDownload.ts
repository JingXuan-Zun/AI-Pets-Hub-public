import { serializeGroupMemoryShadowCorpusTemplate } from '../../group-memory';

export const GROUP_MEMORY_SHADOW_TEMPLATE_FILE_NAME = 'group-memory-shadow-corpus-template-v1.json';

export function downloadGroupMemoryShadowCorpusTemplate() {
  const blob = new Blob([serializeGroupMemoryShadowCorpusTemplate()], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.download = GROUP_MEMORY_SHADOW_TEMPLATE_FILE_NAME;
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
