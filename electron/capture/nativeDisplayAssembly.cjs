const { createCaptureDisplayProjection } = require('./displayProjection.cjs');
const { createCaptureAreaGeometry } = require('./areaGeometry.cjs');
const { createOwnCaptureWindowTitleReader } = require('./windowTitles.cjs');
const { createCaptureNativeReaders } = require('./nativeReaders.cjs');
const { createNativeDisplayCache } = require('./nativeDisplayCache.cjs');
const { createCapturePowerShellRunner } = require('./powerShellRunner.cjs');
const { readNativeResultList, parseNativeDisplayBounds, parseNativeScreenPreviews } = require('./nativeResults.cjs');
const {
  getDisplayScaleFactor,
  createFallbackNativeDisplayBounds,
  resolveNativeDisplayBounds,
} = require('./displayGeometry.cjs');

function createCaptureNativeDisplayAssembly(dependencies) {
  const { app, BrowserWindow, screen, execFile, fs, path, process,
    getFullDisplayBounds, getTargetDisplay, AREA_PICKER_MAX_PREVIEW_WIDTH,
    AREA_PICKER_MAX_PREVIEW_HEIGHT, NATIVE_DISPLAY_BOUNDS_CACHE_TTL_MS,
    buildFilteredWindowCaptureSources, normalizeCaptureSourceTitle, getNativeDisplayBoundsPowerShellScript,
    getNativeScreenPreviewPowerShellScript, getNativeWindowCaptureSourcesPowerShellScript } = dependencies;
  const createDisplayList = createCaptureDisplayProjection({
    screen, getFullDisplayBounds, getDisplayScaleFactor, createFallbackNativeDisplayBounds, resolveNativeDisplayBounds,
  });
  const { getAreaPickerThumbnailSize, getVirtualWorkAreaBounds, getVirtualDisplayBounds } = createCaptureAreaGeometry({
    screen, getFullDisplayBounds, getTargetDisplay, AREA_PICKER_MAX_PREVIEW_WIDTH, AREA_PICKER_MAX_PREVIEW_HEIGHT,
  });
  const getOwnCaptureWindowTitleSet = createOwnCaptureWindowTitleReader({ BrowserWindow, normalizeCaptureSourceTitle });
  const runTemporaryPowerShellScript = createCapturePowerShellRunner({ app, execFile, fs, path });
  const { getNativeDisplayBounds, getNativeWindowCaptureSources, getNativeScreenPreviewMap } = createCaptureNativeReaders({
    process, execFile, runTemporaryPowerShellScript, getNativeDisplayBoundsPowerShellScript,
    getNativeWindowCaptureSourcesPowerShellScript, getNativeScreenPreviewPowerShellScript,
    parseNativeDisplayBounds, readNativeResultList, parseNativeScreenPreviews,
    getOwnCaptureWindowTitleSet, buildFilteredWindowCaptureSources,
  });
  const { invalidateNativeDisplayBoundsCache, getNativeDisplayBoundsCached } = createNativeDisplayCache({
    getNativeDisplayBounds, NATIVE_DISPLAY_BOUNDS_CACHE_TTL_MS,
  });
  return { createDisplayList, getAreaPickerThumbnailSize, getVirtualWorkAreaBounds, getVirtualDisplayBounds,
    runTemporaryPowerShellScript, getNativeWindowCaptureSources, getNativeScreenPreviewMap,
    getNativeDisplayBoundsCached, invalidateNativeDisplayBoundsCache };
}

module.exports = { createCaptureNativeDisplayAssembly };
