function createWindowManagerDisposer({
  stopMainTopmostGuard, clearMainInteractiveLayerWarmupTimers,
  clearPostDragInputProxyIdleDestroyTimer, hidePostDragInputProxy,
  getInputProxyWindow, getReadyFallbackTimer, setReadyFallbackTimer,
  getDisplayRefreshTimer, setDisplayRefreshTimer, getTray, setTray, clearTimeout,
}) {
  return function dispose() {
    stopMainTopmostGuard();
    clearMainInteractiveLayerWarmupTimers();
    clearPostDragInputProxyIdleDestroyTimer();
    hidePostDragInputProxy('window-manager-dispose', true);
    const postDragInputProxyWindow = getInputProxyWindow();
    if (postDragInputProxyWindow && !postDragInputProxyWindow.isDestroyed()) {
      postDragInputProxyWindow.destroy();
    }
    const mainWindowRendererReadyFallbackTimer = getReadyFallbackTimer();
    if (mainWindowRendererReadyFallbackTimer) {
      clearTimeout(mainWindowRendererReadyFallbackTimer);
      setReadyFallbackTimer(null);
    }
    const settingsWindowDisplayRefreshTimer = getDisplayRefreshTimer();
    if (settingsWindowDisplayRefreshTimer) {
      clearTimeout(settingsWindowDisplayRefreshTimer);
      setDisplayRefreshTimer(null);
    }
    const tray = getTray();
    if (tray && !tray.isDestroyed()) {
      tray.destroy();
    }
    setTray(null);
  };
}

function createWindowManagerStateDisposer({
  managerState, stopMainTopmostGuard, clearMainInteractiveLayerWarmupTimers,
  clearPostDragInputProxyIdleDestroyTimer, hidePostDragInputProxy, clearTimeout,
}) {
  return createWindowManagerDisposer({
    stopMainTopmostGuard, clearMainInteractiveLayerWarmupTimers,
    clearPostDragInputProxyIdleDestroyTimer, hidePostDragInputProxy,
    getInputProxyWindow: () => managerState.postDragInputProxyWindow,
    getReadyFallbackTimer: () => managerState.mainWindowRendererReadyFallbackTimer,
    setReadyFallbackTimer: (timer) => { managerState.mainWindowRendererReadyFallbackTimer = timer; },
    getDisplayRefreshTimer: () => managerState.settingsWindowDisplayRefreshTimer,
    setDisplayRefreshTimer: (timer) => { managerState.settingsWindowDisplayRefreshTimer = timer; },
    getTray: () => managerState.tray, setTray: (value) => { managerState.tray = value; },
    clearTimeout,
  });
}

module.exports = { createWindowManagerDisposer, createWindowManagerStateDisposer };
