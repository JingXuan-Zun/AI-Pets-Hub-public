const { createSettingsWindowDisplayRefreshScheduler } = require('./settingsWindowDisplayRefresh.cjs');
const { createSettingsWindowContentScheduler } = require('./settingsWindowContentScheduler.cjs');
const { createSettingsWindowPresenter } = require('./settingsWindowPresentation.cjs');

function createSettingsPresentationControllers({
  getSettingsWindow, getMainWindow, getDisplayRefreshTimer, setDisplayRefreshTimer, setTimeout, clearTimeout,
  captureService, SETTINGS_WINDOW_SHOW_DISPLAY_REFRESH_DELAY_MS, getContentRefreshAt, setContentRefreshAt,
  getCurrentTime, SETTINGS_WINDOW_CONTENT_REFRESH_COOLDOWN_MS, refreshSettingsWindowContent,
  getSettingsPanelWindowBounds, isSettingsWindowAtSettingsPanelUrl, logWindowEvent, loadRenderer,
  HIDE_MAIN_WINDOW_FOR_GRAPH_DIAGNOSTICS, scheduleKeepWindowOnTop, AUX_TOPMOST_RELATIVE_LEVEL,
  scheduleWindowStackOnTop, notifySettingsWindowState,
}) {
  const scheduleSettingsWindowDisplayRefresh = createSettingsWindowDisplayRefreshScheduler({
    getSettingsWindow,
    getDisplayRefreshTimer,
    setDisplayRefreshTimer,
    setTimeout,
    clearTimeout,
    captureService, SETTINGS_WINDOW_SHOW_DISPLAY_REFRESH_DELAY_MS,
  });
  const scheduleSettingsWindowContentRefresh = createSettingsWindowContentScheduler({
    getContentRefreshAt,
    setContentRefreshAt,
    getCurrentTime, SETTINGS_WINDOW_CONTENT_REFRESH_COOLDOWN_MS,
    refreshSettingsWindowContent,
  });
  const showSettingsWindow = createSettingsWindowPresenter({
    getSettingsWindow, getMainWindow,
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
  });
  return { scheduleSettingsWindowDisplayRefresh, scheduleSettingsWindowContentRefresh, showSettingsWindow };
}

function createSettingsStatePresentationControllers({
  managerState, setTimeout, clearTimeout, captureService,
  SETTINGS_WINDOW_SHOW_DISPLAY_REFRESH_DELAY_MS, getCurrentTime, SETTINGS_WINDOW_CONTENT_REFRESH_COOLDOWN_MS, refreshSettingsWindowContent,
  getSettingsPanelWindowBounds, isSettingsWindowAtSettingsPanelUrl, logWindowEvent, loadRenderer,
  HIDE_MAIN_WINDOW_FOR_GRAPH_DIAGNOSTICS, scheduleKeepWindowOnTop, AUX_TOPMOST_RELATIVE_LEVEL, scheduleWindowStackOnTop,
  notifySettingsWindowState,
}) {
  return createSettingsPresentationControllers({
    getSettingsWindow: () => managerState.settingsWindow, getMainWindow: () => managerState.mainWindow, getDisplayRefreshTimer: () => managerState.settingsWindowDisplayRefreshTimer,
    setDisplayRefreshTimer: (timer) => { managerState.settingsWindowDisplayRefreshTimer = timer; }, setTimeout, clearTimeout,
    captureService, SETTINGS_WINDOW_SHOW_DISPLAY_REFRESH_DELAY_MS, getContentRefreshAt: () => managerState.settingsWindowContentRefreshAt,
    setContentRefreshAt: (value) => { managerState.settingsWindowContentRefreshAt = value; }, getCurrentTime, SETTINGS_WINDOW_CONTENT_REFRESH_COOLDOWN_MS,
    refreshSettingsWindowContent, getSettingsPanelWindowBounds, isSettingsWindowAtSettingsPanelUrl,
    logWindowEvent, loadRenderer, HIDE_MAIN_WINDOW_FOR_GRAPH_DIAGNOSTICS,
    scheduleKeepWindowOnTop, AUX_TOPMOST_RELATIVE_LEVEL, scheduleWindowStackOnTop,
    notifySettingsWindowState,
  });
}

module.exports = { createSettingsPresentationControllers, createSettingsStatePresentationControllers };
