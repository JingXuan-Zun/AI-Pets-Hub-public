const { createCaptureDisplayEnvironment } = require('./displayEnvironment.cjs');
const { createCaptureBroadcastScheduler } = require('./broadcastScheduler.cjs');

function getLiveRendererWindows(windows) {
  return (Array.isArray(windows) ? windows : [])
    .filter((win) => win && !win.isDestroyed());
}

function createCaptureEnvironmentAssembly(dependencies) {
  const {
    BrowserWindow, getSettingsWindow, normalizeCaptureSourceTypes, getDisplayListWithNativeBounds,
    getCaptureSourceListWithOptions, isCaptureSourceCacheFresh, console, clearTimeout, setTimeout,
    DISPLAY_ENVIRONMENT_BROADCAST_DELAY_MS, CAPTURE_SOURCE_REFRESH_DELAY_MS, invalidateCaptureSourceCache,
  } = dependencies;
  let settingsWindowProvider = getSettingsWindow;
  function getRendererWindows() {
    return BrowserWindow.getAllWindows();
  }
  const { getDisplayEnvironment, broadcastDisplayEnvironment } = createCaptureDisplayEnvironment({
    normalizeCaptureSourceTypes, getDisplayListWithNativeBounds, getCaptureSourceListWithOptions,
    isCaptureSourceCacheFresh, getLiveRendererWindows, getRendererWindows, console,
  });
  const { scheduleDisplayEnvironmentBroadcast, scheduleCaptureSourceRefreshBroadcast, disposeBroadcastTimers } = createCaptureBroadcastScheduler({
    DISPLAY_ENVIRONMENT_BROADCAST_DELAY_MS, CAPTURE_SOURCE_REFRESH_DELAY_MS,
    clearTimeout, setTimeout, broadcastDisplayEnvironment, isCaptureSourceCacheFresh,
    getSettingsWindow: () => settingsWindowProvider(),
  });
  function setSettingsWindowProvider(nextProvider) {
    settingsWindowProvider = typeof nextProvider === 'function'
      ? nextProvider
      : (() => null);
  }
  function dispose() {
    disposeBroadcastTimers();
    invalidateCaptureSourceCache();
  }
  return {
    getDisplayEnvironment, broadcastDisplayEnvironment, scheduleDisplayEnvironmentBroadcast,
    scheduleCaptureSourceRefreshBroadcast, setSettingsWindowProvider, dispose,
  };
}

module.exports = { createCaptureEnvironmentAssembly, getLiveRendererWindows };
