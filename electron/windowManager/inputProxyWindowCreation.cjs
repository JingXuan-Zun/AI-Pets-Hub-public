function createInputProxyWindowConfigurator({
  proxyState, disableDwmSystemBorderForWindow, pointerDiagnosticsEnabled, logWindowEvent,
  TOPMOST_WINDOW_LEVEL, POST_DRAG_INPUT_PROXY_TOPMOST_RELATIVE_LEVEL,
}) {
  return function configurePostDragInputProxyWindow(inputProxyWindow) {
    inputProxyWindow.setOpacity(0.01);
    void disableDwmSystemBorderForWindow(inputProxyWindow).then((result) => {
      if (pointerDiagnosticsEnabled && !result.applied) {
        logWindowEvent(
          `main-window: input proxy DWM border disable skipped reason=${result.reason}`,
        );
      }
    });
    proxyState.getWindow().setAlwaysOnTop(
      true,
      TOPMOST_WINDOW_LEVEL,
      POST_DRAG_INPUT_PROXY_TOPMOST_RELATIVE_LEVEL,
    );
    proxyState.getWindow().setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  };
}

function createInputProxyWindowEventRegistrar({
  proxyState, applyPostDragInputProxyRegions, clearPostDragInputProxyIdleDestroyTimer, logWindowEvent, hidePostDragInputProxy,
}) {
  return function attachPostDragInputProxyEvents(inputProxyWindow) {
    inputProxyWindow.webContents.once('did-finish-load', () => {
      if (proxyState.getWindow() !== inputProxyWindow || inputProxyWindow.isDestroyed()) {
        return;
      }
      proxyState.setReady(true);
      applyPostDragInputProxyRegions();
    });
    inputProxyWindow.on('closed', () => {
      if (proxyState.getWindow() !== inputProxyWindow) {
        return;
      }
      clearPostDragInputProxyIdleDestroyTimer();
      proxyState.setWindow(null);
      proxyState.setReady(false);
      proxyState.setPointerActive(false);
      proxyState.setRegions([]);
      proxyState.setPendingRegions(null);
      proxyState.setShapeSignature('');
    });
    inputProxyWindow.loadURL(
      'data:text/html;charset=utf-8,<html><head><meta charset="utf-8"></head><body></body></html>',
    ).catch((error) => {
      logWindowEvent(`main-window: failed to load post-drag input proxy ${error?.stack || error}`);
      if (proxyState.getWindow() === inputProxyWindow) {
        hidePostDragInputProxy('load-failed', true);
      }
    });
  };
}

function createInputProxyWindowCreator({
  proxyState, getMainWindow, BrowserWindow, path, baseDirectory, sessionPartition, disableDwmSystemBorderForWindow,
  pointerDiagnosticsEnabled, logWindowEvent, TOPMOST_WINDOW_LEVEL, POST_DRAG_INPUT_PROXY_TOPMOST_RELATIVE_LEVEL,
  applyPostDragInputProxyRegions, clearPostDragInputProxyIdleDestroyTimer, hidePostDragInputProxy,
}) {
  const configurePostDragInputProxyWindow = createInputProxyWindowConfigurator({ proxyState, disableDwmSystemBorderForWindow, pointerDiagnosticsEnabled, logWindowEvent, TOPMOST_WINDOW_LEVEL, POST_DRAG_INPUT_PROXY_TOPMOST_RELATIVE_LEVEL });
  const attachPostDragInputProxyEvents = createInputProxyWindowEventRegistrar({ proxyState, applyPostDragInputProxyRegions, clearPostDragInputProxyIdleDestroyTimer, logWindowEvent, hidePostDragInputProxy });
  return function ensurePostDragInputProxyWindow() {
    if (proxyState.getWindow() && !proxyState.getWindow().isDestroyed()) {
      clearPostDragInputProxyIdleDestroyTimer();
      return proxyState.getWindow();
    }
    if (!getMainWindow() || getMainWindow().isDestroyed()) {
      return null;
    }

    proxyState.setReady(false);
    proxyState.setPointerActive(false);
    proxyState.setWindow(new BrowserWindow({
      ...getMainWindow().getBounds(),
      frame: false,
      transparent: true,
      focusable: false,
      hasShadow: false,
      resizable: false,
      opacity: 0.01,
      show: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      autoHideMenuBar: true,
      backgroundColor: '#00000000',
      title: 'AI Desktop Pet Input Proxy',
      webPreferences: {
        preload: path.join(baseDirectory, 'postDragInputProxyPreload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        ...(sessionPartition ? { partition: sessionPartition } : {}),
      },
    }));
    const inputProxyWindow = proxyState.getWindow();
    configurePostDragInputProxyWindow(inputProxyWindow);
    attachPostDragInputProxyEvents(inputProxyWindow);
    return inputProxyWindow;
  };
}

module.exports = { createInputProxyWindowCreator };
