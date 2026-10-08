const { createWindowResourceResolvers } = require('./windowResourceResolvers.cjs');
const { createWindowStateMessagingControllers } = require('./windowStateMessaging.cjs');

function createWindowResourceMessagingControllers({
  captureService, screen, getSharedState, nativeImage,
  path, processRef, baseDirectory, SETTINGS_PANEL_WINDOW_BOUNDS,
  CHAT_PANEL_WINDOW_BOUNDS, INTERACTIVE_CHAT_PANEL_WINDOW_BOUNDS, INTERACTIVE_CHAT_PANEL_CENTER_Y_RATIO, managerState,
}) {
  const {
    getCompactWindowBounds, getSettingsWindowBounds, getSettingsPanelWindowBounds, getChatPanelWindowBounds,
    isInteractiveDialogueChatActive, getResolvedChatPanelWindowLimits, getResolvedChatPanelWindowBounds, getBrowserWindowIconOptions,
    resolveTrayIcon,
  } = createWindowResourceResolvers({
    captureService, screen, getSharedState, nativeImage,
    path, processRef, baseDirectory, SETTINGS_PANEL_WINDOW_BOUNDS,
    CHAT_PANEL_WINDOW_BOUNDS, INTERACTIVE_CHAT_PANEL_WINDOW_BOUNDS, INTERACTIVE_CHAT_PANEL_CENTER_Y_RATIO,
  });
  const {
    getIsSettingsWindowOpen, getIsChatWindowOpen, notifySettingsWindowState, notifyChatWindowState,
    broadcastSharedState, broadcastRuntimeWorldPresentationIntent,
  } = createWindowStateMessagingControllers({
    managerState, getSharedState
  });
  return {
    getCompactWindowBounds, getSettingsWindowBounds, getSettingsPanelWindowBounds, getChatPanelWindowBounds,
    isInteractiveDialogueChatActive, getResolvedChatPanelWindowLimits, getResolvedChatPanelWindowBounds, getBrowserWindowIconOptions,
    resolveTrayIcon, getIsSettingsWindowOpen, getIsChatWindowOpen, notifySettingsWindowState,
    notifyChatWindowState, broadcastSharedState, broadcastRuntimeWorldPresentationIntent,
  };
}

module.exports = { createWindowResourceMessagingControllers };
