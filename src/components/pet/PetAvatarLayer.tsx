import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import { MessageCircle, Settings as SettingsIcon } from 'lucide-react';
import { type DesktopPetAnimationToolTrigger } from '../../chatState';
import { PRIMARY_DESKTOP_PET_SLOT_ID } from '../../multiPetRoster';
import { type PetConfig, type PetModelMotionBinding } from '../../types';
import { pushFrontendRuntimeLog } from '../../frontendRuntimeLogger';
import { Button } from '../../../components/ui/button';
import PetVisualRenderer from './PetVisualRenderer';
import {
  arePetVisualBoundsEqual,
  type PetVisualBounds,
} from './petVisualBounds';
import { resolvePetContentHoverRegions } from '../../pet-runtime/content/petContentManifest';
import { resolvePetActionForMotionKey } from '../../pet-runtime/content/petModelMotionBindings';
import { isPetModelExpressionBinding } from '../../pet-runtime/content/petModelMotionBindingKinds';
import { usePetContentManifest } from '../../pet-runtime/content/usePetContentManifest';
import { usePetHoverController } from '../../pet-runtime/interactions/usePetHoverController';
import { usePetPointerLookTarget } from '../../pet-runtime/interactions/usePetPointerLookTarget';
import { resolvePetPointerLookHoverState } from '../../pet-runtime/interactions/petPointerLookInputGate';
import { usePetMovementInteractionPause } from './usePetMovementInteractionPause';
import { type PetActionMotionOverrideMode } from '../../pet-runtime/core/petActionStateMachine';
import { resolvePet2DRenderAdapterState } from './pet2dRenderAdapterState';
import { type AvatarRuntimeEventListener } from '../../pet-runtime/avatar-runtime/avatarRuntimeEvents';
import { resolvePetRuntimeContentSurface } from './petRuntimeContentSurface';
import { canModelTypeUseMotionBindings } from '../../pet-runtime/live2d/live2dModelSupport';
import {
  resolvePetVisualRendererIsMoving,
  resolvePetVisualRendererProps,
  resolvePetVisualRendererShellSurface,
} from './petVisualRendererSurface';
import { resolvePrimaryPetLayerZIndex } from './petLayerOrdering';
import { resolveStackedPetSelectionTargetFromPointerEvent } from './petPointerSelection';
import { usePetMessageAnimationQueue } from './usePetMessageAnimationQueue';
import { useAnimationToolTriggerAudioPlayback } from './useAnimationToolTriggerAudioPlayback';
import { usePetVisualBoundsMeasurement } from './usePetVisualBoundsMeasurement';
import { useLive2DDragReleaseProbe } from './useLive2DDragReleaseProbe';
import {
  resolvePetAvatarShellStyle,
  resolvePetRuntimeViewport,
} from './petAvatarLayerGeometry';
import { usePetLayerMotionState } from './usePetLayerMotionState';
import { PetDebugBoundsOverlay } from './PetDebugBoundsOverlay';
import {
  resolvePetDragVisualPreviewDelta,
  type PetDragVisualPreviewSurface,
} from '../../pet-runtime/interactions/petDragVisualPreview';
import { useRuntimeWorldExpressionAction } from './useRuntimeWorldExpressionAction';

type Position = {
  x: number;
  y: number;
};

interface PetAvatarLayerProps {
  activityCenter: Position;
  active3DSceneCount?: number;
  actionOverride?: PetConfig['currentAction'] | null;
  config: PetConfig;
  debugClampBounds?: PetVisualBounds | null;
  debugCollisionBounds?: PetVisualBounds | null;
  expressionAction?: PetConfig['currentAction'] | null;
  hungerTriggerThreshold: number;
  isAutoMoving: boolean;
  isDragging?: boolean;
  isChatOpen: boolean;
  isInteractiveDialogueHidden?: boolean;
  isInteractiveDialogueMode?: boolean;
  isSpeaking?: boolean;
  isSettingsOpen: boolean;
  isTyping?: boolean;
  interactiveDialoguePosition?: Position | null;
  interactiveDialogueShellSize?: number;
  latestMessage?: string;
  animationToolTrigger?: DesktopPetAnimationToolTrigger | null;
  lastReplayableAnimationToolTrigger?: DesktopPetAnimationToolTrigger | null;
  manualMotionBinding?: PetModelMotionBinding | null;
  motionOverrideMode?: PetActionMotionOverrideMode | null;
  motionTarget: Position | null;
  petPos: Position;
  sequenceFrameDurationMultiplier?: number;
  selectedPetId?: string | null;
  showPetActions: boolean;
  visionTarget: Position | null;
  onPetVisualBoundsChange?: (bounds: PetVisualBounds) => void;
  dragVisualPreviewSurfaceRef?: MutableRefObject<PetDragVisualPreviewSurface | null>;
  onRuntimeEvent?: AvatarRuntimeEventListener;
  onOpenChatPanel: () => void;
  onOpenSettingsPanel: () => void;
  onMovementPauseChange?: (isMovementPaused: boolean) => void;
  onPetContextMenu: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onSelectPet?: (petId: string) => void;
  onStartOverlappedPetDrag?: (event: ReactPointerEvent<HTMLDivElement>, petId: string) => void;
  onStartPetDrag: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onWheelPetScale: (event: ReactWheelEvent<HTMLDivElement>) => void;
}

function getAutoMoveLabel(config: PetConfig, hungerTriggerThreshold: number) {
  if (config.currentAction === 'SWIMMING') {
    return 'Swimming...';
  }

  if (config.currentAction === 'RUNNING') {
    return config.stats.hunger >= hungerTriggerThreshold ? 'Running for food...' : 'Running...';
  }

  if (config.currentAction === 'WALKING') {
    return config.stats.hunger >= hungerTriggerThreshold ? 'Walking for food...' : 'Walking...';
  }

  return 'Searching for food...';
}

function areOptionalPositionsEqual(left?: Position | null, right?: Position | null) {
  return (left?.x ?? null) === (right?.x ?? null)
    && (left?.y ?? null) === (right?.y ?? null);
}

function areAvatarConfigsEqual(left: PetConfig, right: PetConfig) {
  return left.currentAction === right.currentAction
    && left.modelType === right.modelType
    && left.modelUrl === right.modelUrl
    && left.scale === right.scale
    && left.settings.avatar3dRuntimeBackend === right.settings.avatar3dRuntimeBackend
    && left.stats.hunger === right.stats.hunger
    && left.customModelPresets === right.customModelPresets;
}

function arePetAvatarLayerPropsEqual(
  previousProps: PetAvatarLayerProps,
  nextProps: PetAvatarLayerProps,
) {
  return previousProps.actionOverride === nextProps.actionOverride
    && previousProps.active3DSceneCount === nextProps.active3DSceneCount
    && previousProps.activityCenter.x === nextProps.activityCenter.x
    && previousProps.activityCenter.y === nextProps.activityCenter.y
    && areAvatarConfigsEqual(previousProps.config, nextProps.config)
    && arePetVisualBoundsEqual(previousProps.debugClampBounds, nextProps.debugClampBounds)
    && arePetVisualBoundsEqual(previousProps.debugCollisionBounds, nextProps.debugCollisionBounds)
    && previousProps.expressionAction === nextProps.expressionAction
    && previousProps.hungerTriggerThreshold === nextProps.hungerTriggerThreshold
    && previousProps.isAutoMoving === nextProps.isAutoMoving
    && previousProps.isChatOpen === nextProps.isChatOpen
    && previousProps.isDragging === nextProps.isDragging
    && previousProps.isInteractiveDialogueHidden === nextProps.isInteractiveDialogueHidden
    && previousProps.isInteractiveDialogueMode === nextProps.isInteractiveDialogueMode
    && previousProps.isSettingsOpen === nextProps.isSettingsOpen
    && previousProps.isSpeaking === nextProps.isSpeaking
    && previousProps.isTyping === nextProps.isTyping
    && previousProps.animationToolTrigger === nextProps.animationToolTrigger
    && previousProps.lastReplayableAnimationToolTrigger === nextProps.lastReplayableAnimationToolTrigger
    && areOptionalPositionsEqual(previousProps.interactiveDialoguePosition, nextProps.interactiveDialoguePosition)
    && previousProps.interactiveDialogueShellSize === nextProps.interactiveDialogueShellSize
    && previousProps.latestMessage === nextProps.latestMessage
    && previousProps.manualMotionBinding === nextProps.manualMotionBinding
    && previousProps.motionOverrideMode === nextProps.motionOverrideMode
    && areOptionalPositionsEqual(previousProps.motionTarget, nextProps.motionTarget)
    && previousProps.onMovementPauseChange === nextProps.onMovementPauseChange
    && previousProps.onOpenChatPanel === nextProps.onOpenChatPanel
    && previousProps.onOpenSettingsPanel === nextProps.onOpenSettingsPanel
    && previousProps.onPetContextMenu === nextProps.onPetContextMenu
    && previousProps.onSelectPet === nextProps.onSelectPet
    && previousProps.onStartOverlappedPetDrag === nextProps.onStartOverlappedPetDrag
    && previousProps.dragVisualPreviewSurfaceRef === nextProps.dragVisualPreviewSurfaceRef
    && previousProps.onRuntimeEvent === nextProps.onRuntimeEvent
    && previousProps.onPetVisualBoundsChange === nextProps.onPetVisualBoundsChange
    && previousProps.onStartPetDrag === nextProps.onStartPetDrag
    && previousProps.onWheelPetScale === nextProps.onWheelPetScale
    && previousProps.petPos.x === nextProps.petPos.x
    && previousProps.petPos.y === nextProps.petPos.y
    && previousProps.sequenceFrameDurationMultiplier === nextProps.sequenceFrameDurationMultiplier
    && previousProps.selectedPetId === nextProps.selectedPetId
    && previousProps.showPetActions === nextProps.showPetActions
    && areOptionalPositionsEqual(previousProps.visionTarget, nextProps.visionTarget);
}

function PetAvatarLayerComponent({
  activityCenter,
  active3DSceneCount = 1,
  actionOverride = null,
  config,
  debugClampBounds = null,
  debugCollisionBounds = null,
  expressionAction = null,
  hungerTriggerThreshold,
  isAutoMoving,
  isDragging = false,
  isChatOpen,
  isInteractiveDialogueHidden = false,
  isInteractiveDialogueMode = false,
  isSpeaking = false,
  isSettingsOpen,
  isTyping = false,
  interactiveDialoguePosition = null,
  interactiveDialogueShellSize = 256,
  latestMessage = '',
  animationToolTrigger = null,
  lastReplayableAnimationToolTrigger = null,
  manualMotionBinding = null,
  motionOverrideMode = null,
  motionTarget,
  petPos,
  sequenceFrameDurationMultiplier = 1,
  selectedPetId = null,
  showPetActions,
  visionTarget,
  onPetVisualBoundsChange,
  dragVisualPreviewSurfaceRef,
  onRuntimeEvent,
  onOpenChatPanel,
  onOpenSettingsPanel,
  onMovementPauseChange,
  onPetContextMenu,
  onSelectPet,
  onStartOverlappedPetDrag,
  onStartPetDrag,
  onWheelPetScale,
}: PetAvatarLayerProps) {
  const renderedAction = actionOverride ?? config.currentAction;
  const avatarShellRef = useRef<HTMLDivElement | null>(null);
  const latestDragPreviewPositionRef = useRef<Position | null>(null);
  const scaleGeometryProbeTimerRef = useRef<number | null>(null);
  useAnimationToolTriggerAudioPlayback(animationToolTrigger, PRIMARY_DESKTOP_PET_SLOT_ID);
  const chatAnimationState = usePetMessageAnimationQueue(
    latestMessage,
    isTyping,
    config.modelType,
    config.modelUrl,
    config.customModelPresets,
    animationToolTrigger,
    lastReplayableAnimationToolTrigger,
    undefined,
    PRIMARY_DESKTOP_PET_SLOT_ID,
  );
  const effectiveManualMotionBinding = chatAnimationState.motionBinding ?? manualMotionBinding;
  const effectiveManualExpressionBinding = chatAnimationState.expressionBinding;
  const runtimeWorldExpressionAction = useRuntimeWorldExpressionAction();
  const effectiveExpressionAction = expressionAction ?? (
    effectiveManualMotionBinding || effectiveManualExpressionBinding
      ? null
      : runtimeWorldExpressionAction
  );
  const manualMotionAction = useMemo(() => (
    canModelTypeUseMotionBindings(config.modelType)
    && effectiveManualMotionBinding
    && !isPetModelExpressionBinding(effectiveManualMotionBinding)
      ? resolvePetActionForMotionKey(effectiveManualMotionBinding.motionKey)
      : null
  ), [config.modelType, effectiveManualMotionBinding]);
  const visualRendererAction = manualMotionAction ?? renderedAction;
  const pet2dRenderAdapterState = useMemo(() => resolvePet2DRenderAdapterState({
    action: renderedAction,
    expressionAction: effectiveExpressionAction,
    isAutoMoving,
    isMoving: actionOverride === null && isAutoMoving,
    motionOverrideMode,
    scale: config.scale,
    sequenceFrameDurationMultiplier,
  }), [
    actionOverride,
    config.scale,
    effectiveExpressionAction,
    isAutoMoving,
    motionOverrideMode,
    renderedAction,
    sequenceFrameDurationMultiplier,
  ]);
  const shouldAnimateAsMoving = pet2dRenderAdapterState.visualIsMoving;
  const [primaryDragDelta, setPrimaryDragDelta] = useState<Position | null>(null);
  const { dragMotionState, focusTarget } = usePetLayerMotionState({
    dragDelta: primaryDragDelta,
    isDragging,
    modelType: config.modelType,
    motionTarget,
    position: petPos,
    shouldAnimateAsMoving,
    visionTarget,
  });
  useEffect(() => {
    if (!isDragging) {
      setPrimaryDragDelta(null);
    }
  }, [isDragging]);
  const { manifest: contentManifest } = usePetContentManifest(
    canModelTypeUseMotionBindings(config.modelType) ? config.modelUrl : '',
  );
  const {
    matchedModelPreset,
    mergedContentManifest,
    motionLibraryBindings,
    motionLibraryContentManifest,
  } = useMemo(() => (
    resolvePetRuntimeContentSurface({
      contentManifest,
      customModelPresets: config.customModelPresets,
      manualMotionBinding: effectiveManualMotionBinding,
      modelType: config.modelType,
      modelUrl: config.modelUrl,
    })
  ), [
    config.customModelPresets,
    config.modelType,
    config.modelUrl,
    contentManifest,
    effectiveManualMotionBinding,
  ]);
  const hoverRegions = useMemo(() => (
    resolvePetContentHoverRegions(mergedContentManifest)
  ), [mergedContentManifest]);
  const hoverInteractionsEnabled = !isDragging && !isInteractiveDialogueHidden;
  const { handlePointerLeave, handlePointerMove, hoverState, hoverTargetRef } = usePetHoverController({
    enabled: hoverInteractionsEnabled,
    supportedRegions: hoverRegions,
  });
  const pointerLookInteractionsEnabled = hoverInteractionsEnabled && config.pointerLookEnabled;
  const pointerLookTarget = usePetPointerLookTarget({
    enabled: pointerLookInteractionsEnabled,
    hoverState,
    trackingFallbackPaddingPx: config.modelType === '3d' ? 56 : undefined,
    trackingFallbackElementRef: avatarShellRef,
    trackingElementRef: hoverTargetRef,
    trackingLostHoldMs: config.modelType === 'live2d' ? 5000 : undefined,
    trackingStillReturnMs: config.modelType === 'live2d' ? 10000 : undefined,
  });
  const rendererHoverState = useMemo(() => (
    resolvePetPointerLookHoverState(hoverState, config.pointerLookEnabled)
  ), [config.pointerLookEnabled, hoverState]);
  useLive2DDragReleaseProbe({
    avatarShellRef,
    focusTarget,
    isDragging,
    modelType: config.modelType,
    modelUrl: config.modelUrl,
    petId: PRIMARY_DESKTOP_PET_SLOT_ID,
    pointerLookTarget,
    position: petPos,
    scale: config.scale,
  });
  const isHovered = hoverInteractionsEnabled && hoverState.activeRegion !== null;
  const {
    isMovementInteractionPaused,
    isWheelInteractionActive,
    notifyContextMenuInteraction,
    notifyPointerDownInteraction,
    notifyWheelInteraction,
  } = usePetMovementInteractionPause({
    isHovered,
  });
  const visualRendererIsMoving = useMemo(() => (
    resolvePetVisualRendererIsMoving({
      modelType: config.modelType,
      shouldAnimateAsMoving,
      visualRendererAction: manualMotionAction,
    })
  ), [config.modelType, manualMotionAction, shouldAnimateAsMoving]);
  const {
    handleVisualBoundsChange,
    measuredInteractiveVisualBounds,
    measuredWindowShapeVisualBounds,
  } = usePetVisualBoundsMeasurement({
    avatar3dRuntimeBackend: config.settings.avatar3dRuntimeBackend,
    isDragging,
    modelType: config.modelType,
    modelUrl: config.modelUrl,
    onVisualBoundsChange: onPetVisualBoundsChange,
    scale: config.scale,
    visualRendererIsMoving,
  });

  useEffect(() => {
    onMovementPauseChange?.(isMovementInteractionPaused);
  }, [isMovementInteractionPaused, onMovementPauseChange]);

  useEffect(() => () => {
    onMovementPauseChange?.(false);
  }, [onMovementPauseChange]);

  const renderShellSurface = useMemo(() => (
    resolvePetVisualRendererShellSurface({
      avatar3dRuntimeBackend: config.settings.avatar3dRuntimeBackend,
      dragMotionState,
      interactiveDialoguePosition,
      interactiveDialogueShellSize,
      isInteractiveDialogueMode,
      isDragging,
      measuredInteractiveVisualBounds,
      measuredWindowShapeVisualBounds,
      modelType: config.modelType,
      renderKind: matchedModelPreset?.renderKind ?? (/\.(?:webm|mp4|m4v|mov)$/iu.test(config.modelUrl) ? 'video' : undefined),
      position: petPos,
      scale: config.scale,
      shouldAnimateAsMoving,
      visualRendererAction: manualMotionAction,
    })
  ), [
    config.modelType,
    matchedModelPreset?.renderKind,
    config.scale,
    config.settings.avatar3dRuntimeBackend,
    dragMotionState,
    interactiveDialoguePosition,
    interactiveDialogueShellSize,
    isInteractiveDialogueMode,
    isDragging,
    manualMotionAction,
    measuredInteractiveVisualBounds,
    measuredWindowShapeVisualBounds,
    petPos,
    shouldAnimateAsMoving,
  ]);
  const {
    interactiveHitAreaStyle,
    presentationMode,
    renderedPosition,
    shellSize,
    shouldEmitVisualBounds,
    shouldLockDragAndScale,
    selectionScoreAreaAttributes,
    windowShapeProxyStyle,
  } = renderShellSurface;
  const runtimeViewport = useMemo(() => (
    resolvePetRuntimeViewport({
      activityCenter,
      renderedPosition,
      shellSize,
    })
  ), [activityCenter, renderedPosition, shellSize]);
  const live2DRendererViewport = useMemo(() => ({
    height: runtimeViewport.height,
    width: runtimeViewport.width,
    x: 0,
    y: 0,
  }), [runtimeViewport.height, runtimeViewport.width]);
  const visualRendererViewport = useMemo(() => {
    if (
      config.modelType !== 'live2d'
      && !(config.modelType === '3d' && config.settings.avatar3dRuntimeBackend === 'unity')
    ) {
      return null;
    }

    if (config.modelType === 'live2d') {
      return live2DRendererViewport;
    }

    return runtimeViewport;
  }, [
    config.modelType,
    config.settings.avatar3dRuntimeBackend,
    live2DRendererViewport,
    runtimeViewport,
  ]);
  const avatarShellStyle = useMemo(() => (
    resolvePetAvatarShellStyle({
      isDragging,
      isScaling: isWheelInteractionActive,
      renderedPosition,
      shellSize,
      shouldLetDragPreviewOwnTransform: Boolean(dragVisualPreviewSurfaceRef),
    })
  ), [dragVisualPreviewSurfaceRef, isDragging, isWheelInteractionActive, renderedPosition, shellSize]);

  useLayoutEffect(() => {
    if (config.modelType !== '3d' || isDragging) {
      return undefined;
    }

    const captureGeometry = (phase: 'commit-frame' | 'settled') => {
      const shell = avatarShellRef.current;
      const canvas = shell?.querySelector('canvas') ?? null;
      const viewport = canvas?.parentElement ?? null;
      const shellRect = shell?.getBoundingClientRect() ?? null;
      const canvasRect = canvas?.getBoundingClientRect() ?? null;
      const viewportRect = viewport?.getBoundingClientRect() ?? null;
      const computedShellStyle = shell ? window.getComputedStyle(shell) : null;

      pushFrontendRuntimeLog('scale-diagnose', 'TEMP 3d scale geometry probe', {
        canvasRect: canvasRect ? {
          height: canvasRect.height,
          left: canvasRect.left,
          top: canvasRect.top,
          width: canvasRect.width,
        } : null,
        phase,
        position: renderedPosition,
        scale: config.scale,
        shellRect: shellRect ? {
          height: shellRect.height,
          left: shellRect.left,
          top: shellRect.top,
          width: shellRect.width,
        } : null,
        shellSize,
        shellTransform: computedShellStyle?.transform ?? null,
        shellTransition: computedShellStyle?.transition ?? null,
        viewportRect: viewportRect ? {
          height: viewportRect.height,
          left: viewportRect.left,
          top: viewportRect.top,
          width: viewportRect.width,
        } : null,
      });
    };

    const animationFrameId = window.requestAnimationFrame(() => {
      captureGeometry('commit-frame');
    });
    if (scaleGeometryProbeTimerRef.current !== null) {
      window.clearTimeout(scaleGeometryProbeTimerRef.current);
    }
    scaleGeometryProbeTimerRef.current = window.setTimeout(() => {
      scaleGeometryProbeTimerRef.current = null;
      captureGeometry('settled');
    }, 280);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      if (scaleGeometryProbeTimerRef.current !== null) {
        window.clearTimeout(scaleGeometryProbeTimerRef.current);
        scaleGeometryProbeTimerRef.current = null;
      }
    };
  }, [config.modelType, config.scale, isDragging, renderedPosition, shellSize]);

  useLayoutEffect(() => {
    if (!isDragging) {
      latestDragPreviewPositionRef.current = null;
      return;
    }

    const latestPreviewPosition = latestDragPreviewPositionRef.current;
    const avatarShell = avatarShellRef.current;
    if (!latestPreviewPosition || !avatarShell) {
      return;
    }

    avatarShell.style.transform = `translate3d(${latestPreviewPosition.x}px, ${latestPreviewPosition.y}px, 0)`;
  }, [isDragging, renderedPosition.x, renderedPosition.y, shellSize]);

  useEffect(() => {
    if (!dragVisualPreviewSurfaceRef) {
      return undefined;
    }

    const previewSurface = {
      previewPosition: (position: Position, previousPosition: Position) => {
        latestDragPreviewPositionRef.current = position;
        setPrimaryDragDelta(resolvePetDragVisualPreviewDelta({
          position,
          previousPosition,
        }));
        const avatarShell = avatarShellRef.current;
        if (!avatarShell) {
          return;
        }

        avatarShell.style.transform = `translate3d(${position.x}px, ${position.y}px, 0)`;
      },
    };
    dragVisualPreviewSurfaceRef.current = previewSurface;

    return () => {
      if (dragVisualPreviewSurfaceRef.current === previewSurface) {
        dragVisualPreviewSurfaceRef.current = null;
      }
    };
  }, [dragVisualPreviewSurfaceRef]);
  const visualRendererProps = useMemo(() => (
    resolvePetVisualRendererProps({
      action: visualRendererAction,
      active3DSceneCount,
      avatar3dRuntimeBackend: config.settings.avatar3dRuntimeBackend,
      contentManifestOverride: motionLibraryContentManifest,
      debugPetId: PRIMARY_DESKTOP_PET_SLOT_ID,
      dragMotionState,
      expressionAction: effectiveExpressionAction,
      focusTarget,
      hoverState: rendererHoverState,
      isInteractiveDialogueHidden,
      isDragging,
      isMoving: visualRendererIsMoving,
      isSpeaking,
      isTyping,
      latestMessage,
      live2dRuntimeProfile: matchedModelPreset?.live2dRuntimeProfile ?? null,
      manualExpressionBinding: effectiveManualExpressionBinding,
      manualMotionBinding: effectiveManualMotionBinding,
      modelType: config.modelType,
      motionBindings: motionLibraryBindings,
      modelUrl: config.modelUrl,
      renderKind: matchedModelPreset?.renderKind,
      randomVideoPlaybackEnabled: matchedModelPreset?.randomVideoPlaybackEnabled,
      videoEmotionFolderAliases: matchedModelPreset?.videoEmotionFolderAliases ?? null,
      videoLibraryRootPath: matchedModelPreset?.videoLibraryRootPath ?? null,
      sequenceFrames: matchedModelPreset?.sequenceFrames,
      onRuntimeEvent,
      onVisualBoundsChange: shouldEmitVisualBounds ? handleVisualBoundsChange : undefined,
      pet2dRenderAdapterState,
      pointerLookTarget,
      presentationMode,
      scale: config.scale,
      sequenceFrameDurationMultiplier,
      updatePriority: 'primary',
      viewport: visualRendererViewport,
    })
  ), [
    active3DSceneCount,
    config.modelType,
    config.modelUrl,
    config.scale,
    config.settings.avatar3dRuntimeBackend,
    dragMotionState,
    effectiveExpressionAction,
    focusTarget,
    handleVisualBoundsChange,
    rendererHoverState,
    isInteractiveDialogueHidden,
    isDragging,
    isSpeaking,
    isTyping,
    latestMessage,
    matchedModelPreset?.live2dRuntimeProfile,
    effectiveManualExpressionBinding,
    effectiveManualMotionBinding,
    motionLibraryBindings,
    motionLibraryContentManifest,
    onRuntimeEvent,
    pet2dRenderAdapterState,
    pointerLookTarget,
    presentationMode,
    matchedModelPreset?.sequenceFrames,
    matchedModelPreset?.renderKind,
    matchedModelPreset?.randomVideoPlaybackEnabled,
    matchedModelPreset?.videoEmotionFolderAliases,
    matchedModelPreset?.videoLibraryRootPath,
    sequenceFrameDurationMultiplier,
    shouldEmitVisualBounds,
    visualRendererViewport,
    visualRendererAction,
    visualRendererIsMoving,
  ]);
  const handleInteractivePointerDownCapture = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (shouldLockDragAndScale && event.button === 0) {
      return;
    }
    notifyPointerDownInteraction();
  }, [notifyPointerDownInteraction, shouldLockDragAndScale]);
  const handleInteractivePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (shouldLockDragAndScale && event.button === 0) {
      return;
    }
    const targetPetId = resolveStackedPetSelectionTargetFromPointerEvent(event, {
      currentPetId: PRIMARY_DESKTOP_PET_SLOT_ID,
      selectedPetId,
    });
    if (targetPetId !== PRIMARY_DESKTOP_PET_SLOT_ID) {
      if (onStartOverlappedPetDrag) {
        onStartOverlappedPetDrag(event, targetPetId);
        return;
      }

      onSelectPet?.(targetPetId);
      return;
    }
    onStartPetDrag(event);
  }, [onSelectPet, onStartOverlappedPetDrag, onStartPetDrag, selectedPetId, shouldLockDragAndScale]);
  const handleInteractiveWheel = useCallback((event: ReactWheelEvent<HTMLDivElement>) => {
    if (shouldLockDragAndScale) {
      event.preventDefault();
      return;
    }
    notifyWheelInteraction();
    onWheelPetScale(event);
  }, [notifyWheelInteraction, onWheelPetScale, shouldLockDragAndScale]);
  const handleInteractiveContextMenu = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    notifyContextMenuInteraction();
    onPetContextMenu(event);
  }, [notifyContextMenuInteraction, onPetContextMenu]);

  return (
    <>
      <div
        className="absolute group pointer-events-none"
        style={{
          left: activityCenter.x,
          opacity: isInteractiveDialogueHidden ? 0 : 1,
          top: activityCenter.y,
          transition: 'opacity 180ms ease',
          transform: 'translate(-50%, -50%)',
          zIndex: resolvePrimaryPetLayerZIndex({
            isDragging,
            isInteractiveDialogueMode,
            isSelected: selectedPetId === PRIMARY_DESKTOP_PET_SLOT_ID,
          }),
        }}
      >
        <div
          ref={avatarShellRef}
          data-desktop-pet-debug-box="primary pet shell"
          data-desktop-pet-debug-box-kind="viewport"
          data-desktop-pet-owner-id={PRIMARY_DESKTOP_PET_SLOT_ID}
          className={isInteractiveDialogueMode ? 'pet-interactive-dialogue-enter relative pointer-events-none' : 'relative pointer-events-none'}
          style={avatarShellStyle}
        >
          {visionTarget && (
            <svg
              className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 overflow-visible"
            >
              <line
                className="pet-vision-line"
                x1="400"
                y1="400"
                x2={400 + visionTarget.x}
                y2={400 + visionTarget.y}
                stroke="rgba(var(--primary), 0.3)"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <circle
                className="pet-vision-pulse"
                cx={400 + visionTarget.x}
                cy={400 + visionTarget.y}
                r="20"
                fill="none"
                stroke="rgba(var(--primary), 0.5)"
                strokeWidth="1"
              />
            </svg>
          )}

          {pet2dRenderAdapterState.actionPresentationProfile.shouldShowAutoMoveOverlay && (
            <div
              data-desktop-pet-window-shape="true"
              data-desktop-pet-native-scope="pet"
              className="pet-overlay-enter absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap rounded border border-yellow-500/50 bg-transparent px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-yellow-500"
            >
              {getAutoMoveLabel(config, hungerTriggerThreshold)}
            </div>
          )}

          <div
            data-desktop-pet-debug-box="primary visual surface"
            data-desktop-pet-debug-box-kind="viewport"
            className="relative h-full w-full"
          >
            {interactiveHitAreaStyle && (
              <div
                aria-hidden="true"
                data-desktop-pet-debug-box="primary visual bounds"
                data-desktop-pet-debug-box-kind="surface"
                className="pointer-events-none absolute"
                style={interactiveHitAreaStyle}
              />
            )}
            <PetDebugBoundsOverlay
              bounds={debugClampBounds}
              kind="clamp"
              label="primary clamp bounds"
              shellSize={shellSize}
            />
            <PetDebugBoundsOverlay
              bounds={debugCollisionBounds}
              kind="collision"
              label="primary collision bounds"
              shellSize={shellSize}
            />
            {!isInteractiveDialogueHidden && (
              <div
                aria-hidden="true"
                data-desktop-pet-debug-box="primary window shape"
                data-desktop-pet-window-shape="true"
                data-desktop-pet-native-scope="pet"
                className="pointer-events-none absolute"
                style={windowShapeProxyStyle}
              />
            )}
            <div
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
            >
              <div className="relative flex h-full w-full shrink-0 basis-full items-center justify-center">
                <PetVisualRenderer {...visualRendererProps} />
              </div>
            </div>
            <div
              ref={hoverTargetRef}
              data-desktop-pet-debug-box="primary interactive hit area"
              data-desktop-pet-interactive={isInteractiveDialogueHidden ? undefined : 'true'}
              data-desktop-pet-native-scope="pet"
              data-desktop-pet-id={PRIMARY_DESKTOP_PET_SLOT_ID}
              onPointerDownCapture={handleInteractivePointerDownCapture}
              onPointerDown={handleInteractivePointerDown}
              onPointerEnter={handlePointerMove}
              onPointerLeave={handlePointerLeave}
              onPointerMove={handlePointerMove}
              onWheel={handleInteractiveWheel}
              onContextMenu={handleInteractiveContextMenu}
              {...selectionScoreAreaAttributes}
              className="absolute inset-0 cursor-grab select-none active:cursor-grabbing pointer-events-auto"
              style={{
                ...interactiveHitAreaStyle,
                pointerEvents: isInteractiveDialogueHidden ? 'none' : 'auto',
              }}
            />
          </div>

          {showPetActions && (
            <div
              data-desktop-pet-interactive="true"
              data-desktop-pet-window-shape="true"
              data-desktop-pet-native-scope="pet"
              className="pet-overlay-enter absolute -bottom-12 left-1/2 z-20 flex -translate-x-1/2 gap-3 pointer-events-auto"
              style={{
                pointerEvents: isInteractiveDialogueHidden ? 'none' : 'auto',
              }}
            >
              <Button
                size="icon"
                variant="secondary"
                className={`h-10 w-10 rounded border border-border transition-colors ${isChatOpen ? 'bg-primary text-primary-foreground' : 'bg-card/85 hover:bg-primary hover:text-primary-foreground'}`}
                onClick={onOpenChatPanel}
                title="Open Chat Panel"
              >
                <MessageCircle className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="secondary"
                className={`h-10 w-10 rounded border border-border transition-colors ${isSettingsOpen ? 'bg-primary text-primary-foreground' : 'bg-card/85 hover:bg-primary hover:text-primary-foreground'}`}
                onClick={onOpenSettingsPanel}
                title="Open Settings Panel"
              >
                <SettingsIcon className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export const PetAvatarLayer = memo(PetAvatarLayerComponent, arePetAvatarLayerPropsEqual);
PetAvatarLayer.displayName = 'PetAvatarLayer';
