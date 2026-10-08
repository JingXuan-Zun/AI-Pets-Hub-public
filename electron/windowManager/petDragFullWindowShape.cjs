function createPetDragShapeRetentionQuery({
  shapeState, getCurrentTime,
}) {
  return function isPetDragFullWindowShapeRetained() {
    return shapeState.getPetDragNativeShapeActive() || getCurrentTime() < shapeState.getHoldUntil();
  };
}

function createPetDragFullWindowShapeEnsurer({
  shapeState, createFullWindowInteractiveRegion, createInteractiveRegionsSignature, isFullWindowInteractiveShape,
  pointerDiagnosticsEnabled, logWindowEvent, summarizeInteractiveRegion, applyInteractiveWindowShape, applyPointerPassthroughState,
}) {
  return function ensurePetDragFullWindowInteractiveShape(reason) {
    const fullWindowRegion = createFullWindowInteractiveRegion();
    if (!fullWindowRegion) {
      return;
    }

    const fullWindowRegions = [fullWindowRegion];
    const fullWindowSignature = createInteractiveRegionsSignature(fullWindowRegions);
    const shouldApply = shapeState.getSignature() !== fullWindowSignature
      || !shapeState.getApplied()
      || !isFullWindowInteractiveShape(shapeState.getRegions());

    shapeState.setRegions(fullWindowRegions);
    shapeState.setSignature(fullWindowSignature);
    if (shouldApply) {
      if (pointerDiagnosticsEnabled) {
        logWindowEvent(
          `main-window: retained pet drag full-window shape reason=${reason} `
          + `first=${summarizeInteractiveRegion(fullWindowRegion)}`,
        );
      }
      applyInteractiveWindowShape();
    }
    applyPointerPassthroughState();
  };
}

function createPetDragFullWindowShape(dependencies) {
  const isPetDragFullWindowShapeRetained = createPetDragShapeRetentionQuery(dependencies);
  const ensurePetDragFullWindowInteractiveShape = createPetDragFullWindowShapeEnsurer(dependencies);
  return { isPetDragFullWindowShapeRetained, ensurePetDragFullWindowInteractiveShape };
}

module.exports = { createPetDragFullWindowShape };
