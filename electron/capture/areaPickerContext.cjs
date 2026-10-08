function selectAreaPickerDisplays(displays, captureSources) {
  const screenSourcesByDisplayId = new Map(
    captureSources
      .filter((source) => source.type === 'screen' && source.displayId)
      .map((source) => [String(source.displayId), source]),
  );
  return displays
    .map((display) => {
      const source = screenSourcesByDisplayId.get(String(display.id));
      if (!source) {
        return null;
      }

      const scaleFactor = Number.isFinite(display.scaleFactor) && display.scaleFactor > 0
        ? display.scaleFactor
        : 1;
      return {
        ...display,
        sourceId: source.id,
        sourceName: source.name || display.label,
        sourceType: 'screen',
        previewThumbnail: source.thumbnail || '',
        nativeX: display.nativeX ?? Math.round(display.x * scaleFactor),
        nativeY: display.nativeY ?? Math.round(display.y * scaleFactor),
        nativeWidth: display.nativeWidth ?? Math.max(1, Math.round(display.width * scaleFactor)),
        nativeHeight: display.nativeHeight ?? Math.max(1, Math.round(display.height * scaleFactor)),
      };
    })
    .filter(Boolean);
}

function getAreaPickerNativeVirtualBounds(selectableDisplays, virtualBounds) {
  const nativeLeft = selectableDisplays.length
    ? Math.min(...selectableDisplays.map((display) => display.nativeX))
    : Math.round(virtualBounds.x);
  const nativeTop = selectableDisplays.length
    ? Math.min(...selectableDisplays.map((display) => display.nativeY))
    : Math.round(virtualBounds.y);
  const nativeRight = selectableDisplays.length
    ? Math.max(...selectableDisplays.map((display) => display.nativeX + display.nativeWidth))
    : Math.round(virtualBounds.x + virtualBounds.width);
  const nativeBottom = selectableDisplays.length
    ? Math.max(...selectableDisplays.map((display) => display.nativeY + display.nativeHeight))
    : Math.round(virtualBounds.y + virtualBounds.height);

  return { x: nativeLeft, y: nativeTop, width: nativeRight - nativeLeft, height: nativeBottom - nativeTop };
}

async function buildAreaPickerContext(dependencies, options = {}) {
  const { getVirtualDisplayBounds, getDisplayListWithNativeBounds, getAreaPickerScreenSources,
    getAreaPickerThumbnailSize, screen } = dependencies;
  const virtualBounds = getVirtualDisplayBounds();
  const displays = await getDisplayListWithNativeBounds({
    forceRefresh: Boolean(options?.forceRefresh),
  });
  const captureSources = await getAreaPickerScreenSources({
    forceRefresh: Boolean(options?.forceRefresh),
    thumbnailSize: getAreaPickerThumbnailSize(screen.getAllDisplays()),
  });
  const selectableDisplays = selectAreaPickerDisplays(displays, captureSources);
  return {
    virtualBounds,
    nativeVirtualBounds: getAreaPickerNativeVirtualBounds(selectableDisplays, virtualBounds),
    displays: selectableDisplays,
  };
}

function createAreaPickerContextBuilder(dependencies) {
  return buildAreaPickerContext.bind(null, dependencies);
}

module.exports = { createAreaPickerContextBuilder };
