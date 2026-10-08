const { createMainWindowReadinessStateAdapter, createMainWindowRecoveryStateAdapter } = require('./mainWindowLifecycleStateAdapters.cjs');
const { createMainWindowReadinessGate } = require('./mainWindowReadiness.cjs');
const { createMainWindowRecreator, createMainWindowRendererRecovery } = require('./mainWindowRecovery.cjs');
const { createMainWindowReadyFallbackScheduler } = require('./mainWindowReadyFallback.cjs');
const { createMainWindowHealthPresenter } = require('./mainWindowHealth.cjs');

function createMainWindowRecoveryCycle(dependencies, markMainWindowReadyToShow) {
  const {
    getIsQuitting, getMainWindow, clearMainWindow, logWindowEvent, hidePostDragInputProxy, createWindowForRecovery: createWindow,
    getRendererRecoveryInProgress, setRendererRecoveryInProgress, setRendererReadyToShow, markMainWindowCanShow,
    getReadyFallbackTimer, setReadyFallbackTimer, getRendererReadyToShow,
    getStartupRecoveryCount, incrementStartupRecoveryCount, setTimeout, clearTimeout,
    MAIN_WINDOW_RENDERER_READY_TIMEOUT_MS, MAIN_WINDOW_RENDERER_STARTUP_RECOVERY_LIMIT,
  } = dependencies;
  const recreateMainWindow = createMainWindowRecreator({
    getIsQuitting, getMainWindow, clearMainWindow, logWindowEvent, hidePostDragInputProxy, createWindow,
  });
  const recoverMainWindowRenderer = createMainWindowRendererRecovery({
    getIsQuitting, getMainWindow, getRendererRecoveryInProgress, setRendererRecoveryInProgress,
    setRendererReadyToShow, markMainWindowCanShow, logWindowEvent, hidePostDragInputProxy, recreateMainWindow,
    scheduleMainWindowRendererReadyFallback: () => scheduleMainWindowRendererReadyFallback(),
  });
  const scheduleMainWindowRendererReadyFallback = createMainWindowReadyFallbackScheduler({
    getReadyFallbackTimer, setReadyFallbackTimer, getRendererReadyToShow, getRendererRecoveryInProgress,
    getMainWindow, getStartupRecoveryCount, incrementStartupRecoveryCount,
    logWindowEvent, recoverMainWindowRenderer, markMainWindowReadyToShow, setTimeout, clearTimeout,
    MAIN_WINDOW_RENDERER_READY_TIMEOUT_MS, MAIN_WINDOW_RENDERER_STARTUP_RECOVERY_LIMIT,
  });
  return { recreateMainWindow, recoverMainWindowRenderer, scheduleMainWindowRendererReadyFallback };
}

function createMainWindowRecoveryControllers(dependencies) {
  const {
    getMainWindow, getCanShow, getRendererReadyToShow, setRendererReadyToShow, resetStartupRecoveryCount,
    getReadyFallbackTimer, setReadyFallbackTimer, logWindowEvent, clearTimeout, showMainWindow,
    getRendererRecoveryInProgress, createWindowForHealth: createWindow, setTimeout, MAIN_WINDOW_RENDERER_HEALTH_TIMEOUT_MS,
  } = dependencies;
  const { showMainWindowWhenReady, markMainWindowReadyToShow } = createMainWindowReadinessGate({
    getMainWindow, getCanShow, getRendererReadyToShow, setRendererReadyToShow, resetStartupRecoveryCount,
    getReadyFallbackTimer, setReadyFallbackTimer, logWindowEvent, clearTimeout, showMainWindow,
  });
  const { recreateMainWindow, recoverMainWindowRenderer, scheduleMainWindowRendererReadyFallback }
    = createMainWindowRecoveryCycle(dependencies, markMainWindowReadyToShow);
  const showOrRecoverMainWindow = createMainWindowHealthPresenter({
    getMainWindow, getRendererRecoveryInProgress,
    createWindow, recreateMainWindow, showMainWindowWhenReady, showMainWindow,
    logWindowEvent, recoverMainWindowRenderer, setTimeout, clearTimeout, MAIN_WINDOW_RENDERER_HEALTH_TIMEOUT_MS,
  });
  return {
    showMainWindowWhenReady, markMainWindowReadyToShow, recoverMainWindowRenderer,
    scheduleMainWindowRendererReadyFallback, showOrRecoverMainWindow,
  };
}

function createMainWindowStateRecoveryControllers({
  managerState, logWindowEvent, showMainWindow, hidePostDragInputProxy,
  createWindowForRecovery, createWindowForHealth, setTimeout, clearTimeout,
  MAIN_WINDOW_RENDERER_READY_TIMEOUT_MS, MAIN_WINDOW_RENDERER_STARTUP_RECOVERY_LIMIT, MAIN_WINDOW_RENDERER_HEALTH_TIMEOUT_MS,
}) {
  return createMainWindowRecoveryControllers({
    ...createMainWindowReadinessStateAdapter(managerState),
    logWindowEvent, showMainWindow,
    getIsQuitting: () => managerState.isQuitting,
    clearMainWindow: () => { managerState.mainWindow = null; },
    hidePostDragInputProxy, createWindowForRecovery,
    createWindowForHealth,
    ...createMainWindowRecoveryStateAdapter(managerState),
    setTimeout,
    clearTimeout,
    MAIN_WINDOW_RENDERER_READY_TIMEOUT_MS, MAIN_WINDOW_RENDERER_STARTUP_RECOVERY_LIMIT,
    MAIN_WINDOW_RENDERER_HEALTH_TIMEOUT_MS,
  });
}

module.exports = { createMainWindowRecoveryControllers, createMainWindowStateRecoveryControllers };
