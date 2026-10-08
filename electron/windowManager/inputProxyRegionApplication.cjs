function createInputProxyGeometrySynchronizer({
  getMainWindow, proxyState, createInteractiveRegionsSignature,
}) {
  return function syncPostDragInputProxyGeometry() {
    const mainBounds = getMainWindow().getBounds();
    const proxyBounds = proxyState.getWindow().getBounds();
    if (
      proxyBounds.x !== mainBounds.x
      || proxyBounds.y !== mainBounds.y
      || proxyBounds.width !== mainBounds.width
      || proxyBounds.height !== mainBounds.height
    ) {
      proxyState.getWindow().setBounds(mainBounds);
    }

    const nextShapeSignature = createInteractiveRegionsSignature(proxyState.getRegions());
    if (proxyState.getShapeSignature() !== nextShapeSignature) {
      proxyState.getWindow().setShape(proxyState.getRegions());
      proxyState.setShapeSignature(nextShapeSignature);
    }
  };
}

function createInputProxyRegionApplier({
  proxyState, getMainWindow, clearPostDragInputProxyIdleDestroyTimer, hidePostDragInputProxy,
  keepWindowOnTop, POST_DRAG_INPUT_PROXY_TOPMOST_RELATIVE_LEVEL, pointerDiagnosticsEnabled,
  logWindowEvent, summarizeInteractiveRegion, createInteractiveRegionsSignature,
}) {
  const syncPostDragInputProxyGeometry = createInputProxyGeometrySynchronizer({ getMainWindow, proxyState, createInteractiveRegionsSignature });
  return function applyPostDragInputProxyRegions() {
    if (
      !proxyState.getWindow()
      || proxyState.getWindow().isDestroyed()
      || !proxyState.getReady()
      || proxyState.getRegions().length === 0
      || !getMainWindow()
      || getMainWindow().isDestroyed()
      || !getMainWindow().isVisible()
    ) {
      return;
    }

    try {
      clearPostDragInputProxyIdleDestroyTimer();
      syncPostDragInputProxyGeometry();

      if (!proxyState.getWindow().isVisible()) {
        if (typeof proxyState.getWindow().showInactive === 'function') {
          proxyState.getWindow().showInactive();
        } else {
          proxyState.getWindow().show();
        }
        keepWindowOnTop(
          proxyState.getWindow(),
          POST_DRAG_INPUT_PROXY_TOPMOST_RELATIVE_LEVEL,
          { bringToFront: true },
        );
      }
      if (pointerDiagnosticsEnabled) {
        logWindowEvent(
          `main-window: post-drag input proxy shown count=${proxyState.getRegions().length} `
          + `first=${summarizeInteractiveRegion(proxyState.getRegions()[0])}`,
        );
      }
    } catch (error) {
      logWindowEvent(`main-window: failed to apply post-drag input proxy ${error?.stack || error}`);
      hidePostDragInputProxy('apply-failed', true);
    }
  };
}

module.exports = { createInputProxyRegionApplier };
