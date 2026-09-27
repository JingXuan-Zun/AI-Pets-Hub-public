import { type PetAction, type PetModelMotionKey } from '../../types';

export type PetPointerLookPriorityContext = {
  action?: PetAction | null;
  expressionAction?: PetAction | null;
  isDragging?: boolean;
  isDragLookSettling?: boolean;
  isMoving?: boolean;
  manualMotionActive?: boolean;
  manualMotionKey?: PetModelMotionKey | null;
  motionKey?: PetModelMotionKey | string | null;
  motionMode?: string | null;
  motionSource?: string | null;
};

const POINTER_LOOK_STRENGTH_IDLE = 1;
const POINTER_LOOK_STRENGTH_MOVING = 0.72;
const POINTER_LOOK_STRENGTH_REACTION = 0.62;
const POINTER_LOOK_STRENGTH_EATING = 0.5;
const POINTER_LOOK_STRENGTH_SLEEPING = 0.28;
const POINTER_LOOK_STRENGTH_MANUAL_MOTION = 0.48;

export function clampPetPointerLookStrength(value: number) {
  if (!Number.isFinite(value)) {
    return POINTER_LOOK_STRENGTH_IDLE;
  }

  return Math.max(0, Math.min(POINTER_LOOK_STRENGTH_IDLE, value));
}

export function resolvePetPointerLookStrength({
  action = 'IDLE',
  expressionAction = null,
  isDragging = false,
  isDragLookSettling = false,
  isMoving = false,
  manualMotionActive = false,
  manualMotionKey = null,
  motionKey = null,
  motionMode = null,
  motionSource = null,
}: PetPointerLookPriorityContext) {
  if (isDragging || isDragLookSettling) {
    return POINTER_LOOK_STRENGTH_IDLE;
  }

  const visualAction = expressionAction ?? action ?? 'IDLE';
  const effectiveMotionKey = motionKey ?? manualMotionKey ?? null;
  const isIdleBase = visualAction === 'IDLE' && !isMoving;
  const isIdleMotion = !effectiveMotionKey || effectiveMotionKey === 'idle';

  if (visualAction === 'SLEEPING') {
    return POINTER_LOOK_STRENGTH_SLEEPING;
  }

  if (visualAction === 'EATING') {
    return POINTER_LOOK_STRENGTH_EATING;
  }

  if (visualAction === 'HAPPY' || visualAction === 'SAD') {
    return POINTER_LOOK_STRENGTH_REACTION;
  }

  if (
    visualAction === 'WALKING'
    || visualAction === 'RUNNING'
    || visualAction === 'SWIMMING'
    || isMoving
  ) {
    return POINTER_LOOK_STRENGTH_MOVING;
  }

  if (isIdleBase && isIdleMotion) {
    return POINTER_LOOK_STRENGTH_IDLE;
  }

  if (manualMotionActive) {
    return POINTER_LOOK_STRENGTH_MANUAL_MOTION;
  }

  if (motionMode === 'replace' || motionMode === 'soft-stop') {
    return POINTER_LOOK_STRENGTH_MANUAL_MOTION;
  }

  if (motionSource && motionSource !== 'none' && motionSource !== 'state-machine') {
    return POINTER_LOOK_STRENGTH_REACTION;
  }

  return POINTER_LOOK_STRENGTH_IDLE;
}
