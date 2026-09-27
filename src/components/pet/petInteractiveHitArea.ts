import { type CSSProperties } from 'react';
import { type PetVisualBounds } from './petVisualBounds';
import { type ModelType } from '../../types';

const WIDE_2D_SELECTION_WIDTH_THRESHOLD_PX = 190;
const WIDE_2D_SELECTION_WIDTH_RATIO = 0.46;
const WIDE_2D_SELECTION_MIN_WIDTH_PX = 120;

function sanitizeExtent(value: number) {
  return Math.max(1, Math.round(value));
}

export { arePetVisualBoundsEqual } from './petVisualBounds';

function resolvePetVisualBoundsRectStyle(
  shellSize: number,
  bounds: PetVisualBounds | null | undefined,
): CSSProperties | undefined {
  if (!bounds) {
    return undefined;
  }

  const safeShellSize = Math.max(1, Math.round(shellSize));
  const halfShellSize = safeShellSize / 2;
  const safeBounds = {
    left: sanitizeExtent(bounds.left),
    right: sanitizeExtent(bounds.right),
    top: sanitizeExtent(bounds.top),
    bottom: sanitizeExtent(bounds.bottom),
  } satisfies PetVisualBounds;

  return {
    bottom: 'auto',
    height: `${safeBounds.top + safeBounds.bottom}px`,
    left: `${Math.round(halfShellSize - safeBounds.left)}px`,
    right: 'auto',
    top: `${Math.round(halfShellSize - safeBounds.top)}px`,
    width: `${safeBounds.left + safeBounds.right}px`,
  } satisfies CSSProperties;
}

export function resolvePetWindowShapeProxyStyle(
  shellSize: number,
  bounds: PetVisualBounds | null | undefined,
): CSSProperties | undefined {
  return resolvePetVisualBoundsRectStyle(shellSize, bounds);
}

export function resolvePetInteractiveHitAreaStyle(
  shellSize: number,
  bounds: PetVisualBounds | null | undefined,
): CSSProperties | undefined {
  return resolvePetVisualBoundsRectStyle(shellSize, bounds);
}

function resolvePetSelectionBounds(
  bounds: PetVisualBounds,
  modelType: ModelType,
): PetVisualBounds {
  if (modelType === '3d') {
    return bounds;
  }

  const safeBounds = {
    bottom: sanitizeExtent(bounds.bottom),
    left: sanitizeExtent(bounds.left),
    right: sanitizeExtent(bounds.right),
    top: sanitizeExtent(bounds.top),
  } satisfies PetVisualBounds;
  const visualWidth = safeBounds.left + safeBounds.right;

  if (visualWidth <= WIDE_2D_SELECTION_WIDTH_THRESHOLD_PX) {
    return safeBounds;
  }

  const selectionWidth = Math.max(
    WIDE_2D_SELECTION_MIN_WIDTH_PX,
    Math.round(visualWidth * WIDE_2D_SELECTION_WIDTH_RATIO),
  );
  const left = Math.floor(selectionWidth / 2);

  return {
    ...safeBounds,
    left,
    right: Math.max(1, selectionWidth - left),
  } satisfies PetVisualBounds;
}

export function resolvePetSelectionHitAreaStyle(
  shellSize: number,
  bounds: PetVisualBounds | null | undefined,
  modelType: ModelType,
): CSSProperties | undefined {
  if (!bounds) {
    return undefined;
  }

  return resolvePetVisualBoundsRectStyle(
    shellSize,
    resolvePetSelectionBounds(bounds, modelType),
  );
}

function formatScoreRatio(value: number) {
  return String(Number(value.toFixed(6)));
}

export function resolvePetSelectionScoreAreaAttributes(
  interactiveBounds: PetVisualBounds | null | undefined,
  scoreBounds: PetVisualBounds | null | undefined,
) {
  if (!interactiveBounds || !scoreBounds) {
    return undefined;
  }

  const safeInteractiveBounds = {
    bottom: sanitizeExtent(interactiveBounds.bottom),
    left: sanitizeExtent(interactiveBounds.left),
    right: sanitizeExtent(interactiveBounds.right),
    top: sanitizeExtent(interactiveBounds.top),
  } satisfies PetVisualBounds;
  const safeScoreBounds = {
    bottom: Math.min(safeInteractiveBounds.bottom, sanitizeExtent(scoreBounds.bottom)),
    left: Math.min(safeInteractiveBounds.left, sanitizeExtent(scoreBounds.left)),
    right: Math.min(safeInteractiveBounds.right, sanitizeExtent(scoreBounds.right)),
    top: Math.min(safeInteractiveBounds.top, sanitizeExtent(scoreBounds.top)),
  } satisfies PetVisualBounds;
  const interactiveWidth = Math.max(1, safeInteractiveBounds.left + safeInteractiveBounds.right);
  const interactiveHeight = Math.max(1, safeInteractiveBounds.top + safeInteractiveBounds.bottom);
  const scoreWidth = Math.max(1, safeScoreBounds.left + safeScoreBounds.right);
  const scoreHeight = Math.max(1, safeScoreBounds.top + safeScoreBounds.bottom);

  return {
    'data-desktop-pet-selection-score-height': formatScoreRatio(scoreHeight / interactiveHeight),
    'data-desktop-pet-selection-score-left': formatScoreRatio((safeInteractiveBounds.left - safeScoreBounds.left) / interactiveWidth),
    'data-desktop-pet-selection-score-top': formatScoreRatio((safeInteractiveBounds.top - safeScoreBounds.top) / interactiveHeight),
    'data-desktop-pet-selection-score-width': formatScoreRatio(scoreWidth / interactiveWidth),
  };
}
