import { type CSSProperties } from 'react';
import { type ModelType } from '../../types';
import { type PetAction } from '../../types';
import { type Supported3DModelFormat } from '../../model3dFormatSupport';
import { resolveAvatar3DEffectiveAutoRotateSpeed } from '../../pet-runtime/avatar3d/avatar3dActionState';
import {
  resolveAvatar3DRenderAdapterState,
  type Avatar3DRenderAdapterState,
} from '../../pet-runtime/avatar3d/avatar3dRenderAdapterState';
import { type Avatar3DPresentationState } from '../../pet-runtime/avatar3d/avatar3dPresentationState';
import { type PetContentManifest } from '../../pet-runtime/content/petContentManifest';
import { type PetHoverState } from '../../pet-runtime/interactions/petHoverController';
import {
  type ThreeAvatarRuntimeBridgeState,
  type ThreeAvatarRuntimeManualMotionSelection,
  type ThreeAvatarRuntimeReactionState,
  type ThreeAvatarRuntimeBridgeRenderViewState,
} from '../../pet-runtime/avatar-runtime/three/threeAvatarRuntimeBridge';
import {
  type AvatarRuntimeDragState,
  type AvatarRuntimeFocusTarget,
  type AvatarRuntimePresentationMode,
} from '../../pet-runtime/avatar-runtime/avatarRuntimeTypes';
import { resolveFallback3DVisualBounds, type PetVisualBounds } from './petVisualBounds';

type Position = {
  x: number;
  y: number;
};

export const PET_RUNTIME_FOCUS_TARGET_QUANTIZE_STEP = 4;
export const PET_RUNTIME_LIVE2D_FOCUS_TARGET_QUANTIZE_STEP = 0.25;
export const PET_RUNTIME_DRAG_DELTA_QUANTIZE_STEP = 2;
export const IDLE_PET_RUNTIME_DRAG_MOTION_STATE: AvatarRuntimeDragState = {
  active: false,
  deltaX: 0,
  deltaY: 0,
};

export function quantizePetRuntimeMotionValue(value: number, step: number) {
  if (!Number.isFinite(value) || Math.abs(value) < step * 0.5) {
    return 0;
  }

  return Math.round(value / step) * step;
}

export function resolvePetRuntimeFocusTarget(
  target: Position | null | undefined,
  quantizeStep = PET_RUNTIME_FOCUS_TARGET_QUANTIZE_STEP,
): Position | null {
  if (!target) {
    return null;
  }

  return {
    x: quantizePetRuntimeMotionValue(target.x, quantizeStep),
    y: quantizePetRuntimeMotionValue(target.y, quantizeStep),
  };
}

export function resolvePetRuntimeDragMotionState(
  modelType: ModelType,
  isDragging: boolean,
  deltaX: number,
  deltaY: number,
): AvatarRuntimeDragState {
  if (modelType !== '3d' || !isDragging) {
    return IDLE_PET_RUNTIME_DRAG_MOTION_STATE;
  }

  const normalizedDeltaX = quantizePetRuntimeMotionValue(deltaX, PET_RUNTIME_DRAG_DELTA_QUANTIZE_STEP);
  const normalizedDeltaY = quantizePetRuntimeMotionValue(deltaY, PET_RUNTIME_DRAG_DELTA_QUANTIZE_STEP);
  if (normalizedDeltaX === 0 && normalizedDeltaY === 0) {
    return IDLE_PET_RUNTIME_DRAG_MOTION_STATE;
  }

  return {
    active: true,
    deltaX: normalizedDeltaX,
    deltaY: normalizedDeltaY,
  };
}

export function resolvePetRuntimePresentationMode(
  modelType: ModelType,
  isInteractiveDialogueMode: boolean,
): AvatarRuntimePresentationMode {
  return modelType === '3d' && isInteractiveDialogueMode
    ? 'interactive-dialogue'
    : 'default';
}

export function resolvePetRuntimeFallbackVisualBounds(
  modelType: ModelType,
  scale: number,
  isMoving: boolean,
): PetVisualBounds | null {
  if (modelType !== '3d') {
    return null;
  }

  return resolveFallback3DVisualBounds(scale, isMoving);
}

type PetThreeAvatarRuntimeSurface = {
  fallbackVisualBounds: PetVisualBounds;
  modelRuntimeUrl: string;
};

export function resolvePetThreeAvatarRuntimeSurface(
  bridgeState: Pick<ThreeAvatarRuntimeBridgeState, 'renderAdapterState'>,
): PetThreeAvatarRuntimeSurface {
  return {
    fallbackVisualBounds: bridgeState.renderAdapterState.fallbackVisualBounds,
    modelRuntimeUrl: bridgeState.renderAdapterState.modelRuntimeUrl,
  };
}

type ResolvePetThreeAvatarRenderSurfaceOptions = {
  preparedModelFormat?: Supported3DModelFormat | null;
  preparedModelRuntimeUrl?: string | null;
  preparedPresentationState?: Avatar3DPresentationState | null;
  renderAdapterState: Pick<
    ThreeAvatarRuntimeBridgeState['renderAdapterState'],
    'modelFormat' | 'modelRuntimeUrl' | 'presentationState'
  >;
};

type PetThreeAvatarRenderSurface = {
  modelFormat: Supported3DModelFormat | null;
  modelRuntimeUrl: string;
  presentationState: Avatar3DPresentationState;
};

export function resolvePetThreeAvatarRenderSurface({
  preparedModelFormat = null,
  preparedModelRuntimeUrl = null,
  preparedPresentationState = null,
  renderAdapterState,
}: ResolvePetThreeAvatarRenderSurfaceOptions): PetThreeAvatarRenderSurface {
  return {
    modelFormat: preparedModelFormat ?? renderAdapterState.modelFormat,
    modelRuntimeUrl: preparedModelRuntimeUrl ?? renderAdapterState.modelRuntimeUrl,
    presentationState: preparedPresentationState ?? renderAdapterState.presentationState,
  };
}

export function resolvePetThreeAvatarViewportStyle(
  presentationState: Avatar3DPresentationState,
): CSSProperties {
  return {
    height: `${(presentationState.viewportScale * 100).toFixed(1)}%`,
    left: presentationState.viewportOffsetXPercent === 0
      ? '50%'
      : `calc(50% + ${presentationState.viewportOffsetXPercent.toFixed(1)}%)`,
    pointerEvents: 'none',
    position: 'absolute',
    top: presentationState.viewportOffsetYPercent === 0
      ? '50%'
      : `calc(50% + ${presentationState.viewportOffsetYPercent.toFixed(1)}%)`,
    transform: 'translate(-50%, -50%)',
    width: `${(presentationState.viewportScale * 100).toFixed(1)}%`,
  } satisfies CSSProperties;
}

export function resolvePetThreeAvatarShellStyle(
  presentationState: Avatar3DPresentationState,
): CSSProperties {
  return {
    ...presentationState.wrapperStyle,
    animation: 'none',
    backfaceVisibility: 'hidden',
    transform: 'translateZ(0)',
    transformOrigin: 'center bottom',
    willChange: 'opacity',
  } satisfies CSSProperties;
}

type ResolvePetThreeAvatarSceneSurfaceOptions = {
  focusTarget: Position | null;
  manualMotionSelection?: ThreeAvatarRuntimeManualMotionSelection | null;
  pointerLookTarget?: Position | null;
  presentationState: Avatar3DPresentationState;
  reactionState?: ThreeAvatarRuntimeReactionState;
};

type PetThreeAvatarSceneSurface = {
  actionState: Avatar3DPresentationState['actionState'];
  autoRotateSpeed: number;
  baseCameraDistance: number;
  cameraFocusYRatio: number;
  cameraTargetY: number;
  lookAtYOffset: number;
  manualMotionSelection: ThreeAvatarRuntimeManualMotionSelection | null;
  pointerLookTarget: Position | null;
  reactionState?: ThreeAvatarRuntimeReactionState;
};

export function resolvePetThreeAvatarSceneSurface({
  focusTarget,
  manualMotionSelection = null,
  pointerLookTarget = null,
  presentationState,
  reactionState,
}: ResolvePetThreeAvatarSceneSurfaceOptions): PetThreeAvatarSceneSurface {
  return {
    actionState: presentationState.actionState,
    autoRotateSpeed: resolveAvatar3DEffectiveAutoRotateSpeed(
      presentationState.actionState,
      focusTarget,
    ),
    baseCameraDistance: presentationState.cameraDistance,
    cameraFocusYRatio: presentationState.cameraFocusYRatio,
    cameraTargetY: presentationState.cameraTargetY,
    lookAtYOffset: presentationState.lookAtYOffset,
    manualMotionSelection,
    pointerLookTarget,
    reactionState,
  };
}

type ResolvePetThreeAvatarComponentStateOptions = {
  action: PetAction;
  activeSceneCount: number;
  bridgeRenderState?: ThreeAvatarRuntimeBridgeRenderViewState | null;
  contentManifest?: PetContentManifest | null;
  contentManifestResolved?: boolean;
  contentManifestSourceUrl?: string | null;
  dragMotionState?: AvatarRuntimeDragState | null;
  expressionAction?: PetAction | null;
  focusTarget?: Position | null;
  hoverState?: PetHoverState | null;
  isMoving?: boolean;
  manualMotionSelection?: ThreeAvatarRuntimeManualMotionSelection | null;
  pointerLookTarget?: Position | null;
  presentationMode?: AvatarRuntimePresentationMode;
  reactionState?: ThreeAvatarRuntimeReactionState;
  runtimeDebugLabel?: string | null;
  scale?: number;
  url: string;
};

type PetThreeAvatarComponentState = {
  action: PetAction;
  activeSceneCount: number;
  contentManifest: PetContentManifest | null;
  contentManifestResolved: boolean;
  contentManifestSourceUrl: string | null;
  dragMotionState: AvatarRuntimeDragState | null | undefined;
  expressionAction: PetAction | null;
  focusTarget: Position | null;
  hoverState: PetHoverState | null | undefined;
  isMoving: boolean;
  manualMotionSelection: ThreeAvatarRuntimeManualMotionSelection | null;
  pointerLookTarget: Position | null;
  presentationMode: AvatarRuntimePresentationMode;
  reactionState?: ThreeAvatarRuntimeReactionState;
  runtimeDebugLabel: string | null;
  scale: number;
  url: string;
};

export function resolvePetThreeAvatarComponentState({
  action,
  activeSceneCount,
  bridgeRenderState = null,
  contentManifest = null,
  contentManifestResolved = false,
  contentManifestSourceUrl = null,
  dragMotionState,
  expressionAction = null,
  focusTarget = null,
  hoverState,
  isMoving = false,
  manualMotionSelection = null,
  pointerLookTarget = null,
  presentationMode = 'default',
  reactionState,
  runtimeDebugLabel = null,
  scale = 1,
  url,
}: ResolvePetThreeAvatarComponentStateOptions): PetThreeAvatarComponentState {
  const resolvedContent = bridgeRenderState?.content ?? null;
  const resolvedLayout = bridgeRenderState?.layout ?? null;
  const resolvedSemanticState = bridgeRenderState?.semanticState ?? null;

  return {
    action: resolvedSemanticState?.action ?? action,
    activeSceneCount: resolvedLayout?.activeSceneCount ?? bridgeRenderState?.activeSceneCount ?? activeSceneCount,
    contentManifest: resolvedContent?.contentManifest ?? contentManifest,
    contentManifestResolved: resolvedContent?.contentManifestResolved ?? contentManifestResolved,
    contentManifestSourceUrl: resolvedContent?.contentManifestSourceUrl ?? contentManifestSourceUrl,
    dragMotionState: bridgeRenderState?.dragMotionState ?? dragMotionState,
    expressionAction: resolvedSemanticState?.expressionAction ?? expressionAction,
    focusTarget: (
      bridgeRenderState?.focusTarget
      ?? (resolvedSemanticState?.summary.lookAtTarget as AvatarRuntimeFocusTarget | null | undefined)
      ?? focusTarget
      ?? null
    ),
    hoverState: bridgeRenderState?.hoverState ?? hoverState,
    isMoving: resolvedSemanticState?.isMoving ?? isMoving,
    manualMotionSelection: bridgeRenderState?.manualMotionSelection ?? manualMotionSelection,
    pointerLookTarget: (
      bridgeRenderState?.pointerLookTarget
      ?? (resolvedSemanticState?.summary.pointerLookTarget as AvatarRuntimeFocusTarget | null | undefined)
      ?? pointerLookTarget
      ?? null
    ),
    presentationMode: resolvedLayout?.presentationMode ?? presentationMode,
    reactionState: bridgeRenderState?.reactionState ?? reactionState,
    runtimeDebugLabel: bridgeRenderState?.runtimeDebugLabel ?? runtimeDebugLabel,
    scale: resolvedLayout?.scale ?? scale,
    url: resolvedContent?.modelUrl ?? url,
  };
}

export function resolvePetThreeAvatarFallbackRenderAdapterState(
  options: Pick<
    PetThreeAvatarComponentState,
    'action' | 'expressionAction' | 'isMoving' | 'presentationMode' | 'reactionState' | 'scale' | 'url'
  >,
): Avatar3DRenderAdapterState {
  return resolveAvatar3DRenderAdapterState({
    action: options.action,
    expressionAction: options.expressionAction,
    isMoving: options.isMoving,
    modelUrl: options.url,
    motionOverrideMode: options.reactionState?.motionOverrideState.mode,
    presentationMode: options.presentationMode,
    scale: options.scale,
  });
}
