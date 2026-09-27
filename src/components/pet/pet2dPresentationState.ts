import { type PetAction } from '../../types';
import {
  resolvePetActionStateMachineSnapshot,
  type PetActionMotionOverrideMode,
  type PetActionStateMachineSnapshot,
} from '../../pet-runtime/core/petActionStateMachine';

type ResolvePet2DPresentationStateOptions = {
  action?: PetAction;
  expressionAction?: PetAction | null;
  isMoving?: boolean;
  motionOverrideMode?: PetActionMotionOverrideMode | null;
};

export type Pet2DAnimationPreset = {
  className: string;
  durationMs: number;
  lowOpacity: number;
  peakScale: number;
};

export type Pet2DPresentationState = {
  actionState: PetActionStateMachineSnapshot;
  visualAction: PetAction;
  visualIsMoving: boolean;
};

export function resolvePet2DPresentationState({
  action = 'IDLE',
  expressionAction = null,
  isMoving = false,
  motionOverrideMode,
}: ResolvePet2DPresentationStateOptions): Pet2DPresentationState {
  const actionState = resolvePetActionStateMachineSnapshot({
    action,
    expressionAction,
    isMoving,
    motionOverrideMode,
  });

  return {
    actionState,
    visualAction: actionState.visualAction,
    visualIsMoving: actionState.visualIsMoving,
  };
}

export function shouldUsePet2DSequenceMotionClass(
  presentationState: Pet2DPresentationState,
) {
  return !presentationState.actionState.isExpressionLocked
    && (
      presentationState.actionState.baseAction === 'WALKING'
      || presentationState.actionState.baseAction === 'RUNNING'
      || presentationState.visualIsMoving
    );
}

export function resolvePet2DAnimationPreset(
  presentationState: Pet2DPresentationState,
  scale: number,
  useSequenceMotionClass = false,
): Pet2DAnimationPreset {
  if (useSequenceMotionClass) {
    return {
      className: 'pet-anim-sequence',
      durationMs: 1,
      lowOpacity: 1,
      peakScale: scale,
    };
  }

  const { visualAction, visualIsMoving } = presentationState;
  const { visualMotionMode } = presentationState.actionState;

  if (visualMotionMode === 'running') {
    return {
      className: 'pet-anim-running',
      durationMs: 240,
      lowOpacity: 1,
      peakScale: scale * 1.03,
    };
  }

  if (visualMotionMode === 'walking') {
    return {
      className: 'pet-anim-walking',
      durationMs: 450,
      lowOpacity: 1,
      peakScale: scale * 1.01,
    };
  }

  if (visualMotionMode === 'swimming') {
    return {
      className: 'pet-anim-swimming',
      durationMs: 1200,
      lowOpacity: 1,
      peakScale: scale * 1.02,
    };
  }

  if (visualIsMoving) {
    return {
      className: 'pet-anim-moving',
      durationMs: 300,
      lowOpacity: 1,
      peakScale: scale * 1.02,
    };
  }

  switch (visualAction) {
    case 'EATING':
      return {
        className: 'pet-anim-eating',
        durationMs: 500,
        lowOpacity: 1,
        peakScale: scale * 1.1,
      };
    case 'HAPPY':
      return {
        className: 'pet-anim-happy',
        durationMs: 3000,
        lowOpacity: 1,
        peakScale: scale * 1.05,
      };
    case 'SAD':
      return {
        className: 'pet-anim-sad',
        durationMs: 3000,
        lowOpacity: 0.7,
        peakScale: scale,
      };
    case 'SLEEPING':
      return {
        className: 'pet-anim-sleeping',
        durationMs: 3000,
        lowOpacity: 0.8,
        peakScale: scale * 0.98,
      };
    default:
      return {
        className: 'pet-anim-idle',
        durationMs: 3000,
        lowOpacity: 1,
        peakScale: scale,
      };
  }
}
