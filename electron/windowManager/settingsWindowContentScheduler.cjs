function createSettingsWindowContentScheduler({
  getContentRefreshAt, setContentRefreshAt, getCurrentTime, refreshSettingsWindowContent,
  SETTINGS_WINDOW_CONTENT_REFRESH_COOLDOWN_MS,
}) {
  return function scheduleSettingsWindowContentRefresh(options = {}) {
    const {
      forceCaptureSourceRefresh = false,
      forceDisplayRefresh = false,
    } = options;
    const now = getCurrentTime();

    if (
      !forceDisplayRefresh
      && (now - getContentRefreshAt()) <= SETTINGS_WINDOW_CONTENT_REFRESH_COOLDOWN_MS
    ) {
      return;
    }

    setContentRefreshAt(now);

    refreshSettingsWindowContent(forceCaptureSourceRefresh);
  };
}

module.exports = { createSettingsWindowContentScheduler };
