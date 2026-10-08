function normalizeCaptureSourceTypes(dependencies, types) {
  const requestedTypes = Array.isArray(types)
    ? types
    : [];
  const normalizedTypes = dependencies.CAPTURE_SOURCE_TYPES.filter((type) => requestedTypes.includes(type));
  return normalizedTypes.length
    ? normalizedTypes
    : [...dependencies.CAPTURE_SOURCE_TYPES];
}

function getCaptureSourceCacheKey(dependencies, types) {
  return normalizeCaptureSourceTypes(dependencies, types).join(',');
}

function getCaptureSourceCacheEntry(dependencies, types) {
  return dependencies.getCache().get(getCaptureSourceCacheKey(dependencies, types)) ?? {
    sources: [],
    updatedAt: 0,
  };
}

function getCachedCaptureSources(dependencies, types) {
  return getCaptureSourceCacheEntry(dependencies, types).sources;
}

function isCaptureSourceCacheFresh(dependencies, types) {
  const cacheEntry = getCaptureSourceCacheEntry(dependencies, types);
  return cacheEntry.updatedAt > 0
    && (Date.now() - cacheEntry.updatedAt) <= dependencies.CAPTURE_SOURCE_CACHE_TTL_MS;
}

function hasCaptureSourceCacheEntries(dependencies, types) {
  return getCachedCaptureSources(dependencies, types).length > 0;
}

function hasCaptureSourceCacheThumbnails(dependencies, types) {
  const cachedSources = getCachedCaptureSources(dependencies, types);
  return cachedSources.length > 0
    && cachedSources.every((source) => source.thumbnail);
}

function primeCaptureSourceCache(dependencies, types, sources) {
  const normalizedTypes = normalizeCaptureSourceTypes(dependencies, types);
  const updatedAt = Date.now();
  dependencies.getCache().set(getCaptureSourceCacheKey(dependencies, normalizedTypes), {
    sources,
    updatedAt,
  });

  if (normalizedTypes.length <= 1) {
    return;
  }

  normalizedTypes.forEach((type) => {
    dependencies.getCache().set(type, {
      sources: sources.filter((source) => source.type === type),
      updatedAt,
    });
  });
}

function createCaptureSourceCache(dependencies) {
  return {
    normalizeCaptureSourceTypes: normalizeCaptureSourceTypes.bind(null, dependencies),
    getCaptureSourceCacheKey: getCaptureSourceCacheKey.bind(null, dependencies),
    getCachedCaptureSources: getCachedCaptureSources.bind(null, dependencies),
    isCaptureSourceCacheFresh: isCaptureSourceCacheFresh.bind(null, dependencies),
    hasCaptureSourceCacheEntries: hasCaptureSourceCacheEntries.bind(null, dependencies),
    hasCaptureSourceCacheThumbnails: hasCaptureSourceCacheThumbnails.bind(null, dependencies),
    primeCaptureSourceCache: primeCaptureSourceCache.bind(null, dependencies),
  };
}

module.exports = { createCaptureSourceCache };
