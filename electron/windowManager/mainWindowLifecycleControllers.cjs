const { createMainWindowStateRecoveryControllers } = require('./mainWindowRecoveryControllers.cjs');
const { createMainWindowStateCreationControllers } = require('./mainWindowCreationControllers.cjs');

function createMainWindowLifecycleControllers({
  managerState, logWindowEvent, showMainWindow, hidePostDragInputProxy,
  createWindowForRecovery, createWindowForHealth, setTimeout, clearTimeout,
  MAIN_WINDOW_RENDERER_READY_TIMEOUT_MS, MAIN_WINDOW_RENDERER_STARTUP_RECOVERY_LIMIT, MAIN_WINDOW_RENDERER_HEALTH_TIMEOUT_MS, pointerDiagnosticsEnabled,
  hideMainWindow, applyPostDragInputProxyRegions, scheduleWindowStackOnTop, openExternalSafely,
  shell, notifySettingsWindowState, notifyChatWindowState, broadcastSharedState,
  captureService, getShellRendererWindows, COMPACT_WINDOW_BOUNDS, getBrowserWindowIconOptions,
  path, baseDirectory, sessionPartition, windowOwnershipState,
  BrowserWindow, attachLoadLogging, resizeWindowForSettings, startMainTopmostGuard,
  setWindowPointerPassthrough, USE_SEPARATE_RENDER_AND_INPUT_WINDOWS, ensurePostDragInputProxyWindow, isDev,
  getOpenDevTools, loadRenderer,
}) {
  const {
    showMainWindowWhenReady, markMainWindowReadyToShow, recoverMainWindowRenderer,
    scheduleMainWindowRendererReadyFallback, showOrRecoverMainWindow,
  } = createMainWindowStateRecoveryControllers({
    managerState, logWindowEvent, showMainWindow, hidePostDragInputProxy,
    createWindowForRecovery, createWindowForHealth,
    setTimeout, clearTimeout,
    MAIN_WINDOW_RENDERER_READY_TIMEOUT_MS, MAIN_WINDOW_RENDERER_STARTUP_RECOVERY_LIMIT, MAIN_WINDOW_RENDERER_HEALTH_TIMEOUT_MS,
  });
  const createWindow = createMainWindowStateCreationControllers({
    managerState, pointerDiagnosticsEnabled, hideMainWindow, logWindowEvent,
    applyPostDragInputProxyRegions, scheduleWindowStackOnTop, showMainWindowWhenReady,
    openExternalSafely, shell, notifySettingsWindowState,
    notifyChatWindowState, broadcastSharedState, captureService,
    getShellRendererWindows, recoverMainWindowRenderer, COMPACT_WINDOW_BOUNDS,
    getBrowserWindowIconOptions, path, baseDirectory,
    sessionPartition, windowOwnershipState, showOrRecoverMainWindow,
    BrowserWindow, attachLoadLogging, resizeWindowForSettings,
    startMainTopmostGuard, setWindowPointerPassthrough, USE_SEPARATE_RENDER_AND_INPUT_WINDOWS,
    ensurePostDragInputProxyWindow, scheduleMainWindowRendererReadyFallback, isDev,
    getOpenDevTools, loadRenderer,
  });
  return { showMainWindowWhenReady, markMainWindowReadyToShow, recoverMainWindowRenderer, scheduleMainWindowRendererReadyFallback, showOrRecoverMainWindow, createWindow };
}

module.exports = { createMainWindowLifecycleControllers };
