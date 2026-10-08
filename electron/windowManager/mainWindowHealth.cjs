function createMainWindowHealthPresenter({
  getMainWindow, getRendererRecoveryInProgress, createWindow, recreateMainWindow,
  showMainWindowWhenReady, showMainWindow, logWindowEvent, recoverMainWindowRenderer,
  setTimeout, clearTimeout, MAIN_WINDOW_RENDERER_HEALTH_TIMEOUT_MS,
}) {
  async function showOrRecoverMainWindow(reason = 'manual') {
    if (!getMainWindow() || getMainWindow().isDestroyed()) {
      createWindow();
      return 'created';
    }
    const activeWebContents = getMainWindow().webContents;
    if (!activeWebContents || activeWebContents.isDestroyed()) {
      recreateMainWindow(`${reason}-web-contents-unavailable`);
      return 'recreated';
    }
    if (getRendererRecoveryInProgress() || activeWebContents.isLoadingMainFrame?.()) {
      showMainWindowWhenReady(`${reason}-loading`);
      return 'loading';
    }
    let healthTimeout = null;
    try {
      await Promise.race([
        activeWebContents.executeJavaScript('document.readyState', true),
        new Promise((_, reject) => {
          healthTimeout = setTimeout(
            () => reject(new Error('main renderer health check timed out')),
            MAIN_WINDOW_RENDERER_HEALTH_TIMEOUT_MS,
          );
        }),
      ]);
      showMainWindow();
      return 'shown';
    } catch (error) {
      logWindowEvent(`main-window: renderer health check failed reason=${reason} error=${error?.message || error}`);
      recoverMainWindowRenderer(activeWebContents, { reason: `${reason}-unresponsive` });
      return 'recovering';
    } finally {
      if (healthTimeout) {
        clearTimeout(healthTimeout);
      }
    }
  }
  return showOrRecoverMainWindow;
}
module.exports = { createMainWindowHealthPresenter };
