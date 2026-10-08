const { createMainInteractiveLayerWarmupRecovery } = require('./mainInteractiveLayerWarmupRecovery.cjs');

function createMainInteractiveLayerWarmup({
  warmupState, nativeShapeState, getMainWindow, getPlatform, applyInteractiveWindowShape, applyPointerPassthroughState,
  logWindowEvent, pointerDiagnosticsEnabled, USE_SEPARATE_RENDER_AND_INPUT_WINDOWS,
  MAIN_INTERACTIVE_LAYER_WARMUP_REGION, MAIN_INTERACTIVE_LAYER_WARMUP_RESTORE_DELAY_MS, setTimeout,
}) {
  const { canWarmMainInteractiveLayer, restoreMainInteractiveLayerWarmup } = createMainInteractiveLayerWarmupRecovery({
    warmupState, nativeShapeState, getMainWindow, getPlatform, applyInteractiveWindowShape, applyPointerPassthroughState,
    logWindowEvent, pointerDiagnosticsEnabled, USE_SEPARATE_RENDER_AND_INPUT_WINDOWS,
  });

  function warmMainInteractiveLayer() {
    warmupState.setWarmupTimer(null);
    if (warmupState.getCompleted()) {
      return;
    }
    if (!canWarmMainInteractiveLayer()) {
      return;
    }
    if (!nativeShapeState.getRequestedPointerPassthrough() || nativeShapeState.getRegions().length > 0) {
      return;
    }

    warmupState.setCompleted(true);
    try {
      getMainWindow().setShape([MAIN_INTERACTIVE_LAYER_WARMUP_REGION]);
      nativeShapeState.setApplied(true);
      getMainWindow().setIgnoreMouseEvents(false, { forward: false });
      nativeShapeState.setPointerPassthrough(false);
      if (pointerDiagnosticsEnabled) {
        logWindowEvent('main-window: warmed interactive layer with tiny shape');
      }
    } catch (error) {
      logWindowEvent(`main-window: failed to warm interactive layer ${error?.stack || error}`);
      restoreMainInteractiveLayerWarmup();
      return;
    }

    warmupState.setRestoreTimer(setTimeout(
      restoreMainInteractiveLayerWarmup,
      MAIN_INTERACTIVE_LAYER_WARMUP_RESTORE_DELAY_MS,
    ));
    if (typeof warmupState.getRestoreTimer().unref === 'function') {
      warmupState.getRestoreTimer().unref();
    }
  }

  return { warmMainInteractiveLayer };
}

module.exports = { createMainInteractiveLayerWarmup };
