function createWindowManagerStateControls({ managerState, syncInteractiveChatWindowBounds, broadcastSharedState }) {
  function getMainWindow() {
    return managerState.mainWindow;
  }

  function getSettingsWindow() {
    return managerState.settingsWindow;
  }

  function getChatWindow() {
    return managerState.chatWindow;
  }

  function getShellRendererWindows() {
    return [managerState.mainWindow, managerState.settingsWindow, managerState.chatWindow].filter((win) => win && !win.isDestroyed());
  }

  function setQuitting(nextValue) {
    managerState.isQuitting = Boolean(nextValue);
  }

  function setSharedState(nextState) {
    managerState.latestSharedState = nextState ?? null;
    syncInteractiveChatWindowBounds();
    broadcastSharedState();
  }

  function getSharedState() {
    return managerState.latestSharedState;
  }

  return {
    getMainWindow,
    getSettingsWindow,
    getChatWindow,
    getShellRendererWindows,
    setQuitting,
    setSharedState,
    getSharedState,
  };
}

module.exports = { createWindowManagerStateControls };
