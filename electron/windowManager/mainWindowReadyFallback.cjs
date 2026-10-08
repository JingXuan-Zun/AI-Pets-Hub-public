function createMainWindowReadyFallbackScheduler({
  getReadyFallbackTimer, setReadyFallbackTimer, getRendererReadyToShow,
  getRendererRecoveryInProgress, getMainWindow, getStartupRecoveryCount,
  incrementStartupRecoveryCount, logWindowEvent, recoverMainWindowRenderer,
  markMainWindowReadyToShow, setTimeout, clearTimeout,
  MAIN_WINDOW_RENDERER_READY_TIMEOUT_MS, MAIN_WINDOW_RENDERER_STARTUP_RECOVERY_LIMIT,
}) {
  function scheduleMainWindowRendererReadyFallback() {
    if (getReadyFallbackTimer()) {
      clearTimeout(getReadyFallbackTimer());
      setReadyFallbackTimer(null);
    }
    setReadyFallbackTimer(setTimeout(() => {
      setReadyFallbackTimer(null);
      if (!getRendererReadyToShow()
        && !getRendererRecoveryInProgress()
        && getMainWindow()
        && !getMainWindow().isDestroyed()
        && getStartupRecoveryCount() < MAIN_WINDOW_RENDERER_STARTUP_RECOVERY_LIMIT) {
        incrementStartupRecoveryCount();
        logWindowEvent(`main-window: renderer ready timeout recovery=${getStartupRecoveryCount()}`);
        recoverMainWindowRenderer(getMainWindow().webContents, { reason: 'renderer-ready-timeout' });
        return;
      }
      markMainWindowReadyToShow('renderer-ready-timeout-exhausted');
    }, MAIN_WINDOW_RENDERER_READY_TIMEOUT_MS));
    if (typeof getReadyFallbackTimer().unref === 'function') {
      getReadyFallbackTimer().unref();
    }
  }
  return scheduleMainWindowRendererReadyFallback;
}
module.exports = { createMainWindowReadyFallbackScheduler };
