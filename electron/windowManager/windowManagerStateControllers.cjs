const { createWindowManagerActions } = require('./windowManagerActions.cjs');
const { createWindowOwnershipStateAdapters } = require('./windowOwnershipStateAdapters.cjs');
const { createWindowManagerStateControls } = require('./windowManagerStateControls.cjs');

function createWindowManagerStateControllers({
  managerState, Tray, hidePostDragInputProxy, resolveTrayIcon, configureTray,
  resizeWindowForSettings, syncInteractiveChatWindowBounds, broadcastSharedState,
}) {
  const { hideMainWindow, createTray, setSettingsOpen } = createWindowManagerActions({
    managerState, Tray, hidePostDragInputProxy, resolveTrayIcon, configureTray, resizeWindowForSettings,
  });
  const windowOwnershipState = createWindowOwnershipStateAdapters(managerState);
  const { getMainWindow, getSettingsWindow, getChatWindow, getShellRendererWindows, setQuitting, setSharedState, getSharedState }
    = createWindowManagerStateControls({
    managerState,
    syncInteractiveChatWindowBounds,
    broadcastSharedState,
  });
  return {
    hideMainWindow, createTray, setSettingsOpen, windowOwnershipState,
    getMainWindow, getSettingsWindow, getChatWindow, getShellRendererWindows, setQuitting, setSharedState, getSharedState,
  };
}

module.exports = { createWindowManagerStateControllers };
