const { createCaptureQueryAssembly } = require('./queryAssembly.cjs');
const { createCaptureEnvironmentAssembly } = require('./environmentAssembly.cjs');
const { createAreaPickerContextBuilder } = require('./areaPickerContext.cjs');

function createCaptureQuerySession(dependencies) {
  const {
    getCache, getRequests, CAPTURE_SOURCE_TYPES, CAPTURE_SOURCE_CACHE_TTL_MS, getDisplayList,
    CAPTURE_SOURCE_THUMBNAIL_SIZE, desktopCapturer, CAPTURE_SOURCE_EMPTY_THUMBNAIL_SIZE,
    AREA_PICKER_PREVIEW_THUMBNAIL_SIZE, getDisplayListWithNativeBounds, CAPTURE_SOURCE_ANALYSIS_THUMBNAIL_SIZE,
    CAPTURE_SOURCE_WINDOW_LIST_PLACEHOLDER_SIZE, CAPTURE_SOURCE_SCREEN_LIST_PLACEHOLDER_SIZE,
    getNativeWindowCaptureSources, getNativeScreenPreviewMap, AREA_PICKER_SCREEN_SOURCE_CACHE_TTL_MS,
    BrowserWindow, getSettingsWindow, console, clearTimeout, setTimeout,
    DISPLAY_ENVIRONMENT_BROADCAST_DELAY_MS, CAPTURE_SOURCE_REFRESH_DELAY_MS, invalidateCaptureSourceCache,
    getVirtualDisplayBounds, getAreaPickerThumbnailSize, screen,
  } = dependencies;
  async function getCaptureSourceList(options = {}) {
    return getCaptureSourceListWithOptions(options);
  }
  const { normalizeCaptureSourceTypes, isCaptureSourceCacheFresh, getCaptureSourceListWithOptions,
    getAreaPickerScreenSources, invalidateAreaPickerScreenSourceCache } = createCaptureQueryAssembly({
    getCache, getRequests,
    CAPTURE_SOURCE_TYPES, CAPTURE_SOURCE_CACHE_TTL_MS, getDisplayList, CAPTURE_SOURCE_THUMBNAIL_SIZE,
    desktopCapturer, CAPTURE_SOURCE_EMPTY_THUMBNAIL_SIZE, AREA_PICKER_PREVIEW_THUMBNAIL_SIZE,
    getDisplayListWithNativeBounds, CAPTURE_SOURCE_ANALYSIS_THUMBNAIL_SIZE,
    CAPTURE_SOURCE_WINDOW_LIST_PLACEHOLDER_SIZE, CAPTURE_SOURCE_SCREEN_LIST_PLACEHOLDER_SIZE,
    getNativeWindowCaptureSources, getNativeScreenPreviewMap, AREA_PICKER_SCREEN_SOURCE_CACHE_TTL_MS,
  });
  const { getDisplayEnvironment, broadcastDisplayEnvironment, scheduleDisplayEnvironmentBroadcast,
    scheduleCaptureSourceRefreshBroadcast, setSettingsWindowProvider, dispose } = createCaptureEnvironmentAssembly({
    BrowserWindow, getSettingsWindow, normalizeCaptureSourceTypes, getDisplayListWithNativeBounds,
    getCaptureSourceListWithOptions, isCaptureSourceCacheFresh, console, clearTimeout, setTimeout,
    DISPLAY_ENVIRONMENT_BROADCAST_DELAY_MS, CAPTURE_SOURCE_REFRESH_DELAY_MS, invalidateCaptureSourceCache,
  });
  const buildAreaPickerContext = createAreaPickerContextBuilder({
    getVirtualDisplayBounds, getDisplayListWithNativeBounds, getAreaPickerScreenSources,
    getAreaPickerThumbnailSize, screen,
  });
  return {
    getCaptureSourceList, getCaptureSourceListWithOptions, getAreaPickerScreenSources,
    invalidateAreaPickerScreenSourceCache, getDisplayEnvironment, broadcastDisplayEnvironment,
    scheduleDisplayEnvironmentBroadcast, scheduleCaptureSourceRefreshBroadcast,
    setSettingsWindowProvider, dispose, buildAreaPickerContext,
  };
}

module.exports = { createCaptureQuerySession };
