
export function resolveVisualSnapshotSourceBounds(source: DesktopPetCaptureSourceLike) {
  const rawBounds = source.bounds;
  if (
    rawBounds
    && Number.isFinite(Number(rawBounds.x))
    && Number.isFinite(Number(rawBounds.y))
    && Number.isFinite(Number(rawBounds.width))
    && Number.isFinite(Number(rawBounds.height))
    && Number(rawBounds.width) > 0
    && Number(rawBounds.height) > 0
  ) {
    return {
      height: Math.round(Number(rawBounds.height)),
      width: Math.round(Number(rawBounds.width)),
      x: Math.round(Number(rawBounds.x)),
      y: Math.round(Number(rawBounds.y)),
    };
  }

  if (
    source.type === 'screen'
    && Number.isFinite(Number(source.width))
    && Number.isFinite(Number(source.height))
    && Number(source.width) > 0
    && Number(source.height) > 0
  ) {
    return {
      height: Math.round(Number(source.height)),
      width: Math.round(Number(source.width)),
      x: 0,
      y: 0,
    };
  }

  return null;
}
