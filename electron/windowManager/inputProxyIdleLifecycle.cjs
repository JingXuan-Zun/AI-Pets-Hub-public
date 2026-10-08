function createInputProxyIdleTimerClearer({
  proxyState, clearTimeout,
}) {
  return function clearPostDragInputProxyIdleDestroyTimer() {
    if (!proxyState.getIdleDestroyTimer()) {
      return;
    }

    clearTimeout(proxyState.getIdleDestroyTimer());
    proxyState.setIdleDestroyTimer(null);
  };
}

function createInputProxyIdleDestroyScheduler({
  proxyState, clearPostDragInputProxyIdleDestroyTimer, pointerDiagnosticsEnabled, logWindowEvent,
  POST_DRAG_INPUT_PROXY_IDLE_DESTROY_MS, setTimeout,
}) {
  return function schedulePostDragInputProxyIdleDestroy(reason) {
    clearPostDragInputProxyIdleDestroyTimer();
    if (
      !proxyState.getWindow()
      || proxyState.getWindow().isDestroyed()
      || proxyState.getPointerActive()
    ) {
      return;
    }

    proxyState.setIdleDestroyTimer(setTimeout(() => {
      proxyState.setIdleDestroyTimer(null);
      if (
        !proxyState.getWindow()
        || proxyState.getWindow().isDestroyed()
        || proxyState.getPointerActive()
        || proxyState.getWindow().isVisible()
      ) {
        return;
      }

      if (pointerDiagnosticsEnabled) {
        logWindowEvent(`main-window: post-drag input proxy destroyed reason=${reason}`);
      }
      proxyState.getWindow().destroy();
    }, POST_DRAG_INPUT_PROXY_IDLE_DESTROY_MS));
    if (typeof proxyState.getIdleDestroyTimer().unref === 'function') {
      proxyState.getIdleDestroyTimer().unref();
    }
  };
}

function createInputProxyHider({
  proxyState, schedulePostDragInputProxyIdleDestroy, pointerDiagnosticsEnabled, logWindowEvent,
}) {
  return function hidePostDragInputProxy(reason, force = false) {
    if (proxyState.getPointerActive() && !force) {
      return;
    }

    proxyState.setRegions([]);
    proxyState.setPendingRegions(null);
    proxyState.setShapeSignature('');
    if (!proxyState.getWindow() || proxyState.getWindow().isDestroyed()) {
      return;
    }

    proxyState.getWindow().hide();
    schedulePostDragInputProxyIdleDestroy(reason);
    if (pointerDiagnosticsEnabled) {
      logWindowEvent(`main-window: post-drag input proxy hidden reason=${reason}`);
    }
  };
}

function createInputProxyIdleLifecycle({
  proxyState, clearTimeout, setTimeout, pointerDiagnosticsEnabled, logWindowEvent, POST_DRAG_INPUT_PROXY_IDLE_DESTROY_MS,
}) {
  const clearPostDragInputProxyIdleDestroyTimer = createInputProxyIdleTimerClearer({ proxyState, clearTimeout });
  const schedulePostDragInputProxyIdleDestroy = createInputProxyIdleDestroyScheduler({
    proxyState, clearPostDragInputProxyIdleDestroyTimer, pointerDiagnosticsEnabled, logWindowEvent,
    POST_DRAG_INPUT_PROXY_IDLE_DESTROY_MS, setTimeout,
  });
  const hidePostDragInputProxy = createInputProxyHider({
    proxyState, schedulePostDragInputProxyIdleDestroy, pointerDiagnosticsEnabled, logWindowEvent,
  });
  return { clearPostDragInputProxyIdleDestroyTimer, hidePostDragInputProxy };
}

module.exports = { createInputProxyIdleLifecycle };
