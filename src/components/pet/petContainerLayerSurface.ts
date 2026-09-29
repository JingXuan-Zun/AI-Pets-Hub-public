import { type ComponentProps } from 'react';
import { type PetModelMotionBinding } from '../../types';
import { CompanionPetRuntimeLayer } from './CompanionPetRuntimeLayer';

type CompanionPetRuntimeLayerProps = ComponentProps<typeof CompanionPetRuntimeLayer>;
type SelectedCustomMotionBindingMap = Record<string, PetModelMotionBinding | undefined>;

type PetInteractiveDialogueLayerSurface = {
  isInteractiveDialogueHidden: boolean;
  isInteractiveDialogueMode: boolean;
};

type CreateCompanionRuntimeLayerItemOptions = {
  active3DSceneCount: CompanionPetRuntimeLayerProps['active3DSceneCount'];
  avatar3dRuntimeBackend: CompanionPetRuntimeLayerProps['avatar3dRuntimeBackend'];
  activityArea: CompanionPetRuntimeLayerProps['activityArea'];
  activityCenter: CompanionPetRuntimeLayerProps['activityCenter'];
  addLog: CompanionPetRuntimeLayerProps['addLog'];
  clampCompanionPosition: CompanionPetRuntimeLayerProps['clampCompanionPosition'];
  companionDragDelta: CompanionPetRuntimeLayerProps['companionDragDelta'];
  configRef: CompanionPetRuntimeLayerProps['configRef'];
  createCompanionRoamTarget: CompanionPetRuntimeLayerProps['createCompanionRoamTarget'];
  debugClampBounds: CompanionPetRuntimeLayerProps['debugClampBounds'];
  debugCollisionBounds: CompanionPetRuntimeLayerProps['debugCollisionBounds'];
  draggingCompanionPetId: CompanionPetRuntimeLayerProps['draggingCompanionPetId'];
  draggingCompanionPetIdRef: CompanionPetRuntimeLayerProps['draggingCompanionPetIdRef'];
  handleCompanionPetContextMenu: CompanionPetRuntimeLayerProps['onPetContextMenu'];
  handleCompanionRenderedPositionChange: CompanionPetRuntimeLayerProps['onRenderedPositionChange'];
  handleCompanionVisualBoundsChange: CompanionPetRuntimeLayerProps['onVisualBoundsChange'];
  handleCompanionWheelScale: CompanionPetRuntimeLayerProps['onWheelScale'];
  handleStartCompanionPetDrag: CompanionPetRuntimeLayerProps['onStartDrag'];
  hungerAutoEatStopThreshold: CompanionPetRuntimeLayerProps['hungerAutoEatStopThreshold'];
  hungerTriggerThreshold: CompanionPetRuntimeLayerProps['hungerTriggerThreshold'];
  interactiveDialoguePosition: CompanionPetRuntimeLayerProps['interactiveDialoguePosition'];
  interactiveDialogueShellSize: CompanionPetRuntimeLayerProps['interactiveDialogueShellSize'];
  isInteractiveDialogueActive: boolean;
  isMovementPausedByPetId: (petId: string) => boolean;
  isSpeaking: boolean;
  isTyping: boolean;
  animationToolTrigger: CompanionPetRuntimeLayerProps['animationToolTrigger'];
  lastReplayableAnimationToolTrigger: CompanionPetRuntimeLayerProps['lastReplayableAnimationToolTrigger'];
  latestPetMessages: Record<string, string>;
  manualCompanionEatingUntilByPetIdRef: CompanionPetRuntimeLayerProps['manualEatingUntilByPetIdRef'];
  onUpdateConfig: CompanionPetRuntimeLayerProps['onUpdateConfig'];
  onRuntimeEvent: CompanionPetRuntimeLayerProps['onRuntimeEvent'];
  onSelectPet: CompanionPetRuntimeLayerProps['onSelectPet'];
  onStartOverlappedPetDrag: CompanionPetRuntimeLayerProps['onStartOverlappedPetDrag'];
  panelPetId: string;
  satiatedThreshold: CompanionPetRuntimeLayerProps['satiatedThreshold'];
  selectedCustomMotionByPetId: SelectedCustomMotionBindingMap;
  sequenceFrameDurationMultiplier: CompanionPetRuntimeLayerProps['sequenceFrameDurationMultiplier'];
  slot: CompanionPetRuntimeLayerProps['slot'];
  speakingPetId: string | null;
  triggerPetEatScaleBoost: CompanionPetRuntimeLayerProps['onEatScaleBoost'];
  typingPetId: string | null;
};

export function resolvePetInteractiveDialogueLayerSurface(
  isInteractiveDialogueActive: boolean,
  panelPetId: string,
  targetPetId: string,
): PetInteractiveDialogueLayerSurface {
  return {
    isInteractiveDialogueHidden: isInteractiveDialogueActive && panelPetId !== targetPetId,
    isInteractiveDialogueMode: isInteractiveDialogueActive && panelPetId === targetPetId,
  };
}

export function createCompanionRuntimeLayerItem({
  active3DSceneCount,
  avatar3dRuntimeBackend,
  activityArea,
  activityCenter,
  addLog,
  clampCompanionPosition,
  companionDragDelta,
  configRef,
  createCompanionRoamTarget,
  debugClampBounds,
  debugCollisionBounds,
  draggingCompanionPetId,
  draggingCompanionPetIdRef,
  handleCompanionPetContextMenu,
  handleCompanionRenderedPositionChange,
  handleCompanionVisualBoundsChange,
  handleCompanionWheelScale,
  handleStartCompanionPetDrag,
  hungerAutoEatStopThreshold,
  hungerTriggerThreshold,
  interactiveDialoguePosition,
  interactiveDialogueShellSize,
  isInteractiveDialogueActive,
  isMovementPausedByPetId,
  isSpeaking,
  isTyping,
  animationToolTrigger,
  lastReplayableAnimationToolTrigger,
  latestPetMessages,
  manualCompanionEatingUntilByPetIdRef,
  onUpdateConfig,
  onRuntimeEvent,
  onSelectPet,
  onStartOverlappedPetDrag,
  panelPetId,
  satiatedThreshold,
  selectedCustomMotionByPetId,
  sequenceFrameDurationMultiplier,
  slot,
  speakingPetId,
  triggerPetEatScaleBoost,
  typingPetId,
}: CreateCompanionRuntimeLayerItemOptions): CompanionPetRuntimeLayerProps {
  return {
    active3DSceneCount,
    avatar3dRuntimeBackend,
    activityArea,
    activityCenter,
    addLog,
    clampCompanionPosition,
    companionDragDelta,
    configRef,
    createCompanionRoamTarget,
    debugClampBounds,
    debugCollisionBounds,
    draggingCompanionPetId,
    draggingCompanionPetIdRef,
    hungerAutoEatStopThreshold,
    hungerTriggerThreshold,
    interactiveDialoguePosition,
    interactiveDialogueShellSize,
    isMovementPaused: isMovementPausedByPetId(slot.id),
    isSpeaking: isSpeaking && speakingPetId === slot.id,
    isTyping: isTyping && typingPetId === slot.id,
    animationToolTrigger,
    lastReplayableAnimationToolTrigger,
    latestMessage: latestPetMessages[slot.id] ?? '',
    manualMotionBinding: selectedCustomMotionByPetId[slot.id] ?? null,
    manualEatingUntilByPetIdRef: manualCompanionEatingUntilByPetIdRef,
    onEatScaleBoost: triggerPetEatScaleBoost,
    onPetContextMenu: handleCompanionPetContextMenu,
    onRenderedPositionChange: handleCompanionRenderedPositionChange,
    onRuntimeEvent,
    onSelectPet,
    onStartOverlappedPetDrag,
    onStartDrag: handleStartCompanionPetDrag,
    onUpdateConfig,
    onVisualBoundsChange: handleCompanionVisualBoundsChange,
    onWheelScale: handleCompanionWheelScale,
    sequenceFrameDurationMultiplier,
    selectedPetId: panelPetId,
    satiatedThreshold,
    slot,
    ...resolvePetInteractiveDialogueLayerSurface(
      isInteractiveDialogueActive,
      panelPetId,
      slot.id,
    ),
  };
}
