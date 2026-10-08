

function createWindowObservationGeometry({ screen, logMessage }) {
  function normalizeRectLike(rect) {
    if (!rect || typeof rect !== 'object') {
      return null;
    }

    const x = Number(rect.x);
    const y = Number(rect.y);
    const width = Number(rect.width);
    const height = Number(rect.height);
    if (
      !Number.isFinite(x)
      || !Number.isFinite(y)
      || !Number.isFinite(width)
      || !Number.isFinite(height)
    ) {
      return null;
    }

    return {
      height: Math.max(0, Math.round(height)),
      width: Math.max(0, Math.round(width)),
      x: Math.round(x),
      y: Math.round(y),
    };
  }

  function nativeScreenPointToDipPoint(point) {
    if (
      screen
      && typeof screen.screenToDipPoint === 'function'
      && Number.isFinite(point?.x)
      && Number.isFinite(point?.y)
    ) {
      try {
        const convertedPoint = screen.screenToDipPoint({
          x: Math.round(point.x),
          y: Math.round(point.y),
        });
        if (
          convertedPoint
          && Number.isFinite(convertedPoint.x)
          && Number.isFinite(convertedPoint.y)
        ) {
          return {
            x: Math.round(convertedPoint.x),
            y: Math.round(convertedPoint.y),
          };
        }
      } catch (error) {
        logMessage('window coordinate conversion failed', error?.stack || error);
      }
    }

    return {
      x: Math.round(point.x),
      y: Math.round(point.y),
    };
  }

  function nativeScreenRectToDipRect(rect) {
    const nativeRect = normalizeRectLike(rect);
    if (!nativeRect) {
      return null;
    }

    const topLeft = nativeScreenPointToDipPoint({
      x: nativeRect.x,
      y: nativeRect.y,
    });
    const bottomRight = nativeScreenPointToDipPoint({
      x: nativeRect.x + nativeRect.width,
      y: nativeRect.y + nativeRect.height,
    });

    return {
      coordinateSpace: 'dip',
      height: Math.max(0, Math.round(Math.abs(bottomRight.y - topLeft.y))),
      width: Math.max(0, Math.round(Math.abs(bottomRight.x - topLeft.x))),
      x: topLeft.x,
      y: topLeft.y,
    };
  }

  function normalizeRunningAppWindow(rawWindow) {
    if (!rawWindow || typeof rawWindow !== 'object') {
      return null;
    }

    const pid = Number(rawWindow.pid ?? rawWindow.Id);
    const processName = String(rawWindow.processName ?? rawWindow.ProcessName ?? '').trim();
    const title = String(rawWindow.title ?? rawWindow.MainWindowTitle ?? '').trim();
    const executablePath = String(rawWindow.path ?? rawWindow.Path ?? '').trim();
    const hwnd = Number(rawWindow.hwnd ?? rawWindow.MainWindowHandle);
    const topLevelOrder = Number(rawWindow.topLevelOrder ?? rawWindow.TopLevelOrder);
    const nativeBounds = normalizeRectLike(rawWindow.nativeBounds ?? rawWindow.bounds);
    const bounds = nativeScreenRectToDipRect(nativeBounds);
    if (!Number.isFinite(pid) || (!processName && !title)) {
      return null;
    }

    return {
      bounds,
      coordinateSpace: bounds ? 'dip' : null,
      executablePath,
      active: Boolean(rawWindow.active),
      hwnd: Number.isFinite(hwnd) ? Math.round(hwnd) : null,
      nativeBounds,
      nativeCoordinateSpace: nativeBounds ? 'native-screen' : null,
      pid: Math.round(pid),
      processName,
      title,
      topLevelOrder: Number.isFinite(topLevelOrder) ? Math.round(topLevelOrder) : undefined,
      visible: typeof rawWindow.visible === 'boolean' ? rawWindow.visible : undefined,
    };
  }

  function getDisplaySnapshots() {
    try {
      if (!screen || typeof screen.getAllDisplays !== 'function') {
        return [];
      }

      const primaryDisplay = typeof screen.getPrimaryDisplay === 'function'
        ? screen.getPrimaryDisplay()
        : null;
      return screen.getAllDisplays().map((display, index) => ({
        bounds: display.bounds,
        id: String(display.id),
        index,
        internal: Boolean(display.internal),
        label: display.label || `Display ${index + 1}`,
        primary: Boolean(primaryDisplay && display.id === primaryDisplay.id),
        scaleFactor: display.scaleFactor,
        size: display.size,
        workArea: display.workArea,
      }));
    } catch {
      return [];
    }
  }

  function getRectCenter(bounds) {
    return bounds
      ? {
        x: bounds.x + bounds.width / 2,
        y: bounds.y + bounds.height / 2,
      }
      : null;
  }

  function containsPoint(rect, point) {
    return Boolean(rect && point
      && point.x >= rect.x
      && point.x < rect.x + rect.width
      && point.y >= rect.y
      && point.y < rect.y + rect.height);
  }

  function findDisplayForBounds(bounds) {
    const center = getRectCenter(bounds);
    return getDisplaySnapshots().find((display) => containsPoint(display.bounds, center)) ?? null;
  }

  function enrichWindowDisplay(windowInfo) {
    const display = findDisplayForBounds(windowInfo?.bounds);
    if (!display) {
      return windowInfo;
    }

    return {
      ...windowInfo,
      display: {
        bounds: display.bounds,
        id: display.id,
        index: display.index,
        label: display.label,
        primary: display.primary,
        scaleFactor: display.scaleFactor,
      },
      displayId: display.id,
      displayLabel: display.label,
      displaySource: 'best-effort-window-rect',
    };
  }
  return { normalizeRectLike, nativeScreenPointToDipPoint, nativeScreenRectToDipRect, normalizeRunningAppWindow, getDisplaySnapshots, findDisplayForBounds, enrichWindowDisplay };
}

module.exports = { createWindowObservationGeometry };
