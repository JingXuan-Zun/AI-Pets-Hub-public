const { createMainWindowPresentationEventRegistrar } = require('./mainWindowPresentationEvents.cjs');
const { createMainWindowLoadEventRegistrar } = require('./mainWindowLoadEvents.cjs');
const { createMainWindowOptionsBuilder } = require('./mainWindowOptions.cjs');
const { createMainWindowCreator } = require('./mainWindowCreation.cjs');

function createMainWindowCreationControllers({
  getMainWindow, getIsQuitting, pointerDiagnosticsEnabled, hideMainWindow,
  logWindowEvent, applyPostDragInputProxyRegions, scheduleWindowStackOnTop,
  markMainWindowCanShow, getRendererRecoveryInProgress, showMainWindowWhenReady, openExternalSafely, shell,
  notifySettingsWindowState, notifyChatWindowState, broadcastSharedState, captureService, getShellRendererWindows,
  recoverMainWindowRenderer, COMPACT_WINDOW_BOUNDS, getBrowserWindowIconOptions, path, baseDirectory, sessionPartition,
  setMainWindow, setCanShow, setRendererRecoveryInProgress, setRendererReadyToShow,
  showOrRecoverMainWindow, BrowserWindow, attachLoadLogging, resizeWindowForSettings, startMainTopmostGuard,
  setWindowPointerPassthrough, USE_SEPARATE_RENDER_AND_INPUT_WINDOWS, ensurePostDragInputProxyWindow,
  scheduleMainWindowRendererReadyFallback, isDev, getOpenDevTools, loadRenderer,
}) {
  const attachMainWindowPresentationEvents = createMainWindowPresentationEventRegistrar({
    getMainWindow, getIsQuitting, pointerDiagnosticsEnabled,
    hideMainWindow, logWindowEvent, applyPostDragInputProxyRegions, scheduleWindowStackOnTop,
  });
  const attachMainWindowLoadEvents = createMainWindowLoadEventRegistrar({
    getMainWindow, markMainWindowCanShow, getRendererRecoveryInProgress,
    showMainWindowWhenReady, openExternalSafely, shell,
    notifySettingsWindowState, notifyChatWindowState, broadcastSharedState,
    scheduleWindowStackOnTop, captureService, getShellRendererWindows,
    logWindowEvent, recoverMainWindowRenderer,
  });
  const buildMainWindowOptions = createMainWindowOptionsBuilder({
    COMPACT_WINDOW_BOUNDS, getBrowserWindowIconOptions, path, baseDirectory, sessionPartition,
  });
  const createWindow = createMainWindowCreator({
    getMainWindow, setMainWindow, setCanShow, setRendererRecoveryInProgress, setRendererReadyToShow,
    showOrRecoverMainWindow, BrowserWindow, buildMainWindowOptions, attachLoadLogging,
    scheduleWindowStackOnTop, resizeWindowForSettings, startMainTopmostGuard, setWindowPointerPassthrough,
    USE_SEPARATE_RENDER_AND_INPUT_WINDOWS, ensurePostDragInputProxyWindow, applyPostDragInputProxyRegions,
    scheduleMainWindowRendererReadyFallback, attachMainWindowLoadEvents, attachMainWindowPresentationEvents,
    isDev, getOpenDevTools, loadRenderer,
  });
  return createWindow;
}

function createMainWindowStateCreationControllers({
  managerState, pointerDiagnosticsEnabled, hideMainWindow, logWindowEvent, applyPostDragInputProxyRegions,
  scheduleWindowStackOnTop, showMainWindowWhenReady, openExternalSafely, shell, notifySettingsWindowState,
  notifyChatWindowState, broadcastSharedState, captureService, getShellRendererWindows, recoverMainWindowRenderer,
  COMPACT_WINDOW_BOUNDS, getBrowserWindowIconOptions, path, baseDirectory, sessionPartition,
  windowOwnershipState, showOrRecoverMainWindow, BrowserWindow, attachLoadLogging, resizeWindowForSettings,
  startMainTopmostGuard, setWindowPointerPassthrough, USE_SEPARATE_RENDER_AND_INPUT_WINDOWS, ensurePostDragInputProxyWindow, scheduleMainWindowRendererReadyFallback,
  isDev, getOpenDevTools, loadRenderer,
}) {
  return createMainWindowCreationControllers({
    getMainWindow: () => managerState.mainWindow, getIsQuitting: () => managerState.isQuitting, pointerDiagnosticsEnabled,
    hideMainWindow, logWindowEvent, applyPostDragInputProxyRegions,
    scheduleWindowStackOnTop, markMainWindowCanShow: () => { managerState.mainWindowCanShow = true; }, getRendererRecoveryInProgress: () => managerState.mainWindowRendererRecoveryInProgress,
    showMainWindowWhenReady, openExternalSafely, shell,
    notifySettingsWindowState, notifyChatWindowState, broadcastSharedState,
    captureService, getShellRendererWindows, recoverMainWindowRenderer,
    COMPACT_WINDOW_BOUNDS, getBrowserWindowIconOptions, path,
    baseDirectory, sessionPartition, ...windowOwnershipState.mainCreation,
    showOrRecoverMainWindow, BrowserWindow, attachLoadLogging,
    resizeWindowForSettings, startMainTopmostGuard, setWindowPointerPassthrough,
    USE_SEPARATE_RENDER_AND_INPUT_WINDOWS, ensurePostDragInputProxyWindow, scheduleMainWindowRendererReadyFallback,
    isDev, getOpenDevTools, loadRenderer,
  });
}

module.exports = { createMainWindowCreationControllers, createMainWindowStateCreationControllers };
