function createWindowStateNotifier({ getMainWindow, getSettingsWindow, getChatWindow }) {
  function getIsSettingsWindowOpen() {
    return Boolean(getSettingsWindow() && !getSettingsWindow().isDestroyed() && getSettingsWindow().isVisible());
  }
  function getIsChatWindowOpen() {
    return Boolean(getChatWindow() && !getChatWindow().isDestroyed() && getChatWindow().isVisible());
  }
  function notifySettingsWindowState() {
    const isOpen = getIsSettingsWindowOpen();
    if (getMainWindow() && !getMainWindow().isDestroyed()) {
      getMainWindow().webContents.send('desktop-pet:settings-window-state', isOpen);
    }
    if (getSettingsWindow() && !getSettingsWindow().isDestroyed()) {
      getSettingsWindow().webContents.send('desktop-pet:settings-window-state', isOpen);
    }
  }
  function notifyChatWindowState() {
    const isOpen = getIsChatWindowOpen();
    if (getMainWindow() && !getMainWindow().isDestroyed()) {
      getMainWindow().webContents.send('desktop-pet:chat-window-state', isOpen);
    }
    if (getSettingsWindow() && !getSettingsWindow().isDestroyed()) {
      getSettingsWindow().webContents.send('desktop-pet:chat-window-state', isOpen);
    }
    if (getChatWindow() && !getChatWindow().isDestroyed()) {
      getChatWindow().webContents.send('desktop-pet:chat-window-state', isOpen);
    }
  }
  return { getIsSettingsWindowOpen, getIsChatWindowOpen, notifySettingsWindowState, notifyChatWindowState };
}

function createWindowStateBroadcaster({ getMainWindow, getSettingsWindow, getChatWindow, getSharedState }) {
  function broadcastSharedState() {
    if (!getSharedState()) {
      return;
    }
    if (getSettingsWindow() && !getSettingsWindow().isDestroyed() && getSettingsWindow().isVisible()) {
      getSettingsWindow().webContents.send('desktop-pet:shared-state', getSharedState());
    }
    if (getChatWindow() && !getChatWindow().isDestroyed() && getChatWindow().isVisible()) {
      getChatWindow().webContents.send('desktop-pet:shared-state', getSharedState());
    }
  }
  function broadcastRuntimeWorldPresentationIntent(intent, excludedWebContentsId = null) {
    if (!intent || typeof intent !== 'object') {
      return;
    }
    [getMainWindow(), getSettingsWindow(), getChatWindow()]
      .filter((win) => win && !win.isDestroyed())
      .forEach((win) => {
        if (win.webContents.id === excludedWebContentsId) {
          return;
        }
        win.webContents.send('desktop-pet:runtime-world-presentation-intent', intent);
      });
  }
  return { broadcastSharedState, broadcastRuntimeWorldPresentationIntent };
}
function createWindowStateMessagingControllers({ managerState, getSharedState }) {
  const { getIsSettingsWindowOpen, getIsChatWindowOpen, notifySettingsWindowState, notifyChatWindowState } = createWindowStateNotifier({
    getMainWindow: () => managerState.mainWindow, getSettingsWindow: () => managerState.settingsWindow, getChatWindow: () => managerState.chatWindow,
  });
  const { broadcastSharedState, broadcastRuntimeWorldPresentationIntent } = createWindowStateBroadcaster({
    getMainWindow: () => managerState.mainWindow, getSettingsWindow: () => managerState.settingsWindow, getChatWindow: () => managerState.chatWindow, getSharedState,
  });
  return { getIsSettingsWindowOpen, getIsChatWindowOpen, notifySettingsWindowState, notifyChatWindowState, broadcastSharedState, broadcastRuntimeWorldPresentationIntent };
}

module.exports = { createWindowStateNotifier, createWindowStateBroadcaster, createWindowStateMessagingControllers };
