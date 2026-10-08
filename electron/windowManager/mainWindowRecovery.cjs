function createMainWindowRecreator({
  getIsQuitting, getMainWindow, clearMainWindow, logWindowEvent,
  hidePostDragInputProxy, createWindow,
}) {
  function recreateMainWindow(reason) {
    if (getIsQuitting()) {
      return false;
    }
    logWindowEvent(`main-window: recreate reason=${reason}`);
    hidePostDragInputProxy('main-renderer-recovery', true);
    if (getMainWindow() && !getMainWindow().isDestroyed()) {
      getMainWindow().destroy();
    }
    clearMainWindow();
    createWindow();
    return true;
  }
  return recreateMainWindow;
}

function createMainWindowRendererRecovery({
  getIsQuitting, getMainWindow, getRendererRecoveryInProgress, setRendererRecoveryInProgress,
  setRendererReadyToShow, markMainWindowCanShow, logWindowEvent, hidePostDragInputProxy,
  scheduleMainWindowRendererReadyFallback, recreateMainWindow,
}) {
  function recoverMainWindowRenderer(webContents, details = {}) {
    if (getIsQuitting() || !getMainWindow() || getMainWindow().isDestroyed()
      || getMainWindow().webContents !== webContents || getRendererRecoveryInProgress()) {
      return false;
    }
    const reason = String(details?.reason || 'unknown');
    if (reason === 'clean-exit') {
      return false;
    }
    if (webContents.isDestroyed?.()) {
      return recreateMainWindow(`${reason}-web-contents-destroyed`);
    }
    setRendererRecoveryInProgress(true);
    logWindowEvent(`main-window: renderer recovery begin reason=${reason}`);
    hidePostDragInputProxy('main-renderer-recovery', true);
    getMainWindow().hide();
    setRendererReadyToShow(false);
    markMainWindowCanShow();
    scheduleMainWindowRendererReadyFallback();

    let recoveryFinished = false;
    const finishRecovery = (result) => {
      if (recoveryFinished) {
        return;
      }
      recoveryFinished = true;
      setRendererRecoveryInProgress(false);
      logWindowEvent(`main-window: renderer recovery ${result} reason=${reason}`);
    };
    getMainWindow().webContents.once('did-finish-load', () => finishRecovery('loaded'));
    getMainWindow().webContents.once('did-fail-load', () => finishRecovery('load-failed'));
    try {
      getMainWindow().webContents.reloadIgnoringCache();
      return true;
    } catch (error) {
      finishRecovery('reload-failed');
      logWindowEvent(`main-window: renderer recovery error=${error?.stack || error}`);
      return recreateMainWindow(`${reason}-reload-failed`);
    }
  }
  return recoverMainWindowRenderer;
}
module.exports = { createMainWindowRecreator, createMainWindowRendererRecovery };
