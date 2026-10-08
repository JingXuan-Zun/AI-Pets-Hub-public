function createChatRendererEventRegistrar({ getChatWindow, openExternalSafely, shell, broadcastSharedState }) {
  return function attachChatRendererEvents() {
    getChatWindow().webContents.setWindowOpenHandler(({ url }) => {
      void openExternalSafely(shell, url);
      return { action: 'deny' };
    });
    getChatWindow().webContents.once('did-finish-load', () => {
      broadcastSharedState();
    });
  };
}

function createChatWindowReadyEventRegistrar({
  getChatWindow, applyChatWindowSizeConstraints, getResolvedChatPanelWindowBounds,
  scheduleKeepWindowOnTop, AUX_TOPMOST_RELATIVE_LEVEL, scheduleWindowStackOnTop,
}) {
  return function attachChatWindowReadyEvent() {
    getChatWindow().once('ready-to-show', () => {
      if (!getChatWindow() || getChatWindow().isDestroyed()) {
        return;
      }
      applyChatWindowSizeConstraints(getChatWindow());
      getChatWindow().setBounds(getResolvedChatPanelWindowBounds(getChatWindow().getBounds()));
      getChatWindow().show();
      getChatWindow().focus();
      scheduleKeepWindowOnTop(getChatWindow(), AUX_TOPMOST_RELATIVE_LEVEL, { bringToFront: true });
      scheduleWindowStackOnTop();
    });
  };
}

function createChatWindowEventRegistrar({
  getChatWindow, getIsQuitting, clearChatWindow,
  applyChatWindowSizeConstraints, getResolvedChatPanelWindowBounds,
  scheduleKeepWindowOnTop, AUX_TOPMOST_RELATIVE_LEVEL, scheduleWindowStackOnTop,
  openExternalSafely, shell, broadcastSharedState,
  notifyChatWindowState, syncInteractiveChatWindowBounds,
}) {
  const attachChatWindowReadyEvent = createChatWindowReadyEventRegistrar({
    getChatWindow, applyChatWindowSizeConstraints, getResolvedChatPanelWindowBounds,
    scheduleKeepWindowOnTop, AUX_TOPMOST_RELATIVE_LEVEL, scheduleWindowStackOnTop,
  });

  const attachChatRendererEvents = createChatRendererEventRegistrar({ getChatWindow, openExternalSafely, shell, broadcastSharedState });

  function attachChatWindowEvents() {
    attachChatWindowReadyEvent();
    attachChatRendererEvents();
    getChatWindow().on('close', (event) => {
      if (getIsQuitting()) {
        return;
      }
      event.preventDefault();
      getChatWindow().hide();
    });
    getChatWindow().on('show', () => {
      notifyChatWindowState();
      broadcastSharedState();
      syncInteractiveChatWindowBounds();
      scheduleWindowStackOnTop();
      scheduleKeepWindowOnTop(getChatWindow(), AUX_TOPMOST_RELATIVE_LEVEL);
    });
    getChatWindow().on('hide', () => {
      notifyChatWindowState();
      scheduleWindowStackOnTop();
    });
    getChatWindow().on('focus', () => scheduleKeepWindowOnTop(getChatWindow(), AUX_TOPMOST_RELATIVE_LEVEL));
    getChatWindow().on('restore', () => scheduleKeepWindowOnTop(getChatWindow(), AUX_TOPMOST_RELATIVE_LEVEL));
    getChatWindow().on('move', () => scheduleKeepWindowOnTop(getChatWindow(), AUX_TOPMOST_RELATIVE_LEVEL));
    getChatWindow().on('resize', () => {
      syncInteractiveChatWindowBounds();
      scheduleKeepWindowOnTop(getChatWindow(), AUX_TOPMOST_RELATIVE_LEVEL);
    });
    getChatWindow().on('closed', () => {
      clearChatWindow();
      notifyChatWindowState();
    });
  }
  return attachChatWindowEvents;
}
module.exports = { createChatWindowEventRegistrar };
