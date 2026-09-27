import {
  resolve3DModelFormatFromUrl,
  resolve3DModelLoaderUrl,
  type Supported3DModelFormat,
} from '../../model3dFormatSupport';
import { type PetAction } from '../../types';
import { resolveFallback3DVisualBounds, type PetVisualBounds } from '../../components/pet/petVisualBounds';
import {
  resolveAvatar3DPresentationState,
  type Avatar3DPresentationState,
} from './avatar3dPresentationState';
import { type Avatar3DInteractionControllerState } from './avatar3dInteractionController';
import { type PetActionMotionOverrideMode } from '../core/petActionStateMachine';
import { type Avatar3DPresentationMode } from './avatar3dPresentationMode';

type ResolveAvatar3DRenderAdapterStateOptions = {
  action?: PetAction;
  expressionAction?: PetAction | null;
  interactionState?: Avatar3DInteractionControllerState;
  isMoving?: boolean;
  modelUrl: string;
  motionOverrideMode?: PetActionMotionOverrideMode | null;
  presentationMode?: Avatar3DPresentationMode;
  scale?: number;
};

export type Avatar3DRenderAdapterState = {
  fallbackVisualBounds: PetVisualBounds;
  modelFormat: Supported3DModelFormat | null;
  modelRuntimeUrl: string;
  presentationState: Avatar3DPresentationState;
};

export function resolveAvatar3DRenderAdapterState({
  action = 'IDLE',
  expressionAction = null,
  interactionState,
  isMoving = false,
  modelUrl,
  motionOverrideMode,
  presentationMode = 'default',
  scale = 1,
}: ResolveAvatar3DRenderAdapterStateOptions): Avatar3DRenderAdapterState {
  const presentationState = resolveAvatar3DPresentationState({
    action,
    expressionAction,
    interactionState,
    isMoving,
    motionOverrideMode,
    presentationMode,
    scale,
  });

  return {
    fallbackVisualBounds: resolveFallback3DVisualBounds(scale, presentationState.visualIsMoving),
    modelFormat: resolve3DModelFormatFromUrl(modelUrl),
    modelRuntimeUrl: resolve3DModelLoaderUrl(modelUrl),
    presentationState,
  };
}
