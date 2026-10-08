const { createInteractiveRegionStateActions } = require('./interactiveRegionStateActions.cjs');
const { createLegacyInteractiveRegionApplier } = require('./legacyInteractiveRegionApplication.cjs');
const { createSeparateWindowInteractiveRegionApplier, createInteractiveRegionRequestDispatcher } = require('./interactiveRegionRequestDispatch.cjs');

function createInteractiveRegionRequests({
  shapeState, getCurrentTime, normalizeInteractiveRegions, createInteractiveRegionsSignature,
  normalizeInteractiveRegionSource, summarizeInteractiveRegion, isFullWindowInteractiveShape,
  isPetDragFullWindowShapeRetained, ensurePetDragFullWindowInteractiveShape, schedulePetDragFullWindowShapeHoldExpiry,
  canApplyInteractiveWindowShape, applyInteractiveWindowShape, applyPointerPassthroughState,
  setPostDragInputProxyRegions, hidePostDragInputProxy, logWindowEvent, pointerDiagnosticsEnabled,
  USE_SEPARATE_RENDER_AND_INPUT_WINDOWS, PET_DRAG_FULL_WINDOW_SHAPE_HOLD_MS,
}) {
  const actions = createInteractiveRegionStateActions({
    shapeState, getCurrentTime, isPetDragFullWindowShapeRetained, ensurePetDragFullWindowInteractiveShape,
    schedulePetDragFullWindowShapeHoldExpiry, canApplyInteractiveWindowShape, applyInteractiveWindowShape,
    applyPointerPassthroughState, hidePostDragInputProxy, logWindowEvent, pointerDiagnosticsEnabled, summarizeInteractiveRegion,
  });
  const applySeparateWindowInteractiveRegions = createSeparateWindowInteractiveRegionApplier({
    shapeState, isFullWindowInteractiveShape, pointerDiagnosticsEnabled, logWindowEvent,
    clearDeferredInteractiveShape: actions.clearDeferredInteractiveShape, setPostDragInputProxyRegions, applyPointerPassthroughState,
  });
  const applyLegacyInteractiveRegions = createLegacyInteractiveRegionApplier({
    ...actions, shapeState, getCurrentTime, isFullWindowInteractiveShape, isPetDragFullWindowShapeRetained,
    pointerDiagnosticsEnabled, PET_DRAG_FULL_WINDOW_SHAPE_HOLD_MS, schedulePetDragFullWindowShapeHoldExpiry,
  });
  return createInteractiveRegionRequestDispatcher({
    normalizeInteractiveRegions, createInteractiveRegionsSignature, normalizeInteractiveRegionSource,
    USE_SEPARATE_RENDER_AND_INPUT_WINDOWS, setPostDragInputProxyRegions,
    applySeparateWindowInteractiveRegions, applyLegacyInteractiveRegions,
  });
}

module.exports = { createInteractiveRegionRequests };
