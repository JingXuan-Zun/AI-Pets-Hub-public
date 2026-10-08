const { createPetDragShapeHold } = require('./petDragShapeHold.cjs');
const { createPostDragInputProxyRouting } = require('./postDragInputProxyRouting.cjs');
const { createInteractiveRegionRequests } = require('./interactiveRegionRequests.cjs');
const { createPetDragNativeShapeSession } = require('./petDragNativeShapeSession.cjs');

function createDragHoldAndProxyRouting(dependencies) {
  const {
    shapeState, proxyState, getMainWindow, getCurrentTime, getPetDragNativeShapeActive,
    isFullWindowInteractiveShape, createFullWindowInteractiveRegion, createInteractiveRegionsSignature,
    summarizeInteractiveRegion, applyInteractiveWindowShape, applyPointerPassthroughState,
    hidePostDragInputProxy, logWindowEvent, pointerDiagnosticsEnabled, setTimeout, clearTimeout,
    normalizeInteractiveRegions, ensurePostDragInputProxyWindow, applyPostDragInputProxyRegions,
    USE_SEPARATE_RENDER_AND_INPUT_WINDOWS,
  } = dependencies;
  const hold = createPetDragShapeHold({
    shapeState, getMainWindow, getCurrentTime,
    isFullWindowInteractiveShape, createFullWindowInteractiveRegion,
    createInteractiveRegionsSignature, summarizeInteractiveRegion, applyInteractiveWindowShape,
    applyPointerPassthroughState, hidePostDragInputProxy, logWindowEvent, pointerDiagnosticsEnabled,
    setTimeout, clearTimeout,
  });
  const { isPetDragFullWindowShapeRetained } = hold;
  const routing = createPostDragInputProxyRouting({
    proxyState, getMainWindow, getPetDragNativeShapeActive, normalizeInteractiveRegions,
    isFullWindowInteractiveShape, isPetDragFullWindowShapeRetained,
    hidePostDragInputProxy, ensurePostDragInputProxyWindow, applyPostDragInputProxyRegions,
    logWindowEvent, pointerDiagnosticsEnabled, USE_SEPARATE_RENDER_AND_INPUT_WINDOWS,
  });
  return { hold, routing };
}

function createInteractiveShapeControllers(dependencies) {
  const {
    shapeState, getCurrentTime, normalizeInteractiveRegions, createInteractiveRegionsSignature,
    normalizeInteractiveRegionSource, summarizeInteractiveRegion, isFullWindowInteractiveShape,
    canApplyInteractiveWindowShape, applyInteractiveWindowShape, applyPointerPassthroughState,
    hidePostDragInputProxy, logWindowEvent, pointerDiagnosticsEnabled, USE_SEPARATE_RENDER_AND_INPUT_WINDOWS,
    PET_DRAG_FULL_WINDOW_SHAPE_HOLD_MS, ensurePostDragInputProxyWindow, setTimeout,
  } = dependencies;
  const { hold, routing } = createDragHoldAndProxyRouting(dependencies);
  const { isPetDragFullWindowShapeRetained, ensurePetDragFullWindowInteractiveShape,
    clearPetDragFullWindowShapeHoldTimer, schedulePetDragFullWindowShapeHoldExpiry, scheduleNativeShapeRefreshAfterPetDragHold } = hold;
  const { setPostDragInputProxyRegions, flushPostDragInputProxyPendingRegions, requestPostDragInputProxyRegions,
    forwardPostDragInputProxyEvent } = routing;
  const setInteractiveRegions = createInteractiveRegionRequests({
    shapeState, getCurrentTime, normalizeInteractiveRegions,
    createInteractiveRegionsSignature, normalizeInteractiveRegionSource, summarizeInteractiveRegion,
    isFullWindowInteractiveShape, isPetDragFullWindowShapeRetained, ensurePetDragFullWindowInteractiveShape,
    schedulePetDragFullWindowShapeHoldExpiry, canApplyInteractiveWindowShape, applyInteractiveWindowShape,
    applyPointerPassthroughState, setPostDragInputProxyRegions, hidePostDragInputProxy, logWindowEvent,
    pointerDiagnosticsEnabled, USE_SEPARATE_RENDER_AND_INPUT_WINDOWS, PET_DRAG_FULL_WINDOW_SHAPE_HOLD_MS,
  });
  const setPetDragNativeShapeActive = createPetDragNativeShapeSession({
    shapeState, getCurrentTime, isFullWindowInteractiveShape,
    isPetDragFullWindowShapeRetained, ensurePetDragFullWindowInteractiveShape, clearPetDragFullWindowShapeHoldTimer,
    schedulePetDragFullWindowShapeHoldExpiry, scheduleNativeShapeRefreshAfterPetDragHold, applyPointerPassthroughState,
    ensurePostDragInputProxyWindow, flushPostDragInputProxyPendingRegions, requestPostDragInputProxyRegions,
    logWindowEvent, pointerDiagnosticsEnabled, USE_SEPARATE_RENDER_AND_INPUT_WINDOWS,
    PET_DRAG_FULL_WINDOW_SHAPE_HOLD_MS, setTimeout,
  });
  return { isPetDragFullWindowShapeRetained, forwardPostDragInputProxyEvent, setInteractiveRegions, setPetDragNativeShapeActive };
}

module.exports = { createInteractiveShapeControllers };
