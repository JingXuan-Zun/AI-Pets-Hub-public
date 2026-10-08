function createSettingsWindowCreator({
  getSettingsWindow, setSettingsWindow, getSettingsPanelWindowBounds,
  BrowserWindow, buildSettingsWindowOptions, attachLoadLogging,
  disableDwmSystemBorderForWindow, logWindowEvent,
  scheduleKeepWindowOnTop, AUX_TOPMOST_RELATIVE_LEVEL, attachSettingsWindowEvents, loadRenderer,
}) {
  return function createSettingsWindow() {
    if (getSettingsWindow() && !getSettingsWindow().isDestroyed()) {
      return getSettingsWindow();
    }

    const initialBounds = getSettingsPanelWindowBounds();
    const nextSettingsWindow = new BrowserWindow(buildSettingsWindowOptions(initialBounds));

    setSettingsWindow(nextSettingsWindow);
    attachLoadLogging(nextSettingsWindow, 'settings-window');
    // Windows may draw a separate DWM border around frameless windows, which
    // makes the right and bottom edges darker than the CSS border on the other
    // two sides. Let the panel's own border be the single visible frame.
    void disableDwmSystemBorderForWindow(nextSettingsWindow).then((result) => {
      if (!result.applied) {
        logWindowEvent(
          `settings-window: DWM border disable skipped reason=${result.reason}`,
        );
      }
    });
    scheduleKeepWindowOnTop(nextSettingsWindow, AUX_TOPMOST_RELATIVE_LEVEL);

    attachSettingsWindowEvents(nextSettingsWindow);

    loadRenderer(nextSettingsWindow, { desktop: '1', panel: 'settings' });
    return nextSettingsWindow;
  };
}

function createSettingsWindowReadiness({
  getSettingsWindow, getReadyPromise, setReadyPromise, createSettingsWindow, waitForSettingsWindowLoad,
}) {
  function ensureSettingsWindowReady() {
    if (getSettingsWindow() && !getSettingsWindow().isDestroyed() && !getReadyPromise()) {
      return Promise.resolve(getSettingsWindow());
    }

    if (getReadyPromise()) {
      return getReadyPromise();
    }

    const nextSettingsWindow = createSettingsWindow();

    if (!nextSettingsWindow || nextSettingsWindow.isDestroyed()) {
      return Promise.resolve(null);
    }

    if (!nextSettingsWindow.webContents.isLoadingMainFrame()) {
      return Promise.resolve(nextSettingsWindow);
    }

    const readyPromise = waitForSettingsWindowLoad(nextSettingsWindow).finally(() => {
      if (getReadyPromise() === readyPromise) {
        setReadyPromise(null);
      }
    });

    setReadyPromise(readyPromise);
    return readyPromise;
  }

  function preloadSettingsWindow() {
    if (getSettingsWindow() && !getSettingsWindow().isDestroyed()) {
      return;
    }

    void ensureSettingsWindowReady().catch(() => {});
  }

  return { ensureSettingsWindowReady, preloadSettingsWindow };
}

module.exports = { createSettingsWindowCreator, createSettingsWindowReadiness };
