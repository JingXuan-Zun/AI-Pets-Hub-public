function applyWindowTopmostCache(win, relativeLevel, topmostLevel, topmostStateByWindow) {
  const previousState = topmostStateByWindow.get(win);
  const isWindowAlreadyTopmost = typeof win.isAlwaysOnTop === 'function'
    ? win.isAlwaysOnTop()
    : false;
  const needsTopmostRefresh = !previousState
    || previousState.relativeLevel !== relativeLevel
    || previousState.topmostLevel !== topmostLevel
    || !isWindowAlreadyTopmost;

  if (needsTopmostRefresh) {
    win.setAlwaysOnTop(true, topmostLevel, relativeLevel);
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    topmostStateByWindow.set(win, {
      relativeLevel,
      topmostLevel,
    });
  }
}

module.exports = { applyWindowTopmostCache };
