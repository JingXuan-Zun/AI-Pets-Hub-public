function createNativePointerPassthroughSetter({
  nativeShapeState, getMainWindow,
}) {
  return function setPointerPassthroughState(nextIgnore, nextForward) {
    if (
      nativeShapeState.getPointerPassthrough() === nextIgnore
      && nativeShapeState.getPointerPassthroughForwarding() === nextForward
    ) {
      return false;
    }

    nativeShapeState.setPointerPassthrough(nextIgnore);
    nativeShapeState.setPointerPassthroughForwarding(nextForward);
    getMainWindow().setIgnoreMouseEvents(nextIgnore, { forward: nextForward });
    return true;
  };
}

function createLegacyPointerPassthroughApplier({
  nativeShapeState, isFullWindowInteractiveShape, isPetDragFullWindowShapeRetained, getIsAgentDesktopExecutionActive,
  hasInteractiveWindowShape, setPointerPassthroughState, pointerDiagnosticsEnabled, logWindowEvent,
}) {
  return function applyLegacyPointerPassthroughState() {
    // Legacy path for non-Windows platforms: the main BrowserWindow owns both
    // the rendered pixels and the native interactive shape.
    const hasFullWindowShape = isFullWindowInteractiveShape(nativeShapeState.getRegions());
    // Keep the transparent full-window drag layer click-through for the whole
    // post-drag shape lease. Switching it back to interactive on pointerup while
    // the full-window shape is still active can briefly blank composed video.
    const hasPetDragPassthrough = isPetDragFullWindowShapeRetained();
    const nextIgnore = getIsAgentDesktopExecutionActive()
      ? !hasInteractiveWindowShape()
      : hasPetDragPassthrough
        ? true
        : Boolean(nativeShapeState.getRequestedPointerPassthrough()) && !hasFullWindowShape;
    const nextForward = hasPetDragPassthrough;
    if (!setPointerPassthroughState(nextIgnore, nextForward)) {
      return;
    }
    if (pointerDiagnosticsEnabled) {
      logWindowEvent(
        `main-window: pointer passthrough ignore=${nextIgnore} `
        + `forward=${nextForward} requested=${nativeShapeState.getRequestedPointerPassthrough()} `
        + `shapeActive=${hasInteractiveWindowShape()} petDragPassthrough=${hasPetDragPassthrough}`,
      );
    }
  };
}

function createNativePointerPassthroughApplier({
  nativeShapeState, getMainWindow, getInputProxyRegionCount, isFullWindowInteractiveShape,
  isPetDragFullWindowShapeRetained, getIsAgentDesktopExecutionActive, hasInteractiveWindowShape,
  pointerDiagnosticsEnabled, logWindowEvent, USE_SEPARATE_RENDER_AND_INPUT_WINDOWS,
}) {
  const setPointerPassthroughState = createNativePointerPassthroughSetter({ nativeShapeState, getMainWindow });
  const applyLegacyPointerPassthroughState = createLegacyPointerPassthroughApplier({
    nativeShapeState, isFullWindowInteractiveShape, isPetDragFullWindowShapeRetained, getIsAgentDesktopExecutionActive,
    hasInteractiveWindowShape, setPointerPassthroughState, pointerDiagnosticsEnabled, logWindowEvent,
  });
  return function applyPointerPassthroughState() {
    if (!getMainWindow() || getMainWindow().isDestroyed()) {
      nativeShapeState.setPointerPassthrough(Boolean(nativeShapeState.getRequestedPointerPassthrough()));
      nativeShapeState.setPointerPassthroughForwarding(false);
      return;
    }

    if (USE_SEPARATE_RENDER_AND_INPUT_WINDOWS) {
      const nextIgnore = true;
      const nextForward = false;
      if (!setPointerPassthroughState(nextIgnore, nextForward)) {
        return;
      }
      if (pointerDiagnosticsEnabled) {
        logWindowEvent(
          `main-window: permanent render passthrough ignore=${nextIgnore} `
          + `forward=${nextForward} inputProxy=${getInputProxyRegionCount()}`,
        );
      }
      return;
    }

    applyLegacyPointerPassthroughState();
  };
}

module.exports = { createNativePointerPassthroughApplier };
