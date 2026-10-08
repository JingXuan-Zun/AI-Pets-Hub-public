import { findBestVisualSnapshotSourceMatch, findVisualSnapshotScreenFallbackSource, getVisualSnapshotWindowIdPrefix } from './captureSourceMatching';

export function selectVisualSnapshotSource(
  sources: DesktopPetCaptureSourceLike[],
  options: {
    allowScreenFallback?: boolean;
    query: string;
    sourceId: string;
    sourceType: 'all' | 'screen' | 'window';
  },
) {
  if (options.sourceId) {
    const exactSource = sources.find((source) => source.id === options.sourceId);
    if (exactSource) {
      return exactSource;
    }

    const windowIdPrefix = getVisualSnapshotWindowIdPrefix(options.sourceId);
    const prefixMatchedSource = windowIdPrefix
      ? sources.find((source) => source.type === 'window' && source.id.startsWith(windowIdPrefix))
      : null;
    if (prefixMatchedSource) {
      return prefixMatchedSource;
    }

    if (options.query) {
      const matchedSource = findBestVisualSnapshotSourceMatch(sources, options.query);
      if (matchedSource) {
        return matchedSource;
      }
    }

    if (options.allowScreenFallback) {
      return findVisualSnapshotScreenFallbackSource(sources);
    }

    return null;
  }

  if (options.query) {
    const matchedSource = findBestVisualSnapshotSourceMatch(sources, options.query);
    if (matchedSource) {
      return matchedSource;
    }

    if (options.allowScreenFallback) {
      return findVisualSnapshotScreenFallbackSource(sources);
    }

    return null;
  }

  if (options.sourceType === 'window') {
    return sources.find((source) => source.type === 'window') ?? null;
  }

  if (options.sourceType === 'screen') {
    return sources.find((source) => source.type === 'screen') ?? null;
  }

  return sources.find((source) => source.type === 'screen')
    ?? sources.find((source) => source.type === 'window')
    ?? null;
}

export function selectGameScreenSource(
  sources: DesktopPetCaptureSourceLike[],
  options: {
    query: string;
    sourceId: string;
    sourceType: 'all' | 'screen' | 'window';
  },
) {
  if (options.sourceId) {
    const exactSource = sources.find((source) => source.id === options.sourceId);
    if (exactSource) {
      return exactSource;
    }

    return null;
  }

  if (options.query) {
    const matchedSource = findBestVisualSnapshotSourceMatch(sources, options.query);
    if (matchedSource) {
      return matchedSource;
    }

    return null;
  }

  if (options.sourceType === 'window') {
    return sources.find((source) => source.type === 'window') ?? null;
  }

  if (options.sourceType === 'screen') {
    return sources.find((source) => source.type === 'screen') ?? null;
  }

  return sources.find((source) => source.type === 'window')
    ?? sources.find((source) => source.type === 'screen')
    ?? null;
}
