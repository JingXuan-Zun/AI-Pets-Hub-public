const { applyWindowTopmostCache } = require('./windowTopmostCache.cjs');

function createWindowTopmostPolicy({
  getChatWindow, getSettingsWindow, getIsAgentDesktopExecutionActive, topmostStateByWindow,
  MAIN_TOPMOST_RELATIVE_LEVEL, TOPMOST_WINDOW_LEVEL, DISABLE_SETTINGS_TOPMOST_FOR_GRAPH_DIAGNOSTICS,
}) {
  return function keepWindowOnTop(win, relativeLevel = MAIN_TOPMOST_RELATIVE_LEVEL, options = {}) {
    const {
      bringToFront = false,
      topmostLevel = TOPMOST_WINDOW_LEVEL,
    } = options;
    if (!win || win.isDestroyed()) {
      return;
    }

    // Chat/settings are normal user windows: other applications must be able to
    // cover them and receive input. Their initial focus is handled by show/focus.
    if (win === getChatWindow() || win === getSettingsWindow()) {
      if (win.isAlwaysOnTop()) win.setAlwaysOnTop(false);
      topmostStateByWindow.delete(win);
      return;
    }

    if (DISABLE_SETTINGS_TOPMOST_FOR_GRAPH_DIAGNOSTICS && win === getSettingsWindow()) {
      if (win.isAlwaysOnTop()) {
        win.setAlwaysOnTop(false);
      }
      topmostStateByWindow.delete(win);
      return;
    }

    if (
      getIsAgentDesktopExecutionActive()
      && (win === getChatWindow() || win === getSettingsWindow())
    ) {
      if (win.isAlwaysOnTop()) {
        win.setAlwaysOnTop(false);
      }
      topmostStateByWindow.delete(win);
      return;
    }

    applyWindowTopmostCache(win, relativeLevel, topmostLevel, topmostStateByWindow);

    if (bringToFront && win.isVisible() && typeof win.moveTop === 'function') {
      win.moveTop();
    }
  };
}

module.exports = { createWindowTopmostPolicy };
