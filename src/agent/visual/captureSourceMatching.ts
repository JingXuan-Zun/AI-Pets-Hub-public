

export function normalizeVisualSnapshotSourceTypeInput(value: string) {
  return value === 'screen' || value === 'window' ? value : 'all';
}

function normalizeVisualSnapshotMatchText(value: unknown) {
  return typeof value === 'string'
    ? value.normalize('NFKC').trim().toLowerCase()
    : '';
}

export function normalizeVisualSnapshotCompactMatchText(value: unknown) {
  return normalizeVisualSnapshotMatchText(value)
    .replace(/[\s"'`“”‘’_\-:：;；,，.。|/\\()[\]{}<>《》]+/gu, '');
}

export function createVisualSnapshotQueryTokens(query: string) {
  const normalizedQuery = normalizeVisualSnapshotMatchText(query);
  if (!normalizedQuery) {
    return [];
  }

  const compactQuery = normalizeVisualSnapshotCompactMatchText(query);
  const splitTokens = normalizedQuery
    .split(/[\s"'`“”‘’_\-:：;；,，.。|/\\()[\]{}<>《》]+/u)
    .filter(Boolean);
  const fragmentTokens = normalizedQuery.match(/[a-z0-9]+|[\u3400-\u9fff]+/giu) ?? [];
  const stopTokens = new Set([
    'a',
    'an',
    'at',
    'current',
    'currently',
    'image',
    'in',
    'look',
    'open',
    'opened',
    'picture',
    'screen',
    'see',
    'the',
    'window',
  ]);

  return [...new Set([
    compactQuery,
    ...splitTokens,
    ...fragmentTokens,
  ].map((token) => normalizeVisualSnapshotCompactMatchText(token))
    .filter((token) => token.length >= 2 && !stopTokens.has(token)))];
}

export function scoreVisualSnapshotSourceMatch(source: DesktopPetCaptureSourceLike, query: string) {
  const normalizedQuery = normalizeVisualSnapshotMatchText(query);
  const compactQuery = normalizeVisualSnapshotCompactMatchText(query);
  const sourceTexts = [
    source.id,
    source.name,
    source.type,
    source.displayId,
  ];
  const normalizedSourceTexts = sourceTexts.map(normalizeVisualSnapshotMatchText).filter(Boolean);
  const compactSourceTexts = sourceTexts.map(normalizeVisualSnapshotCompactMatchText).filter(Boolean);

  if (!normalizedQuery && !compactQuery) {
    return 0;
  }

  if (
    normalizedSourceTexts.some((text) => text.includes(normalizedQuery))
    || compactSourceTexts.some((text) => text.includes(compactQuery))
  ) {
    return 100 + Math.min(compactQuery.length, 50);
  }

  const tokens = createVisualSnapshotQueryTokens(query);
  return tokens.reduce((score, token) => {
    const tokenMatched = compactSourceTexts.some((text) => text.includes(token));
    return tokenMatched ? score + Math.min(30, Math.max(8, token.length * 4)) : score;
  }, 0);
}

export function findBestVisualSnapshotSourceMatch(
  sources: DesktopPetCaptureSourceLike[],
  query: string,
) {
  let bestSource: DesktopPetCaptureSourceLike | null = null;
  let bestScore = 0;

  for (const source of sources) {
    const score = scoreVisualSnapshotSourceMatch(source, query);
    if (score > bestScore) {
      bestScore = score;
      bestSource = source;
    }
  }

  return bestScore >= 8 ? bestSource : null;
}

export function findVisualSnapshotScreenFallbackSource(sources: DesktopPetCaptureSourceLike[]) {
  return sources.find((source) => source.type === 'screen' && Boolean(source.thumbnail))
    ?? sources.find((source) => source.type === 'screen')
    ?? null;
}

export function createVisualSnapshotSourceSelectionDiagnostics(
  sources: DesktopPetCaptureSourceLike[],
  options: {
    allowScreenFallback?: boolean;
    query: string;
    rawSourceId?: unknown;
    selectedSource?: DesktopPetCaptureSourceLike | null;
    sourceId: string;
    sourceType: 'all' | 'screen' | 'window';
  },
) {
  const windowIdPrefix = options.sourceId ? getVisualSnapshotWindowIdPrefix(options.sourceId) : '';
  const exactMatchedSource = options.sourceId
    ? sources.find((source) => source.id === options.sourceId) ?? null
    : null;
  const prefixMatchedSource = windowIdPrefix
    ? sources.find((source) => source.type === 'window' && source.id.startsWith(windowIdPrefix)) ?? null
    : null;
  const queryMatchedSource = options.query ? findBestVisualSnapshotSourceMatch(sources, options.query) : null;
  const rawSourceIdText = options.rawSourceId === undefined
    ? '<absent>'
    : typeof options.rawSourceId === 'string'
      ? options.rawSourceId.trim() || '<empty-string>'
      : `<${typeof options.rawSourceId}>`;

  return [
    `Visual source selection: requestedType=${options.sourceType}`,
    `Visual source selection: requestedSourceId=${options.sourceId || '<none>'}`,
    `Visual source selection: rawSourceId=${rawSourceIdText}`,
    options.sourceId ? `Visual source selection: sourceIdExactMatch=${exactMatchedSource ? exactMatchedSource.id : '<none>'}` : '',
    windowIdPrefix ? `Visual source selection: sourceIdPrefix=${windowIdPrefix}` : '',
    windowIdPrefix ? `Visual source selection: sourceIdPrefixMatch=${prefixMatchedSource ? prefixMatchedSource.id : '<none>'}` : '',
    options.query ? `Visual source selection: query=${options.query}` : '',
    options.query ? `Visual source selection: queryBestMatch=${queryMatchedSource ? `${queryMatchedSource.id} (${queryMatchedSource.name})` : '<none>'}` : '',
    `Visual source selection: allowScreenFallback=${options.allowScreenFallback === true}`,
    options.selectedSource ? `Visual source selection: selected=${options.selectedSource.id} (${options.selectedSource.type})` : '',
  ].filter(Boolean);
}

export function getVisualSnapshotWindowIdPrefix(sourceId: string) {
  const match = sourceId.match(/^(window:\d+:)/iu);
  return match?.[1] ?? '';
}
