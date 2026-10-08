const { createMainInteractiveWarmupTimers } = require('./mainInteractiveWarmupTimers.cjs');
const { createMainInteractiveWarmupTimerStateAdapter } = require('./mainWindowLifecycleStateAdapters.cjs');

function createMainWindowPresenter({
  getMainWindow, getReadyFallbackTimer, setReadyFallbackTimer, clearTimeout,
  scheduleKeepWindowOnTop, MAIN_TOPMOST_RELATIVE_LEVEL,
  scheduleWindowStackOnTop, scheduleMainInteractiveLayerWarmup,
}) {
  function showMainWindow() {
    if (!getMainWindow() || getMainWindow().isDestroyed()) {
      return;
    }

    if (getReadyFallbackTimer()) {
      clearTimeout(getReadyFallbackTimer());
      setReadyFallbackTimer(null);
    }

    if (typeof getMainWindow().showInactive === 'function') {
      getMainWindow().showInactive();
    } else {
      getMainWindow().show();
    }
    if (getMainWindow().isMinimized()) {
      getMainWindow().restore();
    }
    scheduleKeepWindowOnTop(getMainWindow(), MAIN_TOPMOST_RELATIVE_LEVEL, { bringToFront: true });
    scheduleWindowStackOnTop();
    scheduleMainInteractiveLayerWarmup();
  }
  return showMainWindow;
}

function createMainWindowPresentationControllers({
  managerState, getPlatform, PREWARM_MAIN_INTERACTIVE_LAYER,
  warmMainInteractiveLayer, MAIN_INTERACTIVE_LAYER_WARMUP_DELAY_MS, setTimeout, clearTimeout,
  scheduleKeepWindowOnTop, MAIN_TOPMOST_RELATIVE_LEVEL, scheduleWindowStackOnTop,
}) {
  const { clearMainInteractiveLayerWarmupTimers, scheduleMainInteractiveLayerWarmup } = createMainInteractiveWarmupTimers({
    getPlatform, PREWARM_MAIN_INTERACTIVE_LAYER,
    ...createMainInteractiveWarmupTimerStateAdapter(managerState),
    warmMainInteractiveLayer, MAIN_INTERACTIVE_LAYER_WARMUP_DELAY_MS,
    setTimeout, clearTimeout,
  });
  const showMainWindow = createMainWindowPresenter({
    getMainWindow: () => managerState.mainWindow,
    getReadyFallbackTimer: () => managerState.mainWindowRendererReadyFallbackTimer,
    setReadyFallbackTimer: (timer) => { managerState.mainWindowRendererReadyFallbackTimer = timer; },
    clearTimeout,
    scheduleKeepWindowOnTop, MAIN_TOPMOST_RELATIVE_LEVEL,
    scheduleWindowStackOnTop, scheduleMainInteractiveLayerWarmup,
  });
  return { clearMainInteractiveLayerWarmupTimers, scheduleMainInteractiveLayerWarmup, showMainWindow };
}

module.exports = { createMainWindowPresenter, createMainWindowPresentationControllers };
