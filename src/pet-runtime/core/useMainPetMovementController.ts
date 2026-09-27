import { useCallback, useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { type FolderItem, type PetAction, type PetConfig } from '../../types';
import { type DesktopIconInteractionTarget } from '../../components/pet/desktopIconTargets';
import { type DesktopMouseInteractionTarget } from '../../components/pet/desktopMouseTarget';
import { type PetDragState } from '../interactions/petDragController';
import {
  type MainPetAutoMovePlan,
  resolveUsableMainPetRoamTarget,
} from './petMovementController';
import { usePetRuntimeStore } from './petRuntimeStore';
import { useMainPetAutonomyController } from './useMainPetAutonomyController';
import { useMainPetMovementStepper } from './useMainPetMovementStepper';
import { useMainPetVisionController } from './useMainPetVisionController';
import { type PetRuntimePosition } from './petRuntimeTypes';

interface UseMainPetMovementControllerOptions {
  addLog: (message: string) => void;
  canEatFoodFromPosition: (position: PetRuntimePosition, foodPosition: PetRuntimePosition) => boolean;
  clampPetPosition: (position: PetRuntimePosition) => PetRuntimePosition;
  config: PetConfig;
  configRef: MutableRefObject<PetConfig>;
  createRoamTarget: (from: PetRuntimePosition) => PetRuntimePosition;
  desktopIconTargets: DesktopIconInteractionTarget[];
  desktopMouseTarget: DesktopMouseInteractionTarget | null;
  dragState: PetDragState;
  eatFolder: (folder: FolderItem, positionOverride?: PetRuntimePosition) => void;
  findNearestFolder: (from: PetRuntimePosition) => FolderItem | null;
  foodDriveActiveRef: MutableRefObject<boolean>;
  hungerAutoEatStopThreshold: number;
  hungerTriggerThreshold: number;
  isReactionMovementPaused: boolean;
  isInteractionMovementPaused: boolean;
  isMovementPaused: boolean;
  pendingPetConfigSyncRef: MutableRefObject<boolean>;
  petPosRef: MutableRefObject<PetRuntimePosition>;
  resolveFolderTargetPosition: (folderId: string, fallbackPosition: PetRuntimePosition) => PetRuntimePosition;
  satiatedThreshold: number;
  setPetPos: Dispatch<SetStateAction<PetRuntimePosition>>;
  updatePetAction: (action: PetAction) => void;
  updatePetPosition: (position: PetRuntimePosition) => void;
}

export function useMainPetMovementController({
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
}: UseMainPetMovementControllerOptions) {
  const autoMovePlanRef = useRef<MainPetAutoMovePlan>(null);
  const autoMoveTickUnsubscribeRef = useRef<(() => void) | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const consecutiveBlockedStepsRef = useRef(0);
  const movementPausedRef = useRef(isMovementPaused);
  const isTemporarilyMovementPaused = isReactionMovementPaused || isInteractionMovementPaused;
  const temporarilyMovementPausedRef = useRef(isTemporarilyMovementPaused);
  const {
    isAutoMoving,
    motionTarget,
    resetMovementSyncState,
    setIsAutoMoving,
    setVisionTarget,
    syncPetPositionDuringMovement,
    syncRenderedPetPositionDuringMovement,
    updateMotionTarget,
    visionTarget,
  } = usePetRuntimeStore({
    clampPetPosition,
    configPosition: config.position,
    configRef,
    dragState,
    pendingPetConfigSyncRef,
    petPosRef,
    setPetPos,
    updatePetPosition,
  });

  const resolveUsableRoamTarget = useCallback((from: PetRuntimePosition) => (
    resolveUsableMainPetRoamTarget(from, clampPetPosition, createRoamTarget)
  ), [clampPetPosition, createRoamTarget]);

  const clearAutoMove = useCallback((nextAction: PetAction = 'IDLE', syncAction = true) => {
    autoMovePlanRef.current = null;
    updateMotionTarget(null);
    setIsAutoMoving(false);
    resetMovementSyncState();
    consecutiveBlockedStepsRef.current = 0;
    lastFrameTimeRef.current = null;
    if (autoMoveTickUnsubscribeRef.current) {
      autoMoveTickUnsubscribeRef.current();
      autoMoveTickUnsubscribeRef.current = null;
    }
    if (syncAction) {
      updatePetAction(nextAction);
    }
  }, [resetMovementSyncState, setIsAutoMoving, updateMotionTarget, updatePetAction]);

  const startAutoMove = useCallback((plan: Exclude<MainPetAutoMovePlan, null>, target: PetRuntimePosition, logMessage?: string) => {
    autoMovePlanRef.current = plan;
    resetMovementSyncState();
    consecutiveBlockedStepsRef.current = 0;
    lastFrameTimeRef.current = null;
    updateMotionTarget(target);
    setIsAutoMoving(true);
    updatePetAction(plan.action);
    if (logMessage) {
      addLog(logMessage);
    }
  }, [addLog, resetMovementSyncState, setIsAutoMoving, updateMotionTarget, updatePetAction]);

  useEffect(() => {
    movementPausedRef.current = isMovementPaused;
    temporarilyMovementPausedRef.current = isTemporarilyMovementPaused;
  }, [isMovementPaused, isTemporarilyMovementPaused]);

  useEffect(() => {
    if (!isMovementPaused) {
      return;
    }

    const frozenPosition = petPosRef.current;
    if (
      configRef.current.position.x !== frozenPosition.x
      || configRef.current.position.y !== frozenPosition.y
    ) {
      updatePetPosition(frozenPosition);
    }

    if (isAutoMoving || autoMovePlanRef.current) {
      clearAutoMove('IDLE');
    }
  }, [clearAutoMove, configRef, isAutoMoving, isMovementPaused, petPosRef, updatePetPosition]);

  useMainPetVisionController({
    isAutoMoving,
    setVisionTarget,
  });

  useMainPetAutonomyController({
    autoMovePlanRef,
    clearAutoMove,
    config,
    configRef,
    clampPetPosition,
    desktopIconTargets,
    desktopMouseTarget,
    dragState,
    findNearestFolder,
    foodDriveActiveRef,
    hungerAutoEatStopThreshold,
    hungerTriggerThreshold,
    isAutoMoving,
    isMovementPaused,
    isTemporarilyMovementPaused,
    petPosRef,
    resolveFolderTargetPosition,
    resolveUsableRoamTarget,
    satiatedThreshold,
    startAutoMove,
    updateMotionTarget,
  });

  useMainPetMovementStepper({
    autoMovePlanRef,
    autoMoveTickUnsubscribeRef,
    canEatFoodFromPosition,
    clampPetPosition,
    clearAutoMove,
    configRef,
    consecutiveBlockedStepsRef,
    eatFolder,
    isAutoMoving,
    isMovementPaused,
    isTemporarilyMovementPaused,
    lastFrameTimeRef,
    movementPausedRef,
    petPosRef,
    resolveFolderTargetPosition,
    resolveUsableRoamTarget,
    syncPetPositionDuringMovement,
    syncRenderedPetPositionDuringMovement,
    temporarilyMovementPausedRef,
    updateMotionTarget,
    updatePetAction,
    updatePetPosition,
  });

  return {
    clearAutoMove,
    isAutoMoving,
    motionTarget,
    visionTarget,
  };
}
