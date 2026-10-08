function createSettingsWindowDisplayRefreshScheduler({
  getSettingsWindow, getDisplayRefreshTimer, setDisplayRefreshTimer,
  setTimeout, clearTimeout, captureService, SETTINGS_WINDOW_SHOW_DISPLAY_REFRESH_DELAY_MS,
}) {
  function scheduleSettingsWindowDisplayRefresh(delayMs = SETTINGS_WINDOW_SHOW_DISPLAY_REFRESH_DELAY_MS) {
    if (!getSettingsWindow() || getSettingsWindow().isDestroyed() || !getSettingsWindow().isVisible()) {
      return;
    }

    if (getDisplayRefreshTimer()) {
      clearTimeout(getDisplayRefreshTimer());
    }

    const nextSettingsWindow = getSettingsWindow();
    setDisplayRefreshTimer(setTimeout(() => {
      setDisplayRefreshTimer(null);

      if (!nextSettingsWindow || nextSettingsWindow.isDestroyed() || !nextSettingsWindow.isVisible()) {
        return;
      }

      void captureService.broadcastDisplayEnvironment({
        includeCaptureSources: false,
        preferCachedCaptureSources: true,
        windows: [nextSettingsWindow],
      });
    }, delayMs));
  }

  return scheduleSettingsWindowDisplayRefresh;
}

module.exports = { createSettingsWindowDisplayRefreshScheduler };
