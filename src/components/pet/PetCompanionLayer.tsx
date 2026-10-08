import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { type DesktopPetSlot } from '../../multiPetRoster';
import { type Avatar3DRuntimeBackend, type PetModelMotionBinding, type PetModelPreset } from '../../types';
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
import { useTimedPetBubbleMessage } from './useTimedPetBubbleMessage';
import { resolveCompanionPetLayerZIndex } from './petLayerOrdering';
import { resolveStackedPetSelectionTargetFromPointerEvent } from './petPointerSelection';
import { usePetVisualBoundsMeasurement } from './usePetVisualBoundsMeasurement';
import {
  resolvePetAvatarShellStyle,
  resolvePetRuntimeViewport,
} from './petAvatarLayerGeometry';
import { usePetLayerMotionState } from './usePetLayerMotionState';
import { PetDebugBoundsOverlay } from './PetDebugBoundsOverlay';
import { useLive2DDragReleaseProbe } from './useLive2DDragReleaseProbe';

type Position = {
  x: number;
  y: number;
};

function areOptionalPositionsEqual(left?: Position | null, right?: Position | null) {
  return (left?.x ?? null) === (right?.x ?? null)
    && (left?.y ?? null) === (right?.y ?? null);
}

function areCompanionSlotsEqual(left: DesktopPetSlot, right: DesktopPetSlot) {
  return left.id === right.id
    && left.currentAction === right.currentAction
    && left.modelType === right.modelType
    && left.modelUrl === right.modelUrl
    && left.scale === right.scale
    && left.position.x === right.position.x
    && left.position.y === right.position.y
    && left.personality.name === right.personality.name;
}

interface PetCompanionLayerProps {
  activityCenter: Position;
  dragDelta?: Position | null;
  active3DSceneCount?: number;
  avatar3dRuntimeBackend?: Avatar3DRuntimeBackend;
  customModelPresets?: PetModelPreset[];
  debugClampBounds?: PetVisualBounds | null;
  debugCollisionBounds?: PetVisualBounds | null;
  expressionAction?: DesktopPetSlot['currentAction'] | null;
  isDragging?: boolean;
  isInteractiveDialogueHidden?: boolean;
  isInteractiveDialogueMode?: boolean;
  isSpeaking?: boolean;
  isTyping?: boolean;
  interactiveDialoguePosition?: Position | null;
  interactiveDialogueShellSize?: number;
  latestMessage?: string;
  manualExpressionBinding?: PetModelMotionBinding | null;
  manualMotionBinding?: PetModelMotionBinding | null;
  motionOverrideMode?: PetActionMotionOverrideMode | null;
  motionTarget?: Position | null;
  onMovementPauseChange?: (isMovementPaused: boolean) => void;
  onPetContextMenu?: (event: ReactMouseEvent<HTMLDivElement>, slotId: string) => void;
  onRuntimeEvent?: AvatarRuntimeEventListener;
  onSelectPet?: (petId: string) => void;
  onStartOverlappedPetDrag?: (event: ReactPointerEvent<HTMLDivElement>, petId: string) => void;
  onVisualBoundsChange?: (slotId: string, bounds: PetVisualBounds) => void;
  onStartDrag?: (
    event: ReactPointerEvent<HTMLDivElement>,
    slotId: string,
    renderedPosition: Position,
  ) => void;
  onWheelScale?: (event: ReactWheelEvent<HTMLDivElement>, slotId: string) => void;
  sequenceFrameDurationMultiplier?: number;
  selectedPetId?: string | null;
  slot: DesktopPetSlot;
}

function arePetCompanionLayerPropsEqual(
  previousProps: PetCompanionLayerProps,
  nextProps: PetCompanionLayerProps,
) {
  return previousProps.active3DSceneCount === nextProps.active3DSceneCount
    && previousProps.avatar3dRuntimeBackend === nextProps.avatar3dRuntimeBackend
    && previousProps.activityCenter.x === nextProps.activityCenter.x
    && previousProps.activityCenter.y === nextProps.activityCenter.y
    && previousProps.customModelPresets === nextProps.customModelPresets
    && arePetVisualBoundsEqual(previousProps.debugClampBounds, nextProps.debugClampBounds)
    && arePetVisualBoundsEqual(previousProps.debugCollisionBounds, nextProps.debugCollisionBounds)
    && areOptionalPositionsEqual(previousProps.dragDelta, nextProps.dragDelta)
    && previousProps.expressionAction === nextProps.expressionAction
    && previousProps.isDragging === nextProps.isDragging
    && previousProps.isInteractiveDialogueHidden === nextProps.isInteractiveDialogueHidden
    && previousProps.isInteractiveDialogueMode === nextProps.isInteractiveDialogueMode
    && previousProps.isSpeaking === nextProps.isSpeaking
    && previousProps.isTyping === nextProps.isTyping
    && areOptionalPositionsEqual(previousProps.interactiveDialoguePosition, nextProps.interactiveDialoguePosition)
    && previousProps.interactiveDialogueShellSize === nextProps.interactiveDialogueShellSize
    && previousProps.latestMessage === nextProps.latestMessage
    && previousProps.manualExpressionBinding === nextProps.manualExpressionBinding
    && previousProps.manualMotionBinding === nextProps.manualMotionBinding
    && previousProps.motionOverrideMode === nextProps.motionOverrideMode
    && areOptionalPositionsEqual(previousProps.motionTarget, nextProps.motionTarget)
    && previousProps.onMovementPauseChange === nextProps.onMovementPauseChange
    && previousProps.onPetContextMenu === nextProps.onPetContextMenu
    && previousProps.onRuntimeEvent === nextProps.onRuntimeEvent
    && previousProps.onSelectPet === nextProps.onSelectPet
    && previousProps.onStartOverlappedPetDrag === nextProps.onStartOverlappedPetDrag
    && previousProps.onStartDrag === nextProps.onStartDrag
    && previousProps.onVisualBoundsChange === nextProps.onVisualBoundsChange
    && previousProps.onWheelScale === nextProps.onWheelScale
    && previousProps.sequenceFrameDurationMultiplier === nextProps.sequenceFrameDurationMultiplier
    && previousProps.selectedPetId === nextProps.selectedPetId
    && areCompanionSlotsEqual(previousProps.slot, nextProps.slot);
}

function PetCompanionLayerComponent({
  activityCenter,
  dragDelta = null,
  active3DSceneCount = 1,
  avatar3dRuntimeBackend = 'three',
  customModelPresets = [],
  debugClampBounds = null,
  debugCollisionBounds = null,
  expressionAction = null,
  isDragging = false,
  isInteractiveDialogueHidden = false,
  isInteractiveDialogueMode = false,
  isSpeaking = false,
  isTyping = false,
  interactiveDialoguePosition = null,
  interactiveDialogueShellSize = 256,
  latestMessage = '',
  manualExpressionBinding = null,
  manualMotionBinding = null,
  motionOverrideMode = null,
  motionTarget = null,
  onMovementPauseChange,
  onPetContextMenu,
  onRuntimeEvent,
  onSelectPet,
  onStartOverlappedPetDrag,
  onVisualBoundsChange,
  onStartDrag,
  onWheelScale,
  sequenceFrameDurationMultiplier = 1,
  selectedPetId = null,
  slot,
}: PetCompanionLayerProps) {
  const companionShellRef = useRef<HTMLDivElement | null>(null);
  const isMoving = motionTarget !== null;
  const manualMotionAction = useMemo(() => (
    canModelTypeUseMotionBindings(slot.modelType)
    && manualMotionBinding
    && !isPetModelExpressionBinding(manualMotionBinding)
      ? resolvePetActionForMotionKey(manualMotionBinding.motionKey)
      : null
  ), [manualMotionBinding, slot.modelType]);
  const visualRendererAction = manualMotionAction ?? slot.currentAction;
  const pet2dRenderAdapterState = useMemo(() => resolvePet2DRenderAdapterState({
    action: slot.currentAction,
    expressionAction,
    isMoving,
    motionOverrideMode,
    scale: slot.scale,
    sequenceFrameDurationMultiplier,
  }), [expressionAction, isMoving, motionOverrideMode, sequenceFrameDurationMultiplier, slot.currentAction, slot.scale]);
  const shouldAnimateAsMoving = pet2dRenderAdapterState.visualIsMoving;
  const { dragMotionState, focusTarget } = usePetLayerMotionState({
    dragDelta,
    isDragging,
    modelType: slot.modelType,
    motionTarget,
    position: slot.position,
    shouldAnimateAsMoving,
  });
  const { manifest: contentManifest } = usePetContentManifest(
    canModelTypeUseMotionBindings(slot.modelType) ? slot.modelUrl : '',
  );
  const {
    matchedModelPreset,
    mergedContentManifest,
    motionLibraryBindings,
    motionLibraryContentManifest,
  } = useMemo(() => (
    resolvePetRuntimeContentSurface({
      contentManifest,
      customModelPresets,
      manualMotionBinding,
      modelType: slot.modelType,
      modelUrl: slot.modelUrl,
    })
  ), [
    contentManifest,
    customModelPresets,
    manualMotionBinding,
    slot.modelType,
    slot.modelUrl,
  ]);
  const hoverRegions = useMemo(() => (
    resolvePetContentHoverRegions(mergedContentManifest)
  ), [mergedContentManifest]);
  const hoverInteractionsEnabled = !isDragging && !isInteractiveDialogueHidden;
  const { handlePointerLeave, handlePointerMove, hoverState, hoverTargetRef } = usePetHoverController({
    enabled: hoverInteractionsEnabled,
    supportedRegions: hoverRegions,
  });
  const pointerLookInteractionsEnabled = hoverInteractionsEnabled && slot.pointerLookEnabled;
  const pointerLookTarget = usePetPointerLookTarget({
    enabled: pointerLookInteractionsEnabled,
    hoverState,
    trackingFallbackPaddingPx: slot.modelType === '3d' ? 56 : undefined,
    trackingFallbackElementRef: companionShellRef,
    trackingElementRef: hoverTargetRef,
    trackingLostHoldMs: slot.modelType === 'live2d' ? 5000 : undefined,
    trackingStillReturnMs: slot.modelType === 'live2d' ? 10000 : undefined,
  });
  const rendererHoverState = useMemo(() => (
    resolvePetPointerLookHoverState(hoverState, slot.pointerLookEnabled)
  ), [hoverState, slot.pointerLookEnabled]);
  useLive2DDragReleaseProbe({
    avatarShellRef: companionShellRef,
    focusTarget,
    isDragging,
    modelType: slot.modelType,
    modelUrl: slot.modelUrl,
    petId: slot.id,
    pointerLookTarget,
    position: slot.position,
    scale: slot.scale,
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
      modelType: slot.modelType,
      shouldAnimateAsMoving,
      visualRendererAction: manualMotionAction,
    })
  ), [manualMotionAction, shouldAnimateAsMoving, slot.modelType]);
  const handleCompanionVisualBoundsChange = useCallback((bounds: PetVisualBounds) => {
    onVisualBoundsChange?.(slot.id, bounds);
  }, [onVisualBoundsChange, slot.id]);
  const {
    handleVisualBoundsChange,
    latestVisualBounds,
    measuredInteractiveVisualBounds,
    measuredWindowShapeVisualBounds,
  } = usePetVisualBoundsMeasurement({
    avatar3dRuntimeBackend,
    isDragging,
    modelType: slot.modelType,
    modelUrl: slot.modelUrl,
    onVisualBoundsChange: handleCompanionVisualBoundsChange,
    scale: slot.scale,
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
      avatar3dRuntimeBackend,
      dragMotionState,
      interactiveDialoguePosition,
      interactiveDialogueShellSize,
      isInteractiveDialogueMode,
      isDragging,
      measuredInteractiveVisualBounds,
      measuredWindowShapeVisualBounds,
      modelType: slot.modelType,
      renderKind: matchedModelPreset?.renderKind ?? (/\.(?:webm|mp4|m4v|mov)$/iu.test(slot.modelUrl) ? 'video' : undefined),
      position: slot.position,
      scale: slot.scale,
      shouldAnimateAsMoving,
      visualRendererAction: manualMotionAction,
    })
  ), [
    avatar3dRuntimeBackend,
    dragMotionState,
    interactiveDialoguePosition,
    interactiveDialogueShellSize,
    isInteractiveDialogueMode,
    isDragging,
    manualMotionAction,
    measuredInteractiveVisualBounds,
    measuredWindowShapeVisualBounds,
    shouldAnimateAsMoving,
    slot.modelType,
    matchedModelPreset?.renderKind,
    slot.position,
    slot.scale,
  ]);
  const {
    interactiveHitAreaStyle,
    presentationMode,
    renderedPosition,
    selectionScoreAreaAttributes,
    shellSize,
    shouldEmitVisualBounds,
    shouldLockDragAndScale,
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
      slot.modelType !== 'live2d'
      && !(slot.modelType === '3d' && avatar3dRuntimeBackend === 'unity')
    ) {
      return null;
    }

    if (slot.modelType === 'live2d') {
      return live2DRendererViewport;
    }

    return runtimeViewport;
  }, [
    avatar3dRuntimeBackend,
    live2DRendererViewport,
    runtimeViewport,
    slot.modelType,
  ]);
  const avatarShellStyle = useMemo(() => (
    resolvePetAvatarShellStyle({
      isDragging,
      isScaling: isWheelInteractionActive,
      renderedPosition,
      shellSize,
    })
  ), [isDragging, isWheelInteractionActive, renderedPosition, shellSize]);
  const resolvedBubbleTopOffset = Math.max(
    28,
    Math.round((latestVisualBounds?.top ?? shellSize / 2) + 10),
  );
  const visualRendererProps = useMemo(() => (
      resolvePetVisualRendererProps({
      action: visualRendererAction,
      active3DSceneCount,
      avatar3dRuntimeBackend,
      contentManifestOverride: motionLibraryContentManifest,
      debugPetId: slot.id,
      dragMotionState,
      expressionAction,
      focusTarget,
      hoverState: rendererHoverState,
      isInteractiveDialogueHidden,
      isDragging,
      isMoving: visualRendererIsMoving,
      isSpeaking,
      isTyping,
      latestMessage,
      live2dRuntimeProfile: matchedModelPreset?.live2dRuntimeProfile ?? null,
      manualExpressionBinding,
      manualMotionBinding,
      modelType: slot.modelType,
      motionBindings: motionLibraryBindings,
      modelUrl: slot.modelUrl,
      renderKind: matchedModelPreset?.renderKind
        ?? (/\.(?:webm|mp4|m4v|mov)(?:[?#].*)?$/iu.test(slot.modelUrl) ? 'video' : undefined),
      randomVideoPlaybackEnabled: matchedModelPreset?.randomVideoPlaybackEnabled,
      videoEmotionFolderAliases: matchedModelPreset?.videoEmotionFolderAliases ?? null,
      videoLibraryRootPath: matchedModelPreset?.videoLibraryRootPath ?? null,
      sequenceFrames: matchedModelPreset?.sequenceFrames,
      onRuntimeEvent,
      onVisualBoundsChange: shouldEmitVisualBounds
        ? handleVisualBoundsChange
        : undefined,
      pet2dRenderAdapterState,
      pointerLookTarget,
      presentationMode,
      scale: slot.scale,
      sequenceFrameDurationMultiplier,
      updatePriority: 'companion',
      viewport: visualRendererViewport,
    })
  ), [
    active3DSceneCount,
    avatar3dRuntimeBackend,
    dragMotionState,
    expressionAction,
    focusTarget,
    handleVisualBoundsChange,
    rendererHoverState,
    isInteractiveDialogueHidden,
    isDragging,
    isSpeaking,
    isTyping,
    latestMessage,
    matchedModelPreset?.live2dRuntimeProfile,
    manualExpressionBinding,
    manualMotionBinding,
    motionLibraryBindings,
    motionLibraryContentManifest,
    onRuntimeEvent,
    onVisualBoundsChange,
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
    slot.id,
    slot.modelType,
    slot.modelUrl,
    slot.scale,
    visualRendererViewport,
    visualRendererAction,
    visualRendererIsMoving,
  ]);
  const displayBubbleMessage = useTimedPetBubbleMessage({
    isActive: isTyping,
    latestMessage,
  });

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: activityCenter.x,
        opacity: isInteractiveDialogueHidden ? 0 : 1,
        top: activityCenter.y,
        transition: 'opacity 180ms ease',
        transform: 'translate(-50%, -50%)',
        zIndex: resolveCompanionPetLayerZIndex({
          isDragging,
          isInteractiveDialogueMode,
          isSelected: selectedPetId === slot.id,
        }),
      }}
    >
      <div
        ref={companionShellRef}
        data-desktop-pet-debug-box={`${slot.personality.name} shell`}
        data-desktop-pet-debug-box-kind="viewport"
        data-desktop-pet-owner-id={slot.id}
        className={isInteractiveDialogueMode ? 'pet-interactive-dialogue-enter relative pointer-events-none' : 'relative pointer-events-none'}
        style={avatarShellStyle}
      >
        <AnimatePresence>
          {displayBubbleMessage && (
            <motion.div
              data-desktop-pet-window-shape="true"
              data-desktop-pet-native-scope="pet"
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              className="pointer-events-none absolute left-1/2 z-10 w-60 max-w-[30vw] -translate-x-1/2 text-center text-xs font-semibold leading-relaxed text-primary"
              style={{
                bottom: `calc(50% + ${resolvedBubbleTopOffset}px)`,
                textShadow: '0 1px 6px rgba(0, 0, 0, 0.88)',
              }}
            >
              <div className="max-h-20 overflow-hidden whitespace-pre-wrap break-words">
                {displayBubbleMessage}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div
          data-desktop-pet-window-shape="true"
          data-desktop-pet-native-scope="pet"
          className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 rounded-sm border border-primary/30 bg-background/70 px-2 py-1 text-[10px] font-bold tracking-widest text-primary backdrop-blur-sm"
        >
          {slot.personality.name}
        </div>

        <div
          data-desktop-pet-debug-box={`${slot.personality.name} visual surface`}
          data-desktop-pet-debug-box-kind="viewport"
          className="relative h-full w-full"
        >
          {interactiveHitAreaStyle && (
            <div
              aria-hidden="true"
              data-desktop-pet-debug-box={`${slot.personality.name} visual bounds`}
              data-desktop-pet-debug-box-kind="surface"
              className="pointer-events-none absolute"
              style={interactiveHitAreaStyle}
            />
          )}
          <PetDebugBoundsOverlay
            bounds={debugClampBounds}
            kind="clamp"
            label={`${slot.personality.name} clamp bounds`}
            shellSize={shellSize}
          />
          <PetDebugBoundsOverlay
            bounds={debugCollisionBounds}
            kind="collision"
            label={`${slot.personality.name} collision bounds`}
            shellSize={shellSize}
          />
          {!isInteractiveDialogueHidden && (
            <div
              aria-hidden="true"
              data-desktop-pet-debug-box={`${slot.personality.name} window shape`}
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
            data-desktop-pet-debug-box={`${slot.personality.name} interactive hit area`}
            data-desktop-pet-interactive={isInteractiveDialogueHidden ? undefined : 'true'}
            data-desktop-pet-native-scope="pet"
            data-desktop-pet-id={slot.id}
            className="absolute inset-0 cursor-grab active:cursor-grabbing pointer-events-auto"
            onPointerDownCapture={(event) => {
              if (shouldLockDragAndScale && event.button === 0) {
                return;
              }
              notifyPointerDownInteraction();
            }}
            onPointerDown={(event) => {
              if (shouldLockDragAndScale && event.button === 0) {
                return;
              }
              const targetPetId = resolveStackedPetSelectionTargetFromPointerEvent(event, {
                currentPetId: slot.id,
                selectedPetId,
              });
              if (targetPetId !== slot.id) {
                if (onStartOverlappedPetDrag) {
                  onStartOverlappedPetDrag(event, targetPetId);
                  return;
                }

                onSelectPet?.(targetPetId);
                return;
              }
              onStartDrag?.(event, slot.id, renderedPosition);
            }}
            onPointerEnter={handlePointerMove}
            onPointerLeave={handlePointerLeave}
            onPointerMove={handlePointerMove}
            {...selectionScoreAreaAttributes}
            onWheel={(event) => {
              if (shouldLockDragAndScale) {
                event.preventDefault();
                return;
              }
              notifyWheelInteraction();
              onWheelScale?.(event, slot.id);
            }}
            onContextMenu={(event) => {
              notifyContextMenuInteraction();
              onPetContextMenu?.(event, slot.id);
            }}
            style={{
              ...interactiveHitAreaStyle,
              pointerEvents: isInteractiveDialogueHidden ? 'none' : 'auto',
            }}
          />
        </div>
      </div>
    </div>
  );
}

export const PetCompanionLayer = memo(PetCompanionLayerComponent, arePetCompanionLayerPropsEqual);
PetCompanionLayer.displayName = 'PetCompanionLayer';
