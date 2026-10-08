

export function normalizeAgentRuntimeVisualLookupText(value: string) {
  return value.replace(/\s+/gu, '').trim().toLowerCase();
}

export function formatCaptureSourceLine(source: DesktopPetCaptureSourceLike, index: number) {
  const idText = source.id ? ` id="${source.id}"` : '';
  const displayText = source.displayId ? ` display=${source.displayId}` : '';
  const sizeText = source.width && source.height ? ` ${source.width}x${source.height}` : '';
  const thumbnailText = source.thumbnail ? ' thumbnail=yes' : ' thumbnail=no';
  const appIconText = source.appIcon ? ' appIcon=yes' : '';

  return `${index + 1}. [${source.type}] ${source.name}${idText}${sizeText}${displayText}${thumbnailText}${appIconText}`;
}

export function formatCaptureSourceCandidateLines(sources: DesktopPetCaptureSourceLike[], limit = 12) {
  if (!sources.length) {
    return ['Available capture source candidates: none'];
  }

  const candidateLines = sources.slice(0, limit).map((source, index) => (
    `Available capture source candidate ${formatCaptureSourceLine(source, index)}`
  ));
  if (sources.length > limit) {
    candidateLines.push(`Available capture source candidates omitted: ${sources.length - limit}`);
  }

  return candidateLines;
}

export function normalizeCaptureSourceTypesInput(value: string): Array<'screen' | 'window'> {
  if (value === 'screen') {
    return ['screen'];
  }

  if (value === 'window') {
    return ['window'];
  }

  return ['screen', 'window'];
}
