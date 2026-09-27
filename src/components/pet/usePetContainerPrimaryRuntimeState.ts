import { type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { type DesktopPetChatMode, type PetAction, type PetConfig, type PetConfigUpdateHandler } from '../../types';
import { type SelectedCustomMotionBindingMap } from './usePetContainerCustomMotionSelection';
import { usePetContainerActionHandlers } from './usePetContainerActionHandlers';
import { usePrimaryPetRuntime } from './usePrimaryPetRuntime';
import { type DesktopIconInteractionTarget } from './desktopIconTargets';
import { type DesktopMouseInteractionTarget } from './desktopMouseTarget';
import { type PetDragVisualPreviewHandler } from '../../pet-runtime/interactions/petDragVisualPreview';

type Position = { x: number; y: number };

interface UsePetContainerPrimaryRuntimeStateOptions {
  actionOverride?: PetAction | null;
  addLog: (msg: string) => void;
  clampPrimaryPetPosition: (position: Position) => Position;
  clampToScene: (position: Position, type: 'pet' | 'folder') => Position;
  config: PetConfig;
  configRef: MutableRefObject<PetConfig>;
  createPrimaryPetRoamTarget: (from: Position) => Position;
  desktopIconTargets: DesktopIconInteractionTarget[];
  desktopMouseTarget: DesktopMouseInteractionTarget | null;
  effectiveAutoMovementPause: boolean;
  getScenePositionFromViewportPoint: (point: Position) => Position;
  hungerAutoEatStopThreshold: number;
  hungerTriggerThreshold: number;
  isInteractionMovementPaused: boolean;
  isPrimaryTyping: boolean;
  isPrimaryPetMenuMovementLocked: boolean;
  latestMessage: string;
  mainPetMaxScale: number;
  minPetScale: number;
  onFoodConsumed: () => void;
  onSetAction: (action: PetAction) => void;
  onUpdateConfig: PetConfigUpdateHandler;
  openChatPanel: () => void;
  openInteractiveDialogue: () => void;
  openPetActions: () => void;
  openSettingsPanel: (tab: 'personality' | 'motion-expression') => void;
  panelPetId: string;
  pendingPetConfigSyncRef: MutableRefObject<boolean>;
  petEatReachThreshold: number;
  petPos: Position;
  petPosRef: MutableRefObject<Position>;
  petScaleStep: number;
  pointerInteractionLockRef: MutableRefObject<boolean>;
  onPetDragNativeRegionPreview?: (preview: {
    position: Position;
    previousPosition: Position;
  }) => void;
  onPetDragNativeShapeActiveChange?: (active: boolean) => void;
  onPetDragVisualPreview?: PetDragVisualPreviewHandler;
  resolveScaledPetPosition?: (
    currentPosition: Position,
    currentScale: number,
    nextScale: number,
  ) => Position;
  satiatedThreshold: number;
  selectPanelPet: (petId: string) => void;
  setChatMode: (mode: DesktopPetChatMode) => void;
  setPetPos: (position: Position) => void;
  setSelectedCustomMotionByPetId: Dispatch<SetStateAction<SelectedCustomMotionBindingMap>>;
  fallbackPetName: string;
}

export function usePetContainerPrimaryRuntimeState({
  actionOverride = null,
  addLog,
  clampPrimaryPetPosition,
  clampToScene,
  config,
  configRef,
  createPrimaryPetRoamTarget,
  desktopIconTargets,
  desktopMouseTarget,
  effectiveAutoMovementPause,
  getScenePositionFromViewportPoint,
  hungerAutoEatStopThreshold,
  hungerTriggerThreshold,
  isInteractionMovementPaused,
  isPrimaryTyping,
  isPrimaryPetMenuMovementLocked,
  latestMessage,
  mainPetMaxScale,
  minPetScale,
  onFoodConsumed,
  onSetAction,
  onUpdateConfig,
  openChatPanel,
  openInteractiveDialogue,
  openPetActions,
  openSettingsPanel,
  panelPetId,
  pendingPetConfigSyncRef,
  petEatReachThreshold,
  petPos,
  petPosRef,
  petScaleStep,
  pointerInteractionLockRef,
  onPetDragNativeRegionPreview,
  onPetDragNativeShapeActiveChange,
  onPetDragVisualPreview,
  resolveScaledPetPosition,
  satiatedThreshold,
  selectPanelPet,
  setChatMode,
  setPetPos,
  setSelectedCustomMotionByPetId,
  fallbackPetName,
}: UsePetContainerPrimaryRuntimeStateOptions) {
  const primaryRuntimeState = usePrimaryPetRuntime({
    actionOverride,
    addLog,
    clampPetPosition: clampPrimaryPetPosition,
    clampToScene,
    config,
    configRef,
    createRoamTarget: createPrimaryPetRoamTarget,
    desktopIconTargets,
    desktopMouseTarget,
    hungerAutoEatStopThreshold,
    getScenePositionFromViewportPoint,
    hungerTriggerThreshold,
    isInteractionMovementPaused,
    isMovementPaused: !config.autoMovementEnabled || effectiveAutoMovementPause || isPrimaryPetMenuMovementLocked,
    isTyping: isPrimaryTyping,
    latestMessage,
    maxPetScale: mainPetMaxScale,
    minPetScale,
    onFoodConsumed,
    onUpdateConfig,
    pendingPetConfigSyncRef,
    petPos,
    petPosRef,
    petEatReachThreshold,
    petScaleStep,
    pointerInteractionLockRef,
    onPetDragNativeRegionPreview,
    onPetDragNativeShapeActiveChange,
    onPetDragVisualPreview,
    resolveScaledPetPosition,
    satiatedThreshold,
    setPetPos,
  });
  const actionHandlerState = usePetContainerActionHandlers({
    addLog,
    configRef,
    fallbackPetName,
    onSetAction,
    onUpdateConfig,
    openChatPanel,
    openInteractiveDialogue,
    openPetActions,
    openSettingsPanel,
    panelPetId,
    selectPanelPet,
    setChatMode,
    setSelectedCustomMotionByPetId,
    startPetDrag: primaryRuntimeState.startPetDrag,
    suppressPetClickRef: primaryRuntimeState.suppressPetClickRef,
  });

  return {
    ...primaryRuntimeState,
    ...actionHandlerState,
  };
}
