function readCaptureRequest(dependencies, options) {
  const {
    forceRefresh = false,
    preferCached = false,
    captureSourceTypes,
    includeCaptureThumbnails = false,
    sourceId = '',
  } = options;
  const normalizedTypes = dependencies.normalizeCaptureSourceTypes(captureSourceTypes);
  const cacheKey = `${dependencies.getCaptureSourceCacheKey(normalizedTypes)}|thumb:${includeCaptureThumbnails ? '1' : '0'}|source:${sourceId}`;
  return { forceRefresh, preferCached, includeCaptureThumbnails, sourceId, normalizedTypes, cacheKey };
}

function selectCachedCaptureRequest(dependencies, { forceRefresh, preferCached, includeCaptureThumbnails, normalizedTypes }) {
  if (
    !forceRefresh
    && dependencies.isCaptureSourceCacheFresh(normalizedTypes)
    && dependencies.hasCaptureSourceCacheEntries(normalizedTypes)
    && (!includeCaptureThumbnails || dependencies.hasCaptureSourceCacheThumbnails(normalizedTypes))
  ) {
    return { value: dependencies.getCachedCaptureSources(normalizedTypes) };
  }

  if (
    !forceRefresh
    && preferCached
    && dependencies.hasCaptureSourceCacheEntries(normalizedTypes)
    && (!includeCaptureThumbnails || dependencies.hasCaptureSourceCacheThumbnails(normalizedTypes))
  ) {
    return { value: dependencies.getCachedCaptureSources(normalizedTypes) };
  }
  return null;
}

async function executeCaptureRequest(dependencies, options = {}) {
  const request = readCaptureRequest(dependencies, options);
  const { normalizedTypes, cacheKey, includeCaptureThumbnails, sourceId } = request;
  const cached = selectCachedCaptureRequest(dependencies, request);
  if (cached) {
    return cached.value;
  }
  if (dependencies.getRequests().has(cacheKey)) {
    return dependencies.getRequests().get(cacheKey);
  }

  const captureSourceRequest = dependencies.fetchCaptureSourceList(normalizedTypes, {
    includeThumbnails: includeCaptureThumbnails,
    sourceId,
  })
    .then((sources) => {
      if (!sourceId.trim()) {
        dependencies.primeCaptureSourceCache(normalizedTypes, sources);
      }
      return sources;
    })
    .finally(() => {
      dependencies.getRequests().delete(cacheKey);
    });

  dependencies.getRequests().set(cacheKey, captureSourceRequest);
  return captureSourceRequest;
}

function createCaptureRequestReader(dependencies) {
  return executeCaptureRequest.bind(null, dependencies);
}

module.exports = { createCaptureRequestReader };
