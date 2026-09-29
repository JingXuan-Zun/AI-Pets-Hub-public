import { fitDirectionalExtentsToArea } from './petActivityRegionMath';

type Position = {
  x: number;
  y: number;
};

type Area = {
  width: number;
  height: number;
};

type DirectionalExtents = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

type ReachableRange = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  spanX: number;
  spanY: number;
};

export function measurePetDistance(from: Position, to: Position) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function resolvePetMovementDeltaSeconds(
  lastFrameTime: number | null,
  currentFrameTime: number,
  fallbackIntervalMs: number,
) {
  if (lastFrameTime === null) {
    return Math.min(Math.max(0, fallbackIntervalMs) / 1000, 0.032);
  }

  return Math.min(Math.max(0, currentFrameTime - lastFrameTime) / 1000, 0.032);
}

function createReachableRange(area: Area, extents: DirectionalExtents): ReachableRange {
  const fittedExtents = fitDirectionalExtentsToArea(area, extents);
  const minX = -area.width / 2 + fittedExtents.left;
  const maxX = area.width / 2 - fittedExtents.right;
  const minY = -area.height / 2 + fittedExtents.top;
  const maxY = area.height / 2 - fittedExtents.bottom;

  return {
    minX,
    maxX,
    minY,
    maxY,
    spanX: Math.max(0, Math.abs(maxX - minX)),
    spanY: Math.max(0, Math.abs(maxY - minY)),
  };
}

function createActualReachableRange(area: Area, extents: DirectionalExtents): ReachableRange {
  const safeWidth = Math.max(1, Math.round(area.width));
  const safeHeight = Math.max(1, Math.round(area.height));
  const left = Math.max(1, Math.round(extents.left));
  const right = Math.max(1, Math.round(extents.right));
  const top = Math.max(1, Math.round(extents.top));
  const bottom = Math.max(1, Math.round(extents.bottom));
  const minX = -safeWidth / 2 + left;
  const maxX = safeWidth / 2 - right;
  const minY = -safeHeight / 2 + top;
  const maxY = safeHeight / 2 - bottom;
  const centerX = Math.round((minX + maxX) / 2);
  const centerY = Math.round((minY + maxY) / 2);
  const safeMinX = minX <= maxX ? minX : centerX;
  const safeMaxX = minX <= maxX ? maxX : centerX;
  const safeMinY = minY <= maxY ? minY : centerY;
  const safeMaxY = minY <= maxY ? maxY : centerY;

  return {
    minX: safeMinX,
    maxX: safeMaxX,
    minY: safeMinY,
    maxY: safeMaxY,
    spanX: Math.max(0, Math.abs(safeMaxX - safeMinX)),
    spanY: Math.max(0, Math.abs(safeMaxY - safeMinY)),
  };
}

function createRandomPositionInRange(range: ReachableRange) {
  const { minX, maxX, minY, maxY } = range;
  const safeMinX = Math.min(minX, maxX);
  const safeMaxX = Math.max(minX, maxX);
  const safeMinY = Math.min(minY, maxY);
  const safeMaxY = Math.max(minY, maxY);

  return {
    x: Math.round(safeMinX + Math.random() * (safeMaxX - safeMinX)),
    y: Math.round(safeMinY + Math.random() * (safeMaxY - safeMinY)),
  };
}

function createDirectionalFallbackTargets(range: ReachableRange): Position[] {
  const { minX, maxX, minY, maxY } = range;
  const centerX = Math.round((minX + maxX) / 2);
  const centerY = Math.round((minY + maxY) / 2);

  return [
    { x: Math.round(minX), y: centerY },
    { x: Math.round(maxX), y: centerY },
    { x: centerX, y: Math.round(minY) },
    { x: centerX, y: Math.round(maxY) },
    { x: Math.round(minX), y: Math.round(minY) },
    { x: Math.round(maxX), y: Math.round(minY) },
    { x: Math.round(minX), y: Math.round(maxY) },
    { x: Math.round(maxX), y: Math.round(maxY) },
  ];
}

export function createRoamTargetInActivityArea(
  area: Area,
  extents: DirectionalExtents,
  from: Position,
) {
  const reachableRange = createActualReachableRange(area, extents);
  const reachableDistance = Math.hypot(reachableRange.spanX, reachableRange.spanY);
  const preferredMinDistance = Math.max(140, Math.round(Math.min(area.width, area.height) * 0.16));
  const minDistance = Math.max(24, Math.min(preferredMinDistance, Math.round(reachableDistance * 0.45)));
  let fallbackTarget = createRandomPositionInRange(reachableRange);

  if (reachableDistance < 8) {
    return fallbackTarget;
  }

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidateTarget = createRandomPositionInRange(reachableRange);
    fallbackTarget = candidateTarget;

    if (measurePetDistance(from, candidateTarget) >= minDistance) {
      return candidateTarget;
    }
  }

  const directionalFallback = createDirectionalFallbackTargets(reachableRange)
    .sort((left, right) => measurePetDistance(from, right) - measurePetDistance(from, left))[0];

  if (directionalFallback && measurePetDistance(from, directionalFallback) > measurePetDistance(from, fallbackTarget)) {
    return directionalFallback;
  }

  return fallbackTarget;
}
