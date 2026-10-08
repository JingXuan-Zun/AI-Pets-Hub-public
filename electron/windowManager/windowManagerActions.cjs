function createWindowManagerActions({ managerState, hidePostDragInputProxy, Tray, resolveTrayIcon, configureTray, resizeWindowForSettings }) {
  function hideMainWindow() {
    if (!managerState.mainWindow) {
      return;
    }

    hidePostDragInputProxy('main-window-hidden', true);
    managerState.mainWindow.hide();
  }

  function createTray() {
    managerState.tray = new Tray(resolveTrayIcon());
    configureTray();
  }

  const setSettingsOpen = (isOpen) => {
    managerState.isShellSettingsOpen = Boolean(isOpen);
    resizeWindowForSettings(Boolean(isOpen));
  };

  return { hideMainWindow, createTray, setSettingsOpen };
}

module.exports = { createWindowManagerActions };
