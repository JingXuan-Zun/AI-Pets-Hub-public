function readCaptureSourceQuery(dependencies, types, options) {
  const { normalizeCaptureSourceTypes, CAPTURE_SOURCE_ANALYSIS_THUMBNAIL_SIZE,
    CAPTURE_SOURCE_THUMBNAIL_SIZE, CAPTURE_SOURCE_EMPTY_THUMBNAIL_SIZE,
    CAPTURE_SOURCE_WINDOW_LIST_PLACEHOLDER_SIZE, CAPTURE_SOURCE_SCREEN_LIST_PLACEHOLDER_SIZE } = dependencies;
  const { includeThumbnails = false, sourceId = '' } = options;
  const normalizedTypes = normalizeCaptureSourceTypes(types);
  const includeScreenSources = normalizedTypes.includes('screen');
  const includeWindowSources = normalizedTypes.includes('window');
  const isWindowOnlyRequest = includeWindowSources && !includeScreenSources;
  const thumbnailSize = includeThumbnails && includeScreenSources
    ? (sourceId ? CAPTURE_SOURCE_ANALYSIS_THUMBNAIL_SIZE : CAPTURE_SOURCE_THUMBNAIL_SIZE)
    : CAPTURE_SOURCE_EMPTY_THUMBNAIL_SIZE;
  const fallbackThumbnailSize = isWindowOnlyRequest
    ? CAPTURE_SOURCE_WINDOW_LIST_PLACEHOLDER_SIZE
    : !includeThumbnails && includeScreenSources
      ? CAPTURE_SOURCE_SCREEN_LIST_PLACEHOLDER_SIZE
    : CAPTURE_SOURCE_THUMBNAIL_SIZE;

  return { includeThumbnails, sourceId, includeScreenSources, includeWindowSources,
    thumbnailSize, fallbackThumbnailSize };
}

function mergeCapturePreviewSources(resolvedSources, previewScreenSources) {
  const previewScreenSourcesByDisplayId = new Map(
    previewScreenSources
      .filter((source) => source.type === 'screen' && source.displayId)
      .map((source) => [String(source.displayId), source]),
  );
  const mergedSources = resolvedSources.map((source) => {
    if (source.type !== 'screen') {
      return source;
    }

    const previewSource = source.displayId
      ? previewScreenSourcesByDisplayId.get(String(source.displayId))
      : null;
    if (!previewSource) {
      return source;
    }

    return {
      ...source,
      width: source.width || previewSource.width,
      height: source.height || previewSource.height,
      thumbnail: source.thumbnail || previewSource.thumbnail,
    };
  });
  const mergedSourceIds = new Set(mergedSources.map((source) => source.id));
  previewScreenSources.forEach((source) => {
    if (!mergedSourceIds.has(source.id)) {
      mergedSources.push(source);
    }
  });
  return mergedSources;
}

async function fillCaptureScreenPreviews(dependencies, resolvedSources) {
  const { getDisplayListWithNativeBounds, getDisplayList, getNativeScreenPreviewMap,
    fetchAreaPickerScreenSourceList } = dependencies;
  const previewDisplays = await getDisplayListWithNativeBounds()
    .catch(() => getDisplayList());
  const nativeScreenPreviewMap = await getNativeScreenPreviewMap(previewDisplays)
    .catch(() => new Map());
  if (nativeScreenPreviewMap.size) {
    resolvedSources = resolvedSources.map((source) => (
      source.type === 'screen' && source.displayId && nativeScreenPreviewMap.has(String(source.displayId))
        ? { ...source, thumbnail: source.thumbnail || nativeScreenPreviewMap.get(String(source.displayId)) }
        : source
    ));
  }

  const previewScreenSources = await fetchAreaPickerScreenSourceList()
    .catch(() => []);
  return previewScreenSources.length
    ? mergeCapturePreviewSources(resolvedSources, previewScreenSources)
    : resolvedSources;
}

async function fetchCaptureSourceQuery(dependencies, types = dependencies.CAPTURE_SOURCE_TYPES, options = {}) {
  const { getNativeWindowCaptureSources, desktopCapturer, getDisplayListWithNativeBounds,
    getDisplayList, mapCaptureSources, CAPTURE_SOURCE_ANALYSIS_THUMBNAIL_SIZE, CAPTURE_SOURCE_THUMBNAIL_SIZE } = dependencies;
  const { includeThumbnails, sourceId, includeScreenSources, includeWindowSources,
    thumbnailSize, fallbackThumbnailSize } = readCaptureSourceQuery(dependencies, types, options);
  const nativeWindowSourcesPromise = includeWindowSources
    ? getNativeWindowCaptureSources({ includeThumbnails, sourceId, thumbnailSize: sourceId ? CAPTURE_SOURCE_ANALYSIS_THUMBNAIL_SIZE : CAPTURE_SOURCE_THUMBNAIL_SIZE })
    : Promise.resolve([]);
  const desktopSourcesPromise = includeScreenSources
    ? desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize,
        fetchWindowIcons: false,
      })
    : Promise.resolve([]);
  const displayListPromise = includeScreenSources
    ? getDisplayListWithNativeBounds().catch(() => getDisplayList())
    : Promise.resolve(getDisplayList());
  const [desktopSources, nativeWindowSources, displays] = await Promise.all([
    desktopSourcesPromise,
    nativeWindowSourcesPromise,
    displayListPromise,
  ]);
  let resolvedSources = mapCaptureSources(desktopSources, {
    displays,
    includeThumbnail: includeThumbnails,
    includeAppIcon: false,
    fallbackThumbnailSize,
  }).concat(nativeWindowSources);

  if (includeScreenSources && includeThumbnails) {
    const needsScreenPreviewFallback = resolvedSources.some((source) =>
      source.type === 'screen' && !source.thumbnail)
      || !resolvedSources.some((source) => source.type === 'screen');
    if (needsScreenPreviewFallback) {
      resolvedSources = await fillCaptureScreenPreviews(dependencies, resolvedSources);
    }
  }
  return includeWindowSources
    ? resolvedSources.filter((source) => source.type === 'screen' || source.type === 'window')
    : resolvedSources.filter((source) => source.type === 'screen');
}

function createCaptureSourceQuery(dependencies) {
  return fetchCaptureSourceQuery.bind(null, dependencies);
}

module.exports = { createCaptureSourceQuery };
