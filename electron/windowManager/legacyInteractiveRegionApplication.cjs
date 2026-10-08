function createLegacyInteractiveRegionApplier({
  shapeState, getCurrentTime, isFullWindowInteractiveShape, isPetDragFullWindowShapeRetained,
  pointerDiagnosticsEnabled, logInteractiveRegionRequest, clearDeferredInteractiveShape, PET_DRAG_FULL_WINDOW_SHAPE_HOLD_MS,
  schedulePetDragFullWindowShapeHoldExpiry, deferInteractiveRegionsDuringPetDragHold,
  shouldKeepInteractiveShapeDuringPointerInteraction, reapplyUnchangedInteractiveShape, applyChangedInteractiveShape,
}) {
  return function applyLegacyInteractiveRegions(nextRegions, nextSignature, interactiveRegionSource) {
    const nextIsFullWindowShape = isFullWindowInteractiveShape(nextRegions);
    const nextIsPetDragFullWindowShape = interactiveRegionSource === 'pet-drag' && nextIsFullWindowShape;
    const shouldRetainPetDragFullWindowShape = !nextIsPetDragFullWindowShape
      && !nextIsFullWindowShape
      && isFullWindowInteractiveShape(shapeState.getRegions())
      && isPetDragFullWindowShapeRetained();
    const shouldHoldCurrentPetDragFullWindowShape = !nextIsPetDragFullWindowShape
      && !nextIsFullWindowShape
      && getCurrentTime() < shapeState.getHoldUntil()
      && isFullWindowInteractiveShape(shapeState.getRegions());

    if (pointerDiagnosticsEnabled) {
      logInteractiveRegionRequest(interactiveRegionSource, nextRegions, nextIsFullWindowShape,
        shouldRetainPetDragFullWindowShape || shouldHoldCurrentPetDragFullWindowShape);
    }

    if (nextIsPetDragFullWindowShape) {
      clearDeferredInteractiveShape();
      shapeState.setHoldUntil(getCurrentTime() + PET_DRAG_FULL_WINDOW_SHAPE_HOLD_MS);
      schedulePetDragFullWindowShapeHoldExpiry();
    } else if (shouldRetainPetDragFullWindowShape || shouldHoldCurrentPetDragFullWindowShape) {
      deferInteractiveRegionsDuringPetDragHold(nextRegions, nextSignature);
      return;
    }

    if (shouldKeepInteractiveShapeDuringPointerInteraction(nextRegions)) {
      return;
    }

    if (shapeState.getSignature() === nextSignature) {
      reapplyUnchangedInteractiveShape(nextRegions);
      return;
    }

    applyChangedInteractiveShape(nextRegions, nextSignature);
  };
}

module.exports = { createLegacyInteractiveRegionApplier };
