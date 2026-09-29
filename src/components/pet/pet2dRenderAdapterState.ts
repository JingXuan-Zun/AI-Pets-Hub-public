import { type PetAction } from '../../types';
import { type PetActionMotionOverrideMode } from '../../pet-runtime/core/petActionStateMachine';
import {
  resolvePet2DPresentationState,
  type Pet2DPresentationState,
} from './pet2dPresentationState';
import {
  resolvePet2DActionPresentationProfile,
  type Pet2DActionPresentationProfile,
} from './pet2dActionPresentationProfile';

type ResolvePet2DRenderAdapterStateOptions = {
  action?: PetAction;
  expressionAction?: PetAction | null;
  hasAnimatedSequence?: boolean;
  isAutoMoving?: boolean;
  isExpressionSequenceActive?: boolean;
  isMoving?: boolean;
  motionOverrideMode?: PetActionMotionOverrideMode | null;
  presentationState?: Pet2DPresentationState;
  scale?: number;
  sequenceFrameDurationMultiplier?: number;
};

export type Pet2DRenderAdapterState = {
  actionPresentationProfile: Pet2DActionPresentationProfile;
  presentationState: Pet2DPresentationState;
  visualIsMoving: boolean;
};

export function resolvePet2DRenderAdapterState({
  action = 'IDLE',
  expressionAction = null,
  hasAnimatedSequence = false,
  isAutoMoving = false,
  isExpressionSequenceActive = false,
  isMoving = false,
  motionOverrideMode,
  presentationState,
  scale = 1,
  sequenceFrameDurationMultiplier = 1,
}: ResolvePet2DRenderAdapterStateOptions): Pet2DRenderAdapterState {
  const resolvedPresentationState = presentationState ?? resolvePet2DPresentationState({
    action,
    expressionAction,
    isMoving,
    motionOverrideMode,
  });

  return {
    actionPresentationProfile: resolvePet2DActionPresentationProfile({
      hasAnimatedSequence,
      isAutoMoving,
      isExpressionSequenceActive,
      presentationState: resolvedPresentationState,
      scale,
      sequenceFrameDurationMultiplier,
    }),
    presentationState: resolvedPresentationState,
    visualIsMoving: resolvedPresentationState.visualIsMoving,
  };
}
