function createChatWindowReusePresenter({
  getChatWindow, applyChatWindowSizeConstraints, getResolvedChatPanelWindowBounds,
  scheduleKeepWindowOnTop, AUX_TOPMOST_RELATIVE_LEVEL, scheduleWindowStackOnTop,
  notifyChatWindowState, broadcastSharedState,
}) {
  return function presentReusedChatWindow() {
    applyChatWindowSizeConstraints(getChatWindow());
    getChatWindow().setBounds(getResolvedChatPanelWindowBounds(getChatWindow().getBounds()));
    getChatWindow().show();
    if (getChatWindow().isMinimized()) {
      getChatWindow().restore();
    }
    getChatWindow().focus();
    scheduleKeepWindowOnTop(getChatWindow(), AUX_TOPMOST_RELATIVE_LEVEL, { bringToFront: true });
    scheduleWindowStackOnTop();
    notifyChatWindowState();
    broadcastSharedState();
  };
}
module.exports = { createChatWindowReusePresenter };
