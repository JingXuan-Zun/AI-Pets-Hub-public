import { type CSSProperties } from 'react';
import {
  type Avatar3DRuntimeBackend,
  type ModelType,
  type PetAction,
  type PetModelMotionBinding,
  type PetVideoEmotionFolderAliases,
} from '../../types';
import { type PetContentManifest } from '../../pet-runtime/content/petContentManifest';
import { type PetHoverState } from '../../pet-runtime/interactions/petHoverController';
import { type Pet2DRenderAdapterState } from './pet2dRenderAdapterState';
import {
  resolvePetSelectionHitAreaStyle,
  resolvePetSelectionScoreAreaAttributes,
  resolvePetWindowShapeProxyStyle,
} from './petInteractiveHitArea';
import {
  resolveFallback3DVisualBounds,
  resolvePetDragNativeWindowShapeVisualBounds,
  resolveLive2DViewportShellSize,
  resolveUnity3DInteractiveVisualBounds,
  resolveUnity3DViewportShellSize,
  type PetVisualBounds,
} from './petVisualBounds';
import { type Avatar3DRuntimeUpdatePriority } from '../../pet-runtime/avatar3d/useAvatar3DRuntimeSleepState';
import { type AvatarRuntimeEventListener } from '../../pet-runtime/avatar-runtime/avatarRuntimeEvents';
import {
  type AvatarRuntimeDragState,
  type AvatarRuntimePresentationMode,
  type AvatarRuntimeViewport,
} from '../../pet-runtime/avatar-runtime/avatarRuntimeTypes';
import {
  resolvePetRuntimeFallbackVisualBounds,
  resolvePetRuntimePresentationMode,
} from './petAvatarRuntimeSurface';
import { type PetVisualRendererProps } from './PetVisualRenderer';
import { type Live2DRuntimeProfileConfigV1 } from '../../pet-runtime/live2d/live2dRuntimeProfile';

type Position = {
  x: number;
  y: number;
};

type ResolvePetVisualRendererShellSurfaceOptions = {
  interactiveDialoguePosition?: Position | null;
  interactiveDialogueShellSize?: number;
  avatar3dRuntimeBackend?: Avatar3DRuntimeBackend;
  dragMotionState?: AvatarRuntimeDragState | null;
  isInteractiveDialogueMode?: boolean;
  isDragging?: boolean;
  measuredInteractiveVisualBounds?: PetVisualBounds | null;
  measuredWindowShapeVisualBounds?: PetVisualBounds | null;
  modelType: ModelType;
  renderKind?: 'video' | 'gif';
  position: Position;
  scale: number;
  shouldAnimateAsMoving: boolean;
  visualRendererAction?: PetAction | null;
};

type PetVisualRendererShellSurface = {
  interactiveHitAreaStyle: CSSProperties | undefined;
  interactiveVisualBounds: PetVisualBounds;
  presentationMode: AvatarRuntimePresentationMode;
  renderedPosition: Position;
  shellSize: number;
  shouldEmitVisualBounds: boolean;
  shouldLockDragAndScale: boolean;
  selectionScoreAreaAttributes: Record<string, string> | undefined;
  visualRendererIsMoving: boolean;
  windowShapeProxyStyle: CSSProperties | undefined;
};

const THREE_D_INTERACTIVE_HIT_CORE_WIDTH_RATIO = 0.52;
const THREE_D_INTERACTIVE_HIT_CORE_MIN_WIDTH_PX = 112;

function constrain3DInteractiveHitVisualBoundsWidth(
  bounds: PetVisualBounds,
  fallbackInteractiveVisualBounds: PetVisualBounds,
) {
  const width = Math.max(1, bounds.left + bounds.right);
  const fallbackWidth = Math.max(1, fallbackInteractiveVisualBounds.left + fallbackInteractiveVisualBounds.right);
  const maxCoreWidth = Math.min(
    width,
    Math.max(
      THREE_D_INTERACTIVE_HIT_CORE_MIN_WIDTH_PX,
      Math.round(fallbackWidth * THREE_D_INTERACTIVE_HIT_CORE_WIDTH_RATIO),
    ),
  );

  if (width <= maxCoreWidth) {
    return bounds;
  }

  const leftRatio = bounds.left / width;
  const left = Math.max(1, Math.min(maxCoreWidth - 1, Math.round(maxCoreWidth * leftRatio)));

  return {
    ...bounds,
    left,
    right: Math.max(1, maxCoreWidth - left),
  } satisfies PetVisualBounds;
}

function resolve3DInteractiveHitVisualBounds(
  interactiveVisualBounds: PetVisualBounds,
  fallbackInteractiveVisualBounds: PetVisualBounds,
) {
  const cappedVisualBounds = {
    bottom: Math.min(interactiveVisualBounds.bottom, fallbackInteractiveVisualBounds.bottom),
    left: Math.min(interactiveVisualBounds.left, fallbackInteractiveVisualBounds.left),
    right: Math.min(interactiveVisualBounds.right, fallbackInteractiveVisualBounds.right),
    top: Math.min(interactiveVisualBounds.top, fallbackInteractiveVisualBounds.top),
  } satisfies PetVisualBounds;

  return constrain3DInteractiveHitVisualBoundsWidth(
    cappedVisualBounds,
    fallbackInteractiveVisualBounds,
  );
}

export function resolvePetVisualRendererIsMoving({
  modelType,
  shouldAnimateAsMoving,
  visualRendererAction = null,
}: Pick<ResolvePetVisualRendererShellSurfaceOptions, 'modelType' | 'shouldAnimateAsMoving' | 'visualRendererAction'>) {
  return visualRendererAction && modelType === '3d'
    ? false
    : shouldAnimateAsMoving;
}

export function resolvePetVisualRendererShellSurface({
  interactiveDialoguePosition = null,
  interactiveDialogueShellSize = 256,
  avatar3dRuntimeBackend = 'three',
  dragMotionState = null,
  isInteractiveDialogueMode = false,
  isDragging = false,
  measuredInteractiveVisualBounds = null,
  measuredWindowShapeVisualBounds = null,
  modelType,
  renderKind,
  position,
  scale,
  shouldAnimateAsMoving,
  visualRendererAction = null,
}: ResolvePetVisualRendererShellSurfaceOptions): PetVisualRendererShellSurface {
  const inferredRenderKind = renderKind;
  const renderedPosition = isInteractiveDialogueMode && interactiveDialoguePosition
    ? interactiveDialoguePosition
    : position;
  const presentationMode = resolvePetRuntimePresentationMode(
    modelType,
    isInteractiveDialogueMode,
  );
  const visualRendererIsMoving = resolvePetVisualRendererIsMoving({
    modelType,
    shouldAnimateAsMoving,
    visualRendererAction,
  });
  const isUnity3DPresentation = modelType === '3d' && avatar3dRuntimeBackend === 'unity';
  const isLive2DPresentation = modelType === 'live2d';
  const shellSize = isInteractiveDialogueMode
    ? Math.max(256, Math.round(interactiveDialogueShellSize))
    : isUnity3DPresentation
      ? resolveUnity3DViewportShellSize(scale, visualRendererIsMoving)
      : isLive2DPresentation
        ? resolveLive2DViewportShellSize(scale, visualRendererIsMoving)
        : 256;
  const shouldLockDragAndScale = isInteractiveDialogueMode;
  const shouldEmitVisualBounds = !isInteractiveDialogueMode;
  const fallbackInteractiveVisualBounds = isUnity3DPresentation
    ? resolveUnity3DInteractiveVisualBounds(scale, visualRendererIsMoving)
    : resolvePetRuntimeFallbackVisualBounds(
      modelType,
      scale,
      visualRendererIsMoving,
    );
  const videoHalfExtent = Math.max(1, Math.round(128 * Math.max(0.5, scale)));
  const videoFallbackBounds: PetVisualBounds = {
    bottom: videoHalfExtent,
    left: videoHalfExtent,
    right: videoHalfExtent,
    top: videoHalfExtent,
  };
  const resolvedFallbackInteractiveVisualBounds = (inferredRenderKind === 'video' || inferredRenderKind === 'gif')
    ? videoFallbackBounds
    : fallbackInteractiveVisualBounds;
  const interactiveVisualBounds = measuredInteractiveVisualBounds ?? resolvedFallbackInteractiveVisualBounds;
  const interactiveHitVisualBounds = modelType === '3d' && resolvedFallbackInteractiveVisualBounds
    ? resolve3DInteractiveHitVisualBounds(interactiveVisualBounds, resolvedFallbackInteractiveVisualBounds)
    : interactiveVisualBounds;
  const windowShapeVisualBounds = measuredWindowShapeVisualBounds ?? interactiveVisualBounds;
  const nativeWindowShapeVisualBounds = isDragging
    ? resolvePetDragNativeWindowShapeVisualBounds(
      windowShapeVisualBounds,
      isDragging,
      dragMotionState,
    )
    : windowShapeVisualBounds;
  const selectionScoreVisualBounds = modelType === '3d'
    ? interactiveHitVisualBounds
    : null;

  return {
    interactiveHitAreaStyle: resolvePetSelectionHitAreaStyle(
      shellSize,
      interactiveHitVisualBounds,
      modelType,
    ),
    interactiveVisualBounds,
    presentationMode,
    renderedPosition,
    shellSize,
    shouldEmitVisualBounds,
    shouldLockDragAndScale,
    selectionScoreAreaAttributes: modelType === '3d'
      ? resolvePetSelectionScoreAreaAttributes(interactiveHitVisualBounds, selectionScoreVisualBounds)
      : undefined,
    visualRendererIsMoving,
    windowShapeProxyStyle: resolvePetWindowShapeProxyStyle(
      shellSize,
      nativeWindowShapeVisualBounds,
    ),
  };
}

type ResolvePetVisualRendererPropsOptions = {
  action: PetAction;
  active3DSceneCount?: number;
  avatar3dRuntimeBackend?: Avatar3DRuntimeBackend;
  contentManifestOverride?: PetContentManifest | null;
  debugPetId?: string;
  dragMotionState?: AvatarRuntimeDragState;
  expressionAction?: PetAction | null;
  focusTarget?: Position | null;
  hoverState?: PetHoverState;
  isInteractiveDialogueHidden?: boolean;
  isDragging?: boolean;
  isSpeaking?: boolean;
  isTyping?: boolean;
  isMoving: boolean;
  latestMessage?: string;
  live2dRuntimeProfile?: Live2DRuntimeProfileConfigV1 | null;
  manualExpressionBinding?: PetModelMotionBinding | null;
  manualMotionBinding?: PetModelMotionBinding | null;
  modelType: ModelType;
  motionBindings?: PetModelMotionBinding[];
  modelUrl: string;
  renderKind?: 'video' | 'gif';
  randomVideoPlaybackEnabled?: boolean;
  videoEmotionFolderAliases?: PetVideoEmotionFolderAliases | null;
  videoLibraryRootPath?: string | null;
  sequenceFrames?: string[];
  onRuntimeEvent?: AvatarRuntimeEventListener;
  onVisualBoundsChange?: ((bounds: PetVisualBounds) => void) | undefined;
  pet2dRenderAdapterState?: Pet2DRenderAdapterState;
  pointerLookTarget?: Position | null;
  presentationMode?: AvatarRuntimePresentationMode;
  scale: number;
  sequenceFrameDurationMultiplier?: number;
  updatePriority?: Avatar3DRuntimeUpdatePriority;
  viewport?: AvatarRuntimeViewport | null;
};

export function resolvePetVisualRendererProps({
  action,
  active3DSceneCount = 1,
  avatar3dRuntimeBackend = 'three',
  contentManifestOverride = null,
  debugPetId,
  dragMotionState,
  expressionAction = null,
  focusTarget = null,
  hoverState,
  isInteractiveDialogueHidden = false,
  isDragging = false,
  isSpeaking = false,
  isTyping = false,
  isMoving,
  latestMessage = '',
  live2dRuntimeProfile = null,
  manualExpressionBinding = null,
  manualMotionBinding = null,
  modelType,
  motionBindings = [],
  modelUrl,
  renderKind,
  randomVideoPlaybackEnabled = false,
  videoEmotionFolderAliases = null,
  videoLibraryRootPath = null,
  sequenceFrames = [],
  onRuntimeEvent,
  onVisualBoundsChange,
  pet2dRenderAdapterState,
  pointerLookTarget = null,
  presentationMode = 'default',
  scale,
  sequenceFrameDurationMultiplier = 1,
  updatePriority = 'companion',
  viewport = null,
}: ResolvePetVisualRendererPropsOptions): PetVisualRendererProps {
  const rendererViewport = (
    modelType === 'live2d'
    || (modelType === '3d' && avatar3dRuntimeBackend === 'unity')
  )
    ? viewport
    : null;

  return {
    action,
    active3DSceneCount,
    avatar3dRuntimeBackend,
    contentManifestOverride,
    debugPetId,
    dragMotionState,
    expressionAction,
    focusTarget,
    hoverState,
    isDragging,
    isMoving,
    isSpeaking,
    isTyping,
    latestMessage,
    live2dRuntimeProfile,
    manualExpressionBinding,
    manualMotionBinding,
    modelType,
    motionBindings,
    modelUrl,
    renderKind,
    randomVideoPlaybackEnabled,
    videoEmotionFolderAliases,
    videoLibraryRootPath,
    sequenceFrames,
    onRuntimeEvent,
    onVisualBoundsChange,
    pet2dRenderAdapterState,
    pointerLookTarget,
    presentationMode,
    scale,
    sequenceFrameDurationMultiplier,
    updatePriority,
    viewport: rendererViewport,
    visible: !isInteractiveDialogueHidden,
  };
}
