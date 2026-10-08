function createMainInteractiveLayerWarmupRecovery({
  warmupState, nativeShapeState, getMainWindow, getPlatform, applyInteractiveWindowShape, applyPointerPassthroughState,
  logWindowEvent, pointerDiagnosticsEnabled, USE_SEPARATE_RENDER_AND_INPUT_WINDOWS,
}) {
  function canWarmMainInteractiveLayer() {
    return getPlatform() === 'win32'
      && !USE_SEPARATE_RENDER_AND_INPUT_WINDOWS
      && getMainWindow()
      && !getMainWindow().isDestroyed()
      && getMainWindow().isVisible()
      && typeof getMainWindow().setShape === 'function'
      && typeof getMainWindow().setIgnoreMouseEvents === 'function';
  }

  function restoreMainInteractiveLayerWarmup() {
    warmupState.setRestoreTimer(null);
    if (!getMainWindow() || getMainWindow().isDestroyed()) {
      return;
    }

    try {
      if (nativeShapeState.getRegions().length > 0) {
        applyInteractiveWindowShape();
      } else if (nativeShapeState.getApplied() && typeof getMainWindow().setShape === 'function') {
        getMainWindow().setShape([]);
        nativeShapeState.setApplied(false);
      }
    } catch (error) {
      nativeShapeState.setApplied(false);
      logWindowEvent(`main-window: failed to restore interactive layer warmup shape ${error?.stack || error}`);
    }

    applyPointerPassthroughState();
    if (pointerDiagnosticsEnabled) {
      logWindowEvent('main-window: restored interactive layer warmup');
    }
  }
  return { canWarmMainInteractiveLayer, restoreMainInteractiveLayerWarmup };
}

module.exports = { createMainInteractiveLayerWarmupRecovery };
