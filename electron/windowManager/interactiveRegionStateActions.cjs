function createDeferredInteractiveShapeClearer({
  shapeState,
}) {
  return function clearDeferredInteractiveShape() {
    shapeState.setPendingRegions(null);
    shapeState.setPendingSignature('');
    shapeState.setPendingReceivedAt(0);
  };
}

function createInteractiveRegionRequestLogger({
  shapeState, logWindowEvent, isPetDragFullWindowShapeRetained,
}) {
  return function logInteractiveRegionRequest(interactiveRegionSource, nextRegions, nextIsFullWindowShape, shouldDefer) {
    logWindowEvent(
      `DRAG-TRACE-V2 regions-request source=${interactiveRegionSource || 'unknown'} `
      + `nextCount=${nextRegions.length} nextFull=${nextIsFullWindowShape} `
      + `currentCount=${shapeState.getRegions().length} `
      + `currentApplied=${shapeState.getApplied()} `
      + `session=${shapeState.getPetDragNativeShapeActive()} retained=${isPetDragFullWindowShapeRetained()} `
      + `defer=${shouldDefer}`,
    );
  };
}

function createHeldInteractiveRegionDeferrer({
  shapeState, getCurrentTime, schedulePetDragFullWindowShapeHoldExpiry, ensurePetDragFullWindowInteractiveShape,
  pointerDiagnosticsEnabled, logWindowEvent, summarizeInteractiveRegion, applyPointerPassthroughState,
}) {
  return function deferInteractiveRegionsDuringPetDragHold(nextRegions, nextSignature) {
    shapeState.setPendingRegions(nextRegions);
    shapeState.setPendingSignature(nextSignature);
    shapeState.setPendingReceivedAt(getCurrentTime());
    schedulePetDragFullWindowShapeHoldExpiry();
    ensurePetDragFullWindowInteractiveShape(shapeState.getPetDragNativeShapeActive() ? 'active-session' : 'post-drag-hold');
    if (pointerDiagnosticsEnabled) {
      logWindowEvent(
        `main-window: retained pet drag full-window shape while deferring `
        + `count=${nextRegions.length} `
        + `first=${summarizeInteractiveRegion(nextRegions[0])}`,
      );
    }
    applyPointerPassthroughState();
  };
}

function createInteractiveShapeRetentionQuery({
  shapeState, pointerDiagnosticsEnabled, logWindowEvent, summarizeInteractiveRegion,
}) {
  return function shouldKeepInteractiveShapeDuringPointerInteraction(nextRegions) {
    if (
      nextRegions.length === 0
      && !shapeState.getRequestedPointerPassthrough()
      && shapeState.getRegions().length > 0
    ) {
      if (pointerDiagnosticsEnabled) {
        logWindowEvent(
          `main-window: retained interactive shape during active pointer interaction `
          + `first=${summarizeInteractiveRegion(shapeState.getRegions()[0])}`,
        );
      }
      return true;
    }
    return false;
  };
}

function createUnchangedInteractiveShapeApplier({
  shapeState, canApplyInteractiveWindowShape, applyInteractiveWindowShape, applyPointerPassthroughState,
}) {
  return function reapplyUnchangedInteractiveShape(nextRegions) {
    if (
      nextRegions.length > 0
      && canApplyInteractiveWindowShape()
      && !shapeState.getApplied()
    ) {
      shapeState.setRegions(nextRegions);
      applyInteractiveWindowShape();
      applyPointerPassthroughState();
    }
  };
}

function createChangedInteractiveShapeApplier({
  shapeState, clearDeferredInteractiveShape, pointerDiagnosticsEnabled, logWindowEvent, summarizeInteractiveRegion,
  applyInteractiveWindowShape, applyPointerPassthroughState, isPetDragFullWindowShapeRetained, hidePostDragInputProxy,
}) {
  return function applyChangedInteractiveShape(nextRegions, nextSignature) {
    clearDeferredInteractiveShape();
    shapeState.setRegions(nextRegions);
    if (pointerDiagnosticsEnabled && shapeState.getSignature() !== nextSignature) {
      logWindowEvent(
        `main-window: received interactive shape count=${shapeState.getRegions().length} `
        + `first=${summarizeInteractiveRegion(shapeState.getRegions()[0])}`,
      );
    }
    shapeState.setSignature(nextSignature);
    applyInteractiveWindowShape();
    applyPointerPassthroughState();
    if (!isPetDragFullWindowShapeRetained()) {
      hidePostDragInputProxy('main-shape-restored');
    }
  };
}

function createInteractiveRegionStateActions(dependencies) {
  const clearDeferredInteractiveShape = createDeferredInteractiveShapeClearer(dependencies);
  const logInteractiveRegionRequest = createInteractiveRegionRequestLogger(dependencies);
  const deferInteractiveRegionsDuringPetDragHold = createHeldInteractiveRegionDeferrer(dependencies);
  const shouldKeepInteractiveShapeDuringPointerInteraction = createInteractiveShapeRetentionQuery(dependencies);
  const reapplyUnchangedInteractiveShape = createUnchangedInteractiveShapeApplier(dependencies);
  const applyChangedInteractiveShape = createChangedInteractiveShapeApplier({ ...dependencies, clearDeferredInteractiveShape });
  return { clearDeferredInteractiveShape, logInteractiveRegionRequest, deferInteractiveRegionsDuringPetDragHold,
    shouldKeepInteractiveShapeDuringPointerInteraction, reapplyUnchangedInteractiveShape, applyChangedInteractiveShape };
}

module.exports = { createInteractiveRegionStateActions };
