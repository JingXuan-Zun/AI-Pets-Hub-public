function scheduleDisplayEnvironmentBroadcast(dependencies, state, options = {}) {
  const { DISPLAY_ENVIRONMENT_BROADCAST_DELAY_MS, clearTimeout, setTimeout, broadcastDisplayEnvironment } = dependencies;

  const {
    delayMs = DISPLAY_ENVIRONMENT_BROADCAST_DELAY_MS,
    ...broadcastOptions
  } = options;

  if (state.displayEnvironmentBroadcastTimer) {
    clearTimeout(state.displayEnvironmentBroadcastTimer);
  }

  state.displayEnvironmentBroadcastTimer = setTimeout(() => {
    state.displayEnvironmentBroadcastTimer = null;
    void broadcastDisplayEnvironment(broadcastOptions);
  }, delayMs);
}

function scheduleCaptureSourceRefreshBroadcast(dependencies, state, delayMs = dependencies.CAPTURE_SOURCE_REFRESH_DELAY_MS, options = {}) {
  const { getSettingsWindow, isCaptureSourceCacheFresh, clearTimeout, setTimeout, broadcastDisplayEnvironment } = dependencies;

  const { force = false } = options;
  const settingsWindow = getSettingsWindow();
  if (!settingsWindow || settingsWindow.isDestroyed() || !settingsWindow.isVisible()) {
    return;
  }

  if (!force && isCaptureSourceCacheFresh(['screen'])) {
    return;
  }

  if (state.captureSourceRefreshTimer) {
    clearTimeout(state.captureSourceRefreshTimer);
  }

  state.captureSourceRefreshTimer = setTimeout(() => {
    state.captureSourceRefreshTimer = null;
    const nextSettingsWindow = getSettingsWindow();
    if (!nextSettingsWindow || nextSettingsWindow.isDestroyed() || !nextSettingsWindow.isVisible()) {
      return;
    }

    if (!force && isCaptureSourceCacheFresh(['screen'])) {
      return;
    }

    void broadcastDisplayEnvironment({
      captureSourceTypes: ['screen'],
      forceRefreshCaptureSources: true,
      windows: [nextSettingsWindow],
    });
  }, delayMs);
}

function disposeBroadcastTimers({ clearTimeout }, state) {
    if (state.displayEnvironmentBroadcastTimer) {
      clearTimeout(state.displayEnvironmentBroadcastTimer);
      state.displayEnvironmentBroadcastTimer = null;
    }
    if (state.captureSourceRefreshTimer) {
      clearTimeout(state.captureSourceRefreshTimer);
      state.captureSourceRefreshTimer = null;
    }

  }

function createCaptureBroadcastScheduler(dependencies) {
  const state = { displayEnvironmentBroadcastTimer: null, captureSourceRefreshTimer: null };
  return {
    scheduleDisplayEnvironmentBroadcast: scheduleDisplayEnvironmentBroadcast.bind(null, dependencies, state),
    scheduleCaptureSourceRefreshBroadcast: scheduleCaptureSourceRefreshBroadcast.bind(null, dependencies, state),
    disposeBroadcastTimers: disposeBroadcastTimers.bind(null, dependencies, state),
  };
}

module.exports = { createCaptureBroadcastScheduler };
