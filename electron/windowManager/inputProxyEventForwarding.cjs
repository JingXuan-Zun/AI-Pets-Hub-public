const SUPPORTED_INPUT_PROXY_EVENT_TYPES = ['mouseDown', 'mouseMove', 'mouseUp', 'mouseWheel'];

function createForwardedInputProxyEvent(type, inputEvent, bounds) {
  const x = Math.max(0, Math.min(bounds.width - 1, Math.round(Number(inputEvent.x || 0))));
  const y = Math.max(0, Math.min(bounds.height - 1, Math.round(Number(inputEvent.y || 0))));
  const forwardedEvent = {
    type,
    x,
    y,
  };
  if (type === 'mouseWheel') {
    forwardedEvent.deltaX = Number(inputEvent.deltaX || 0);
    // Chromium's DOM wheel event and Electron's synthetic mouseWheel input
    // use opposite vertical sign conventions. Normalize back to DOM semantics
    // before the main renderer's shared scale controller handles the event.
    forwardedEvent.deltaY = -Number(inputEvent.deltaY || 0);
  } else {
    forwardedEvent.button = ['left', 'middle', 'right'].includes(inputEvent.button)
      ? inputEvent.button
      : 'left';
    forwardedEvent.clickCount = Math.max(1, Math.min(3, Math.round(Number(inputEvent.clickCount || 1))));
    forwardedEvent.movementX = Number(inputEvent.movementX || 0);
    forwardedEvent.movementY = Number(inputEvent.movementY || 0);
  }
  return forwardedEvent;
}

function createInputProxyEventForwarder({
  proxyState, getMainWindow, isPetDragFullWindowShapeRetained, hidePostDragInputProxy,
  USE_SEPARATE_RENDER_AND_INPUT_WINDOWS, flushPostDragInputProxyPendingRegions, requestPostDragInputProxyRegions,
}) {
  function forwardPostDragInputProxyEvent(sender, inputEvent) {
    if (
      !proxyState.getWindow()
      || proxyState.getWindow().isDestroyed()
      || sender !== proxyState.getWindow().webContents
      || !getMainWindow()
      || getMainWindow().isDestroyed()
      || !inputEvent
      || typeof inputEvent !== 'object'
    ) {
      return;
    }

    const type = String(inputEvent.type || '');
    const supportedTypes = new Set(SUPPORTED_INPUT_PROXY_EVENT_TYPES);
    if (!supportedTypes.has(type)) {
      return;
    }

    const forwardedEvent = createForwardedInputProxyEvent(type, inputEvent, getMainWindow().getContentBounds());
    if (type === 'mouseDown') {
      proxyState.setPointerActive(true);
    }
    getMainWindow().webContents.sendInputEvent(forwardedEvent);
    if (type === 'mouseUp') {
      proxyState.setPointerActive(false);
      if (USE_SEPARATE_RENDER_AND_INPUT_WINDOWS) {
        flushPostDragInputProxyPendingRegions('pointer-finished');
        requestPostDragInputProxyRegions('input-proxy-pointer-finished');
        return;
      }
      if (!isPetDragFullWindowShapeRetained()) {
        hidePostDragInputProxy('pointer-finished-after-lease');
      }
    }
  }
  return forwardPostDragInputProxyEvent;
}

module.exports = { createInputProxyEventForwarder };
