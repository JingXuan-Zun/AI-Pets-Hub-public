import { type ModelType } from '../../types';
import { resolveVisualFacingTarget } from './petMotionVisualState';
import {
  PET_RUNTIME_LIVE2D_FOCUS_TARGET_QUANTIZE_STEP,
  resolvePetRuntimeFocusTarget,
} from './petAvatarRuntimeSurface';

export type PetLayerPosition = {
  x: number;
  y: number;
};

const MOVEMENT_FOCUS_TARGET_HOLD_MS = 900;
const LIVE2D_MOVEMENT_FOCUS_TARGET_HOLD_MS = 900;
const MIN_MOVEMENT_FOCUS_DELTA = 0.25;
const LIVE2D_MIN_DRAG_FOCUS_MAGNITUDE = 8;
const LIVE2D_MAX_DRAG_FOCUS_MAGNITUDE = 24;

export function resolvePetLayerRawFocusTarget({
  motionFocusTarget,
  movementFocusTarget,
  modelType = '2d',
  shouldAnimateAsMoving,
  visionTarget = null,
}: {
  motionFocusTarget: PetLayerPosition | null;
  movementFocusTarget: PetLayerPosition | null;
  modelType?: ModelType;
  shouldAnimateAsMoving: boolean;
  visionTarget?: PetLayerPosition | null;
}) {
  const fallbackVisionTarget = modelType === 'live2d' ? null : visionTarget;
  return (
    (shouldAnimateAsMoving
      ? resolveVisualFacingTarget(movementFocusTarget, motionFocusTarget)
      : movementFocusTarget)
    ?? fallbackVisionTarget
  );
}

export function shouldExpireMovementFocusTargetForModelType(modelType: ModelType) {
  return modelType !== '2d';
}

export function resolveMovementFocusTargetHoldMs(modelType: ModelType) {
  return modelType === 'live2d'
    ? LIVE2D_MOVEMENT_FOCUS_TARGET_HOLD_MS
    : MOVEMENT_FOCUS_TARGET_HOLD_MS;
}

export function shouldIgnoreLive2DIdlePositionFocus({
  modelType,
  shouldAnimateAsMoving,
  wasDragging,
}: {
  modelType: ModelType;
  shouldAnimateAsMoving: boolean;
  wasDragging: boolean;
}) {
  return modelType === 'live2d' && !shouldAnimateAsMoving && !wasDragging;
}

export function shouldSuppressMovementFocusAfterDragHandoff({
  isDragging,
  modelType,
  nextFocusTarget = null,
  wasDragging,
}: {
  isDragging: boolean;
  modelType: ModelType;
  nextFocusTarget?: PetLayerPosition | null;
  wasDragging: boolean;
}) {
  return modelType === 'live2d' && wasDragging && !isDragging && nextFocusTarget === null;
}

export function resolveNextMovementFocusTarget(
  modelType: ModelType,
  delta: PetLayerPosition,
): PetLayerPosition | null {
  if (Math.abs(delta.x) < MIN_MOVEMENT_FOCUS_DELTA && Math.abs(delta.y) < MIN_MOVEMENT_FOCUS_DELTA) {
    return null;
  }

  const nextFocusTarget = resolvePetRuntimeFocusTarget(
    delta,
    modelType === 'live2d' ? PET_RUNTIME_LIVE2D_FOCUS_TARGET_QUANTIZE_STEP : undefined,
  );
  if (!nextFocusTarget) {
    return null;
  }

  const isCenteredTarget = nextFocusTarget.x === 0 && nextFocusTarget.y === 0;
  if (shouldExpireMovementFocusTargetForModelType(modelType) && isCenteredTarget) {
    return null;
  }

  return nextFocusTarget;
}

export function resolvePetLayerMovementFocusTarget({
  dragHandoffFocusTarget,
  isDragging,
  modelType,
  movementFocusTarget,
}: {
  dragHandoffFocusTarget: PetLayerPosition | null;
  isDragging: boolean;
  modelType: ModelType;
  movementFocusTarget: PetLayerPosition | null;
}) {
  if (modelType === 'live2d' && isDragging) {
    return dragHandoffFocusTarget;
  }
  return dragHandoffFocusTarget ?? movementFocusTarget;
}

export function resolvePetLayerFocusTarget(
  modelType: ModelType,
  rawFocusTarget: PetLayerPosition | null,
) {
  return resolvePetRuntimeFocusTarget(
    rawFocusTarget,
    modelType === 'live2d' ? PET_RUNTIME_LIVE2D_FOCUS_TARGET_QUANTIZE_STEP : undefined,
  );
}

export function resolvePetLayerDragFocusDelta(
  modelType: ModelType,
  delta: PetLayerPosition,
): PetLayerPosition {
  if (modelType !== 'live2d') {
    return delta;
  }
  const magnitude = Math.hypot(delta.x, delta.y);
  // Once the pointer gesture has crossed the drag activation threshold, even
  // a sub-pixel scene delta still carries a valid direction. Treating it as
  // zero here made slow/short companion drags lose the unified maximum cue.
  if (magnitude === 0) {
    return delta;
  }
  // Drag direction is a semantic input, not a velocity measurement. Using the
  // per-frame delta magnitude here made slow/short drags visibly weaker than
  // fast drags even though both gestures pointed in the same direction.
  const targetMagnitude = LIVE2D_MAX_DRAG_FOCUS_MAGNITUDE;
  const scale = targetMagnitude / magnitude;
  return { x: delta.x * scale, y: delta.y * scale };
}

export function resolvePetMovementFocusPositionUpdate({
  delta,
  dragFocusTarget = null,
  isDragging,
  modelType,
  shouldAnimateAsMoving,
  wasDragging,
}: {
  delta: PetLayerPosition;
  dragFocusTarget?: PetLayerPosition | null;
  isDragging: boolean;
  modelType: ModelType;
  shouldAnimateAsMoving: boolean;
  wasDragging: boolean;
}):
  | { type: 'preserve' }
  | { type: 'clear' }
  | { target: PetLayerPosition; type: 'set' } {
  if (isDragging) {
    return modelType === 'live2d' ? { type: 'clear' } : { type: 'preserve' };
  }

  if (shouldIgnoreLive2DIdlePositionFocus({
    modelType,
    shouldAnimateAsMoving,
    wasDragging,
  })) {
    return { type: 'preserve' };
  }

  const dragReleaseFocusTarget = modelType === 'live2d' && wasDragging
    ? dragFocusTarget
    : null;
  const nextFocusTarget = dragReleaseFocusTarget
    ?? resolveNextMovementFocusTarget(modelType, delta)
    ?? (wasDragging ? dragFocusTarget : null);
  if (shouldSuppressMovementFocusAfterDragHandoff({
    isDragging,
    modelType,
    nextFocusTarget,
    wasDragging,
  })) {
    return { type: 'clear' };
  }

  return nextFocusTarget
    ? { target: nextFocusTarget, type: 'set' }
    : { type: 'preserve' };
}
