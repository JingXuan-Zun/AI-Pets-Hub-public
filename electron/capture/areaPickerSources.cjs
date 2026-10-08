function getAreaPickerThumbnailSizeKey(thumbnailSize) {
  return `${Math.max(1, Math.round(thumbnailSize?.width ?? 0))}x${Math.max(1, Math.round(thumbnailSize?.height ?? 0))}`;
}

function createAreaPickerCache(ttlMs) {
  const state = { sources: [], updatedAt: 0, key: '' };

  function isFresh() {
    return state.updatedAt > 0 && (Date.now() - state.updatedAt) <= ttlMs;
  }

  function store(sources, key) {
    state.sources = sources;
    state.updatedAt = Date.now();
    state.key = key;
  }

  function invalidate() {
    state.sources = [];
    state.updatedAt = 0;
    state.key = '';
  }

  return { state, isFresh, store, invalidate };
}

function getCachedAreaPickerScreenSources(getCachedCaptureSources) {
  return [
    ...getCachedCaptureSources(['screen']),
    ...getCachedCaptureSources()
      .filter((source) => source.type === 'screen' && source.displayId),
  ].filter((source, index, sources) =>
    source.type === 'screen'
    && source.displayId
    && sources.findIndex((entry) => entry.id === source.id) === index,
  );
}

async function readAreaPickerScreenSources(dependencies, cache, options = {}) {
  const { AREA_PICKER_PREVIEW_THUMBNAIL_SIZE, getCachedCaptureSources,
    fetchAreaPickerScreenSourceList, fetchScreenCaptureSourceListLite, getCaptureSourceListWithOptions } = dependencies;
  const {
    forceRefresh = false,
    thumbnailSize = AREA_PICKER_PREVIEW_THUMBNAIL_SIZE,
  } = options;
  const thumbnailSizeKey = getAreaPickerThumbnailSizeKey(thumbnailSize);
  const baseThumbnailSizeKey = getAreaPickerThumbnailSizeKey(AREA_PICKER_PREVIEW_THUMBNAIL_SIZE);

  if (!forceRefresh && cache.isFresh() && cache.state.key === thumbnailSizeKey) {
    return cache.state.sources;
  }

  const cachedScreenSources = getCachedAreaPickerScreenSources(getCachedCaptureSources);
  if (!forceRefresh && thumbnailSizeKey === baseThumbnailSizeKey && cachedScreenSources.length) {
    cache.store(cachedScreenSources, thumbnailSizeKey);
    return cachedScreenSources;
  }

  const previewScreenSources = await fetchAreaPickerScreenSourceList(thumbnailSize);
  const resolvedPreviewScreenSources = previewScreenSources
    .filter((source) => source.type === 'screen' && source.displayId);
  if (resolvedPreviewScreenSources.length) {
    cache.store(resolvedPreviewScreenSources, thumbnailSizeKey);
    return resolvedPreviewScreenSources;
  }

  const liteScreenSources = await fetchScreenCaptureSourceListLite();
  const resolvedLiteScreenSources = liteScreenSources
    .filter((source) => source.type === 'screen' && source.displayId);
  if (resolvedLiteScreenSources.length) {
    return resolvedLiteScreenSources;
  }

  return getCaptureSourceListWithOptions({ forceRefresh: true })
    .then((sources) => sources.filter((source) => source.type === 'screen' && source.displayId));
}

function createAreaPickerScreenSources(dependencies) {
  const cache = createAreaPickerCache(dependencies.AREA_PICKER_SCREEN_SOURCE_CACHE_TTL_MS);
  return {
    getAreaPickerScreenSources: readAreaPickerScreenSources.bind(null, dependencies, cache),
    invalidateAreaPickerScreenSourceCache: cache.invalidate,
  };
}

module.exports = { createAreaPickerScreenSources };
