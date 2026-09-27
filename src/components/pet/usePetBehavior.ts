import {
  useCallback,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import { type PetAction, type PetConfig, type PetConfigUpdateHandler, type PetItemInteractionType } from '../../types';
import { useMainPetMovementController } from '../../pet-runtime/core/useMainPetMovementController';
import { usePetConfigController } from '../../pet-runtime/core/petConfigController';
import { usePetNeedsController } from '../../pet-runtime/core/petNeedsController';
import { type PetRuntimePosition } from '../../pet-runtime/core/petRuntimeTypes';
import {
  usePetDragController,
  type PetFolderDragPreview,
} from '../../pet-runtime/interactions/petDragController';
import { type PetDragVisualPreviewHandler } from '../../pet-runtime/interactions/petDragVisualPreview';
import { usePetScaleController } from '../../pet-runtime/interactions/petScaleController';
import { type DesktopIconInteractionTarget } from './desktopIconTargets';
import { type DesktopMouseInteractionTarget } from './desktopMouseTarget';

type Position = PetRuntimePosition;

export interface UsePetBehaviorOptions {
  addLog: (message: string) => void;
  clampPetPosition: (position: Position) => Position;
  clampToScene: (position: Position, type: 'pet' | 'folder') => Position;
  config: PetConfig;
  configRef: MutableRefObject<PetConfig>;
  createRoamTarget: (from: Position) => Position;
  desktopIconTargets: DesktopIconInteractionTarget[];
  desktopMouseTarget: DesktopMouseInteractionTarget | null;
  hungerAutoEatStopThreshold: number;
  getScenePositionFromViewportPoint: (point: Position) => Position;
  hungerTriggerThreshold: number;
  isReactionMovementPaused: boolean;
  isInteractionMovementPaused: boolean;
  isMovementPaused: boolean;
  maxPetScale: number;
  minPetScale: number;
  onFoodConsumed?: () => void;
  onUpdateConfig: PetConfigUpdateHandler;
  pendingPetConfigSyncRef: MutableRefObject<boolean>;
  petPos: Position;
  petPosRef: MutableRefObject<Position>;
  petEatReachThreshold: number;
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
  setPetPos: Dispatch<SetStateAction<Position>>;
}

export function usePetBehavior({
  addLog,
  clampPetPosition,
  clampToScene,
  config,
  configRef,
  createRoamTarget,
  desktopIconTargets,
  desktopMouseTarget,
  hungerAutoEatStopThreshold,
  getScenePositionFromViewportPoint,
  hungerTriggerThreshold,
  isReactionMovementPaused,
  isInteractionMovementPaused,
  isMovementPaused,
  maxPetScale,
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
}: UsePetBehaviorOptions) {
  const folderDragPreviewRef = useRef<PetFolderDragPreview>(null);
  const clearAutoMoveRef = useRef<(nextAction?: PetAction, syncAction?: boolean) => void>(() => {});
  const {
    updateFolderPosition,
    updatePetAction,
    updatePetPosition,
  } = usePetConfigController({
    configRef,
    onUpdateConfig,
    pendingPetConfigSyncRef,
  });

  const {
    canEatFoodFromPosition,
    canInteractWithFolder,
    eatFolder,
    findNearestFolder,
    foodDriveActiveRef,
    resolveFolderTargetPosition,
    updateStat,
    interactWithFolder,
  } = usePetNeedsController({
    clampPetPosition,
    config,
    configRef,
    folderDragPreviewRef,
    hungerAutoEatStopThreshold,
    hungerTriggerThreshold,
    onFoodConsumed,
    onItemInteraction: (type: PetItemInteractionType) => {
      updatePetAction(type === 'eat' ? 'EATING' : 'HAPPY');
    },
    onUpdateConfig,
    pendingPetConfigSyncRef,
    petEatReachThreshold,
  });

  const { handlePetWheelScale } = usePetScaleController({
    configRef,
    clampPetPosition,
    maxPetScale,
    minPetScale,
    onUpdateConfig,
    petScaleStep,
    petPosRef,
    resolveScaledPetPosition,
    setPetPos,
  });

  const clearAutoMoveForDrag = useCallback((nextAction: PetAction = 'IDLE', syncAction = true) => {
    clearAutoMoveRef.current(nextAction, syncAction);
  }, []);

  const {
    dragState,
    folderDragPreview,
    startFolderDrag,
    startPetDrag,
    isPetDragActive,
    suppressPetClickRef,
  } = usePetDragController({
    addLog,
    clampPetPosition,
    clampToScene,
    clearAutoMove: clearAutoMoveForDrag,
    configRef,
    folderDragPreviewRef,
    getScenePositionFromViewportPoint,
    petPos,
    petPosRef,
    pointerInteractionLockRef,
    onPetDragNativeRegionPreview,
    onPetDragNativeShapeActiveChange,
    onPetDragVisualPreview,
    canInteractWithFolder,
    interactWithFolder,
    setPetPos,
    updateFolderPosition,
    updatePetPosition,
  });

  const {
    clearAutoMove,
    isAutoMoving,
    motionTarget,
    visionTarget,
  } = useMainPetMovementController({
    addLog,
    canEatFoodFromPosition,
    clampPetPosition,
    config,
    configRef,
    createRoamTarget,
    desktopIconTargets,
    desktopMouseTarget,
    dragState,
    eatFolder,
    findNearestFolder,
    foodDriveActiveRef,
    hungerAutoEatStopThreshold,
    hungerTriggerThreshold,
    isReactionMovementPaused,
    isInteractionMovementPaused,
    isMovementPaused,
    pendingPetConfigSyncRef,
    petPosRef,
    resolveFolderTargetPosition,
    satiatedThreshold,
    setPetPos,
    updatePetAction,
    updatePetPosition,
  });

  clearAutoMoveRef.current = clearAutoMove;

  return {
    dragState,
    folderDragPreview,
    handlePetWheelScale,
    isPetDragActive,
    isAutoMoving,
    motionTarget,
    startFolderDrag,
    startPetDrag,
    suppressPetClickRef,
    updateStat,
    visionTarget,
  };
}
