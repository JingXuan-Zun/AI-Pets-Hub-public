import { type ModelType } from '../../types';
import {
  resolvePetDragNativeWindowShapeVisualBounds,
  type PetVisualBounds,
} from './petVisualBounds';

type Position = {
  x: number;
  y: number;
};

type Size = {
  height: number;
  width: number;
};

type DragDelta = {
  x: number;
  y: number;
};

export type NativeDragInteractivePetRegionInput = {
  dragDelta?: DragDelta | null;
  id: string;
  isDragging?: boolean;
  modelType: ModelType;
  position: Position;
  previousActivityCenter?: Position | null;
  previousPosition?: Position | null;
  visualBounds: PetVisualBounds;
};

type ResolveNativeDragInteractiveRegionOptions = NativeDragInteractivePetRegionInput & {
  activityCenter: Position;
  padding?: number;
  viewport: Size;
};

type ResolveNativeDragInteractiveRegionsOptions = {
  activityCenter: Position;
  padding?: number;
  pets: NativeDragInteractivePetRegionInput[];
  viewport: Size;
};

const NATIVE_DRAG_WINDOW_SHAPE_REGION_PADDING_PX = 48;

function sanitizeExtent(value: number) {
  return Math.max(1, Math.round(Number.isFinite(value) ? value : 1));
}

function sanitizePosition(value: number) {
  return Math.round(Number.isFinite(value) ? value : 0);
}

function sanitizeVisualBounds(bounds: PetVisualBounds) {
  return {
    bottom: sanitizeExtent(bounds.bottom),
    left: sanitizeExtent(bounds.left),
    right: sanitizeExtent(bounds.right),
    top: sanitizeExtent(bounds.top),
  } satisfies PetVisualBounds;
}

function resolveNativeDragRegionFromRect(
  rect: Pick<DOMRect, 'bottom' | 'left' | 'right' | 'top'>,
  viewport: Size,
  padding: number,
) {
  const left = Math.max(0, Math.floor(rect.left - padding));
  const top = Math.max(0, Math.floor(rect.top - padding));
  const right = Math.min(Math.max(0, Math.round(viewport.width)), Math.ceil(rect.right + padding));
  const bottom = Math.min(Math.max(0, Math.round(viewport.height)), Math.ceil(rect.bottom + padding));
  const width = right - left;
  const height = bottom - top;

  if (width <= 0 || height <= 0) {
    return null;
  }

  return {
    height,
    width,
    x: left,
    y: top,
  } satisfies DesktopPetInteractiveRegionLike;
}

function resolveWindowShapeRectForPosition({
  activityCenter,
  position,
  shapeBounds,
}: {
  activityCenter: Position;
  position: Position;
  shapeBounds: PetVisualBounds;
}) {
  const centerX = sanitizePosition(activityCenter.x + position.x);
  const centerY = sanitizePosition(activityCenter.y + position.y);

  return {
    bottom: centerY + shapeBounds.bottom,
    left: centerX - shapeBounds.left,
    right: centerX + shapeBounds.right,
    top: centerY - shapeBounds.top,
  };
}

function resolveSweptWindowShapeRect({
  activityCenter,
  isDragging,
  position,
  previousActivityCenter = null,
  previousPosition = null,
  shapeBounds,
}: {
  activityCenter: Position;
  isDragging: boolean;
  position: Position;
  previousActivityCenter?: Position | null;
  previousPosition?: Position | null;
  shapeBounds: PetVisualBounds;
}) {
  const currentRect = resolveWindowShapeRectForPosition({
    activityCenter,
    position,
    shapeBounds,
  });
  const previousCenter = previousActivityCenter ?? activityCenter;
  if (
    !isDragging
    || (
      (!previousPosition || (previousPosition.x === position.x && previousPosition.y === position.y))
      && previousCenter.x === activityCenter.x
      && previousCenter.y === activityCenter.y
    )
  ) {
    return currentRect;
  }

  const previousRect = resolveWindowShapeRectForPosition({
    activityCenter: previousCenter,
    position: previousPosition ?? position,
    shapeBounds,
  });

  return {
    bottom: Math.max(previousRect.bottom, currentRect.bottom),
    left: Math.min(previousRect.left, currentRect.left),
    right: Math.max(previousRect.right, currentRect.right),
    top: Math.min(previousRect.top, currentRect.top),
  };
}

function resolveDragWindowShapeBounds({
  dragDelta,
  isDragging = false,
  visualBounds,
}: NativeDragInteractivePetRegionInput) {
  const safeBounds = sanitizeVisualBounds(visualBounds);

  if (!isDragging) {
    return safeBounds;
  }

  return resolvePetDragNativeWindowShapeVisualBounds(
    safeBounds,
    isDragging,
    {
      active: isDragging,
      deltaX: dragDelta?.x ?? 0,
      deltaY: dragDelta?.y ?? 0,
    },
  );
}

export function resolveNativeDragInteractiveRegionFromVisualBounds({
  activityCenter,
  dragDelta = null,
  id,
  isDragging = false,
  modelType,
  padding = NATIVE_DRAG_WINDOW_SHAPE_REGION_PADDING_PX,
  position,
  previousActivityCenter = null,
  previousPosition = null,
  viewport,
  visualBounds,
}: ResolveNativeDragInteractiveRegionOptions) {
  void id;
  const shapeBounds = resolveDragWindowShapeBounds({
    dragDelta,
    id,
    isDragging,
    modelType,
    position,
    visualBounds,
  });
  const sweptRect = resolveSweptWindowShapeRect({
    activityCenter,
    isDragging,
    position,
    previousActivityCenter,
    previousPosition,
    shapeBounds,
  });

  return resolveNativeDragRegionFromRect(sweptRect, viewport, padding);
}

export function resolveNativeDragInteractiveRegions({
  activityCenter,
  padding = NATIVE_DRAG_WINDOW_SHAPE_REGION_PADDING_PX,
  pets,
  viewport,
}: ResolveNativeDragInteractiveRegionsOptions) {
  return pets
    .map((pet) => resolveNativeDragInteractiveRegionFromVisualBounds({
      ...pet,
      activityCenter,
      padding,
      viewport,
    }))
    .filter((region): region is DesktopPetInteractiveRegionLike => Boolean(region));
}

function createRegionSignature(region: DesktopPetInteractiveRegionLike) {
  return `${region.x},${region.y},${region.width},${region.height}`;
}

export function mergeNativeDragInteractiveRegions(
  baseRegions: DesktopPetInteractiveRegionLike[],
  dragRegions: DesktopPetInteractiveRegionLike[],
) {
  const mergedRegions = new Map<string, DesktopPetInteractiveRegionLike>();

  [...baseRegions, ...dragRegions].forEach((region) => {
    mergedRegions.set(createRegionSignature(region), region);
  });

  return Array.from(mergedRegions.values());
}
