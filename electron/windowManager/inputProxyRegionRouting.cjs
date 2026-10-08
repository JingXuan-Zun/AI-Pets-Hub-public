function createInputProxyRegionSetter({
  proxyState, normalizeInteractiveRegions, isFullWindowInteractiveShape, getPetDragNativeShapeActive,
  hidePostDragInputProxy, ensurePostDragInputProxyWindow, applyPostDragInputProxyRegions, logWindowEvent, pointerDiagnosticsEnabled,
}) {
  function setPostDragInputProxyRegions(regions) {
    const nextRegions = normalizeInteractiveRegions(regions);
    if (isFullWindowInteractiveShape(nextRegions)) {
      if (pointerDiagnosticsEnabled) {
        logWindowEvent('main-window: ignored full-window input proxy region; pointer capture owns active drag');
      }
      return;
    }

    if (proxyState.getPointerActive() || getPetDragNativeShapeActive()) {
      proxyState.setPendingRegions(nextRegions);
      if (pointerDiagnosticsEnabled) {
        logWindowEvent(
          `main-window: deferred input proxy shape during captured pointer count=${nextRegions.length}`,
        );
      }
      return;
    }

    proxyState.setPendingRegions(null);
    proxyState.setRegions(nextRegions);
    if (proxyState.getRegions().length === 0) {
      hidePostDragInputProxy('empty-regions');
      return;
    }

    ensurePostDragInputProxyWindow();
    applyPostDragInputProxyRegions();
  }
  return setPostDragInputProxyRegions;
}

function createInputProxyRegionFlusher({
  proxyState, getPetDragNativeShapeActive, hidePostDragInputProxy, applyPostDragInputProxyRegions,
  logWindowEvent, pointerDiagnosticsEnabled,
}) {
  function flushPostDragInputProxyPendingRegions(reason) {
    if (
      proxyState.getPointerActive()
      || getPetDragNativeShapeActive()
      || !proxyState.getPendingRegions()
    ) {
      return;
    }

    const nextRegions = proxyState.getPendingRegions();
    proxyState.setPendingRegions(null);
    proxyState.setRegions(nextRegions);
    if (nextRegions.length === 0) {
      hidePostDragInputProxy(`${reason}-empty`);
      return;
    }

    applyPostDragInputProxyRegions();
    if (pointerDiagnosticsEnabled) {
      logWindowEvent(
        `main-window: flushed input proxy shape reason=${reason} count=${nextRegions.length}`,
      );
    }
  }
  return flushPostDragInputProxyPendingRegions;
}

function createInputProxyRegionRequester({
  getMainWindow,
}) {
  function requestPostDragInputProxyRegions(reason) {
    if (!getMainWindow() || getMainWindow().isDestroyed()) {
      return;
    }

    getMainWindow().webContents.send('desktop-pet:refresh-native-interactive-regions', {
      inputProxy: true,
      reason,
    });
  }
  return requestPostDragInputProxyRegions;
}

function createInputProxyRegionRouting(dependencies) {
  const setPostDragInputProxyRegions = createInputProxyRegionSetter(dependencies);
  const flushPostDragInputProxyPendingRegions = createInputProxyRegionFlusher(dependencies);
  const requestPostDragInputProxyRegions = createInputProxyRegionRequester(dependencies);
  return { setPostDragInputProxyRegions, flushPostDragInputProxyPendingRegions, requestPostDragInputProxyRegions };
}

module.exports = { createInputProxyRegionRouting };
