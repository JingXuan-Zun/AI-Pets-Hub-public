const { createAuxiliaryWindowCreationControllers } = require('./auxiliaryWindowCreationControllers.cjs');
const { createSettingsWindowContentRefresh } = require('./settingsWindowLoadStages.cjs');

function createAuxiliaryWindowContentControllers({
  windowOwnershipState, getBrowserWindowIconOptions, path, baseDirectory,
  sessionPartition, isCurrentWindowCompactMinimumSizeActive, getResolvedChatPanelWindowLimits, isInteractiveDialogueChatActive,
  getResolvedChatPanelWindowBounds, scheduleKeepWindowOnTop, AUX_TOPMOST_RELATIVE_LEVEL, scheduleWindowStackOnTop,
  notifyChatWindowState, broadcastSharedState, openExternalSafely, shell,
  getChatPanelWindowBounds, BrowserWindow, attachLoadLogging, loadRenderer,
  scheduleSettingsWindowContentRefresh, disableDwmSystemBorderForWindow, notifySettingsWindowState, HIDE_MAIN_WINDOW_FOR_GRAPH_DIAGNOSTICS,
  showMainWindowWhenReady, SETTINGS_PANEL_WINDOW_BOUNDS, getSettingsPanelWindowBounds, logWindowEvent,
  waitForSettingsWindowLoad, captureService, scheduleSettingsWindowDisplayRefresh, getShellRendererWindows,
  DISPLAY_ENVIRONMENT_BROADCAST_DELAY_MS, SETTINGS_WINDOW_SHOW_CAPTURE_REFRESH_DELAY_MS,
}) {
  const {
    closeChatWindow, openChatWindow, syncInteractiveChatWindowBounds,
    ensureSettingsWindowReady, preloadSettingsWindow,
  } = createAuxiliaryWindowCreationControllers({
    windowOwnershipState, getBrowserWindowIconOptions, path,
    baseDirectory, sessionPartition, isCurrentWindowCompactMinimumSizeActive,
    getResolvedChatPanelWindowLimits, isInteractiveDialogueChatActive, getResolvedChatPanelWindowBounds,
    scheduleKeepWindowOnTop, AUX_TOPMOST_RELATIVE_LEVEL, scheduleWindowStackOnTop,
    notifyChatWindowState, broadcastSharedState, openExternalSafely,
    shell, getChatPanelWindowBounds, BrowserWindow,
    attachLoadLogging, loadRenderer, scheduleSettingsWindowContentRefresh,
    disableDwmSystemBorderForWindow, notifySettingsWindowState, HIDE_MAIN_WINDOW_FOR_GRAPH_DIAGNOSTICS,
    showMainWindowWhenReady, SETTINGS_PANEL_WINDOW_BOUNDS, getSettingsPanelWindowBounds,
    logWindowEvent, waitForSettingsWindowLoad,
  });
  const refreshSettingsWindowContent = createSettingsWindowContentRefresh({
    captureService, scheduleSettingsWindowDisplayRefresh, getShellRendererWindows,
    DISPLAY_ENVIRONMENT_BROADCAST_DELAY_MS, SETTINGS_WINDOW_SHOW_CAPTURE_REFRESH_DELAY_MS,
  });
  return { closeChatWindow, openChatWindow, syncInteractiveChatWindowBounds, ensureSettingsWindowReady, preloadSettingsWindow, refreshSettingsWindowContent };
}

module.exports = { createAuxiliaryWindowContentControllers };
