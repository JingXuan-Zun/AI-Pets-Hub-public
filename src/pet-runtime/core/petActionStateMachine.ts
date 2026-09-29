import { type PetAction } from '../../types';

type ResolvePetActionStateMachineOptions = {
  action?: PetAction;
  expressionAction?: PetAction | null;
  isMoving?: boolean;
  motionOverrideMode?: PetActionMotionOverrideMode | null;
};

export type PetActionMotionMode = 'idle' | 'walking' | 'running' | 'swimming';
export type PetActionMotionOverrideMode = 'preserve' | 'soft-stop' | 'replace';

export type PetActionEmotionMode = 'neutral' | 'eating' | 'happy' | 'sad' | 'sleeping';

export type PetActionStateMachineSnapshot = {
  baseAction: PetAction;
  expressionAction: PetAction | null;
  isExpressionLocked: boolean;
  motionMode: PetActionMotionMode;
  motionOverrideMode: PetActionMotionOverrideMode;
  requestedIsMoving: boolean;
  visualAction: PetAction;
  visualEmotionMode: PetActionEmotionMode;
  visualIsMoving: boolean;
  visualMotionMode: PetActionMotionMode;
};

export function resolvePetActionMotionMode(action: PetAction): PetActionMotionMode {
  if (action === 'RUNNING') {
    return 'running';
  }

  if (action === 'WALKING') {
    return 'walking';
  }

  if (action === 'SWIMMING') {
    return 'swimming';
  }

  return 'idle';
}

export function resolvePetActionEmotionMode(action: PetAction): PetActionEmotionMode {
  if (action === 'EATING') {
    return 'eating';
  }

  if (action === 'HAPPY') {
    return 'happy';
  }

  if (action === 'SAD') {
    return 'sad';
  }

  if (action === 'SLEEPING') {
    return 'sleeping';
  }

  return 'neutral';
}

export function resolvePetActionStateMachineSnapshot({
  action = 'IDLE',
  expressionAction = null,
  isMoving = false,
  motionOverrideMode = expressionAction ? 'replace' : 'preserve',
}: ResolvePetActionStateMachineOptions): PetActionStateMachineSnapshot {
  const baseAction = action;
  const visualAction = expressionAction ?? action;
  const requestedIsMoving = Boolean(isMoving);
  const isExpressionLocked = Boolean(expressionAction);
  const motionMode = resolvePetActionMotionMode(baseAction);
  const visualEmotionMode = resolvePetActionEmotionMode(visualAction);
  const shouldPreserveBaseMotion = requestedIsMoving && motionOverrideMode === 'preserve';
  const visualMotionMode = shouldPreserveBaseMotion
    ? motionMode
    : resolvePetActionMotionMode(visualAction);

  return {
    baseAction,
    expressionAction,
    isExpressionLocked,
    motionMode,
    motionOverrideMode,
    requestedIsMoving,
    visualAction,
    visualEmotionMode,
    visualIsMoving: shouldPreserveBaseMotion
      ? requestedIsMoving
      : (isExpressionLocked ? false : requestedIsMoving),
    visualMotionMode,
  };
}

export function resolvePetActionWrapperClassName(snapshot: PetActionStateMachineSnapshot) {
  if (snapshot.visualEmotionMode === 'eating') {
    return 'pet-anim-eating';
  }

  if (snapshot.visualEmotionMode === 'happy') {
    return 'pet-anim-happy';
  }

  if (snapshot.visualEmotionMode === 'sad') {
    return 'pet-anim-sad';
  }

  if (snapshot.visualEmotionMode === 'sleeping') {
    return 'pet-anim-sleeping';
  }

  if (snapshot.visualMotionMode === 'running') {
    return 'pet-anim-running';
  }

  if (snapshot.visualMotionMode === 'walking') {
    return 'pet-anim-walking';
  }

  if (snapshot.visualMotionMode === 'swimming') {
    return 'pet-anim-swimming';
  }

  if (snapshot.visualIsMoving) {
    return 'pet-anim-moving';
  }

  return 'pet-anim-idle';
}

export function resolvePetActionOpacity(snapshot: PetActionStateMachineSnapshot) {
  return snapshot.visualEmotionMode === 'sad' || snapshot.visualEmotionMode === 'sleeping'
    ? 0.8
    : 1;
}
