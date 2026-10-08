function createWindowOwnershipStateAdapters(managerState) {
  return {
    mainCreation: {
      setMainWindow: (win) => { managerState.mainWindow = win; },
      setCanShow: (value) => { managerState.mainWindowCanShow = value; },
      setRendererRecoveryInProgress: (value) => { managerState.mainWindowRendererRecoveryInProgress = value; },
      setRendererReadyToShow: (value) => { managerState.mainWindowRendererReadyToShow = value; },
    },
    chatOwnership: {
      getChatWindow: () => managerState.chatWindow, setChatWindow: (win) => { managerState.chatWindow = win; },
      getWasInteractive: () => managerState.wasInteractiveDialogueChatActive,
      setWasInteractive: (active) => { managerState.wasInteractiveDialogueChatActive = active; },
    },
    chatClosing: {
      getIsQuitting: () => managerState.isQuitting,
      clearChatWindow: () => { managerState.chatWindow = null; },
    },
    settingsOwnership: {
      getSettingsWindow: () => managerState.settingsWindow, setSettingsWindow: (win) => { managerState.settingsWindow = win; },
      getIsQuitting: () => managerState.isQuitting,
      clearSettingsWindow: () => { managerState.settingsWindow = null; },
      clearSettingsWindowReadyPromise: () => { managerState.settingsWindowReadyPromise = null; },
    },
    settingsReadiness: {
      getReadyPromise: () => managerState.settingsWindowReadyPromise,
      setReadyPromise: (promise) => { managerState.settingsWindowReadyPromise = promise; },
    },
    trayOwnership: {
      getTray: () => managerState.tray, getMainWindow: () => managerState.mainWindow,
      markQuitting: () => { managerState.isQuitting = true; },
    },
  };
}

module.exports = { createWindowOwnershipStateAdapters };
