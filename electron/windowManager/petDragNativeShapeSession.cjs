const { createPetDragNativeSessionActions } = require('./petDragNativeSessionActions.cjs');

function createPetDragNativeShapeSession({
  shapeState, getCurrentTime, isFullWindowInteractiveShape, isPetDragFullWindowShapeRetained,
  ensurePetDragFullWindowInteractiveShape, clearPetDragFullWindowShapeHoldTimer,
  schedulePetDragFullWindowShapeHoldExpiry, scheduleNativeShapeRefreshAfterPetDragHold, applyPointerPassthroughState,
  ensurePostDragInputProxyWindow, flushPostDragInputProxyPendingRegions, requestPostDragInputProxyRegions,
  logWindowEvent, pointerDiagnosticsEnabled, USE_SEPARATE_RENDER_AND_INPUT_WINDOWS,
  PET_DRAG_FULL_WINDOW_SHAPE_HOLD_MS, setTimeout,
}) {
  const { setSeparateWindowPetDragActive, startPetDragNativeShapeSession, endPetDragNativeShapeSession }
    = createPetDragNativeSessionActions({
    shapeState, getCurrentTime, isFullWindowInteractiveShape, isPetDragFullWindowShapeRetained,
    ensurePetDragFullWindowInteractiveShape, clearPetDragFullWindowShapeHoldTimer,
    schedulePetDragFullWindowShapeHoldExpiry, scheduleNativeShapeRefreshAfterPetDragHold, applyPointerPassthroughState,
    ensurePostDragInputProxyWindow, flushPostDragInputProxyPendingRegions, requestPostDragInputProxyRegions,
    logWindowEvent, pointerDiagnosticsEnabled, PET_DRAG_FULL_WINDOW_SHAPE_HOLD_MS, setTimeout,
  });
  return function setPetDragNativeShapeActive(active) {
    const nextActive = Boolean(active);

    if (USE_SEPARATE_RENDER_AND_INPUT_WINDOWS) {
      setSeparateWindowPetDragActive(nextActive);
      return;
    }

    if (pointerDiagnosticsEnabled) {
      logWindowEvent(
        `DRAG-TRACE-V2 session-request next=${nextActive} current=${shapeState.getPetDragNativeShapeActive()} `
        + `shapeApplied=${shapeState.getApplied()} `
        + `shapeCount=${shapeState.getRegions().length} `
        + `retained=${isPetDragFullWindowShapeRetained()}`,
      );
    }
    if (shapeState.getPetDragNativeShapeActive() === nextActive) {
      if (nextActive) {
        ensurePetDragFullWindowInteractiveShape('active-session-refresh');
      }
      return;
    }

    shapeState.setPetDragNativeShapeActive(nextActive);
    if (nextActive) {
      startPetDragNativeShapeSession();
      return;
    }

    endPetDragNativeShapeSession();
  };
}

module.exports = { createPetDragNativeShapeSession };
