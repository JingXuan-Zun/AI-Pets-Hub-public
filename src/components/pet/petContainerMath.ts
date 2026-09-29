import { type PetConfig } from '../../types';
import { type DirectionalExtents } from './petActivityRegionMath';

type Position = {
  x: number;
  y: number;
};

export type ViewportRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const MIN_PET_SCALE = 0.5;
export const MAX_2D_PET_SCALE = 3;
export const MAX_LIVE2D_PET_SCALE = 4;
export const MAX_3D_PET_SCALE = 6;
export const PANEL_SCREEN_MARGIN = 24;
const PET_EAT_SCALE_BOOST_RATIO = 0.25;
const PET_EAT_SCALE_BOOST_MIN = 0.18;

export function scaleDirectionalExtents(
  extents: DirectionalExtents,
  currentScale: number,
  nextScale: number,
) {
  const safeCurrentScale = Number.isFinite(currentScale) && currentScale > 0 ? currentScale : 1;
  const safeNextScale = Number.isFinite(nextScale) && nextScale > 0 ? nextScale : safeCurrentScale;
  const ratio = safeNextScale / safeCurrentScale;

  return {
    left: Math.max(1, Math.round(extents.left * ratio)),
    right: Math.max(1, Math.round(extents.right * ratio)),
    top: Math.max(1, Math.round(extents.top * ratio)),
    bottom: Math.max(1, Math.round(extents.bottom * ratio)),
  } satisfies DirectionalExtents;
}

export function resolveScaledPetPositionWithBounds(
  position: Position,
  currentScale: number,
  nextScale: number,
  visualBounds: DirectionalExtents,
  clampPositionWithBounds: (
    position: Position,
    petScale: number,
    visualBounds: DirectionalExtents,
  ) => Position,
) {
  return clampPositionWithBounds(
    position,
    nextScale,
    scaleDirectionalExtents(visualBounds, currentScale, nextScale),
  );
}

export function resolveMaxScaleToFitActivityArea(
  activityArea: { width: number; height: number },
  visualBounds: DirectionalExtents,
  currentScale: number,
  maxScale: number,
) {
  const safeCurrentScale = Number.isFinite(currentScale) && currentScale > 0
    ? currentScale
    : 1;
  const safeMaxScale = Number.isFinite(maxScale) && maxScale > 0
    ? maxScale
    : safeCurrentScale;
  const safeWidth = Math.max(1, Math.round(activityArea.width));
  const safeHeight = Math.max(1, Math.round(activityArea.height));
  const visualWidth = Math.max(1, Math.round(visualBounds.left + visualBounds.right));
  const visualHeight = Math.max(1, Math.round(visualBounds.top + visualBounds.bottom));
  const maxByWidth = safeCurrentScale * (safeWidth / visualWidth);
  const maxByHeight = safeCurrentScale * (safeHeight / visualHeight);
  const fittedScale = Math.min(safeMaxScale, maxByWidth, maxByHeight);

  return Math.max(MIN_PET_SCALE, Number(fittedScale.toFixed(2)));
}

export function resolveEatScaleBoostAmount(currentScale: number) {
  const safeScale = Number.isFinite(currentScale) && currentScale > 0 ? currentScale : 1;
  return Math.max(PET_EAT_SCALE_BOOST_MIN, Number((safeScale * PET_EAT_SCALE_BOOST_RATIO).toFixed(2)));
}

export function resolvePetScaleCap(modelType: PetConfig['modelType']) {
  if (modelType === '3d') {
    return MAX_3D_PET_SCALE;
  }
  return modelType === 'live2d' ? MAX_LIVE2D_PET_SCALE : MAX_2D_PET_SCALE;
}

export function positionsMatch(left: Position, right: Position) {
  return left.x === right.x && left.y === right.y;
}

export function measurePositionDistance(left: Position, right: Position) {
  const deltaX = left.x - right.x;
  const deltaY = left.y - right.y;
  return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
}

export function parseLocalTestPositiveNumber(rawValue: string | null, fallbackValue: number) {
  const nextValue = Number(rawValue ?? '');
  return Number.isFinite(nextValue) && nextValue > 0 ? nextValue : fallbackValue;
}

function createActivityRangeForExtents(
  area: { width: number; height: number },
  extents: DirectionalExtents,
) {
  const safeWidth = Math.max(1, Math.round(area.width));
  const safeHeight = Math.max(1, Math.round(area.height));
  const safeExtents = {
    left: Math.max(1, Math.round(extents.left)),
    right: Math.max(1, Math.round(extents.right)),
    top: Math.max(1, Math.round(extents.top)),
    bottom: Math.max(1, Math.round(extents.bottom)),
  } satisfies DirectionalExtents;

  return {
    minX: -safeWidth / 2 + safeExtents.left,
    maxX: safeWidth / 2 - safeExtents.right,
    minY: -safeHeight / 2 + safeExtents.top,
    maxY: safeHeight / 2 - safeExtents.bottom,
  };
}

export function preserveEdgeAnchoringAcrossBoundsChange(
  position: Position,
  area: { width: number; height: number },
  previousExtents: DirectionalExtents,
  nextExtents: DirectionalExtents,
  tolerance = 3,
) {
  const previousRange = createActivityRangeForExtents(area, previousExtents);
  const nextRange = createActivityRangeForExtents(area, nextExtents);
  let nextX = position.x;
  let nextY = position.y;

  if (Math.abs(position.x - previousRange.minX) <= tolerance) {
    nextX = nextRange.minX;
  } else if (Math.abs(position.x - previousRange.maxX) <= tolerance) {
    nextX = nextRange.maxX;
  } else {
    nextX = Math.max(nextRange.minX, Math.min(nextRange.maxX, position.x));
  }

  if (Math.abs(position.y - previousRange.minY) <= tolerance) {
    nextY = nextRange.minY;
  } else if (Math.abs(position.y - previousRange.maxY) <= tolerance) {
    nextY = nextRange.maxY;
  } else {
    nextY = Math.max(nextRange.minY, Math.min(nextRange.maxY, position.y));
  }

  return {
    x: Math.round(nextX),
    y: Math.round(nextY),
  };
}

export function resolveTopRightPanelPosition(
  anchorRect: ViewportRect,
  panelSize: { width: number; height: number },
) {
  const maxLeft = anchorRect.x + anchorRect.width - panelSize.width - PANEL_SCREEN_MARGIN;
  const maxTop = anchorRect.y + anchorRect.height - panelSize.height - PANEL_SCREEN_MARGIN;

  return {
    x: Math.round(Math.max(anchorRect.x + PANEL_SCREEN_MARGIN, maxLeft)),
    y: Math.round(Math.max(anchorRect.y + PANEL_SCREEN_MARGIN, Math.min(maxTop, anchorRect.y + PANEL_SCREEN_MARGIN))),
  };
}

export function clampViewportCoordinate(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function createViewportRangeForExtents(
  viewport: ViewportRect,
  extents: DirectionalExtents,
  padding = 16,
) {
  const safeViewport = {
    x: Math.round(viewport.x),
    y: Math.round(viewport.y),
    width: Math.max(1, Math.round(viewport.width)),
    height: Math.max(1, Math.round(viewport.height)),
  } satisfies ViewportRect;
  const safeExtents = {
    left: Math.max(1, Math.round(extents.left)),
    right: Math.max(1, Math.round(extents.right)),
    top: Math.max(1, Math.round(extents.top)),
    bottom: Math.max(1, Math.round(extents.bottom)),
  } satisfies DirectionalExtents;
  const safePadding = Math.max(0, Math.round(padding));
  const rawMinX = safeViewport.x + safeExtents.left + safePadding;
  const rawMaxX = safeViewport.x + safeViewport.width - safeExtents.right - safePadding;
  const rawMinY = safeViewport.y + safeExtents.top + safePadding;
  const rawMaxY = safeViewport.y + safeViewport.height - safeExtents.bottom - safePadding;

  return {
    minX: Math.min(rawMinX, rawMaxX),
    maxX: Math.max(rawMinX, rawMaxX),
    minY: Math.min(rawMinY, rawMaxY),
    maxY: Math.max(rawMinY, rawMaxY),
  };
}

export function preserveViewportEdgeAnchoringAcrossBoundsChange(
  position: Position,
  activityCenter: Position,
  viewport: ViewportRect,
  previousExtents: DirectionalExtents,
  nextExtents: DirectionalExtents,
  padding = 16,
  tolerance = 3,
) {
  const previousRange = createViewportRangeForExtents(viewport, previousExtents, padding);
  const nextRange = createViewportRangeForExtents(viewport, nextExtents, padding);
  const anchorX = activityCenter.x + position.x;
  const anchorY = activityCenter.y + position.y;
  let nextAnchorX = anchorX;
  let nextAnchorY = anchorY;

  if (Math.abs(anchorX - previousRange.minX) <= tolerance) {
    nextAnchorX = nextRange.minX;
  } else if (Math.abs(anchorX - previousRange.maxX) <= tolerance) {
    nextAnchorX = nextRange.maxX;
  } else {
    nextAnchorX = clampViewportCoordinate(anchorX, nextRange.minX, nextRange.maxX);
  }

  if (Math.abs(anchorY - previousRange.minY) <= tolerance) {
    nextAnchorY = nextRange.minY;
  } else if (Math.abs(anchorY - previousRange.maxY) <= tolerance) {
    nextAnchorY = nextRange.maxY;
  } else {
    nextAnchorY = clampViewportCoordinate(anchorY, nextRange.minY, nextRange.maxY);
  }

  return {
    x: nextAnchorX - activityCenter.x,
    y: nextAnchorY - activityCenter.y,
  };
}

export function isPetPositionVisibleInViewport(
  position: Position,
  activityCenter: Position,
  viewport: ViewportRect,
  extents: DirectionalExtents,
  padding = 16,
) {
  const range = createViewportRangeForExtents(viewport, extents, padding);
  const anchorX = activityCenter.x + position.x;
  const anchorY = activityCenter.y + position.y;

  return anchorX >= range.minX
    && anchorX <= range.maxX
    && anchorY >= range.minY
    && anchorY <= range.maxY;
}

export function clampPetPositionToViewport(
  position: Position,
  activityCenter: Position,
  viewport: ViewportRect,
  extents: DirectionalExtents,
  padding = 16,
) {
  const range = createViewportRangeForExtents(viewport, extents, padding);
  const anchorX = activityCenter.x + position.x;
  const anchorY = activityCenter.y + position.y;
  const nextAnchorX = clampViewportCoordinate(anchorX, range.minX, range.maxX);
  const nextAnchorY = clampViewportCoordinate(anchorY, range.minY, range.maxY);

  return {
    x: nextAnchorX - activityCenter.x,
    y: nextAnchorY - activityCenter.y,
  };
}
