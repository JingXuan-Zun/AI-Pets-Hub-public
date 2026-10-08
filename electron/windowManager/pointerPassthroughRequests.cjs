function createPointerPassthroughRequester({
  nativeShapeState, setRequestedPointerPassthrough, getMainWindow,
  getPetDragNativeShapeActive, isPetDragFullWindowShapeRetained,
  pointerDiagnosticsEnabled, logWindowEvent, applyPointerPassthroughState,
}) {
  return function setWindowPointerPassthrough(ignore) {
    setRequestedPointerPassthrough(Boolean(ignore));
    if (pointerDiagnosticsEnabled && getMainWindow() && !getMainWindow().isDestroyed()) {
      logWindowEvent(
        `DRAG-TRACE-V2 pointer-request requested=${nativeShapeState.getRequestedPointerPassthrough()} `
        + `applied=${nativeShapeState.getPointerPassthrough()} shapeApplied=${nativeShapeState.getApplied()} `
        + `shapeRegions=${nativeShapeState.getRegions().length} `
        + `session=${getPetDragNativeShapeActive()} retained=${isPetDragFullWindowShapeRetained()}`,
      );
    }
    applyPointerPassthroughState();
  };
}

function createWindowStatePointerPassthroughRequester({
  managerState, nativeShapeState, isPetDragFullWindowShapeRetained,
  pointerDiagnosticsEnabled, logWindowEvent, applyPointerPassthroughState,
}) {
  return createPointerPassthroughRequester({
    nativeShapeState, setRequestedPointerPassthrough: (ignore) => { managerState.requestedPointerPassthrough = ignore; },
    getMainWindow: () => managerState.mainWindow, getPetDragNativeShapeActive: () => managerState.petDragNativeShapeActive,
    isPetDragFullWindowShapeRetained, pointerDiagnosticsEnabled, logWindowEvent, applyPointerPassthroughState,
  });
}

module.exports = { createPointerPassthroughRequester, createWindowStatePointerPassthroughRequester };
