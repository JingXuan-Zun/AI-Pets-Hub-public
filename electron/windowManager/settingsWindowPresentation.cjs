function createSettingsWindowGeometryPreparer({ getSettingsWindow, getSettingsPanelWindowBounds }) {
  return function prepareSettingsWindowGeometry() {
    const nextBounds = getSettingsPanelWindowBounds();
    const currentBounds = getSettingsWindow().getBounds();
    if (
      currentBounds.x !== nextBounds.x
      || currentBounds.y !== nextBounds.y
      || currentBounds.width !== nextBounds.width
      || currentBounds.height !== nextBounds.height
    ) {
      getSettingsWindow().setBounds(nextBounds);
    }
    if (getSettingsWindow().isMinimized()) {
      getSettingsWindow().restore();
    }
  };
}

function createSettingsWindowPresenter({
  getSettingsWindow,
  getMainWindow,
  getSettingsPanelWindowBounds,
  isSettingsWindowAtSettingsPanelUrl,
  logWindowEvent,
  loadRenderer,
  HIDE_MAIN_WINDOW_FOR_GRAPH_DIAGNOSTICS,
  scheduleKeepWindowOnTop,
  AUX_TOPMOST_RELATIVE_LEVEL,
  scheduleWindowStackOnTop,
  notifySettingsWindowState,
  scheduleSettingsWindowContentRefresh,
}) {
  const prepareSettingsWindowGeometry = createSettingsWindowGeometryPreparer({
    getSettingsWindow, getSettingsPanelWindowBounds,
  });

  function showSettingsWindow() {
    if (!getSettingsWindow() || getSettingsWindow().isDestroyed()) {
      return;
    }

    const wasVisible = getSettingsWindow().isVisible();
    prepareSettingsWindowGeometry();

    const reloadedSettingsContent = !getSettingsWindow().webContents.isLoadingMainFrame()
      && !isSettingsWindowAtSettingsPanelUrl(getSettingsWindow());
    if (reloadedSettingsContent) {
      logWindowEvent(`settings-window: reloading unexpected URL ${getSettingsWindow().webContents.getURL() || '<empty>'}`);
      loadRenderer(getSettingsWindow(), { desktop: '1', panel: 'settings' });
    }

    getSettingsWindow().show();
    getSettingsWindow().focus();
    if (HIDE_MAIN_WINDOW_FOR_GRAPH_DIAGNOSTICS && getMainWindow() && !getMainWindow().isDestroyed()) {
      getMainWindow().hide();
    }
    scheduleKeepWindowOnTop(getSettingsWindow(), AUX_TOPMOST_RELATIVE_LEVEL, { bringToFront: true });
    scheduleWindowStackOnTop();
    notifySettingsWindowState();

    if (wasVisible && !reloadedSettingsContent) {
      scheduleSettingsWindowContentRefresh();
    }
  }

  return showSettingsWindow;
}

module.exports = { createSettingsWindowPresenter };
