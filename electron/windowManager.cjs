const { createWindowManagerStateControllers } = require('./windowManager/windowManagerStateControllers.cjs');
const { createWindowManagerWindowApi, createWindowManagerInteractionApi } = require('./windowManager/windowManagerPublicApi.cjs');
const { createMainInteractiveWarmupStateAdapter } = require('./windowManager/mainWindowLifecycleStateAdapters.cjs');
const {
  createNativeShapeStateAdapter, createInteractiveShapeStateAdapter,
} = require('./windowManager/windowInteractionStateAdapters.cjs');
const { createWindowManagerState } = require('./windowManager/windowManagerState.cjs');
const { createSettingsStatePresentationControllers } = require('./windowManager/settingsPresentationControllers.cjs');
const {
  CURRENT_WINDOW_COMPACT_MINIMUM_SIZE_KEY, COMPACT_WINDOW_BOUNDS, SETTINGS_PANEL_WINDOW_BOUNDS, CHAT_PANEL_WINDOW_BOUNDS,
  INTERACTIVE_CHAT_PANEL_WINDOW_BOUNDS, INTERACTIVE_CHAT_PANEL_CENTER_Y_RATIO, TOPMOST_WINDOW_LEVEL,
  AREA_PICKER_TOPMOST_WINDOW_LEVEL, MAIN_TOPMOST_RELATIVE_LEVEL, POST_DRAG_INPUT_PROXY_TOPMOST_RELATIVE_LEVEL,
  POST_DRAG_INPUT_PROXY_IDLE_DESTROY_MS, AUX_TOPMOST_RELATIVE_LEVEL, PERSISTENT_AREA_BORDER_TOPMOST_RELATIVE_LEVEL,
  AREA_PICKER_TOPMOST_RELATIVE_LEVEL, SETTINGS_WINDOW_SHOW_DISPLAY_REFRESH_DELAY_MS,
  SETTINGS_WINDOW_SHOW_CAPTURE_REFRESH_DELAY_MS, SETTINGS_WINDOW_CONTENT_REFRESH_COOLDOWN_MS,
  DISPLAY_ENVIRONMENT_BROADCAST_DELAY_MS, TOPMOST_GUARD_INTERVAL_MS, PET_DRAG_FULL_WINDOW_SHAPE_HOLD_MS,
  MAIN_INTERACTIVE_LAYER_WARMUP_DELAY_MS, MAIN_INTERACTIVE_LAYER_WARMUP_RESTORE_DELAY_MS,
  MAIN_WINDOW_RENDERER_READY_TIMEOUT_MS, MAIN_WINDOW_RENDERER_HEALTH_TIMEOUT_MS,
  MAIN_WINDOW_RENDERER_STARTUP_RECOVERY_LIMIT, MAIN_INTERACTIVE_LAYER_WARMUP_REGION,
} = require('./windowManager/windowManagerConstants.cjs');
const { createWindowTopmostPolicy } = require('./windowManager/windowTopmostPolicy.cjs');
const { createPostDragInputProxyStateLifecycle } = require('./windowManager/postDragInputProxyLifecycle.cjs');
const { createInteractiveShapeControllers } = require('./windowManager/interactiveShapeControllers.cjs');
const { createMainWindowStateInteractiveGeometry } = require('./windowManager/mainWindowInteractiveGeometry.cjs');
const { createNativeShapeControllers } = require('./windowManager/nativeShapeControllers.cjs');
const { createMainWindowLifecycleControllers } = require('./windowManager/mainWindowLifecycleControllers.cjs');
const { createWindowManagerPlacementControllers } = require('./windowManager/windowPlacementControllers.cjs');
const { createAuxiliaryWindowContentControllers } = require('./windowManager/auxiliaryWindowContentControllers.cjs');
const { createWindowPresentationTrayControllers } = require('./windowManager/windowPresentationTrayControllers.cjs');
const { createWindowStatePointerPassthroughRequester } = require('./windowManager/pointerPassthroughRequests.cjs');
const { createAgentDesktopExecutionPolicy } = require('./windowManager/agentDesktopExecutionPolicy.cjs');
const { createWindowManagerStateDisposer } = require('./windowManager/windowManagerDisposal.cjs');
const { waitForSettingsWindowLoad } = require('./windowManager/settingsWindowLoadStages.cjs');
const { createWindowManagerRendererNavigation } = require('./windowManager/rendererNavigation.cjs');
const { createWindowLoadLogging } = require('./windowManager/windowLoadLogging.cjs');
const {
  normalizeInteractiveRegions,
  createInteractiveRegionsSignature,
  summarizeInteractiveRegion,
  normalizeInteractiveRegionSource,
} = require('./windowManager/interactiveRegionNormalization.cjs');
const { createWindowResourceMessagingControllers } = require('./windowManager/windowResourceMessagingControllers.cjs');
const { app, BrowserWindow, Menu, Tray, nativeImage, screen, shell } = require('electron');
const path = require('path');
const { disableDwmSystemBorderForWindow } = require('./windowsDwmBorderService.cjs');
const { openExternalSafely } = require('./ipcSenderGuard.cjs');

const { resolveWindowManagerRuntimeFlags } = require('./windowManager/windowManagerRuntimeFlags.cjs');

const {
  USE_SEPARATE_RENDER_AND_INPUT_WINDOWS, PREWARM_MAIN_INTERACTIVE_LAYER, HIDE_MAIN_WINDOW_FOR_GRAPH_DIAGNOSTICS,
  DISABLE_SETTINGS_TOPMOST_FOR_GRAPH_DIAGNOSTICS, localTestQueryValues,
  pointerDiagnosticsEnabled, forceFullShapeOnDragEnabled, live2DDragProbeEnabled,
} = resolveWindowManagerRuntimeFlags(process);

function isCurrentWindowCompactMinimumSizeActive(win) {
  return Boolean(win && !win.isDestroyed() && win[CURRENT_WINDOW_COMPACT_MINIMUM_SIZE_KEY]);
}

function createWindowManager(options) {
  const {
    areaPickerService,
    captureService,
    isDev,
    log,
    sessionPartition,
  } = options;

  const managerState = createWindowManagerState();
  const {
    hideMainWindow, createTray, setSettingsOpen, windowOwnershipState,
    getMainWindow, getSettingsWindow, getChatWindow, getShellRendererWindows, setQuitting, setSharedState, getSharedState,
  } = createWindowManagerStateControllers({
    managerState, Tray,
    hidePostDragInputProxy: (reason, destroy) => hidePostDragInputProxy(reason, destroy),
    resolveTrayIcon: () => resolveTrayIcon(), configureTray: () => configureTray(),
    resizeWindowForSettings: (isOpen) => resizeWindowForSettings(isOpen),
    syncInteractiveChatWindowBounds: () => syncInteractiveChatWindowBounds(),
    broadcastSharedState: () => broadcastSharedState(),
  });
  let isAgentDesktopExecutionActive = false;

  const keepWindowOnTop = createWindowTopmostPolicy({
    getChatWindow: () => managerState.chatWindow, getSettingsWindow: () => managerState.settingsWindow,
    getIsAgentDesktopExecutionActive: () => isAgentDesktopExecutionActive, topmostStateByWindow: managerState.topmostStateByWindow,
    MAIN_TOPMOST_RELATIVE_LEVEL, TOPMOST_WINDOW_LEVEL, DISABLE_SETTINGS_TOPMOST_FOR_GRAPH_DIAGNOSTICS,
  });
  const { isFullWindowInteractiveShape, createFullWindowInteractiveRegion } = createMainWindowStateInteractiveGeometry({ managerState });
  const { logWindowEvent, attachLoadLogging } = createWindowLoadLogging({ log });
  const nativeShapeState = createNativeShapeStateAdapter(managerState);
  const { canApplyInteractiveWindowShape, applyInteractiveWindowShape, applyPointerPassthroughState, warmMainInteractiveLayer }
    = createNativeShapeControllers({
    warmupState: createMainInteractiveWarmupStateAdapter(managerState),
    nativeShapeState, getMainWindow: () => managerState.mainWindow, getPlatform: () => process.platform,
    getIsAgentDesktopExecutionActive: () => isAgentDesktopExecutionActive,
    getInputProxyRegionCount: () => managerState.postDragInputProxyRegions.length,
    isFullWindowInteractiveShape, isPetDragFullWindowShapeRetained: () => isPetDragFullWindowShapeRetained(),
    summarizeInteractiveRegion, logWindowEvent, pointerDiagnosticsEnabled,
    USE_SEPARATE_RENDER_AND_INPUT_WINDOWS, MAIN_INTERACTIVE_LAYER_WARMUP_REGION, MAIN_INTERACTIVE_LAYER_WARMUP_RESTORE_DELAY_MS,
    setTimeout: (callback, delay) => setTimeout(callback, delay),
  });

  const {
    getCompactWindowBounds, getSettingsWindowBounds, getSettingsPanelWindowBounds, getChatPanelWindowBounds,
    isInteractiveDialogueChatActive, getResolvedChatPanelWindowLimits, getResolvedChatPanelWindowBounds, getBrowserWindowIconOptions,
    resolveTrayIcon, getIsSettingsWindowOpen, getIsChatWindowOpen, notifySettingsWindowState,
    notifyChatWindowState, broadcastSharedState, broadcastRuntimeWorldPresentationIntent,
  } = createWindowResourceMessagingControllers({
    captureService, screen, getSharedState, nativeImage,
    path, processRef: process, baseDirectory: __dirname, SETTINGS_PANEL_WINDOW_BOUNDS,
    CHAT_PANEL_WINDOW_BOUNDS, INTERACTIVE_CHAT_PANEL_WINDOW_BOUNDS, INTERACTIVE_CHAT_PANEL_CENTER_Y_RATIO, managerState,
  });
  const {
    scheduleKeepWindowOnTop, keepAuxWindowsOnTop, keepAreaPickerOnTop, keepPersistentAreaBorderOnTop,
    keepWindowStackOnTop, scheduleWindowStackOnTop, resizeWindowForSettings, resizeWindowAroundCurrentCenter,
    startMainTopmostGuard, stopMainTopmostGuard,
  } = createWindowManagerPlacementControllers({
    managerState, areaPickerService, keepWindowOnTop,
    MAIN_TOPMOST_RELATIVE_LEVEL, POST_DRAG_INPUT_PROXY_TOPMOST_RELATIVE_LEVEL,
    AUX_TOPMOST_RELATIVE_LEVEL, AREA_PICKER_TOPMOST_RELATIVE_LEVEL,
    PERSISTENT_AREA_BORDER_TOPMOST_RELATIVE_LEVEL, AREA_PICKER_TOPMOST_WINDOW_LEVEL,
    getSettingsWindowBounds, getCompactWindowBounds, captureService, TOPMOST_GUARD_INTERVAL_MS,
    setTimeout: (callback, delay) => setTimeout(callback, delay),
    setInterval: (callback, delay) => setInterval(callback, delay), clearInterval: (timer) => clearInterval(timer),
  });
  const {
    clearMainInteractiveLayerWarmupTimers, scheduleMainInteractiveLayerWarmup, showMainWindow,
    closeSettingsWindow, openSettingsWindow, configureTray,
  } = createWindowPresentationTrayControllers({
    managerState, getPlatform: () => process.platform, PREWARM_MAIN_INTERACTIVE_LAYER, warmMainInteractiveLayer,
    MAIN_INTERACTIVE_LAYER_WARMUP_DELAY_MS, setTimeout: (callback, delay) => setTimeout(callback, delay), clearTimeout: (timer) => clearTimeout(timer), scheduleKeepWindowOnTop,
    MAIN_TOPMOST_RELATIVE_LEVEL, scheduleWindowStackOnTop, ensureSettingsWindowReady: () => ensureSettingsWindowReady(), showSettingsWindow: () => showSettingsWindow(),
    reportOpenSettingsError: (error) => console.error('Failed to open settings window:', error), windowOwnershipState, Menu, app,
    hideMainWindow,
  });
  const {
    postDragInputProxyState, clearPostDragInputProxyIdleDestroyTimer, hidePostDragInputProxy,
    applyPostDragInputProxyRegions, ensurePostDragInputProxyWindow,
  } = createPostDragInputProxyStateLifecycle({
    managerState,
    BrowserWindow, path, baseDirectory: __dirname, sessionPartition,
    disableDwmSystemBorderForWindow, keepWindowOnTop, logWindowEvent, pointerDiagnosticsEnabled,
    createInteractiveRegionsSignature, summarizeInteractiveRegion,
    TOPMOST_WINDOW_LEVEL, POST_DRAG_INPUT_PROXY_TOPMOST_RELATIVE_LEVEL, POST_DRAG_INPUT_PROXY_IDLE_DESTROY_MS,
    setTimeout: (callback, delay) => setTimeout(callback, delay), clearTimeout: (timer) => clearTimeout(timer),
  });
  const interactiveShapeState = createInteractiveShapeStateAdapter(managerState);
  const { isPetDragFullWindowShapeRetained, forwardPostDragInputProxyEvent, setInteractiveRegions, setPetDragNativeShapeActive }
    = createInteractiveShapeControllers({
    shapeState: interactiveShapeState, proxyState: postDragInputProxyState,
    getMainWindow: () => managerState.mainWindow, getCurrentTime: () => Date.now(),
    getPetDragNativeShapeActive: () => managerState.petDragNativeShapeActive,
    isFullWindowInteractiveShape, createFullWindowInteractiveRegion,
    createInteractiveRegionsSignature, normalizeInteractiveRegions, normalizeInteractiveRegionSource,
    summarizeInteractiveRegion, canApplyInteractiveWindowShape, applyInteractiveWindowShape,
    applyPointerPassthroughState, hidePostDragInputProxy, logWindowEvent, pointerDiagnosticsEnabled,
    ensurePostDragInputProxyWindow, applyPostDragInputProxyRegions, USE_SEPARATE_RENDER_AND_INPUT_WINDOWS,
    PET_DRAG_FULL_WINDOW_SHAPE_HOLD_MS, setTimeout: (callback, delay) => setTimeout(callback, delay),
    clearTimeout: (timer) => clearTimeout(timer),
  });
  const setWindowPointerPassthrough = createWindowStatePointerPassthroughRequester({
    managerState, nativeShapeState,
    isPetDragFullWindowShapeRetained, pointerDiagnosticsEnabled, logWindowEvent, applyPointerPassthroughState,
  });
  const { isSettingsWindowAtSettingsPanelUrl, loadRenderer } = createWindowManagerRendererNavigation({
    isDev, path, baseDirectory: __dirname, logWindowEvent,
    localTestQueryValues, pointerDiagnosticsEnabled, forceFullShapeOnDragEnabled, live2DDragProbeEnabled,
  });
  const { scheduleSettingsWindowDisplayRefresh, scheduleSettingsWindowContentRefresh, showSettingsWindow }
    = createSettingsStatePresentationControllers({
    managerState, setTimeout: (callback, delay) => setTimeout(callback, delay), clearTimeout: (timer) => clearTimeout(timer), captureService,
    SETTINGS_WINDOW_SHOW_DISPLAY_REFRESH_DELAY_MS, getCurrentTime: () => Date.now(), SETTINGS_WINDOW_CONTENT_REFRESH_COOLDOWN_MS,
    refreshSettingsWindowContent: (force) => refreshSettingsWindowContent(force), getSettingsPanelWindowBounds, isSettingsWindowAtSettingsPanelUrl,
    logWindowEvent, loadRenderer, HIDE_MAIN_WINDOW_FOR_GRAPH_DIAGNOSTICS,
    scheduleKeepWindowOnTop, AUX_TOPMOST_RELATIVE_LEVEL, scheduleWindowStackOnTop,
    notifySettingsWindowState,
  });
  const {
    showMainWindowWhenReady, markMainWindowReadyToShow, recoverMainWindowRenderer,
    scheduleMainWindowRendererReadyFallback, showOrRecoverMainWindow, createWindow,
  } = createMainWindowLifecycleControllers({
    managerState, logWindowEvent, showMainWindow, hidePostDragInputProxy,
    createWindowForRecovery: () => createWindow(), createWindowForHealth: () => createWindow(), setTimeout: (callback, delay) => setTimeout(callback, delay), clearTimeout: (timer) => clearTimeout(timer),
    MAIN_WINDOW_RENDERER_READY_TIMEOUT_MS, MAIN_WINDOW_RENDERER_STARTUP_RECOVERY_LIMIT, MAIN_WINDOW_RENDERER_HEALTH_TIMEOUT_MS, pointerDiagnosticsEnabled,
    hideMainWindow, applyPostDragInputProxyRegions, scheduleWindowStackOnTop, openExternalSafely,
    shell, notifySettingsWindowState, notifyChatWindowState, broadcastSharedState,
    captureService, getShellRendererWindows, COMPACT_WINDOW_BOUNDS, getBrowserWindowIconOptions,
    path, baseDirectory: __dirname, sessionPartition, windowOwnershipState,
    BrowserWindow, attachLoadLogging, resizeWindowForSettings, startMainTopmostGuard,
    setWindowPointerPassthrough, USE_SEPARATE_RENDER_AND_INPUT_WINDOWS, ensurePostDragInputProxyWindow, isDev,
    getOpenDevTools: () => process.env.DESKTOP_PET_OPEN_DEVTOOLS, loadRenderer,
  });
  const {
    closeChatWindow, openChatWindow, syncInteractiveChatWindowBounds,
    ensureSettingsWindowReady, preloadSettingsWindow, refreshSettingsWindowContent,
  } = createAuxiliaryWindowContentControllers({
    windowOwnershipState, getBrowserWindowIconOptions, path, baseDirectory: __dirname,
    sessionPartition, isCurrentWindowCompactMinimumSizeActive, getResolvedChatPanelWindowLimits, isInteractiveDialogueChatActive,
    getResolvedChatPanelWindowBounds, scheduleKeepWindowOnTop, AUX_TOPMOST_RELATIVE_LEVEL, scheduleWindowStackOnTop,
    notifyChatWindowState, broadcastSharedState, openExternalSafely, shell,
    getChatPanelWindowBounds, BrowserWindow, attachLoadLogging, loadRenderer,
    scheduleSettingsWindowContentRefresh, disableDwmSystemBorderForWindow, notifySettingsWindowState, HIDE_MAIN_WINDOW_FOR_GRAPH_DIAGNOSTICS,
    showMainWindowWhenReady, SETTINGS_PANEL_WINDOW_BOUNDS, getSettingsPanelWindowBounds, logWindowEvent,
    waitForSettingsWindowLoad, captureService, scheduleSettingsWindowDisplayRefresh, getShellRendererWindows,
    DISPLAY_ENVIRONMENT_BROADCAST_DELAY_MS, SETTINGS_WINDOW_SHOW_CAPTURE_REFRESH_DELAY_MS,
  });

const setAgentDesktopExecutionActive = createAgentDesktopExecutionPolicy({
    getIsActive: () => isAgentDesktopExecutionActive,
    setIsActive: (active) => { isAgentDesktopExecutionActive = active; },
    getMainWindow: () => managerState.mainWindow, getChatWindow: () => managerState.chatWindow, getSettingsWindow: () => managerState.settingsWindow,
    topmostStateByWindow: managerState.topmostStateByWindow, applyInteractiveWindowShape, applyPointerPassthroughState,
    keepWindowOnTop, keepAuxWindowsOnTop, MAIN_TOPMOST_RELATIVE_LEVEL,
  });

  const dispose = createWindowManagerStateDisposer({
    managerState, stopMainTopmostGuard, clearMainInteractiveLayerWarmupTimers,
    clearPostDragInputProxyIdleDestroyTimer, hidePostDragInputProxy,
    clearTimeout: (timer) => clearTimeout(timer),
  });

  return {
    ...createWindowManagerWindowApi({
      broadcastSharedState, broadcastRuntimeWorldPresentationIntent, closeChatWindow, closeSettingsWindow,
      createWindow, createTray, dispose, getChatWindow,
      getIsChatWindowOpen, getIsSettingsWindowOpen, getMainWindow, getSettingsWindow,
      getSharedState, getShellRendererWindows, managerState, hideMainWindow,
      keepWindowOnTop, markMainWindowReadyToShow, notifyChatWindowState, notifySettingsWindowState,
      openChatWindow, openSettingsWindow, preloadSettingsWindow, recoverMainWindowRenderer,
      resizeWindowForSettings, scheduleKeepWindowOnTop,
    }),
    setAgentDesktopExecutionActive,
    ...createWindowManagerInteractionApi({
      scheduleSettingsWindowContentRefresh, scheduleWindowStackOnTop, setInteractiveRegions, setPetDragNativeShapeActive,
      forwardPostDragInputProxyEvent, setWindowPointerPassthrough, setQuitting, setSettingsOpen,
      setSharedState, showOrRecoverMainWindow, showMainWindow, showSettingsWindow,
      startMainTopmostGuard, stopMainTopmostGuard,
    }),
  };
}

module.exports = {
  AREA_PICKER_TOPMOST_RELATIVE_LEVEL,
  AUX_TOPMOST_RELATIVE_LEVEL,
  MAIN_TOPMOST_RELATIVE_LEVEL,
  PERSISTENT_AREA_BORDER_TOPMOST_RELATIVE_LEVEL,
  TOPMOST_WINDOW_LEVEL,
  createWindowManager,
};
