function createSettingsRendererEventRegistrar({
  openExternalSafely, shell, getSettingsWindow, broadcastSharedState, scheduleSettingsWindowContentRefresh,
}) {
  function attachSettingsRendererEvents(nextSettingsWindow) {
    nextSettingsWindow.webContents.setWindowOpenHandler(({ url }) => {
      void openExternalSafely(shell, url);
      return { action: 'deny' };
    });

    nextSettingsWindow.webContents.once('did-finish-load', () => {
      if (getSettingsWindow() !== nextSettingsWindow || nextSettingsWindow.isDestroyed()) {
        return;
      }

      broadcastSharedState();

      if (nextSettingsWindow.isVisible()) {
        scheduleSettingsWindowContentRefresh();
      }
    });
  }
  return attachSettingsRendererEvents;
}

function createSettingsVisibilityEventRegistrar({
  disableDwmSystemBorderForWindow, notifySettingsWindowState, broadcastSharedState, scheduleWindowStackOnTop,
  scheduleKeepWindowOnTop, AUX_TOPMOST_RELATIVE_LEVEL, scheduleSettingsWindowContentRefresh,
  HIDE_MAIN_WINDOW_FOR_GRAPH_DIAGNOSTICS, getIsQuitting, showMainWindowWhenReady,
}) {
  return function attachSettingsVisibilityEvents(nextSettingsWindow) {
    nextSettingsWindow.on('show', () => {
      // Reapply after the native window is visible. Windows can create or
      // repaint the DWM edge during the show transition.
      void disableDwmSystemBorderForWindow(nextSettingsWindow);
      notifySettingsWindowState();
      broadcastSharedState();
      scheduleWindowStackOnTop();
      scheduleKeepWindowOnTop(nextSettingsWindow, AUX_TOPMOST_RELATIVE_LEVEL);
      if (!nextSettingsWindow.webContents.isLoadingMainFrame()) {
        scheduleSettingsWindowContentRefresh();
      }
    });

    nextSettingsWindow.on('hide', () => {
      notifySettingsWindowState();
      scheduleWindowStackOnTop();
      if (HIDE_MAIN_WINDOW_FOR_GRAPH_DIAGNOSTICS && !getIsQuitting()) {
        showMainWindowWhenReady('graph-diagnostics-settings-hidden');
      }
    });

    nextSettingsWindow.on('focus', () => scheduleKeepWindowOnTop(nextSettingsWindow, AUX_TOPMOST_RELATIVE_LEVEL));

    nextSettingsWindow.on('restore', () => scheduleKeepWindowOnTop(nextSettingsWindow, AUX_TOPMOST_RELATIVE_LEVEL));

    nextSettingsWindow.on('move', () => scheduleKeepWindowOnTop(nextSettingsWindow, AUX_TOPMOST_RELATIVE_LEVEL));

    nextSettingsWindow.on('resize', () => scheduleKeepWindowOnTop(nextSettingsWindow, AUX_TOPMOST_RELATIVE_LEVEL));
  };
}

function createSettingsWindowEventRegistrar({
  openExternalSafely, shell, getSettingsWindow,
  getIsQuitting, clearSettingsWindow, clearSettingsWindowReadyPromise,
  broadcastSharedState, scheduleSettingsWindowContentRefresh, disableDwmSystemBorderForWindow,
  notifySettingsWindowState, scheduleWindowStackOnTop, scheduleKeepWindowOnTop,
  AUX_TOPMOST_RELATIVE_LEVEL, HIDE_MAIN_WINDOW_FOR_GRAPH_DIAGNOSTICS, showMainWindowWhenReady,
}) {
  const attachSettingsRendererEvents = createSettingsRendererEventRegistrar({
    openExternalSafely, shell, getSettingsWindow, broadcastSharedState, scheduleSettingsWindowContentRefresh,
  });
  const attachSettingsVisibilityEvents = createSettingsVisibilityEventRegistrar({
    disableDwmSystemBorderForWindow, notifySettingsWindowState, broadcastSharedState, scheduleWindowStackOnTop,
    scheduleKeepWindowOnTop, AUX_TOPMOST_RELATIVE_LEVEL, scheduleSettingsWindowContentRefresh,
    HIDE_MAIN_WINDOW_FOR_GRAPH_DIAGNOSTICS, getIsQuitting, showMainWindowWhenReady,
  });

  return function attachSettingsWindowEvents(nextSettingsWindow) {
    attachSettingsRendererEvents(nextSettingsWindow);

    nextSettingsWindow.on('close', (event) => {
      if (getIsQuitting()) {
        return;
      }

      event.preventDefault();
      nextSettingsWindow.hide();
    });

    attachSettingsVisibilityEvents(nextSettingsWindow);

    nextSettingsWindow.on('closed', () => {
      if (getSettingsWindow() === nextSettingsWindow) {
        clearSettingsWindow();
      }
      clearSettingsWindowReadyPromise();
      notifySettingsWindowState();
    });
  };
}

module.exports = { createSettingsWindowEventRegistrar };
