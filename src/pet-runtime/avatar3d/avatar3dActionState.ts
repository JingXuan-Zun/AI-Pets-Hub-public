import {
  resolvePetActionOpacity,
  resolvePetActionStateMachineSnapshot,
  type PetActionMotionOverrideMode,
  type PetActionStateMachineSnapshot,
} from '../core/petActionStateMachine';
import { type PetAction } from '../../types';
import { type Avatar3DInteractionControllerState } from './avatar3dInteractionController';
import {
  resolveAvatar3DPresentationProfile,
  type Avatar3DPresentationProfile,
  type Avatar3DVisualMode,
} from './avatar3dActionPresentationProfile';

type ResolveAvatar3DActionStateOptions = {
  action?: PetAction;
  expressionAction?: PetAction | null;
  interactionState?: Avatar3DInteractionControllerState;
  isMoving?: boolean;
  motionOverrideMode?: PetActionMotionOverrideMode | null;
};

export type Avatar3DActionState = {
  allowAutoRotate: boolean;
  animationDurationMs: number;
  lowOpacity: number;
  opacity: number;
  presentationProfile: Avatar3DPresentationProfile;
  rotateSpeed: number;
  scaleBase: number;
  scalePeak: number;
  snapshot: PetActionStateMachineSnapshot;
  visualAction: PetAction;
  visualIsMoving: boolean;
  visualMode: Avatar3DVisualMode;
  wrapperClassName: string;
  wrapperClassSource: 'interaction' | 'state-machine';
};

export function resolveAvatar3DActionState({
  action = 'IDLE',
  expressionAction = null,
  interactionState,
  isMoving = false,
  motionOverrideMode,
}: ResolveAvatar3DActionStateOptions): Avatar3DActionState {
  const snapshot = resolvePetActionStateMachineSnapshot({
    action,
    expressionAction,
    isMoving,
    motionOverrideMode,
  });
  const presentationProfile = resolveAvatar3DPresentationProfile(
    snapshot,
    interactionState,
  );
  const rotateSpeed =
    snapshot.visualMotionMode === 'running'
      ? 1.9
      : snapshot.visualMotionMode === 'walking'
        ? 0.95
        : snapshot.visualMotionMode === 'swimming'
          ? 0.5
          : snapshot.visualIsMoving
            ? 1.5
            : snapshot.visualEmotionMode === 'happy'
              ? 0.72
              : 0.18;

  return {
    allowAutoRotate: snapshot.visualEmotionMode !== 'sleeping' || snapshot.visualIsMoving,
    animationDurationMs: presentationProfile.animationDurationMs,
    lowOpacity: presentationProfile.lowOpacity,
    opacity: resolvePetActionOpacity(snapshot),
    presentationProfile,
    rotateSpeed,
    scaleBase: presentationProfile.scaleBase,
    scalePeak: presentationProfile.scalePeak,
    snapshot,
    visualAction: snapshot.visualAction,
    visualIsMoving: snapshot.visualIsMoving,
    visualMode: presentationProfile.visualMode,
    wrapperClassName: presentationProfile.wrapperClassName,
    wrapperClassSource: presentationProfile.wrapperClassSource,
  };
}

export function resolveAvatar3DEffectiveAutoRotateSpeed(
  _actionState: Avatar3DActionState,
  _focusTarget: { x: number; y: number } | null | undefined,
) {
  // Keep 3D avatars visually stable when idle; only explicit focus/manual orbit should rotate them.
  return 0;
}
