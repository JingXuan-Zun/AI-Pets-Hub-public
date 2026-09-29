import {
  memo,
  useEffect,
  useMemo,
  useState,
  type MouseEvent as ReactMouseEvent,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import { type DesktopPetAnimationToolTrigger } from '../../chatState';
import { type DesktopPetSlot } from '../../multiPetRoster';
import { useCompanionPetRuntime } from '../../pet-runtime/companion/useCompanionPetRuntime';
import { usePetContentManifest } from '../../pet-runtime/content/usePetContentManifest';
import { type AvatarRuntimeEventListener } from '../../pet-runtime/avatar-runtime/avatarRuntimeEvents';
import { type Avatar3DRuntimeBackend, type CompanionPetConfig, type PetConfig, type PetConfigUpdateHandler, type PetModelMotionBinding } from '../../types';
import { PetCompanionLayer } from './PetCompanionLayer';
import { type PetVisualBounds } from './petVisualBounds';
import { resolvePetRuntimeContentSurface } from './petRuntimeContentSurface';
import { resolvePet2DReactionState } from './usePet2DReactionState';
import { usePetMessageExpressionAction } from './usePetMessageExpressionAction';
import { usePetMessageAnimationQueue } from './usePetMessageAnimationQueue';
import { useAnimationToolTriggerAudioPlayback } from './useAnimationToolTriggerAudioPlayback';

type Position = {
  x: number;
  y: number;
};

type ActivityArea = {
  width: number;
  height: number;
};

interface CompanionPetRuntimeLayerProps {
  activityArea: ActivityArea;
  activityCenter: Position;
  active3DSceneCount?: number;
  avatar3dRuntimeBackend?: Avatar3DRuntimeBackend;
  addLog?: (message: string) => void;
  clampCompanionPosition: (position: Position, pet: CompanionPetConfig) => Position;
  configRef: MutableRefObject<PetConfig>;
  createCompanionRoamTarget?: (pet: CompanionPetConfig) => Position;
  debugClampBounds?: PetVisualBounds | null;
  debugCollisionBounds?: PetVisualBounds | null;
  companionDragDelta?: Position | null;
  draggingCompanionPetId?: string | null;
  draggingCompanionPetIdRef?: MutableRefObject<string | null>;
  hungerAutoEatStopThreshold: number;
  hungerTriggerThreshold: number;
  interactiveDialoguePosition?: Position | null;
  interactiveDialogueShellSize?: number;
  isInteractiveDialogueHidden?: boolean;
  isInteractiveDialogueMode?: boolean;
  isMovementPaused: boolean;
  isSpeaking?: boolean;
  isTyping?: boolean;
  latestMessage?: string;
  animationToolTrigger?: DesktopPetAnimationToolTrigger | null;
  lastReplayableAnimationToolTrigger?: DesktopPetAnimationToolTrigger | null;
  manualMotionBinding?: PetModelMotionBinding | null;
  manualEatingUntilByPetIdRef?: MutableRefObject<Record<string, number>>;
  onEatScaleBoost?: (slotId: string) => void;
  onPetContextMenu?: (event: ReactMouseEvent<HTMLDivElement>, slotId: string) => void;
  onRenderedPositionChange?: (slotId: string, position: Position | null) => void;
  onRuntimeEvent?: AvatarRuntimeEventListener;
  onSelectPet?: (petId: string) => void;
  onStartOverlappedPetDrag?: (event: ReactPointerEvent<HTMLDivElement>, petId: string) => void;
  onStartDrag?: (
    event: ReactPointerEvent<HTMLDivElement>,
    slotId: string,
    renderedPosition: Position,
  ) => void;
  onUpdateConfig: PetConfigUpdateHandler;
  onVisualBoundsChange?: (slotId: string, bounds: { bottom: number; left: number; right: number; top: number }) => void;
  onWheelScale?: (event: ReactWheelEvent<HTMLDivElement>, slotId: string) => void;
  sequenceFrameDurationMultiplier?: number;
  selectedPetId?: string | null;
  satiatedThreshold: number;
  slot: DesktopPetSlot;
}

export const CompanionPetRuntimeLayer = memo(function CompanionPetRuntimeLayer({
  activityArea,
  activityCenter,
  active3DSceneCount = 1,
  avatar3dRuntimeBackend = 'three',
  addLog,
  clampCompanionPosition,
  configRef,
  createCompanionRoamTarget,
  debugClampBounds = null,
  debugCollisionBounds = null,
  companionDragDelta = null,
  draggingCompanionPetId = null,
  draggingCompanionPetIdRef,
  hungerAutoEatStopThreshold,
  hungerTriggerThreshold,
  interactiveDialoguePosition = null,
  interactiveDialogueShellSize = 256,
  isInteractiveDialogueHidden = false,
  isInteractiveDialogueMode = false,
  isMovementPaused,
  isSpeaking = false,
  isTyping = false,
  latestMessage = '',
  animationToolTrigger = null,
  lastReplayableAnimationToolTrigger = null,
  manualMotionBinding = null,
  manualEatingUntilByPetIdRef,
  onEatScaleBoost,
  onPetContextMenu,
  onRenderedPositionChange,
  onRuntimeEvent,
  onSelectPet,
  onStartOverlappedPetDrag,
  onStartDrag,
  onUpdateConfig,
  onVisualBoundsChange,
  onWheelScale,
  sequenceFrameDurationMultiplier = 1,
  selectedPetId = null,
  satiatedThreshold,
  slot,
}: CompanionPetRuntimeLayerProps) {
  const expressionAction = usePetMessageExpressionAction(
    latestMessage,
    isTyping,
    undefined,
    slot.id,
    slot.modelType === 'live2d',
  );
  const customModelPresets = configRef.current.customModelPresets;
  useAnimationToolTriggerAudioPlayback(animationToolTrigger, slot.id);
  const chatAnimationState = usePetMessageAnimationQueue(
    latestMessage,
    isTyping,
    slot.modelType,
    slot.modelUrl,
    customModelPresets,
    animationToolTrigger,
    lastReplayableAnimationToolTrigger,
    undefined,
    slot.id,
  );
  const effectiveManualMotionBinding = chatAnimationState.motionBinding ?? manualMotionBinding;
  const effectiveManualExpressionBinding = chatAnimationState.expressionBinding;
  const { manifest: slotContentManifest } = usePetContentManifest(slot.modelUrl);
  const { mergedContentManifest: reactionContentManifest } = useMemo(() => (
    resolvePetRuntimeContentSurface({
      contentManifest: slotContentManifest,
      customModelPresets,
      manualMotionBinding: effectiveManualMotionBinding,
      modelType: slot.modelType,
      modelUrl: slot.modelUrl,
    })
  ), [
    customModelPresets,
    effectiveManualMotionBinding,
    slot.modelType,
    slot.modelUrl,
    slotContentManifest,
  ]);
  const [isMovementInteractionPaused, setIsMovementInteractionPaused] = useState(false);

  useEffect(() => {
    setIsMovementInteractionPaused(false);
  }, [slot.id, slot.modelType]);

  const {
    action: renderAction,
    motionTarget: renderMotionTarget,
    position: renderPosition,
  } = useCompanionPetRuntime({
    activityArea,
    addLog,
    clampCompanionPosition,
    configRef,
    createCompanionRoamTarget,
    draggingCompanionPetIdRef,
    hungerAutoEatStopThreshold,
    hungerTriggerThreshold,
    isMovementPaused,
    manualEatingUntilByPetIdRef,
    onEatScaleBoost,
    onUpdateConfig,
    pauseMovementForInteraction: isMovementInteractionPaused,
    reactionContentManifest,
    reactionExpressionAction: expressionAction,
    satiatedThreshold,
    slot,
  });
  const isDragging = draggingCompanionPetId === slot.id;
  const isLive2DDragFeedbackActive = slot.modelType === 'live2d' && isDragging;
  const effectiveRenderAction = isLive2DDragFeedbackActive ? 'IDLE' : renderAction;
  const effectiveRenderMotionTarget = isLive2DDragFeedbackActive ? null : renderMotionTarget;
  const reactionState = resolvePet2DReactionState({
    action: effectiveRenderAction,
    contentManifest: reactionContentManifest,
    expressionAction,
    isMoving: Boolean(effectiveRenderMotionTarget),
    isTyping,
  });

  useEffect(() => {
    onRenderedPositionChange?.(slot.id, renderPosition);

    return () => {
      onRenderedPositionChange?.(slot.id, null);
    };
  }, [onRenderedPositionChange, renderPosition, slot.id]);

  if (slot.isPrimary || !slot.enabled || !slot.modelVisible) {
    return null;
  }

  return (
    <PetCompanionLayer
      activityCenter={activityCenter}
      dragDelta={companionDragDelta}
      active3DSceneCount={active3DSceneCount}
      avatar3dRuntimeBackend={avatar3dRuntimeBackend}
      customModelPresets={customModelPresets}
      debugClampBounds={debugClampBounds}
      debugCollisionBounds={debugCollisionBounds}
      expressionAction={expressionAction}
      isDragging={isDragging}
      isInteractiveDialogueHidden={isInteractiveDialogueHidden}
      isInteractiveDialogueMode={isInteractiveDialogueMode}
      isSpeaking={isSpeaking}
      isTyping={isTyping}
      interactiveDialoguePosition={interactiveDialoguePosition}
      interactiveDialogueShellSize={interactiveDialogueShellSize}
      latestMessage={latestMessage}
      manualExpressionBinding={effectiveManualExpressionBinding}
      manualMotionBinding={effectiveManualMotionBinding}
      motionOverrideMode={reactionState.motionOverrideState.mode}
      motionTarget={effectiveRenderMotionTarget}
      onMovementPauseChange={setIsMovementInteractionPaused}
      onPetContextMenu={onPetContextMenu}
      onRuntimeEvent={onRuntimeEvent}
      onSelectPet={onSelectPet}
      onStartOverlappedPetDrag={onStartOverlappedPetDrag}
      onStartDrag={onStartDrag}
      onVisualBoundsChange={onVisualBoundsChange}
      onWheelScale={onWheelScale}
      sequenceFrameDurationMultiplier={sequenceFrameDurationMultiplier}
      selectedPetId={selectedPetId}
      slot={{
        ...slot,
        position: renderPosition,
        currentAction: effectiveRenderAction,
      }}
    />
  );
});

CompanionPetRuntimeLayer.displayName = 'CompanionPetRuntimeLayer';
