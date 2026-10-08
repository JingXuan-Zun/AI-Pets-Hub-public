const { createMainWindowNativeShape } = require('./mainWindowNativeShape.cjs');
const { createMainInteractiveLayerWarmup } = require('./mainInteractiveLayerWarmup.cjs');

function createNativeShapeControllers({
  nativeShapeState, warmupState, getMainWindow, getPlatform, getIsAgentDesktopExecutionActive,
  getInputProxyRegionCount, isFullWindowInteractiveShape, isPetDragFullWindowShapeRetained,
  summarizeInteractiveRegion, logWindowEvent, pointerDiagnosticsEnabled, USE_SEPARATE_RENDER_AND_INPUT_WINDOWS,
  MAIN_INTERACTIVE_LAYER_WARMUP_REGION, MAIN_INTERACTIVE_LAYER_WARMUP_RESTORE_DELAY_MS, setTimeout,
}) {
  const { canApplyInteractiveWindowShape, applyInteractiveWindowShape, applyPointerPassthroughState } = createMainWindowNativeShape({
    nativeShapeState, getMainWindow, getPlatform, getIsAgentDesktopExecutionActive,
    getInputProxyRegionCount, isFullWindowInteractiveShape, isPetDragFullWindowShapeRetained,
    summarizeInteractiveRegion, logWindowEvent, pointerDiagnosticsEnabled, USE_SEPARATE_RENDER_AND_INPUT_WINDOWS,
  });
  const { warmMainInteractiveLayer } = createMainInteractiveLayerWarmup({
    warmupState, nativeShapeState, getMainWindow, getPlatform,
    applyInteractiveWindowShape, applyPointerPassthroughState, logWindowEvent, pointerDiagnosticsEnabled,
    USE_SEPARATE_RENDER_AND_INPUT_WINDOWS, MAIN_INTERACTIVE_LAYER_WARMUP_REGION, MAIN_INTERACTIVE_LAYER_WARMUP_RESTORE_DELAY_MS,
    setTimeout,
  });
  return { canApplyInteractiveWindowShape, applyInteractiveWindowShape, applyPointerPassthroughState, warmMainInteractiveLayer };
}

module.exports = { createNativeShapeControllers };
