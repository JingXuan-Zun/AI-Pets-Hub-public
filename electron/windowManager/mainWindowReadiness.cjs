function createMainWindowReadinessGate({
  getMainWindow, getCanShow, getRendererReadyToShow, setRendererReadyToShow,
  resetStartupRecoveryCount, getReadyFallbackTimer, setReadyFallbackTimer,
  logWindowEvent, clearTimeout, showMainWindow,
}) {
  function showMainWindowWhenReady(reason) {
    if (!getMainWindow() || getMainWindow().isDestroyed()) {
      return;
    }

    if (!getCanShow() || !getRendererReadyToShow()) {
      logWindowEvent(
        `main-window: waiting to show reason=${reason} `
        + `electronReady=${getCanShow()} rendererReady=${getRendererReadyToShow()}`,
      );
      return;
    }

    showMainWindow();
  }

  function markMainWindowReadyToShow(reason = 'renderer') {
    if (!getMainWindow() || getMainWindow().isDestroyed()) {
      return;
    }

    if (!getRendererReadyToShow()) {
      setRendererReadyToShow(true);
      resetStartupRecoveryCount();
      logWindowEvent(`main-window: renderer ready to show reason=${reason}`);
    }

    if (getReadyFallbackTimer()) {
      clearTimeout(getReadyFallbackTimer());
      setReadyFallbackTimer(null);
    }

    showMainWindowWhenReady(reason);
  }

  return { showMainWindowWhenReady, markMainWindowReadyToShow };
}
module.exports = { createMainWindowReadinessGate };
