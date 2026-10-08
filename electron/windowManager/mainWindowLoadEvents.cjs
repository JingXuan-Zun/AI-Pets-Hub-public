function createMainWindowLoadEventRegistrar({
  getMainWindow, markMainWindowCanShow, getRendererRecoveryInProgress,
  showMainWindowWhenReady, openExternalSafely, shell,
  notifySettingsWindowState, notifyChatWindowState, broadcastSharedState,
  scheduleWindowStackOnTop, captureService, getShellRendererWindows,
  logWindowEvent, recoverMainWindowRenderer,
}) {
  return function attachMainWindowLoadEvents() {
    getMainWindow().once('ready-to-show', () => {
      if (!getMainWindow() || getMainWindow().isDestroyed()) {
        return;
      }
      markMainWindowCanShow();
      showMainWindowWhenReady('ready-to-show');
    });
    getMainWindow().webContents.setWindowOpenHandler(({ url }) => {
      void openExternalSafely(shell, url);
      return { action: 'deny' };
    });
    getMainWindow().webContents.once('did-finish-load', () => {
      if (getMainWindow() && !getMainWindow().isDestroyed() && !getMainWindow().isVisible()) {
        markMainWindowCanShow();
        showMainWindowWhenReady('did-finish-load');
      }
      notifySettingsWindowState();
      notifyChatWindowState();
      broadcastSharedState();
      scheduleWindowStackOnTop();
      captureService.scheduleDisplayEnvironmentBroadcast({
        includeCaptureSources: false,
        windows: getShellRendererWindows(),
      });
    });
    getMainWindow().webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame || errorCode === -3 || getRendererRecoveryInProgress()) {
        return;
      }
      logWindowEvent(`main-window: initial load failed code=${errorCode} url=${validatedURL} error=${errorDescription}`);
      recoverMainWindowRenderer(getMainWindow().webContents, { reason: `initial-load-failed-${errorCode}` });
    });
  };
}
module.exports = { createMainWindowLoadEventRegistrar };
