import { type CSSProperties } from 'react';
import {
  resolvePetModel3DCameraDistance,
  resolvePetModel3DViewportScale,
} from '../../components/pet/pet3DPresentationMath';
import {
  resolveAvatar3DActionState,
  type Avatar3DActionState,
} from './avatar3dActionState';
import { type PetAction } from '../../types';
import { type Avatar3DInteractionControllerState } from './avatar3dInteractionController';
import { type PetActionMotionOverrideMode } from '../core/petActionStateMachine';
import { type Avatar3DPresentationMode } from './avatar3dPresentationMode';

type ResolveAvatar3DPresentationStateOptions = {
  action?: PetAction;
  expressionAction?: PetAction | null;
  interactionState?: Avatar3DInteractionControllerState;
  isMoving?: boolean;
  motionOverrideMode?: PetActionMotionOverrideMode | null;
  presentationMode?: Avatar3DPresentationMode;
  scale?: number;
};

export type Avatar3DPresentationState = {
  actionState: Avatar3DActionState;
  cameraDistance: number;
  cameraFocusYRatio: number;
  cameraTargetY: number;
  lookAtYOffset: number;
  rotateSpeed: number;
  viewportOffsetXPercent: number;
  viewportScale: number;
  viewportOffsetYPercent: number;
  visualAction: PetAction;
  visualIsMoving: boolean;
  wrapperClassName: string;
  wrapperStyle: CSSProperties;
};

export function resolveAvatar3DPresentationState({
  action = 'IDLE',
  expressionAction = null,
  interactionState,
  isMoving = false,
  motionOverrideMode,
  presentationMode = 'default',
  scale = 1,
}: ResolveAvatar3DPresentationStateOptions): Avatar3DPresentationState {
  const actionState = resolveAvatar3DActionState({
    action,
    expressionAction,
    interactionState,
    isMoving,
    motionOverrideMode,
  });
  const { visualAction, visualIsMoving } = actionState;
  const baseCameraDistance = resolvePetModel3DCameraDistance(scale);
  const baseViewportScale = resolvePetModel3DViewportScale(scale);
  const isInteractiveDialoguePresentation = presentationMode === 'interactive-dialogue';
  const cameraDistance = isInteractiveDialoguePresentation
    ? baseCameraDistance
    : baseCameraDistance;
  const cameraFocusYRatio = isInteractiveDialoguePresentation ? 0.28 : 0.1;
  const cameraTargetY = isInteractiveDialoguePresentation ? 0.05 : 0.05;
  const lookAtYOffset = isInteractiveDialoguePresentation ? 0.01 : 0;
  const viewportScale = isInteractiveDialoguePresentation
    ? Number(Math.min(2.82, Math.max(baseViewportScale * 1.3, baseViewportScale + 0.84)).toFixed(2))
    : baseViewportScale;
  const viewportOffsetXPercent = 0;
  const viewportOffsetYPercent = isInteractiveDialoguePresentation ? 5 : 0;
  const rotateSpeed = actionState.rotateSpeed;
  const wrapperClassName = actionState.wrapperClassName;

  return {
    actionState,
    cameraDistance,
    cameraFocusYRatio,
    cameraTargetY,
    lookAtYOffset,
    rotateSpeed,
    viewportOffsetXPercent,
    viewportScale,
    viewportOffsetYPercent,
    visualAction,
    visualIsMoving,
    wrapperClassName,
    wrapperStyle: {
      '--pet-scale-base': `${actionState.scaleBase}`,
      '--pet-scale-peak': `${actionState.scalePeak}`,
      '--pet-face-direction': '1',
      '--pet-opacity-low': `${actionState.lowOpacity}`,
      animationDuration: `${actionState.animationDurationMs}ms`,
      overflow: 'visible',
      touchAction: 'none',
      userSelect: 'none',
    } as CSSProperties,
  };
}
