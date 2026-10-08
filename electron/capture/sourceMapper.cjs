function createCaptureDisplayBoundsMap(getDisplayList, displays = getDisplayList()) {
  return new Map(displays.map((display) => {
    const logicalBounds = {
      x: Math.round(Number(display.x ?? 0)),
      y: Math.round(Number(display.y ?? 0)),
      width: Math.max(1, Math.round(Number(display.width ?? 1))),
      height: Math.max(1, Math.round(Number(display.height ?? 1))),
    };
    const scaleFactor = Number.isFinite(display.scaleFactor) && display.scaleFactor > 0
      ? display.scaleFactor
      : 1;
    const nativeBounds = {
      x: Number.isFinite(display.nativeX) ? Math.round(display.nativeX) : Math.round(logicalBounds.x * scaleFactor),
      y: Number.isFinite(display.nativeY) ? Math.round(display.nativeY) : Math.round(logicalBounds.y * scaleFactor),
      width: Number.isFinite(display.nativeWidth) && display.nativeWidth > 0
        ? Math.round(display.nativeWidth)
        : Math.max(1, Math.round(logicalBounds.width * scaleFactor)),
      height: Number.isFinite(display.nativeHeight) && display.nativeHeight > 0
        ? Math.round(display.nativeHeight)
        : Math.max(1, Math.round(logicalBounds.height * scaleFactor)),
    };

    return [String(display.id), {
      logicalBounds,
      nativeBounds,
      nativeBoundsSource: display.nativeBoundsSource ?? 'electron-scale',
      scaleFactor,
    }];
  }));
}

function normalizeCaptureSourceBounds(bounds) {
  if (
    bounds
    && Number.isFinite(Number(bounds.x))
    && Number.isFinite(Number(bounds.y))
    && Number.isFinite(Number(bounds.width))
    && Number.isFinite(Number(bounds.height))
    && Number(bounds.width) > 0
    && Number(bounds.height) > 0
  ) {
    return {
      x: Math.round(Number(bounds.x)),
      y: Math.round(Number(bounds.y)),
      width: Math.max(1, Math.round(Number(bounds.width))),
      height: Math.max(1, Math.round(Number(bounds.height))),
    };
  }

  return null;
}

function mapCaptureSources({ getDisplayList, CAPTURE_SOURCE_THUMBNAIL_SIZE }, sources, options = {}) {
  const {
    displays = getDisplayList(),
    includeThumbnail = true,
    includeAppIcon = true,
    fallbackThumbnailSize = CAPTURE_SOURCE_THUMBNAIL_SIZE,
  } = options;
  const displayBoundsById = createCaptureDisplayBoundsMap(getDisplayList, displays);

  return sources.map((source) => {
    const sourceType = source.id.startsWith('screen:') ? 'screen' : 'window';
    const displayId = source.display_id ? String(source.display_id) : null;
    const displayBounds = displayId ? displayBoundsById.get(displayId) : null;
    const explicitBounds = normalizeCaptureSourceBounds(source.bounds);
    const resolvedBounds = sourceType === 'screen'
      ? displayBounds?.nativeBounds ?? explicitBounds ?? null
      : explicitBounds ?? displayBounds?.logicalBounds ?? null;
    const thumbnailSize = source.thumbnail && !source.thumbnail.isEmpty()
      ? source.thumbnail.getSize()
      : fallbackThumbnailSize;

    return {
      id: source.id,
      name: source.name,
      type: sourceType,
      bounds: resolvedBounds,
      boundsCoordinateSpace: 'native-screen',
      displayId,
      height: resolvedBounds?.height ?? thumbnailSize.height,
      logicalBounds: sourceType === 'screen' ? displayBounds?.logicalBounds ?? null : null,
      nativeBoundsSource: sourceType === 'screen' ? displayBounds?.nativeBoundsSource ?? null : null,
      scaleFactor: displayBounds?.scaleFactor ?? null,
      width: resolvedBounds?.width ?? thumbnailSize.width,
      thumbnail: includeThumbnail && source.thumbnail && !source.thumbnail.isEmpty()
        ? source.thumbnail.toDataURL()
        : '',
      appIcon: includeAppIcon && source.appIcon && !source.appIcon.isEmpty()
        ? source.appIcon.toDataURL()
        : '',
    };
  });
}

function createCaptureSourceMapper(dependencies) {
  return mapCaptureSources.bind(null, dependencies);
}

module.exports = { createCaptureSourceMapper, createCaptureDisplayBoundsMap, normalizeCaptureSourceBounds };
