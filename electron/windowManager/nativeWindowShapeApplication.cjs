function createNativeWindowShapeCapabilities({ nativeShapeState, getMainWindow, getPlatform, USE_SEPARATE_RENDER_AND_INPUT_WINDOWS }) {
  function canApplyInteractiveWindowShape() {
    return getPlatform() === 'win32'
      && !USE_SEPARATE_RENDER_AND_INPUT_WINDOWS
      && getMainWindow()
      && !getMainWindow().isDestroyed()
      && typeof getMainWindow().setShape === 'function';
  }

  function hasInteractiveWindowShape() {
    return canApplyInteractiveWindowShape() && nativeShapeState.getRegions().length > 0;
  }

  return { canApplyInteractiveWindowShape, hasInteractiveWindowShape };
}

function createNativeWindowShapeApplier({
  nativeShapeState, getMainWindow, getPlatform, getIsAgentDesktopExecutionActive,
  USE_SEPARATE_RENDER_AND_INPUT_WINDOWS, pointerDiagnosticsEnabled, logWindowEvent, summarizeInteractiveRegion,
}) {
  return function applyInteractiveWindowShape() {
    if (!getMainWindow() || getMainWindow().isDestroyed() || typeof getMainWindow().setShape !== 'function') {
      nativeShapeState.setApplied(false);
      return;
    }

    if (getIsAgentDesktopExecutionActive()) {
      return;
    }

    if (USE_SEPARATE_RENDER_AND_INPUT_WINDOWS) {
      nativeShapeState.setApplied(false);
      return;
    }

    try {
      if (getPlatform() === 'win32' && nativeShapeState.getRegions().length > 0) {
        getMainWindow().setShape(nativeShapeState.getRegions());
        nativeShapeState.setApplied(true);
        if (pointerDiagnosticsEnabled) {
          const bounds = getMainWindow().getBounds();
          logWindowEvent(
            `main-window: applied interactive shape count=${nativeShapeState.getRegions().length} `
            + `first=${summarizeInteractiveRegion(nativeShapeState.getRegions()[0])} `
            + `bounds=${bounds.x},${bounds.y},${bounds.width},${bounds.height}`,
          );
        }
        return;
      }

      if (nativeShapeState.getApplied()) {
        getMainWindow().setShape([]);
        nativeShapeState.setApplied(false);
        if (pointerDiagnosticsEnabled) {
          logWindowEvent('main-window: cleared interactive shape');
        }
      }
    } catch (error) {
      nativeShapeState.setApplied(false);
      logWindowEvent(`main-window: failed to apply interactive shape ${error?.stack || error}`);
    }
  };
}

module.exports = { createNativeWindowShapeCapabilities, createNativeWindowShapeApplier };
