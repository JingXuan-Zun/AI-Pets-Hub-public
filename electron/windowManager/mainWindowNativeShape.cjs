const { createNativeWindowShapeCapabilities, createNativeWindowShapeApplier } = require('./nativeWindowShapeApplication.cjs');
const { createNativePointerPassthroughApplier } = require('./nativePointerPassthrough.cjs');

function createMainWindowNativeShape({
  nativeShapeState, getMainWindow, getPlatform, getIsAgentDesktopExecutionActive, getInputProxyRegionCount,
  isFullWindowInteractiveShape, isPetDragFullWindowShapeRetained, summarizeInteractiveRegion,
  logWindowEvent, pointerDiagnosticsEnabled, USE_SEPARATE_RENDER_AND_INPUT_WINDOWS,
}) {
  const { canApplyInteractiveWindowShape, hasInteractiveWindowShape } = createNativeWindowShapeCapabilities({
    nativeShapeState, getMainWindow, getPlatform, USE_SEPARATE_RENDER_AND_INPUT_WINDOWS,
  });
  const applyInteractiveWindowShape = createNativeWindowShapeApplier({
    nativeShapeState, getMainWindow, getPlatform, getIsAgentDesktopExecutionActive,
    USE_SEPARATE_RENDER_AND_INPUT_WINDOWS, pointerDiagnosticsEnabled, logWindowEvent, summarizeInteractiveRegion,
  });
  const applyPointerPassthroughState = createNativePointerPassthroughApplier({
    nativeShapeState, getMainWindow, getInputProxyRegionCount, isFullWindowInteractiveShape,
    isPetDragFullWindowShapeRetained, getIsAgentDesktopExecutionActive, hasInteractiveWindowShape,
    pointerDiagnosticsEnabled, logWindowEvent, USE_SEPARATE_RENDER_AND_INPUT_WINDOWS,
  });
  return { canApplyInteractiveWindowShape, applyInteractiveWindowShape, applyPointerPassthroughState };
}

module.exports = { createMainWindowNativeShape };
