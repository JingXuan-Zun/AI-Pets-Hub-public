function createAgentDesktopExecutionPolicy({
  getIsActive, setIsActive, getMainWindow, getChatWindow, getSettingsWindow,
  topmostStateByWindow, applyInteractiveWindowShape, applyPointerPassthroughState,
  keepWindowOnTop, keepAuxWindowsOnTop, MAIN_TOPMOST_RELATIVE_LEVEL,
}) {
  return function setAgentDesktopExecutionActive(active) {
    const nextActive = Boolean(active);
    if (getIsActive() === nextActive) {
      return;
    }

    setIsActive(nextActive);
    const shellWindows = [getMainWindow(), getChatWindow(), getSettingsWindow()]
      .filter((win) => win && !win.isDestroyed());

    shellWindows.forEach((win) => {
      if (nextActive && win !== getMainWindow()) {
        win.setAlwaysOnTop(false);
        topmostStateByWindow.delete(win);
      }
    });

    if (!nextActive) {
      applyInteractiveWindowShape();
    }

    applyPointerPassthroughState();

    if (!nextActive) {
      keepWindowOnTop(getMainWindow(), MAIN_TOPMOST_RELATIVE_LEVEL);
      keepAuxWindowsOnTop();
    }
  };
}

module.exports = { createAgentDesktopExecutionPolicy };
