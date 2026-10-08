// Frameless transparent windows cannot use BrowserWindow.maximize() reliably on
// Windows, so "maximize" fills the display work area with setBounds and keeps the
// previous bounds and size limits to restore later.

// Windows may nudge bounds by a pixel or two after setBounds on scaled displays.
const BOUNDS_TOLERANCE = 8;

function boundsEqual(left, right) {
  return ['x', 'y', 'width', 'height'].every((key) => (
    Math.abs(left[key] - right[key]) <= BOUNDS_TOLERANCE
  ));
}

function createWindowMaximizeToggle({ screen }) {
  const states = new WeakMap();

  function isMaximized(win) {
    const state = states.get(win);
    return Boolean(state?.maximized && boundsEqual(win.getBounds(), state.maximizedBounds));
  }

  // Electron treats a transparent window that exactly fills the work area as
  // natively maximized and may restore it from minimize to the wrong bounds, so
  // re-apply our own state after a restore.
  const watchedWindows = new WeakSet();
  function watchRestore(win) {
    if (watchedWindows.has(win)) return;
    watchedWindows.add(win);
    win.on('restore', () => setImmediate(() => {
      const state = states.get(win);
      if (!state || win.isDestroyed()) return;
      const target = state.maximized ? state.maximizedBounds : state.minimizedFromBounds;
      state.minimizedFromBounds = undefined;
      if (target && !boundsEqual(win.getBounds(), target)) win.setBounds(target, false);
    }));
  }

  function minimize(win) {
    if (!win || win.isDestroyed() || !win.isMinimizable()) return;
    const state = states.get(win);
    if (state && !isMaximized(win)) {
      states.set(win, { ...state, maximized: false, minimizedFromBounds: win.getBounds() });
    }
    win.minimize();
  }

  function restore(win, state) {
    win.setMaximumSize(state.maximumSize[0], state.maximumSize[1]);
    win.setBounds(state.restoreBounds, false);
    // Remember the exact restore bounds: DPI rounding makes getBounds() drift by a
    // pixel per round trip, which would otherwise accumulate.
    states.set(win, { maximized: false, normalBounds: state.restoreBounds });
  }

  function maximize(win) {
    const previous = states.get(win);
    const currentBounds = win.getBounds();
    const restoreBounds = previous?.normalBounds && boundsEqual(currentBounds, previous.normalBounds)
      ? previous.normalBounds : currentBounds;
    const { workArea } = screen.getDisplayMatching(currentBounds);
    // While a saved maximumSize exists the limits are still lifted, so keep the original ones.
    const maximumSize = previous?.maximumSize ?? win.getMaximumSize();
    win.setMaximumSize(0, 0);
    win.setBounds(workArea, false);
    states.set(win, {
      maximized: true, maximizedBounds: win.getBounds(), maximumSize, restoreBounds,
    });
  }

  // Dragging a maximized window restores its previous size under the cursor,
  // keeping the grab point at the same relative spot of the title bar.
  function restoreForDrag(win, { cursorX, cursorY, ratioX, offsetY }) {
    if (!win || win.isDestroyed() || !isMaximized(win)) return null;
    const state = states.get(win);
    const { width, height } = state.restoreBounds;
    const { workArea } = screen.getDisplayNearestPoint({ x: Math.round(cursorX), y: Math.round(cursorY) });
    const clampedRatio = Math.min(1, Math.max(0, Number(ratioX) || 0));
    win.setMaximumSize(state.maximumSize[0], state.maximumSize[1]);
    win.setBounds({
      x: Math.round(cursorX - width * clampedRatio),
      y: Math.max(workArea.y, Math.round(cursorY - (Number(offsetY) || 0))),
      width,
      height,
    }, false);
    states.set(win, { maximized: false });
    return win.getBounds();
  }

  return {
    isMaximized,
    minimize,
    restoreForDrag,
    toggle(win) {
      if (!win || win.isDestroyed()) return false;
      watchRestore(win);
      const state = states.get(win);
      if (state?.maximized && isMaximized(win)) {
        restore(win, state);
        return false;
      }
      maximize(win);
      return true;
    },
  };
}

module.exports = { createWindowMaximizeToggle };
