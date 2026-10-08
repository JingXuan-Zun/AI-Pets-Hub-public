function createSeparateWindowInteractiveRegionApplier({
  shapeState, isFullWindowInteractiveShape, pointerDiagnosticsEnabled, logWindowEvent,
  clearDeferredInteractiveShape, setPostDragInputProxyRegions, applyPointerPassthroughState,
}) {
  return function applySeparateWindowInteractiveRegions(nextRegions, nextSignature, interactiveRegionSource) {
    if (
      interactiveRegionSource === 'pet-drag'
      && isFullWindowInteractiveShape(nextRegions)
    ) {
      if (pointerDiagnosticsEnabled) {
        logWindowEvent('main-window: kept local input proxy regions during active drag');
      }
      return;
    }

    clearDeferredInteractiveShape();
    shapeState.setRegions(nextRegions);
    shapeState.setSignature(nextSignature);
    if (interactiveRegionSource === 'pet-drag') {
      setPostDragInputProxyRegions(nextRegions);
    }
    applyPointerPassthroughState();
  };
}

function createInteractiveRegionRequestDispatcher({
  normalizeInteractiveRegions, createInteractiveRegionsSignature, normalizeInteractiveRegionSource,
  USE_SEPARATE_RENDER_AND_INPUT_WINDOWS, setPostDragInputProxyRegions,
  applySeparateWindowInteractiveRegions, applyLegacyInteractiveRegions,
}) {
  return function setInteractiveRegions(regions, options = null) {
    const nextInteractiveWindowShapeRegions = normalizeInteractiveRegions(regions);
    const nextInteractiveWindowShapeSignature = createInteractiveRegionsSignature(nextInteractiveWindowShapeRegions);
    const interactiveRegionSource = normalizeInteractiveRegionSource(options);

    if (interactiveRegionSource === 'render-input-proxy') {
      if (USE_SEPARATE_RENDER_AND_INPUT_WINDOWS) {
        setPostDragInputProxyRegions(nextInteractiveWindowShapeRegions);
      }
      return;
    }

    if (USE_SEPARATE_RENDER_AND_INPUT_WINDOWS) {
      applySeparateWindowInteractiveRegions(
        nextInteractiveWindowShapeRegions, nextInteractiveWindowShapeSignature, interactiveRegionSource,
      );
      return;
    }

    if (interactiveRegionSource === 'post-drag-input-proxy') {
      setPostDragInputProxyRegions(nextInteractiveWindowShapeRegions);
      return;
    }
    applyLegacyInteractiveRegions(
      nextInteractiveWindowShapeRegions, nextInteractiveWindowShapeSignature, interactiveRegionSource,
    );
  };
}

module.exports = { createSeparateWindowInteractiveRegionApplier, createInteractiveRegionRequestDispatcher };
