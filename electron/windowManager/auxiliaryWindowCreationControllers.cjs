const { createChatWindowOwnershipControllers } = require('./chatWindowControllers.cjs');
const { createSettingsWindowOwnershipControllers } = require('./settingsWindowControllers.cjs');

function createAuxiliaryWindowCreationControllers({
  windowOwnershipState, getBrowserWindowIconOptions, path, baseDirectory,
  sessionPartition, isCurrentWindowCompactMinimumSizeActive, getResolvedChatPanelWindowLimits, isInteractiveDialogueChatActive,
  getResolvedChatPanelWindowBounds, scheduleKeepWindowOnTop, AUX_TOPMOST_RELATIVE_LEVEL, scheduleWindowStackOnTop,
  notifyChatWindowState, broadcastSharedState, openExternalSafely, shell,
  getChatPanelWindowBounds, BrowserWindow, attachLoadLogging, loadRenderer,
  scheduleSettingsWindowContentRefresh, disableDwmSystemBorderForWindow, notifySettingsWindowState, HIDE_MAIN_WINDOW_FOR_GRAPH_DIAGNOSTICS,
  showMainWindowWhenReady, SETTINGS_PANEL_WINDOW_BOUNDS, getSettingsPanelWindowBounds, logWindowEvent,
  waitForSettingsWindowLoad,
}) {
  const { closeChatWindow, openChatWindow, syncInteractiveChatWindowBounds } = createChatWindowOwnershipControllers({
    windowOwnershipState, getBrowserWindowIconOptions, path,
    baseDirectory, sessionPartition, isCurrentWindowCompactMinimumSizeActive,
    getResolvedChatPanelWindowLimits, isInteractiveDialogueChatActive, getResolvedChatPanelWindowBounds,
    scheduleKeepWindowOnTop, AUX_TOPMOST_RELATIVE_LEVEL, scheduleWindowStackOnTop,
    notifyChatWindowState, broadcastSharedState, openExternalSafely,
    shell, getChatPanelWindowBounds, BrowserWindow,
    attachLoadLogging, loadRenderer,
  });
  const { ensureSettingsWindowReady, preloadSettingsWindow } = createSettingsWindowOwnershipControllers({
    windowOwnershipState, openExternalSafely, shell,
    broadcastSharedState, scheduleSettingsWindowContentRefresh, disableDwmSystemBorderForWindow,
    notifySettingsWindowState, scheduleWindowStackOnTop, scheduleKeepWindowOnTop,
    AUX_TOPMOST_RELATIVE_LEVEL, HIDE_MAIN_WINDOW_FOR_GRAPH_DIAGNOSTICS, showMainWindowWhenReady,
    getBrowserWindowIconOptions, SETTINGS_PANEL_WINDOW_BOUNDS, path,
    baseDirectory, sessionPartition, getSettingsPanelWindowBounds,
    BrowserWindow, attachLoadLogging, logWindowEvent,
    loadRenderer, waitForSettingsWindowLoad,
  });
  return { closeChatWindow, openChatWindow, syncInteractiveChatWindowBounds, ensureSettingsWindowReady, preloadSettingsWindow };
}

module.exports = { createAuxiliaryWindowCreationControllers };
