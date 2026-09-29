import { type PetVisualBounds } from './petVisualBounds';

export function sanitizePetModel3DScale(scale: number) {
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

export function resolvePetModel3DViewportScale(scale: number) {
  const safeScale = sanitizePetModel3DScale(scale);
  const scaleOverflow = Math.max(0, safeScale - 1);
  return Number(Math.min(4.35, 1.24 + scaleOverflow * 0.96).toFixed(2));
}

export function resolvePetModel3DCameraDistance(scale: number) {
  const safeScale = sanitizePetModel3DScale(scale);
  const scaleOverflow = Math.max(0, safeScale - 1);
  return Number(Math.min(5.72, 4.12 + scaleOverflow * 0.34).toFixed(2));
}

export function resolvePetModel3DMinimumCameraDistance(
  boundsSize: [number, number, number],
  normalizedScale: number,
  scale: number,
  aspect: number,
  verticalFovDegrees: number,
) {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const safeVerticalFovDegrees = Number.isFinite(verticalFovDegrees) && verticalFovDegrees > 0
    ? verticalFovDegrees
    : 45;
  const safeScale = sanitizePetModel3DScale(scale);
  const safeNormalizedScale = Number.isFinite(normalizedScale) && normalizedScale > 0
    ? normalizedScale
    : 1;
  const scaledWidth = Math.max(0.001, boundsSize[0] * safeNormalizedScale * safeScale);
  const scaledHeight = Math.max(0.001, boundsSize[1] * safeNormalizedScale * safeScale);
  const scaledDepth = Math.max(0.001, boundsSize[2] * safeNormalizedScale * safeScale);
  const verticalFovRadians = (safeVerticalFovDegrees * Math.PI) / 180;
  const horizontalFovRadians = 2 * Math.atan(Math.tan(verticalFovRadians / 2) * safeAspect);
  const fitHeightDistance = (scaledHeight * 0.5) / Math.tan(verticalFovRadians / 2);
  const fitWidthDistance = (scaledWidth * 0.5) / Math.tan(horizontalFovRadians / 2);
  const fitDistance = Math.max(fitHeightDistance, fitWidthDistance);
  const fitMargin = safeScale >= 2 ? 1.18 : safeScale >= 1.4 ? 1.14 : 1.1;
  const depthPadding = scaledDepth * (safeScale >= 2 ? 0.96 : 0.84);
  const extraPadding = 0.22 + Math.max(0, safeScale - 1) * 0.12;

  return Number((fitDistance * fitMargin + depthPadding + extraPadding).toFixed(3));
}

export function resolveNextPetModel3DManualOrbit(
  yaw: number,
  pitch: number,
  deltaX: number,
  deltaY: number,
) {
  let nextYaw = ((yaw + deltaX * 0.014) % (Math.PI * 2) + (Math.PI * 2)) % (Math.PI * 2);
  if (nextYaw > Math.PI) {
    nextYaw -= Math.PI * 2;
  }

  const nextPitch = Math.max(-0.9, Math.min(0.9, pitch + deltaY * 0.01));

  return {
    yaw: nextYaw,
    pitch: nextPitch,
  };
}

type ResolvePetModel3DProjectedVisualBoundsOptions = {
  boundsSize: [number, number, number];
  cameraDistance: number;
  normalizedScale: number;
  scale: number;
  verticalFovDegrees: number;
  viewportHeight: number;
  viewportWidth: number;
};

export function resolvePetModel3DProjectedVisualBounds({
  boundsSize,
  cameraDistance,
  normalizedScale,
  scale,
  verticalFovDegrees,
  viewportHeight,
  viewportWidth,
}: ResolvePetModel3DProjectedVisualBoundsOptions) {
  const safeViewportWidth = Math.max(1, Math.round(viewportWidth));
  const safeViewportHeight = Math.max(1, Math.round(viewportHeight));
  const safeCameraDistance = Number.isFinite(cameraDistance) && cameraDistance > 0
    ? cameraDistance
    : 4.35;
  const safeVerticalFovDegrees = Number.isFinite(verticalFovDegrees) && verticalFovDegrees > 0
    ? verticalFovDegrees
    : 45;
  const safeScale = sanitizePetModel3DScale(scale);
  const safeNormalizedScale = Number.isFinite(normalizedScale) && normalizedScale > 0
    ? normalizedScale
    : 1;
  const scaledWidth = Math.max(0.001, boundsSize[0] * safeNormalizedScale * safeScale);
  const scaledHeight = Math.max(0.001, boundsSize[1] * safeNormalizedScale * safeScale);
  const scaledDepth = Math.max(0.001, boundsSize[2] * safeNormalizedScale * safeScale);
  const horizontalDiameter = Math.max(scaledWidth, scaledDepth);
  const verticalFovRadians = (safeVerticalFovDegrees * Math.PI) / 180;
  const visibleHeight = 2 * safeCameraDistance * Math.tan(verticalFovRadians / 2);
  const visibleWidth = visibleHeight * (safeViewportWidth / safeViewportHeight);
  // Keep a small depth-driven safety margin so wide sleeves / hair tips still fit,
  // but avoid over-inflating edge clamps for large zoomed-in characters.
  const horizontalWorldHalfExtent = horizontalDiameter * 0.5 + scaledDepth * 0.08;
  const verticalWorldHalfExtent = scaledHeight * 0.5 + scaledDepth * 0.05;
  const halfPixelWidth = horizontalWorldHalfExtent * (safeViewportWidth / Math.max(0.001, visibleWidth));
  const halfPixelHeight = verticalWorldHalfExtent * (safeViewportHeight / Math.max(0.001, visibleHeight));

  return {
    left: Math.max(1, Math.round(halfPixelWidth)),
    right: Math.max(1, Math.round(halfPixelWidth)),
    top: Math.max(1, Math.round(halfPixelHeight)),
    bottom: Math.max(1, Math.round(halfPixelHeight)),
  } satisfies PetVisualBounds;
}
