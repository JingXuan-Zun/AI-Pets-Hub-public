const { createCaptureSourceCache } = require('./sourceCache.cjs');
const { createCaptureSourceMapper } = require('./sourceMapper.cjs');
const { createCaptureScreenQueries } = require('./screenQueries.cjs');
const { createCaptureSourceQuery } = require('./sourceQuery.cjs');
const { createCaptureRequestReader } = require('./requestReader.cjs');
const { createAreaPickerScreenSources } = require('./areaPickerSources.cjs');

function createCaptureQueryAssembly(dependencies) {
  const {
    getCache, getRequests, CAPTURE_SOURCE_TYPES, CAPTURE_SOURCE_CACHE_TTL_MS,
    getDisplayList, CAPTURE_SOURCE_THUMBNAIL_SIZE, desktopCapturer, CAPTURE_SOURCE_EMPTY_THUMBNAIL_SIZE,
    AREA_PICKER_PREVIEW_THUMBNAIL_SIZE, getDisplayListWithNativeBounds, CAPTURE_SOURCE_ANALYSIS_THUMBNAIL_SIZE,
    CAPTURE_SOURCE_WINDOW_LIST_PLACEHOLDER_SIZE, CAPTURE_SOURCE_SCREEN_LIST_PLACEHOLDER_SIZE,
    getNativeWindowCaptureSources, getNativeScreenPreviewMap, AREA_PICKER_SCREEN_SOURCE_CACHE_TTL_MS,
  } = dependencies;
  const {
    normalizeCaptureSourceTypes,
    getCaptureSourceCacheKey,
    getCachedCaptureSources,
    isCaptureSourceCacheFresh,
    hasCaptureSourceCacheEntries,
    hasCaptureSourceCacheThumbnails,
    primeCaptureSourceCache,
  } = createCaptureSourceCache({
    getCache, CAPTURE_SOURCE_TYPES, CAPTURE_SOURCE_CACHE_TTL_MS,
  });
  const mapCaptureSources = createCaptureSourceMapper({ getDisplayList, CAPTURE_SOURCE_THUMBNAIL_SIZE });
  const { fetchScreenCaptureSourceListLite, fetchAreaPickerScreenSourceList } = createCaptureScreenQueries({
    desktopCapturer, CAPTURE_SOURCE_EMPTY_THUMBNAIL_SIZE, AREA_PICKER_PREVIEW_THUMBNAIL_SIZE,
    getDisplayListWithNativeBounds, getDisplayList, mapCaptureSources,
  });
  const fetchCaptureSourceList = createCaptureSourceQuery({
    normalizeCaptureSourceTypes, CAPTURE_SOURCE_TYPES, CAPTURE_SOURCE_ANALYSIS_THUMBNAIL_SIZE,
    CAPTURE_SOURCE_THUMBNAIL_SIZE, CAPTURE_SOURCE_EMPTY_THUMBNAIL_SIZE,
    CAPTURE_SOURCE_WINDOW_LIST_PLACEHOLDER_SIZE, CAPTURE_SOURCE_SCREEN_LIST_PLACEHOLDER_SIZE,
    getNativeWindowCaptureSources, desktopCapturer, getDisplayListWithNativeBounds, getDisplayList,
    mapCaptureSources, getNativeScreenPreviewMap, fetchAreaPickerScreenSourceList,
  });
  const getCaptureSourceListWithOptions = createCaptureRequestReader({
    normalizeCaptureSourceTypes, getCaptureSourceCacheKey, isCaptureSourceCacheFresh,
    hasCaptureSourceCacheEntries, hasCaptureSourceCacheThumbnails, getCachedCaptureSources,
    fetchCaptureSourceList, primeCaptureSourceCache, getRequests,
  });
  const { getAreaPickerScreenSources, invalidateAreaPickerScreenSourceCache } = createAreaPickerScreenSources({
    AREA_PICKER_PREVIEW_THUMBNAIL_SIZE, AREA_PICKER_SCREEN_SOURCE_CACHE_TTL_MS,
    getCachedCaptureSources, fetchAreaPickerScreenSourceList, fetchScreenCaptureSourceListLite,
    getCaptureSourceListWithOptions,
  });
  return {
    normalizeCaptureSourceTypes, isCaptureSourceCacheFresh, getCaptureSourceListWithOptions,
    getAreaPickerScreenSources, invalidateAreaPickerScreenSourceCache,
  };
}

module.exports = { createCaptureQueryAssembly };
