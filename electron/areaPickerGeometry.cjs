function getAreaPickerContextSignature(context) {
  if (!context || !Array.isArray(context.displays)) {
    return '';
  }

  return JSON.stringify({
    virtualBounds: context.virtualBounds ?? null,
    nativeVirtualBounds: context.nativeVirtualBounds ?? null,
    displays: context.displays.map((display) => ({
      id: display.id,
      sourceId: display.sourceId,
      x: display.x,
      y: display.y,
      width: display.width,
      height: display.height,
      nativeX: display.nativeX,
      nativeY: display.nativeY,
      nativeWidth: display.nativeWidth,
      nativeHeight: display.nativeHeight,
    })),
  });
}

function rectsIntersect(firstRect, secondRect) {
  return firstRect.x < secondRect.x + secondRect.width
    && firstRect.x + firstRect.width > secondRect.x
    && firstRect.y < secondRect.y + secondRect.height
    && firstRect.y + firstRect.height > secondRect.y;
}

function getRectIntersection(firstRect, secondRect) {
  const left = Math.max(firstRect.x, secondRect.x);
  const top = Math.max(firstRect.y, secondRect.y);
  const right = Math.min(firstRect.x + firstRect.width, secondRect.x + secondRect.width);
  const bottom = Math.min(firstRect.y + firstRect.height, secondRect.y + secondRect.height);

  if (right <= left || bottom <= top) {
    return null;
  }

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

function getSelectedDisplaysForLogicalRect(context, selectionRect) {
  return context.displays.filter((display) => {
    const displayRect = {
      x: Math.round(display.x - context.virtualBounds.x),
      y: Math.round(display.y - context.virtualBounds.y),
      width: Math.round(display.width),
      height: Math.round(display.height),
    };

    return rectsIntersect(selectionRect, displayRect);
  });
}

function createLogicalSelectionFromNativeRect(context, rect) {
  const nativeVirtualBounds = context.nativeVirtualBounds || context.virtualBounds;
  const nativeSelectionRect = {
    x: Math.max(0, Math.round(rect.x ?? 0)),
    y: Math.max(0, Math.round(rect.y ?? 0)),
    width: Math.max(1, Math.round(rect.width ?? 0)),
    height: Math.max(1, Math.round(rect.height ?? 0)),
  };

  const selectedDisplays = [];
  const logicalIntersections = [];

  context.displays.forEach((display) => {
    const nativeDisplayRect = {
      x: Math.round((display.nativeX ?? display.x) - nativeVirtualBounds.x),
      y: Math.round((display.nativeY ?? display.y) - nativeVirtualBounds.y),
      width: Math.max(1, Math.round(display.nativeWidth ?? display.width)),
      height: Math.max(1, Math.round(display.nativeHeight ?? display.height)),
    };
    const nativeIntersection = getRectIntersection(nativeSelectionRect, nativeDisplayRect);
    if (!nativeIntersection) {
      return;
    }

    const logicalDisplayRect = {
      x: Math.round(display.x - context.virtualBounds.x),
      y: Math.round(display.y - context.virtualBounds.y),
      width: Math.max(1, Math.round(display.width)),
      height: Math.max(1, Math.round(display.height)),
    };
    const scaleX = logicalDisplayRect.width / nativeDisplayRect.width;
    const scaleY = logicalDisplayRect.height / nativeDisplayRect.height;
    const logicalIntersection = {
      x: logicalDisplayRect.x + Math.round((nativeIntersection.x - nativeDisplayRect.x) * scaleX),
      y: logicalDisplayRect.y + Math.round((nativeIntersection.y - nativeDisplayRect.y) * scaleY),
      width: Math.max(1, Math.round(nativeIntersection.width * scaleX)),
      height: Math.max(1, Math.round(nativeIntersection.height * scaleY)),
    };

    selectedDisplays.push(display);
    logicalIntersections.push(logicalIntersection);
  });

  if (!logicalIntersections.length) {
    return null;
  }

  const left = Math.min(...logicalIntersections.map((logicalRect) => logicalRect.x));
  const top = Math.min(...logicalIntersections.map((logicalRect) => logicalRect.y));
  const right = Math.max(...logicalIntersections.map((logicalRect) => logicalRect.x + logicalRect.width));
  const bottom = Math.max(...logicalIntersections.map((logicalRect) => logicalRect.y + logicalRect.height));

  return {
    selectionRect: {
      x: Math.max(0, left),
      y: Math.max(0, top),
      width: Math.max(1, right - left),
      height: Math.max(1, bottom - top),
    },
    selectedDisplays,
  };
}

function createAreaSelectionFromRect(context, rect) {
  if (!context?.virtualBounds || !Array.isArray(context.displays) || !rect) {
    return null;
  }

  const convertedSelection = rect.coordinateSpace === 'native' && context.nativeVirtualBounds
    ? createLogicalSelectionFromNativeRect(context, rect)
    : null;
  const selectionRect = convertedSelection?.selectionRect ?? {
    x: Math.max(0, Math.round(rect.x ?? 0)),
    y: Math.max(0, Math.round(rect.y ?? 0)),
    width: Math.max(1, Math.round(rect.width ?? 0)),
    height: Math.max(1, Math.round(rect.height ?? 0)),
  };

  if (selectionRect.width < 8 || selectionRect.height < 8) {
    return null;
  }

  const selectedDisplays = convertedSelection?.selectedDisplays
    ?? getSelectedDisplaysForLogicalRect(context, selectionRect);

  if (!selectedDisplays.length) {
    return null;
  }

  const primaryDisplay = selectedDisplays[0];
  const isCrossDisplaySelection = selectedDisplays.length > 1;
  const displayLabel = isCrossDisplaySelection
    ? `Cross-display (${selectedDisplays.length})`
    : primaryDisplay.label;
  const sourceName = isCrossDisplaySelection
    ? displayLabel
    : primaryDisplay.sourceName;

  return {
    displayId: primaryDisplay.id,
    displayLabel,
    sourceId: primaryDisplay.sourceId,
    sourceName,
    sourceType: 'screen',
    cropRect: selectionRect,
    cropBasisX: Math.round(context.virtualBounds.x),
    cropBasisY: Math.round(context.virtualBounds.y),
    cropBasisWidth: Math.round(context.virtualBounds.width),
    cropBasisHeight: Math.round(context.virtualBounds.height),
    areaSources: selectedDisplays.map((display) => ({
      displayId: display.id,
      displayLabel: display.label,
      sourceId: display.sourceId,
      sourceName: display.sourceName,
      sourceType: 'screen',
      x: Math.round(display.x - context.virtualBounds.x),
      y: Math.round(display.y - context.virtualBounds.y),
      width: Math.round(display.width),
      height: Math.round(display.height),
    })),
  };
}

module.exports = {
  createAreaSelectionFromRect,
  getAreaPickerContextSignature,
};
