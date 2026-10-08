function waitForSettingsWindowLoad(nextSettingsWindow) {
  return new Promise((resolve) => {
    let resolved = false;
    const resolveOnce = (win) => {
      if (resolved) {
        return;
      }
      resolved = true;
      resolve(win);
    };

    nextSettingsWindow.webContents.once('did-finish-load', () => resolveOnce(nextSettingsWindow));
    nextSettingsWindow.webContents.once('did-fail-load', () => resolveOnce(nextSettingsWindow));
    nextSettingsWindow.once('closed', () => resolveOnce(null));
  });
}

function createSettingsWindowContentRefresh({
  captureService, scheduleSettingsWindowDisplayRefresh, getShellRendererWindows,
  DISPLAY_ENVIRONMENT_BROADCAST_DELAY_MS, SETTINGS_WINDOW_SHOW_CAPTURE_REFRESH_DELAY_MS,
}) {
  return function refreshSettingsWindowContent(forceCaptureSourceRefresh) {
    scheduleSettingsWindowDisplayRefresh();
    captureService.scheduleDisplayEnvironmentBroadcast({
      includeCaptureSources: false,
      preferCachedCaptureSources: true,
      windows: getShellRendererWindows(),
      delayMs: DISPLAY_ENVIRONMENT_BROADCAST_DELAY_MS,
    });
    if (forceCaptureSourceRefresh) {
      captureService.scheduleCaptureSourceRefreshBroadcast(
        SETTINGS_WINDOW_SHOW_CAPTURE_REFRESH_DELAY_MS,
        { force: forceCaptureSourceRefresh },
      );
    }
  };
}

module.exports = { waitForSettingsWindowLoad, createSettingsWindowContentRefresh };
