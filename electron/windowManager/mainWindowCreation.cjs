function createMainWindowCreator({
  getMainWindow, setMainWindow, setCanShow, setRendererRecoveryInProgress, setRendererReadyToShow, showOrRecoverMainWindow,
  BrowserWindow, buildMainWindowOptions, attachLoadLogging, scheduleWindowStackOnTop, resizeWindowForSettings,
  startMainTopmostGuard, setWindowPointerPassthrough, USE_SEPARATE_RENDER_AND_INPUT_WINDOWS, ensurePostDragInputProxyWindow,
  applyPostDragInputProxyRegions, scheduleMainWindowRendererReadyFallback, attachMainWindowLoadEvents,
  attachMainWindowPresentationEvents, isDev, getOpenDevTools, loadRenderer,
}) {
  function createWindow() {
    if (getMainWindow() && !getMainWindow().isDestroyed()) {
      void showOrRecoverMainWindow('create-existing-window');
      return;
    }

    setCanShow(false);
    setRendererRecoveryInProgress(false);
    setRendererReadyToShow(false);

    setMainWindow(new BrowserWindow(buildMainWindowOptions()));
    attachLoadLogging(getMainWindow(), 'main-window');

    scheduleWindowStackOnTop();
    resizeWindowForSettings(false);
    scheduleWindowStackOnTop();
    startMainTopmostGuard();
    setWindowPointerPassthrough(true);
    if (USE_SEPARATE_RENDER_AND_INPUT_WINDOWS) {
      ensurePostDragInputProxyWindow();
      getMainWindow().on('move', () => applyPostDragInputProxyRegions());
      getMainWindow().on('resize', () => applyPostDragInputProxyRegions());
    }
    scheduleMainWindowRendererReadyFallback();

    attachMainWindowLoadEvents();

    attachMainWindowPresentationEvents();

    if (isDev && getOpenDevTools() === '1') {
      getMainWindow().webContents.openDevTools({ mode: 'detach' });
    }

    loadRenderer(getMainWindow());
  }

  return createWindow;
}

module.exports = { createMainWindowCreator };
