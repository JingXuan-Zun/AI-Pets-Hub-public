const { createCaptureActivityRegion } = require('./activityRegion.cjs');
const { createCaptureNativeDisplayAssembly } = require('./nativeDisplayAssembly.cjs');

function createCaptureDisplaySession(dependencies) {
  const { app, BrowserWindow, screen, execFile, fs, path, process,
    AREA_PICKER_MAX_PREVIEW_WIDTH, AREA_PICKER_MAX_PREVIEW_HEIGHT, NATIVE_DISPLAY_BOUNDS_CACHE_TTL_MS,
    buildFilteredWindowCaptureSources, normalizeCaptureSourceTitle, getNativeDisplayBoundsPowerShellScript,
    getNativeScreenPreviewPowerShellScript, getNativeWindowCaptureSourcesPowerShellScript } = dependencies;
  const { clampAreaScale, getTargetDisplay, updateActivityRegion } = createCaptureActivityRegion({ screen });
  function getFullDisplayBounds(display) {
    return display.bounds || display.workArea;
  }
  function getDisplayList() {
    return createDisplayList();
  }
  const { createDisplayList, getAreaPickerThumbnailSize, getVirtualWorkAreaBounds, getVirtualDisplayBounds,
    runTemporaryPowerShellScript, getNativeWindowCaptureSources, getNativeScreenPreviewMap,
    getNativeDisplayBoundsCached, invalidateNativeDisplayBoundsCache } = createCaptureNativeDisplayAssembly({
    app, BrowserWindow, screen, execFile, fs, path, process, getFullDisplayBounds, getTargetDisplay,
    AREA_PICKER_MAX_PREVIEW_WIDTH, AREA_PICKER_MAX_PREVIEW_HEIGHT, NATIVE_DISPLAY_BOUNDS_CACHE_TTL_MS,
    buildFilteredWindowCaptureSources, normalizeCaptureSourceTitle, getNativeDisplayBoundsPowerShellScript,
    getNativeScreenPreviewPowerShellScript, getNativeWindowCaptureSourcesPowerShellScript,
  });
  async function getDisplayListWithNativeBounds(options = {}) {
    const nativeDisplays = await getNativeDisplayBoundsCached(options);
    return createDisplayList(nativeDisplays);
  }
  return {
    clampAreaScale, getTargetDisplay, updateActivityRegion, getFullDisplayBounds,
    getDisplayList, getDisplayListWithNativeBounds, getAreaPickerThumbnailSize,
    getVirtualWorkAreaBounds, getVirtualDisplayBounds, runTemporaryPowerShellScript,
    getNativeWindowCaptureSources, getNativeScreenPreviewMap, invalidateNativeDisplayBoundsCache,
  };
}

module.exports = { createCaptureDisplaySession };
