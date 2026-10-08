const PERSISTENT_AREA_BORDER_THICKNESS_PX = 3;

function resolvePersistentAreaBorderRect(captureService, captureOptions) {
  if (captureOptions?.mode !== 'area' || !captureOptions.cropRect) {
    return null;
  }

  const cropRect = captureOptions.cropRect;
  const virtualBounds = captureService.getVirtualDisplayBounds();
  const basisX = Number.isFinite(captureOptions.cropBasisX)
    ? Number(captureOptions.cropBasisX)
    : virtualBounds.x;
  const basisY = Number.isFinite(captureOptions.cropBasisY)
    ? Number(captureOptions.cropBasisY)
    : virtualBounds.y;
  const width = Math.round(Number(cropRect.width ?? 0));
  const height = Math.round(Number(cropRect.height ?? 0));

  if (width < 8 || height < 8) {
    return null;
  }

  return {
    x: Math.round(basisX + Number(cropRect.x ?? 0)),
    y: Math.round(basisY + Number(cropRect.y ?? 0)),
    width,
    height,
  };
}

function resolvePersistentAreaBorderThickness(screen, rect) {
  if (!rect) {
    return PERSISTENT_AREA_BORDER_THICKNESS_PX;
  }

  try {
    const matchedDisplay = screen.getDisplayMatching({
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.max(1, Math.round(rect.width)),
      height: Math.max(1, Math.round(rect.height)),
    });
    const scaleFactor = Number.isFinite(matchedDisplay?.scaleFactor) && matchedDisplay.scaleFactor > 0
      ? matchedDisplay.scaleFactor
      : 1;

    return Math.max(1, Math.round(PERSISTENT_AREA_BORDER_THICKNESS_PX / scaleFactor));
  } catch (_error) {
    return PERSISTENT_AREA_BORDER_THICKNESS_PX;
  }
}

function createPersistentAreaBorderRules({ captureService, screen }) {
  return {
    resolvePersistentAreaBorderRect: (options) => resolvePersistentAreaBorderRect(captureService, options),
    resolvePersistentAreaBorderThickness: (rect) => resolvePersistentAreaBorderThickness(screen, rect),
  };
}

module.exports = { createPersistentAreaBorderRules };
