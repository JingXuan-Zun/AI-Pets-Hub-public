const { createCaptureQuerySession } = require('./capture/querySession.cjs');
const { createCaptureDisplaySession } = require('./capture/displaySession.cjs');
const { createCaptureSourceState } = require('./capture/sourceState.cjs');
const {
  buildFilteredWindowCaptureSources,
  normalizeCaptureSourceTitle,
} = require('./captureSourceFilters.cjs');
const {
  getNativeDisplayBoundsPowerShellScript,
  getNativeScreenPreviewPowerShellScript,
  getNativeWindowCaptureSourcesPowerShellScript,
} = require('./capturePowerShellScripts.cjs');

const { app, BrowserWindow, desktopCapturer, screen } = require('electron');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const CAPTURE_SOURCE_TYPES = ['screen', 'window'];
const DISPLAY_ENVIRONMENT_BROADCAST_DELAY_MS = 120;
const CAPTURE_SOURCE_REFRESH_DELAY_MS = 420;
const CAPTURE_SOURCE_CACHE_TTL_MS = 300000;
const CAPTURE_SOURCE_THUMBNAIL_SIZE = { width: 240, height: 135 };
const CAPTURE_SOURCE_ANALYSIS_THUMBNAIL_SIZE = { width: 960, height: 540 };
const CAPTURE_SOURCE_EMPTY_THUMBNAIL_SIZE = { width: 0, height: 0 };
const CAPTURE_SOURCE_SCREEN_LIST_PLACEHOLDER_SIZE = { width: 320, height: 180 };
const CAPTURE_SOURCE_WINDOW_LIST_PLACEHOLDER_SIZE = { width: 320, height: 180 };
const AREA_PICKER_PREVIEW_THUMBNAIL_SIZE = { width: 960, height: 540 };
const AREA_PICKER_MAX_PREVIEW_WIDTH = 5120;
const AREA_PICKER_MAX_PREVIEW_HEIGHT = 2880;
const AREA_PICKER_SCREEN_SOURCE_CACHE_TTL_MS = 15000;
const NATIVE_DISPLAY_BOUNDS_CACHE_TTL_MS = 15000;

function createCaptureService(options = {}) {
  const {
    getSettingsWindow = () => null,
    getShellRendererWindows: getShellRendererWindowsOption = () => [],
  } = options;

  let shellRendererWindowsProvider = getShellRendererWindowsOption;

  const { getCache, getRequests, invalidateCaptureSourceCache } = createCaptureSourceState({
    invalidateAreaPickerScreenSourceCache: () => invalidateAreaPickerScreenSourceCache(),
    invalidateNativeDisplayBoundsCache: () => invalidateNativeDisplayBoundsCache(),
  });

  const { clampAreaScale, getTargetDisplay, updateActivityRegion, getFullDisplayBounds,
    getDisplayList, getDisplayListWithNativeBounds, getAreaPickerThumbnailSize,
    getVirtualWorkAreaBounds, getVirtualDisplayBounds, runTemporaryPowerShellScript,
    getNativeWindowCaptureSources, getNativeScreenPreviewMap, invalidateNativeDisplayBoundsCache } = createCaptureDisplaySession({
    app, BrowserWindow, screen, execFile, fs, path, process,
    AREA_PICKER_MAX_PREVIEW_WIDTH, AREA_PICKER_MAX_PREVIEW_HEIGHT, NATIVE_DISPLAY_BOUNDS_CACHE_TTL_MS,
    buildFilteredWindowCaptureSources, normalizeCaptureSourceTitle, getNativeDisplayBoundsPowerShellScript,
    getNativeScreenPreviewPowerShellScript, getNativeWindowCaptureSourcesPowerShellScript,
  });

  const { getCaptureSourceList, getCaptureSourceListWithOptions, getAreaPickerScreenSources,
    invalidateAreaPickerScreenSourceCache, getDisplayEnvironment, broadcastDisplayEnvironment,
    scheduleDisplayEnvironmentBroadcast, scheduleCaptureSourceRefreshBroadcast,
    setSettingsWindowProvider, dispose, buildAreaPickerContext } = createCaptureQuerySession({
    getCache, getRequests, CAPTURE_SOURCE_TYPES, CAPTURE_SOURCE_CACHE_TTL_MS, getDisplayList,
    CAPTURE_SOURCE_THUMBNAIL_SIZE, desktopCapturer, CAPTURE_SOURCE_EMPTY_THUMBNAIL_SIZE,
    AREA_PICKER_PREVIEW_THUMBNAIL_SIZE, getDisplayListWithNativeBounds, CAPTURE_SOURCE_ANALYSIS_THUMBNAIL_SIZE,
    CAPTURE_SOURCE_WINDOW_LIST_PLACEHOLDER_SIZE, CAPTURE_SOURCE_SCREEN_LIST_PLACEHOLDER_SIZE,
    getNativeWindowCaptureSources, getNativeScreenPreviewMap, AREA_PICKER_SCREEN_SOURCE_CACHE_TTL_MS,
    BrowserWindow, getSettingsWindow, console, clearTimeout, setTimeout,
    DISPLAY_ENVIRONMENT_BROADCAST_DELAY_MS, CAPTURE_SOURCE_REFRESH_DELAY_MS, invalidateCaptureSourceCache,
    getVirtualDisplayBounds, getAreaPickerThumbnailSize, screen,
  });

  function setShellRendererWindowsProvider(nextProvider) {
    shellRendererWindowsProvider = typeof nextProvider === 'function'
      ? nextProvider
      : (() => []);
  }

  return {
    AREA_PICKER_PREVIEW_THUMBNAIL_SIZE,
    CAPTURE_SOURCE_EMPTY_THUMBNAIL_SIZE,
    broadcastDisplayEnvironment,
    buildAreaPickerContext,
    clampAreaScale,
    dispose,
    getAreaPickerScreenSources,
    getCaptureSourceList,
    getCaptureSourceListWithOptions,
    getDisplayEnvironment,
    getDisplayList,
    getDisplayListWithNativeBounds,
    getFullDisplayBounds,
    getTargetDisplay,
    getVirtualDisplayBounds,
    getVirtualWorkAreaBounds,
    invalidateCaptureSourceCache,
    runTemporaryPowerShellScript,
    scheduleCaptureSourceRefreshBroadcast,
    scheduleDisplayEnvironmentBroadcast,
    setShellRendererWindowsProvider,
    setSettingsWindowProvider,
    updateActivityRegion,
  };
}

module.exports = {
  CAPTURE_SOURCE_EMPTY_THUMBNAIL_SIZE,
  createCaptureService,
};
