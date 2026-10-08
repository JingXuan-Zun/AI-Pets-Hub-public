function createWindowManagerWindowApi({
  broadcastSharedState, broadcastRuntimeWorldPresentationIntent, closeChatWindow, closeSettingsWindow,
  createWindow, createTray, dispose, getChatWindow,
  getIsChatWindowOpen, getIsSettingsWindowOpen, getMainWindow, getSettingsWindow,
  getSharedState, getShellRendererWindows, managerState, hideMainWindow,
  keepWindowOnTop, markMainWindowReadyToShow, notifyChatWindowState, notifySettingsWindowState,
  openChatWindow, openSettingsWindow, preloadSettingsWindow, recoverMainWindowRenderer,
  resizeWindowForSettings, scheduleKeepWindowOnTop,
}) {
  return {
    broadcastSharedState, broadcastRuntimeWorldPresentationIntent, closeChatWindow,
    closeSettingsWindow, createMainWindow: createWindow, createTray,
    dispose, getChatWindow, getIsChatWindowOpen,
    getIsSettingsWindowOpen, getMainWindow, getSettingsWindow,
    getSharedState, getShellRendererWindows, getShellSettingsOpen: () => managerState.isShellSettingsOpen,
    hideMainWindow, keepWindowOnTop, markMainWindowReadyToShow,
    notifyChatWindowState, notifySettingsWindowState, openChatWindow,
    openSettingsWindow, preloadSettingsWindow, recoverMainWindowRenderer,
    resizeWindowForSettings, scheduleKeepWindowOnTop,
  };
}

function createWindowManagerInteractionApi({
  scheduleSettingsWindowContentRefresh, scheduleWindowStackOnTop, setInteractiveRegions, setPetDragNativeShapeActive,
  forwardPostDragInputProxyEvent, setWindowPointerPassthrough, setQuitting, setSettingsOpen,
  setSharedState, showOrRecoverMainWindow, showMainWindow, showSettingsWindow,
  startMainTopmostGuard, stopMainTopmostGuard,
}) {
  return {
    scheduleSettingsWindowContentRefresh, scheduleWindowStackOnTop, setInteractiveRegions,
    setPetDragNativeShapeActive, forwardPostDragInputProxyEvent, setPointerPassthrough: setWindowPointerPassthrough,
    setQuitting, setSettingsOpen, setSharedState,
    showOrRecoverMainWindow, showMainWindow, showSettingsWindow,
    startMainTopmostGuard, stopMainTopmostGuard,
  };
}

module.exports = { createWindowManagerWindowApi, createWindowManagerInteractionApi };
