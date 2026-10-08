const { createPetDragFullWindowShape } = require('./petDragFullWindowShape.cjs');
const { createPetDragShapeRefresh } = require('./petDragShapeRefresh.cjs');
const { createPetDragShapeHoldTimers } = require('./petDragShapeHoldTimers.cjs');

function createPetDragShapeHold({
  shapeState, getMainWindow, getCurrentTime, isFullWindowInteractiveShape, createFullWindowInteractiveRegion,
  createInteractiveRegionsSignature, summarizeInteractiveRegion, applyInteractiveWindowShape,
  applyPointerPassthroughState, hidePostDragInputProxy, logWindowEvent, pointerDiagnosticsEnabled,
  setTimeout, clearTimeout,
}) {
  const { isPetDragFullWindowShapeRetained, ensurePetDragFullWindowInteractiveShape } = createPetDragFullWindowShape({
    shapeState, getCurrentTime, isFullWindowInteractiveShape, createFullWindowInteractiveRegion,
    createInteractiveRegionsSignature, summarizeInteractiveRegion, applyInteractiveWindowShape,
    applyPointerPassthroughState, logWindowEvent, pointerDiagnosticsEnabled,
  });
  const { takeDeferredShapeAfterPetDragHold, requestFreshShapeAfterPetDragHold, scheduleNativeShapeRefreshAfterPetDragHold } = createPetDragShapeRefresh({
    shapeState, getMainWindow, logWindowEvent, pointerDiagnosticsEnabled, summarizeInteractiveRegion, setTimeout,
  });
  const { clearPetDragFullWindowShapeHoldTimer, schedulePetDragFullWindowShapeHoldExpiry } = createPetDragShapeHoldTimers({
    shapeState, getCurrentTime, setTimeout, clearTimeout, hidePostDragInputProxy,
    takeDeferredShapeAfterPetDragHold, requestFreshShapeAfterPetDragHold,
  });
  return { isPetDragFullWindowShapeRetained, clearPetDragFullWindowShapeHoldTimer, ensurePetDragFullWindowInteractiveShape,
    schedulePetDragFullWindowShapeHoldExpiry, scheduleNativeShapeRefreshAfterPetDragHold };
}

module.exports = { createPetDragShapeHold };
