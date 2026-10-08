function createSeparateWindowPetDragSession({
  shapeState, ensurePostDragInputProxyWindow, pointerDiagnosticsEnabled, logWindowEvent,
  flushPostDragInputProxyPendingRegions, requestPostDragInputProxyRegions, applyPointerPassthroughState,
}) {
  return function setSeparateWindowPetDragActive(nextActive) {
    if (shapeState.getPetDragNativeShapeActive() === nextActive) {
      return;
    }

    shapeState.setPetDragNativeShapeActive(nextActive);
    if (nextActive) {
      ensurePostDragInputProxyWindow();
      if (pointerDiagnosticsEnabled) {
        logWindowEvent('main-window: input proxy drag capture started');
      }
    } else {
      flushPostDragInputProxyPendingRegions('drag-session-ended');
      requestPostDragInputProxyRegions('input-proxy-drag-ended');
      if (pointerDiagnosticsEnabled) {
        logWindowEvent('main-window: input proxy drag capture ended');
      }
    }
    applyPointerPassthroughState();
  };
}

function createPetDragNativeSessionStarter({
  shapeState, ensurePostDragInputProxyWindow, clearPetDragFullWindowShapeHoldTimer,
  ensurePetDragFullWindowInteractiveShape, pointerDiagnosticsEnabled, logWindowEvent,
}) {
  return function startPetDragNativeShapeSession() {
    ensurePostDragInputProxyWindow();
    shapeState.setPendingRegions(null);
    shapeState.setPendingSignature('');
    shapeState.setPendingReceivedAt(0);
    shapeState.setEndedAt(0);
    shapeState.setHoldUntil(0);
    clearPetDragFullWindowShapeHoldTimer();
    ensurePetDragFullWindowInteractiveShape('active-session-start');
    if (pointerDiagnosticsEnabled) {
      logWindowEvent('main-window: pet drag native shape session started with stable full-window shape');
    }
  };
}

function createPetDragNativeSessionEnder({
  shapeState, getCurrentTime, isFullWindowInteractiveShape, clearPetDragFullWindowShapeHoldTimer, applyPointerPassthroughState,
  scheduleNativeShapeRefreshAfterPetDragHold, pointerDiagnosticsEnabled, logWindowEvent, PET_DRAG_FULL_WINDOW_SHAPE_HOLD_MS,
  ensurePetDragFullWindowInteractiveShape, schedulePetDragFullWindowShapeHoldExpiry, requestPostDragInputProxyRegions,
  setTimeout, isPetDragFullWindowShapeRetained,
}) {
  return function endPetDragNativeShapeSession() {
    shapeState.setEndedAt(getCurrentTime());
    if (!isFullWindowInteractiveShape(shapeState.getRegions())) {
      shapeState.setHoldUntil(0);
      clearPetDragFullWindowShapeHoldTimer();
      applyPointerPassthroughState();
      scheduleNativeShapeRefreshAfterPetDragHold('bounded-pet-drag-session-ended');
      if (pointerDiagnosticsEnabled) {
        logWindowEvent('main-window: bounded pet drag native shape session ended');
      }
      return;
    }

    shapeState.setHoldUntil(getCurrentTime() + PET_DRAG_FULL_WINDOW_SHAPE_HOLD_MS);
    ensurePetDragFullWindowInteractiveShape('active-session-end-hold');
    schedulePetDragFullWindowShapeHoldExpiry();
    requestPostDragInputProxyRegions('pet-drag-session-ended');
    setTimeout(() => {
      if (!shapeState.getPetDragNativeShapeActive() && isPetDragFullWindowShapeRetained()) {
        requestPostDragInputProxyRegions('pet-drag-session-ended-post-commit');
      }
    }, 32);
    if (pointerDiagnosticsEnabled) {
      logWindowEvent('main-window: pet drag native shape session ended');
    }
  };
}

function createPetDragNativeSessionActions(dependencies) {
  const setSeparateWindowPetDragActive = createSeparateWindowPetDragSession(dependencies);
  const startPetDragNativeShapeSession = createPetDragNativeSessionStarter(dependencies);
  const endPetDragNativeShapeSession = createPetDragNativeSessionEnder(dependencies);
  return { setSeparateWindowPetDragActive, startPetDragNativeShapeSession, endPetDragNativeShapeSession };
}

module.exports = { createPetDragNativeSessionActions };
