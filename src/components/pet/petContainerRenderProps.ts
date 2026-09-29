import { type ComponentProps } from 'react';
import { type DesktopPetAnimationToolTrigger } from '../../chatState';
import { type PetModelMotionBinding } from '../../types';
import { type AvatarRuntimeEventSummaryByPetId } from '../../pet-runtime/avatar-runtime/avatarRuntimeEventState';
import { type AvatarRuntimeEventListener } from '../../pet-runtime/avatar-runtime/avatarRuntimeEvents';
import { CompanionPetRuntimeLayer } from './CompanionPetRuntimeLayer';
import { PetAvatarLayer } from './PetAvatarLayer';
import {
  createCompanionRuntimeLayerItem,
  resolvePetInteractiveDialogueLayerSurface,
} from './petContainerLayerSurface';
import { PetPanelsLayer } from './PetPanelsLayer';

type PetPanelsLayerProps = ComponentProps<typeof PetPanelsLayer>;
type PetAvatarLayerProps = ComponentProps<typeof PetAvatarLayer>;
type CompanionPetRuntimeLayerProps = ComponentProps<typeof CompanionPetRuntimeLayer>;

type Position = { x: number; y: number };
type SelectedCustomMotionBindingMap = Record<string, PetModelMotionBinding | undefined>;

interface CreatePetPanelsLayerPropsOptions extends Omit<PetPanelsLayerProps, 'isInteractiveDialogueOpen'> {
  isInteractiveDialogueActive: boolean;
}

interface CreatePrimaryPetAvatarLayerPropsOptions extends Omit<
  PetAvatarLayerProps,
  'isInteractiveDialogueHidden' | 'isInteractiveDialogueMode'
> {
  isInteractiveDialogueActive: boolean;
  panelPetId: string;
  primaryPetId: string;
}

interface CreateCompanionRuntimeLayerItemsOptions {
  active3DSceneCount: CompanionPetRuntimeLayerProps['active3DSceneCount'];
  avatar3dRuntimeBackend: CompanionPetRuntimeLayerProps['avatar3dRuntimeBackend'];
  activityArea: CompanionPetRuntimeLayerProps['activityArea'];
  activityCenter: CompanionPetRuntimeLayerProps['activityCenter'];
  addLog: CompanionPetRuntimeLayerProps['addLog'];
  clampCompanionPosition: CompanionPetRuntimeLayerProps['clampCompanionPosition'];
  companionDragDelta: CompanionPetRuntimeLayerProps['companionDragDelta'];
  companionRenderSlots: CompanionPetRuntimeLayerProps['slot'][];
  configRef: CompanionPetRuntimeLayerProps['configRef'];
  createCompanionRoamTarget: CompanionPetRuntimeLayerProps['createCompanionRoamTarget'];
  draggingCompanionPetId: CompanionPetRuntimeLayerProps['draggingCompanionPetId'];
  draggingCompanionPetIdRef: CompanionPetRuntimeLayerProps['draggingCompanionPetIdRef'];
  getScaledCompanionCollisionBounds: (petId: string, currentScale: number, nextScale?: number) => NonNullable<CompanionPetRuntimeLayerProps['debugCollisionBounds']>;
  getScaledCompanionVisualBounds: (petId: string, currentScale: number, nextScale?: number) => NonNullable<CompanionPetRuntimeLayerProps['debugClampBounds']>;
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
  isSpeaking: boolean;
  isTyping: boolean;
  animationToolTriggersByPetId: Record<string, DesktopPetAnimationToolTrigger | undefined>;
  lastReplayableAnimationToolTriggersByPetId: Record<string, DesktopPetAnimationToolTrigger | undefined>;
  latestPetMessages: Record<string, string>;
  manualCompanionEatingUntilByPetIdRef: CompanionPetRuntimeLayerProps['manualEatingUntilByPetIdRef'];
  onUpdateConfig: CompanionPetRuntimeLayerProps['onUpdateConfig'];
  onRuntimeEvent: AvatarRuntimeEventListener;
  onSelectPet: CompanionPetRuntimeLayerProps['onSelectPet'];
  onStartOverlappedPetDrag: CompanionPetRuntimeLayerProps['onStartOverlappedPetDrag'];
  panelPetId: string;
  selectedCustomMotionByPetId: SelectedCustomMotionBindingMap;
  sequenceFrameDurationMultiplier: CompanionPetRuntimeLayerProps['sequenceFrameDurationMultiplier'];
  speakingPetId: string | null;
  isMovementPausedByPetId: (petId: string) => boolean;
  triggerPetEatScaleBoost: CompanionPetRuntimeLayerProps['onEatScaleBoost'];
  typingPetId: string | null;
  satiatedThreshold: CompanionPetRuntimeLayerProps['satiatedThreshold'];
}

export function createPetPanelsLayerProps({
  isInteractiveDialogueActive,
  ...props
}: CreatePetPanelsLayerPropsOptions): PetPanelsLayerProps {
  return {
    ...props,
    isInteractiveDialogueOpen: isInteractiveDialogueActive,
  };
}

export function createPrimaryPetAvatarLayerProps({
  isInteractiveDialogueActive,
  panelPetId,
  primaryPetId,
  ...props
}: CreatePrimaryPetAvatarLayerPropsOptions): PetAvatarLayerProps {
  return {
    ...props,
    ...resolvePetInteractiveDialogueLayerSurface(
      isInteractiveDialogueActive,
      panelPetId,
      primaryPetId,
    ),
  };
}

export function createCompanionRuntimeLayerItems({
  active3DSceneCount,
  avatar3dRuntimeBackend,
  activityArea,
  activityCenter,
  addLog,
  clampCompanionPosition,
  companionDragDelta,
  companionRenderSlots,
  configRef,
  createCompanionRoamTarget,
  draggingCompanionPetId,
  draggingCompanionPetIdRef,
  getScaledCompanionCollisionBounds,
  getScaledCompanionVisualBounds,
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
  isSpeaking,
  isTyping,
  animationToolTriggersByPetId,
  lastReplayableAnimationToolTriggersByPetId,
  isMovementPausedByPetId,
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
  speakingPetId,
  triggerPetEatScaleBoost,
  typingPetId,
}: CreateCompanionRuntimeLayerItemsOptions): CompanionPetRuntimeLayerProps[] {
  return companionRenderSlots.map((slot) => createCompanionRuntimeLayerItem({
    active3DSceneCount,
    avatar3dRuntimeBackend,
    activityArea,
    activityCenter,
    addLog,
    clampCompanionPosition,
    companionDragDelta,
    configRef,
    createCompanionRoamTarget,
    debugClampBounds: getScaledCompanionVisualBounds(slot.id, slot.scale),
    debugCollisionBounds: getScaledCompanionCollisionBounds(slot.id, slot.scale),
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
    animationToolTrigger: animationToolTriggersByPetId[slot.id] ?? null,
    lastReplayableAnimationToolTrigger: lastReplayableAnimationToolTriggersByPetId[slot.id] ?? null,
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
  }));
}
