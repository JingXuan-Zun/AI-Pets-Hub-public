function createDisplayListItem(dependencies, display, nativeBounds = null) {
  const { getFullDisplayBounds, getDisplayScaleFactor, createFallbackNativeDisplayBounds, screen } = dependencies;

  const bounds = getFullDisplayBounds(display);
  const scaleFactor = getDisplayScaleFactor(display);
  const fallbackNativeBounds = createFallbackNativeDisplayBounds(bounds, scaleFactor);

  return {
    id: String(display.id),
    label: display.label || `屏幕 ${display.id}`,
    isPrimary: display.id === screen.getPrimaryDisplay().id,
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    nativeX: nativeBounds?.x ?? fallbackNativeBounds.x,
    nativeY: nativeBounds?.y ?? fallbackNativeBounds.y,
    nativeWidth: nativeBounds?.width ?? fallbackNativeBounds.width,
    nativeHeight: nativeBounds?.height ?? fallbackNativeBounds.height,
    nativeBoundsSource: nativeBounds ? 'windows' : 'electron-scale',
    workAreaX: display.workArea.x,
    workAreaY: display.workArea.y,
    workAreaWidth: display.workArea.width,
    workAreaHeight: display.workArea.height,
    scaleFactor,
  };
}

function createDisplayList(dependencies, nativeDisplays = []) {
  const { screen, resolveNativeDisplayBounds } = dependencies;

  const usedNativeDisplayIndexes = new Set();

  return screen.getAllDisplays().map((display) => {
    const fallbackItem = createDisplayListItem(dependencies, display);
    const nativeBounds = resolveNativeDisplayBounds(
      fallbackItem,
      nativeDisplays,
      usedNativeDisplayIndexes,
    );

    return createDisplayListItem(dependencies, display, nativeBounds);
  });
}

function createCaptureDisplayProjection(dependencies) {
  return createDisplayList.bind(null, dependencies);
}

module.exports = { createCaptureDisplayProjection };
