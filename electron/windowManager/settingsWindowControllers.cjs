const { createSettingsWindowEventRegistrar } = require('./settingsWindowEvents.cjs');
const { createSettingsWindowOptionsBuilder } = require('./settingsWindowOptions.cjs');
const { createSettingsWindowCreator, createSettingsWindowReadiness } = require('./settingsWindowLifecycle.cjs');

function createSettingsWindowControllers({
  openExternalSafely, shell, getSettingsWindow, getIsQuitting, clearSettingsWindow, clearSettingsWindowReadyPromise,
  broadcastSharedState, scheduleSettingsWindowContentRefresh, disableDwmSystemBorderForWindow,
  notifySettingsWindowState, scheduleWindowStackOnTop, scheduleKeepWindowOnTop,
  AUX_TOPMOST_RELATIVE_LEVEL, HIDE_MAIN_WINDOW_FOR_GRAPH_DIAGNOSTICS, showMainWindowWhenReady,
  getBrowserWindowIconOptions, SETTINGS_PANEL_WINDOW_BOUNDS, path, baseDirectory, sessionPartition,
  setSettingsWindow, getSettingsPanelWindowBounds, BrowserWindow, attachLoadLogging, logWindowEvent, loadRenderer,
  getReadyPromise, setReadyPromise, waitForSettingsWindowLoad,
}) {
  const attachSettingsWindowEvents = createSettingsWindowEventRegistrar({
    openExternalSafely, shell, getSettingsWindow, getIsQuitting, clearSettingsWindow, clearSettingsWindowReadyPromise,
    broadcastSharedState, scheduleSettingsWindowContentRefresh, disableDwmSystemBorderForWindow,
    notifySettingsWindowState, scheduleWindowStackOnTop, scheduleKeepWindowOnTop,
    AUX_TOPMOST_RELATIVE_LEVEL, HIDE_MAIN_WINDOW_FOR_GRAPH_DIAGNOSTICS, showMainWindowWhenReady,
  });
  const buildSettingsWindowOptions = createSettingsWindowOptionsBuilder({
    getBrowserWindowIconOptions, SETTINGS_PANEL_WINDOW_BOUNDS, path, baseDirectory, sessionPartition,
  });
  const createSettingsWindow = createSettingsWindowCreator({
    getSettingsWindow, setSettingsWindow,
    getSettingsPanelWindowBounds, BrowserWindow, buildSettingsWindowOptions, attachLoadLogging,
    disableDwmSystemBorderForWindow, logWindowEvent,
    scheduleKeepWindowOnTop, AUX_TOPMOST_RELATIVE_LEVEL, attachSettingsWindowEvents, loadRenderer,
  });
  const { ensureSettingsWindowReady, preloadSettingsWindow } = createSettingsWindowReadiness({
    getSettingsWindow, getReadyPromise, setReadyPromise, createSettingsWindow, waitForSettingsWindowLoad,
  });
  return { ensureSettingsWindowReady, preloadSettingsWindow };
}

function createSettingsWindowOwnershipControllers({
  windowOwnershipState, openExternalSafely, shell, broadcastSharedState,
  scheduleSettingsWindowContentRefresh, disableDwmSystemBorderForWindow, notifySettingsWindowState, scheduleWindowStackOnTop,
  scheduleKeepWindowOnTop, AUX_TOPMOST_RELATIVE_LEVEL, HIDE_MAIN_WINDOW_FOR_GRAPH_DIAGNOSTICS, showMainWindowWhenReady,
  getBrowserWindowIconOptions, SETTINGS_PANEL_WINDOW_BOUNDS, path, baseDirectory,
  sessionPartition, getSettingsPanelWindowBounds, BrowserWindow, attachLoadLogging,
  logWindowEvent, loadRenderer, waitForSettingsWindowLoad,
}) {
  return createSettingsWindowControllers({
    openExternalSafely, shell, ...windowOwnershipState.settingsOwnership,
    broadcastSharedState, scheduleSettingsWindowContentRefresh, disableDwmSystemBorderForWindow,
    notifySettingsWindowState, scheduleWindowStackOnTop, scheduleKeepWindowOnTop,
    AUX_TOPMOST_RELATIVE_LEVEL, HIDE_MAIN_WINDOW_FOR_GRAPH_DIAGNOSTICS, showMainWindowWhenReady,
    getBrowserWindowIconOptions, SETTINGS_PANEL_WINDOW_BOUNDS, path,
    baseDirectory, sessionPartition, getSettingsPanelWindowBounds,
    BrowserWindow, attachLoadLogging, logWindowEvent,
    loadRenderer, ...windowOwnershipState.settingsReadiness, waitForSettingsWindowLoad,
  });
}

module.exports = { createSettingsWindowControllers, createSettingsWindowOwnershipControllers };
