function createAuxWindowVisibilityQuery({ getSettingsWindow, getChatWindow, getAreaPickerWindow }) {
  return function hasVisibleAuxWindow() {
    return Boolean(
      (getSettingsWindow() && !getSettingsWindow().isDestroyed() && getSettingsWindow().isVisible())
      || (getChatWindow() && !getChatWindow().isDestroyed() && getChatWindow().isVisible())
      || (getAreaPickerWindow() && !getAreaPickerWindow().isDestroyed() && getAreaPickerWindow().isVisible())
    );
  };
}

function createMainWindowTopmostGuard({
  getGuardTimer, setGuardTimer, getMainWindow, hasVisibleAuxWindow, keepWindowOnTop,
  MAIN_TOPMOST_RELATIVE_LEVEL, TOPMOST_GUARD_INTERVAL_MS, setInterval, clearInterval,
}) {
  function startMainTopmostGuard() {
    if (getGuardTimer()) {
      return;
    }

    setGuardTimer(setInterval(() => {
      if (hasVisibleAuxWindow()) {
        return;
      }

      keepWindowOnTop(getMainWindow(), MAIN_TOPMOST_RELATIVE_LEVEL);
    }, TOPMOST_GUARD_INTERVAL_MS));
    if (typeof getGuardTimer().unref === 'function') {
      getGuardTimer().unref();
    }
  }

  function stopMainTopmostGuard() {
    if (!getGuardTimer()) {
      return;
    }

    clearInterval(getGuardTimer());
    setGuardTimer(null);
  }

  return { startMainTopmostGuard, stopMainTopmostGuard };
}

module.exports = { createAuxWindowVisibilityQuery, createMainWindowTopmostGuard };
