function createMainInteractiveWarmupStateAdapter(managerState) {
  return {
    getCompleted: () => managerState.mainInteractiveLayerWarmupCompleted,
    setCompleted: (completed) => { managerState.mainInteractiveLayerWarmupCompleted = completed; },
    setWarmupTimer: (timer) => { managerState.mainInteractiveLayerWarmupTimer = timer; },
    getRestoreTimer: () => managerState.mainInteractiveLayerWarmupRestoreTimer,
    setRestoreTimer: (timer) => { managerState.mainInteractiveLayerWarmupRestoreTimer = timer; },
  };
}

function createMainInteractiveWarmupTimerStateAdapter(managerState) {
  return {
    getWarmupCompleted: () => managerState.mainInteractiveLayerWarmupCompleted,
    getWarmupTimer: () => managerState.mainInteractiveLayerWarmupTimer,
    setWarmupTimer: (timer) => { managerState.mainInteractiveLayerWarmupTimer = timer; },
    getRestoreTimer: () => managerState.mainInteractiveLayerWarmupRestoreTimer,
    setRestoreTimer: (timer) => { managerState.mainInteractiveLayerWarmupRestoreTimer = timer; },
  };
}

function createMainWindowReadinessStateAdapter(managerState) {
  return {
    getMainWindow: () => managerState.mainWindow,
    getCanShow: () => managerState.mainWindowCanShow,
    getRendererReadyToShow: () => managerState.mainWindowRendererReadyToShow,
    setRendererReadyToShow: (ready) => { managerState.mainWindowRendererReadyToShow = ready; },
    resetStartupRecoveryCount: () => { managerState.mainWindowRendererStartupRecoveryCount = 0; },
    getReadyFallbackTimer: () => managerState.mainWindowRendererReadyFallbackTimer,
    setReadyFallbackTimer: (timer) => { managerState.mainWindowRendererReadyFallbackTimer = timer; },
  };
}

function createMainWindowRecoveryStateAdapter(managerState) {
  return {
    getRendererRecoveryInProgress: () => managerState.mainWindowRendererRecoveryInProgress,
    setRendererRecoveryInProgress: (active) => { managerState.mainWindowRendererRecoveryInProgress = active; },
    markMainWindowCanShow: () => { managerState.mainWindowCanShow = true; },
    getStartupRecoveryCount: () => managerState.mainWindowRendererStartupRecoveryCount,
    incrementStartupRecoveryCount: () => { managerState.mainWindowRendererStartupRecoveryCount += 1; },
  };
}

module.exports = {
  createMainInteractiveWarmupStateAdapter,
  createMainInteractiveWarmupTimerStateAdapter,
  createMainWindowReadinessStateAdapter,
  createMainWindowRecoveryStateAdapter,
};
