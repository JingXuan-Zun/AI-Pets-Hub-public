import { type PetCollisionProfile, type PetConfig } from '../../types';

export type Position = {
  x: number;
  y: number;
};

export type Area = {
  width: number;
  height: number;
};

export type DirectionalExtents = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};

export type ActivitySceneEntityType = 'pet' | 'folder';

export const MIN_PET_COLLISION_SCALE = 0.5;
export const MAX_PET_COLLISION_SCALE = 3;
export const MIN_PET_COLLISION_DIAMETER = 150;
export const MAX_PET_COLLISION_DIAMETER = 820;

function sanitizeDirectionalExtents(extents: DirectionalExtents) {
  return {
    left: Math.max(1, Math.round(extents.left)),
    right: Math.max(1, Math.round(extents.right)),
    top: Math.max(1, Math.round(extents.top)),
    bottom: Math.max(1, Math.round(extents.bottom)),
  } satisfies DirectionalExtents;
}

export function fitDirectionalExtentsToArea(
  area: Area,
  extents: DirectionalExtents,
) {
  const safeAreaWidth = Math.max(2, Math.round(area.width));
  const safeAreaHeight = Math.max(2, Math.round(area.height));
  const safeExtents = sanitizeDirectionalExtents(extents);
  const maxPerSideX = Math.max(1, Math.floor((safeAreaWidth - 1) / 2));
  const maxPerSideY = Math.max(1, Math.floor((safeAreaHeight - 1) / 2));
  let left = Math.min(safeExtents.left, maxPerSideX);
  let right = Math.min(safeExtents.right, maxPerSideX);
  let top = Math.min(safeExtents.top, maxPerSideY);
  let bottom = Math.min(safeExtents.bottom, maxPerSideY);
  const maxHorizontalTotal = Math.max(1, safeAreaWidth - 1);
  const maxVerticalTotal = Math.max(1, safeAreaHeight - 1);
  const horizontalTotal = left + right;
  const verticalTotal = top + bottom;

  if (horizontalTotal > maxHorizontalTotal) {
    const scale = maxHorizontalTotal / horizontalTotal;
    left = Math.max(1, Math.floor(left * scale));
    right = Math.max(1, Math.floor(right * scale));
  }

  if (verticalTotal > maxVerticalTotal) {
    const scale = maxVerticalTotal / verticalTotal;
    top = Math.max(1, Math.floor(top * scale));
    bottom = Math.max(1, Math.floor(bottom * scale));
  }

  return {
    left,
    right,
    top,
    bottom,
  } satisfies DirectionalExtents;
}

function createActivityAreaRangeWithExtents(
  area: Area,
  extents: DirectionalExtents,
) {
  const safeAreaWidth = Math.max(1, Math.round(area.width));
  const safeAreaHeight = Math.max(1, Math.round(area.height));
  const safeExtents = sanitizeDirectionalExtents(extents);
  const minX = -safeAreaWidth / 2 + safeExtents.left;
  const maxX = safeAreaWidth / 2 - safeExtents.right;
  const minY = -safeAreaHeight / 2 + safeExtents.top;
  const maxY = safeAreaHeight / 2 - safeExtents.bottom;

  return {
    minX,
    maxX,
    minY,
    maxY,
    centerX: Math.round((minX + maxX) / 2),
    centerY: Math.round((minY + maxY) / 2),
    fitsHorizontally: safeExtents.left + safeExtents.right <= safeAreaWidth,
    fitsVertically: safeExtents.top + safeExtents.bottom <= safeAreaHeight,
  };
}

export function getSelectedActivityDisplay(
  availableDisplays: DesktopPetDisplayLike[],
  activityDisplayId: PetConfig['settings']['activityDisplayId'],
) {
  return getSelectedDisplayById(availableDisplays, activityDisplayId);
}

export function getSelectedDisplayById(
  availableDisplays: DesktopPetDisplayLike[],
  displayId: PetConfig['settings']['activityDisplayId'],
) {
  return displayId === 'primary'
    ? availableDisplays.find((display) => display.isPrimary) ?? availableDisplays[0] ?? null
    : availableDisplays.find((display) => display.id === displayId)
      ?? availableDisplays.find((display) => display.isPrimary)
      ?? availableDisplays[0]
      ?? null;
}

export function getDisplayScaleFactor(display: DesktopPetDisplayLike | null | undefined) {
  return display?.scaleFactor && display.scaleFactor > 0
    ? display.scaleFactor
    : 1;
}

export function getDisplayPixelSize(display: DesktopPetDisplayLike | null | undefined) {
  const scaleFactor = getDisplayScaleFactor(display);
  return {
    width: display ? Math.max(1, Math.round(display.width * scaleFactor)) : 0,
    height: display ? Math.max(1, Math.round(display.height * scaleFactor)) : 0,
  };
}

export function resolveStoredActivityRegionOffset(settings: PetConfig['settings']) {
  return {
    x: Number.isFinite(settings.activityOffsetX) ? Math.round(settings.activityOffsetX) : 0,
    y: Number.isFinite(settings.activityOffsetY) ? Math.round(settings.activityOffsetY) : 0,
  };
}

export function resolveViewportActivitySettings(
  settings: PetConfig['settings'],
  selectedDisplayScaleFactor: number,
) {
  if (!settings.activityAreaManual) {
    return settings;
  }

  return {
    ...settings,
    activityAreaWidth: settings.activityAreaWidth > 0
      ? Math.max(1, Math.round(settings.activityAreaWidth / selectedDisplayScaleFactor))
      : settings.activityAreaWidth,
    activityAreaHeight: settings.activityAreaHeight > 0
      ? Math.max(1, Math.round(settings.activityAreaHeight / selectedDisplayScaleFactor))
      : settings.activityAreaHeight,
  };
}

export function resolveActivityViewport(
  selectedDisplay: DesktopPetDisplayLike | null,
  sceneSize: Area,
  availableDisplays: DesktopPetDisplayLike[] = [],
) {
  if (!selectedDisplay || selectedDisplay.width <= 0 || selectedDisplay.height <= 0) {
    return {
      x: 0,
      y: 0,
      width: sceneSize.width,
      height: sceneSize.height,
    };
  }

  const virtualDesktopOrigin = availableDisplays.reduce((origin, display) => ({
    x: Math.min(origin.x, Number.isFinite(display.x) ? display.x : origin.x),
    y: Math.min(origin.y, Number.isFinite(display.y) ? display.y : origin.y),
  }), {
    x: Number.isFinite(selectedDisplay.x) ? selectedDisplay.x : 0,
    y: Number.isFinite(selectedDisplay.y) ? selectedDisplay.y : 0,
  });

  return {
    // Use the virtual desktop origin derived from Electron display data.
    // In packaged multi-screen runs, window.screenX / window.screenY can lag
    // or jump after drag, which makes the activity center change mid-session
    // and causes 3D boundary recovery to snap the pet back unexpectedly.
    x: selectedDisplay.x - virtualDesktopOrigin.x,
    y: selectedDisplay.y - virtualDesktopOrigin.y,
    width: selectedDisplay.width,
    height: selectedDisplay.height,
  };
}

export function createDragBoundsViewport(activityViewport: Area, sceneSize: Area) {
  return {
    width: Math.max(activityViewport.width, sceneSize.width),
    height: Math.max(activityViewport.height, sceneSize.height),
  };
}

export function createActivityBaseCenter(activityViewport: { x: number; y: number; width: number; height: number }) {
  return {
    x: activityViewport.x + activityViewport.width / 2,
    y: activityViewport.y + activityViewport.height / 2,
  };
}

export function clampActivityRegionOffsetWithinArea(
  nextOffset: Position,
  area: Area,
  activityBaseCenter: Position,
  dragBoundsViewport: Area,
) {
  const rawMinOffsetX = Math.round(area.width / 2 - activityBaseCenter.x);
  const rawMaxOffsetX = Math.round(dragBoundsViewport.width - area.width / 2 - activityBaseCenter.x);
  const rawMinOffsetY = Math.round(area.height / 2 - activityBaseCenter.y);
  const rawMaxOffsetY = Math.round(dragBoundsViewport.height - area.height / 2 - activityBaseCenter.y);
  const minOffsetX = Math.min(rawMinOffsetX, rawMaxOffsetX);
  const maxOffsetX = Math.max(rawMinOffsetX, rawMaxOffsetX);
  const minOffsetY = Math.min(rawMinOffsetY, rawMaxOffsetY);
  const maxOffsetY = Math.max(rawMinOffsetY, rawMaxOffsetY);

  return {
    x: Math.max(minOffsetX, Math.min(maxOffsetX, Math.round(nextOffset.x))),
    y: Math.max(minOffsetY, Math.min(maxOffsetY, Math.round(nextOffset.y))),
  };
}

export function clampPositionToActivityAreaBounds(
  position: Position,
  area: Area,
  halfWidth: number,
  halfHeight: number,
) {
  const maxX = Math.max(0, area.width / 2 - halfWidth);
  const maxY = Math.max(0, area.height / 2 - halfHeight);

  return {
    x: Math.max(-maxX, Math.min(maxX, position.x)),
    y: Math.max(-maxY, Math.min(maxY, position.y)),
  };
}

export function createRandomPositionInActivityArea(
  area: Area,
  halfWidth: number,
  halfHeight: number,
) {
  const maxX = Math.max(0, area.width / 2 - halfWidth);
  const maxY = Math.max(0, area.height / 2 - halfHeight);

  return {
    x: Math.round((Math.random() * 2 - 1) * maxX),
    y: Math.round((Math.random() * 2 - 1) * maxY),
  };
}

export function createRandomPositionInActivityAreaWithExtents(
  area: Area,
  extents: DirectionalExtents,
) {
  const fittedExtents = fitDirectionalExtentsToArea(area, extents);
  const minX = -area.width / 2 + fittedExtents.left;
  const maxX = area.width / 2 - fittedExtents.right;
  const minY = -area.height / 2 + fittedExtents.top;
  const maxY = area.height / 2 - fittedExtents.bottom;
  const safeMinX = Math.min(minX, maxX);
  const safeMaxX = Math.max(minX, maxX);
  const safeMinY = Math.min(minY, maxY);
  const safeMaxY = Math.max(minY, maxY);

  return {
    x: Math.round(safeMinX + Math.random() * (safeMaxX - safeMinX)),
    y: Math.round(safeMinY + Math.random() * (safeMaxY - safeMinY)),
  };
}

export function clampPositionToActivityAreaBoundsWithExtents(
  position: Position,
  area: Area,
  extents: DirectionalExtents,
) {
  const range = createActivityAreaRangeWithExtents(area, extents);

  return {
    x: range.fitsHorizontally
      ? Math.max(range.minX, Math.min(range.maxX, position.x))
      : range.centerX,
    y: range.fitsVertically
      ? Math.max(range.minY, Math.min(range.maxY, position.y))
      : range.centerY,
  };
}

export function resolvePetCollisionDiameter(scale: number, area?: Area) {
  const safeScale = Number.isFinite(scale) ? scale : MIN_PET_COLLISION_SCALE;
  const normalizedScale = Math.max(
    0,
    Math.min(
      1,
      (safeScale - MIN_PET_COLLISION_SCALE) / (MAX_PET_COLLISION_SCALE - MIN_PET_COLLISION_SCALE),
    ),
  );
  const mappedDiameter = MIN_PET_COLLISION_DIAMETER
    + (MAX_PET_COLLISION_DIAMETER - MIN_PET_COLLISION_DIAMETER) * normalizedScale;
  const areaLimit = area
    ? Math.max(1, Math.min(area.width, area.height))
    : Number.POSITIVE_INFINITY;

  return Math.max(1, Math.round(Math.min(mappedDiameter, areaLimit)));
}

export function resolvePetCollisionRadius(scale: number, area?: Area) {
  return resolvePetCollisionDiameter(scale, area) / 2;
}

export function resolvePetBoundaryExtents(scale: number, area: Area): DirectionalExtents {
  const radius = resolvePetCollisionRadius(scale, area);

  return {
    left: radius,
    right: radius,
    top: radius,
    bottom: radius,
  };
}

export function clampPositionToActivityAreaBoundary(
  position: Position,
  area: Area,
  scale: number,
  visualExtents?: DirectionalExtents | null,
) {
  if (!visualExtents) {
    return clampPositionToActivityAreaBoundsWithExtents(position, area, resolvePetBoundaryExtents(scale, area));
  }

  return clampPositionToActivityAreaBoundsWithExtents(position, area, sanitizeDirectionalExtents(visualExtents));
}

export function createCollisionBoundsFromVisualBounds(
  visualBounds: DirectionalExtents,
  collisionProfile?: PetCollisionProfile | null,
  modelScale = 1,
) {
  if (!collisionProfile) {
    return sanitizeDirectionalExtents(visualBounds);
  }

  const rawTop = visualBounds.top * collisionProfile.topRatio - (collisionProfile.topInset ?? 0);
  const topScaleFactor = collisionProfile.topScaleSlope
    ? Math.max(
      collisionProfile.topScaleMinFactor ?? 0.5,
      Math.min(
        collisionProfile.topScaleMaxFactor ?? 1.5,
        1 + (modelScale - (collisionProfile.topScaleReferenceScale ?? 1)) * collisionProfile.topScaleSlope,
      ),
    )
    : 1;

  return {
    left: Math.max(
      collisionProfile.minLeft ?? 1,
      Math.round(visualBounds.left * collisionProfile.leftRatio - (collisionProfile.leftInset ?? 0)),
    ),
    right: Math.max(
      collisionProfile.minRight ?? 1,
      Math.round(visualBounds.right * collisionProfile.rightRatio - (collisionProfile.rightInset ?? 0)),
    ),
    top: Math.max(
      collisionProfile.minTop ?? 1,
      Math.round(rawTop * topScaleFactor),
    ),
    bottom: Math.max(
      collisionProfile.minBottom ?? 1,
      Math.round(visualBounds.bottom * collisionProfile.bottomRatio - (collisionProfile.bottomInset ?? 0)),
    ),
  } satisfies DirectionalExtents;
}

export function separateOverlappingPetPosition(
  movingPosition: Position,
  movingExtents: DirectionalExtents,
  otherPosition: Position,
  otherExtents: DirectionalExtents,
  gap = 0,
) {
  const dx = movingPosition.x - otherPosition.x;
  const dy = movingPosition.y - otherPosition.y;
  const horizontalThreshold = (
    dx >= 0
      ? movingExtents.left + otherExtents.right
      : movingExtents.right + otherExtents.left
  ) + gap;
  const verticalThreshold = (
    dy >= 0
      ? movingExtents.top + otherExtents.bottom
      : movingExtents.bottom + otherExtents.top
  ) + gap;
  const overlapX = horizontalThreshold - Math.abs(dx);
  const overlapY = verticalThreshold - Math.abs(dy);

  if (overlapX <= 0 || overlapY <= 0) {
    return movingPosition;
  }

  if (overlapX <= overlapY) {
    const directionX = dx === 0 ? 1 : Math.sign(dx);
    return {
      x: Math.round(movingPosition.x + directionX * overlapX),
      y: Math.round(movingPosition.y),
    };
  }

  const directionY = dy === 0 ? 1 : Math.sign(dy);
  return {
    x: Math.round(movingPosition.x),
    y: Math.round(movingPosition.y + directionY * overlapY),
  };
}

interface ClampSceneEntityToActivityAreaOptions {
  folderHalfHeight: number;
  folderHalfWidth: number;
  folderBoundaryExtents?: DirectionalExtents | null;
  petScale: number;
  petVisualBounds?: DirectionalExtents | null;
}

export function clampSceneEntityToActivityArea(
  position: Position,
  area: Area,
  type: ActivitySceneEntityType,
  {
    folderHalfHeight,
    folderHalfWidth,
    folderBoundaryExtents,
    petScale,
    petVisualBounds,
  }: ClampSceneEntityToActivityAreaOptions,
) {
  if (type === 'pet') {
    return clampPositionToActivityAreaBoundary(position, area, petScale, petVisualBounds);
  }

  if (folderBoundaryExtents) {
    return clampPositionToActivityAreaBoundsWithExtents(position, area, folderBoundaryExtents);
  }

  return clampPositionToActivityAreaBounds(position, area, folderHalfWidth, folderHalfHeight);
}
