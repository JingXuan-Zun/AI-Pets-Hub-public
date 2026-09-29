export type CaptureSourceType = DesktopPetCaptureSourceLike['type'];

export const CAPTURE_SOURCE_TYPES: CaptureSourceType[] = ['screen', 'window'];

export function normalizeCaptureSourceTypes(types?: CaptureSourceType[]) {
  const requestedTypes = Array.isArray(types)
    ? types
    : [];
  const normalizedTypes = CAPTURE_SOURCE_TYPES.filter((type) => requestedTypes.includes(type));
  return normalizedTypes.length
    ? normalizedTypes
    : [...CAPTURE_SOURCE_TYPES];
}

export function buildAreaSelectionPreviewSource(
  desktopAreaSelection: DesktopPetAreaSelectionLike | null,
  windowCaptureSources: DesktopPetCaptureSourceLike[],
) {
  if (!desktopAreaSelection || windowCaptureSources.some((source) => source.id === desktopAreaSelection.sourceId)) {
    return null;
  }

  return {
    id: desktopAreaSelection.sourceId,
    name: desktopAreaSelection.sourceName,
    type: 'screen' as const,
    displayId: desktopAreaSelection.displayId,
    width: desktopAreaSelection.cropBasisWidth,
    height: desktopAreaSelection.cropBasisHeight,
    thumbnail: '',
    appIcon: '',
  };
}

export function getPreviewCaptureSources(
  captureMode: DesktopPetCaptureMode,
  screenCaptureSources: DesktopPetCaptureSourceLike[],
  windowCaptureSources: DesktopPetCaptureSourceLike[],
  areaSelectionPreviewSource: DesktopPetCaptureSourceLike | null,
) {
  if (captureMode === 'screen') {
    return screenCaptureSources;
  }

  return areaSelectionPreviewSource
    ? [areaSelectionPreviewSource, ...windowCaptureSources]
    : windowCaptureSources;
}

export function getFilteredCaptureSources(
  captureMode: DesktopPetCaptureMode,
  screenCaptureSources: DesktopPetCaptureSourceLike[],
  windowCaptureSources: DesktopPetCaptureSourceLike[],
) {
  return captureMode === 'screen'
    ? screenCaptureSources
    : windowCaptureSources;
}

export function getSelectedCaptureSource(
  captureSources: DesktopPetCaptureSourceLike[],
  selectedCaptureSourceId: string,
) {
  return captureSources.find((source) => source.id === selectedCaptureSourceId)
    ?? captureSources[0]
    ?? null;
}

export function getActivePreviewSourceId(
  captureMode: DesktopPetCaptureMode,
  desktopAreaSelection: DesktopPetAreaSelectionLike | null,
  selectedCaptureSource: DesktopPetCaptureSourceLike | null,
) {
  return captureMode === 'area'
    ? desktopAreaSelection?.sourceId ?? ''
    : selectedCaptureSource?.id ?? '';
}

export function clampCaptureCropRect(
  rect: DesktopPetCaptureRectLike,
  referenceWidth: number,
  referenceHeight: number,
) {
  const nextWidth = Math.max(1, Math.min(referenceWidth, Math.round(rect.width)));
  const nextHeight = Math.max(1, Math.min(referenceHeight, Math.round(rect.height)));

  return {
    x: Math.max(0, Math.min(referenceWidth - nextWidth, Math.round(rect.x))),
    y: Math.max(0, Math.min(referenceHeight - nextHeight, Math.round(rect.y))),
    width: nextWidth,
    height: nextHeight,
  };
}

export function getUpdatedCaptureCropRect(
  rect: DesktopPetCaptureRectLike,
  key: keyof DesktopPetCaptureRectLike,
  value: string,
  referenceWidth: number,
  referenceHeight: number,
) {
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) {
    return rect;
  }

  return clampCaptureCropRect({
    ...rect,
    [key]: key === 'width' || key === 'height'
      ? Math.max(1, Math.round(parsedValue))
      : Math.max(0, Math.round(parsedValue)),
  }, referenceWidth, referenceHeight);
}

export function buildAreaPreviewCaptureOptions(
  captureMode: DesktopPetCaptureMode,
  desktopAreaSelection: DesktopPetAreaSelectionLike | null,
  captureCropRect: DesktopPetCaptureRectLike,
  captureReferenceWidth: number,
  captureReferenceHeight: number,
) {
  if (captureMode !== 'area' || !desktopAreaSelection) {
    return null;
  }

  return {
    mode: 'area' as const,
    sourceId: desktopAreaSelection.sourceId,
    sourceName: desktopAreaSelection.sourceName,
    sourceType: desktopAreaSelection.sourceType,
    cropRect: captureCropRect,
    cropBasisX: desktopAreaSelection.cropBasisX,
    cropBasisY: desktopAreaSelection.cropBasisY,
    cropBasisWidth: desktopAreaSelection.cropBasisWidth ?? captureReferenceWidth,
    cropBasisHeight: desktopAreaSelection.cropBasisHeight ?? captureReferenceHeight,
    areaSources: desktopAreaSelection.areaSources,
  };
}
