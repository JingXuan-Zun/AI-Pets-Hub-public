import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import { subscribeSharedAnimationTick } from '../../components/pet/sharedAnimationTicker';
import { applyDesktopPetSlotChanges, type DesktopPetSlot } from '../../multiPetRoster';
import { type CompanionPetConfig, type PetAction, type PetConfig } from '../../types';
import { type PetRuntimePosition } from '../core/petRuntimeTypes';
import { type CompanionPlan, type CompanionPositionClamp, resolveUsableRoamTarget } from './companionPetRuntimeUtils';
import { advanceCompanionMotionTick } from './advanceCompanionMotionTick';

const COMPANION_LIVE_SYNC_INTERVAL_MS = 140;
const COMPANION_LIVE_SYNC_DISTANCE = 28;

function areRuntimePositionsEqual(
  left: PetRuntimePosition | null | undefined,
  right: PetRuntimePosition | null | undefined,
) {
  return Boolean(
    left
    && right
    && left.x === right.x
    && left.y === right.y,
  );
}

function shouldSyncCompanionLivePosition({
  lastSyncedAt,
  lastSyncedPosition,
  nextPosition,
  timestamp,
}: {
  lastSyncedAt: number;
  lastSyncedPosition: PetRuntimePosition | null;
  nextPosition: PetRuntimePosition;
  timestamp: number;
}) {
  if ((timestamp - lastSyncedAt) >= COMPANION_LIVE_SYNC_INTERVAL_MS) {
    return true;
  }

  if (!lastSyncedPosition) {
    return true;
  }

  const deltaX = nextPosition.x - lastSyncedPosition.x;
  const deltaY = nextPosition.y - lastSyncedPosition.y;
  return Math.sqrt(deltaX * deltaX + deltaY * deltaY) >= COMPANION_LIVE_SYNC_DISTANCE;
}

interface UseCompanionPetMotionControllerOptions {
  activityArea: Parameters<typeof resolveUsableRoamTarget>[0]['activityArea'];
  addLog?: (message: string) => void;
  clampCompanionPosition: CompanionPositionClamp;
  commitCompanionFoodEat: (
    pet: CompanionPetConfig,
    position: PetRuntimePosition,
    folderId: string,
    nextAction: PetAction,
  ) => void;
  commitCompanionUpdates: (
    updates: Partial<Pick<DesktopPetSlot, 'currentAction' | 'position' | 'stats'>>,
  ) => void;
  configRef: MutableRefObject<PetConfig>;
  createCompanionRoamTarget?: (pet: CompanionPetConfig) => PetRuntimePosition;
  draggingCompanionPetIdRef?: MutableRefObject<string | null>;
  getLiveCompanionPet: () => CompanionPetConfig | null;
  hungerAutoEatStopThreshold: number;
  hungerTriggerThreshold: number;
  isMovementPaused: boolean;
  isTemporarilyMovementPaused: boolean;
  manualEatingUntilByPetIdRef?: MutableRefObject<Record<string, number>>;
  movementPausedRef: MutableRefObject<boolean>;
  onEatScaleBoost?: (slotId: string) => void;
  renderPositionRef: MutableRefObject<PetRuntimePosition>;
  satiatedThreshold: number;
  setRenderAction: (nextAction: PetAction) => void;
  setRenderPosition: (nextPosition: PetRuntimePosition) => void;
  slot: DesktopPetSlot;
  temporarilyMovementPausedRef: MutableRefObject<boolean>;
  updateRenderMotionTarget: (nextTarget: PetRuntimePosition | null) => void;
}

export function useCompanionPetMotionController({
  activityArea,
  addLog,
  clampCompanionPosition,
  commitCompanionFoodEat,
  commitCompanionUpdates,
  configRef,
  createCompanionRoamTarget,
  draggingCompanionPetIdRef,
  getLiveCompanionPet,
  hungerAutoEatStopThreshold,
  hungerTriggerThreshold,
  isMovementPaused,
  isTemporarilyMovementPaused,
  manualEatingUntilByPetIdRef,
  movementPausedRef,
  onEatScaleBoost,
  renderPositionRef,
  satiatedThreshold,
  setRenderAction,
  setRenderPosition,
  slot,
  temporarilyMovementPausedRef,
  updateRenderMotionTarget,
}: UseCompanionPetMotionControllerOptions) {
  const planRef = useRef<CompanionPlan>(null);
  const nextDecisionAtRef = useRef(0);
  const actionUntilRef = useRef(0);
  const hungryDriveRef = useRef(false);
  const consecutiveBlockedStepsRef = useRef(0);
  const lastStepAtRef = useRef<number | null>(null);
  const lastLivePositionSyncAtRef = useRef(0);
  const lastLivePositionSyncPosRef = useRef<PetRuntimePosition | null>(null);

  const resetMotionState = useCallback(() => {
    planRef.current = null;
    nextDecisionAtRef.current = 0;
    actionUntilRef.current = 0;
    consecutiveBlockedStepsRef.current = 0;
    lastStepAtRef.current = null;
    lastLivePositionSyncAtRef.current = 0;
    lastLivePositionSyncPosRef.current = null;
    updateRenderMotionTarget(null);
  }, [updateRenderMotionTarget]);

  useEffect(() => {
    lastStepAtRef.current = null;
    lastLivePositionSyncAtRef.current = 0;
    lastLivePositionSyncPosRef.current = null;
  }, [slot.id]);

  useEffect(() => {
    lastStepAtRef.current = null;
  }, [isTemporarilyMovementPaused]);

  useEffect(() => {
    const pet = getLiveCompanionPet();
    if (!pet) {
      return;
    }

    const isCurrentPetDragging = draggingCompanionPetIdRef?.current === slot.id;
    const targetPosition = isCurrentPetDragging ? slot.position : pet.position;
    const targetAction = isCurrentPetDragging ? slot.currentAction : pet.currentAction;

    if (!planRef.current || isCurrentPetDragging) {
      setRenderPosition(targetPosition);
      setRenderAction(targetAction);
      if (isCurrentPetDragging) {
        updateRenderMotionTarget(null);
      }
    }
  }, [
    draggingCompanionPetIdRef,
    getLiveCompanionPet,
    setRenderAction,
    setRenderPosition,
    slot.currentAction,
    slot.id,
    slot.position.x,
    slot.position.y,
    updateRenderMotionTarget,
  ]);

  useEffect(() => {
    if (isMovementPaused) {
      const frozenPosition = renderPositionRef.current;
      const livePet = getLiveCompanionPet();
      if (
        livePet
        && (
          livePet.position.x !== frozenPosition.x
          || livePet.position.y !== frozenPosition.y
        )
      ) {
        commitCompanionUpdates({ position: frozenPosition });
      }
      resetMotionState();
      setRenderAction('IDLE');
      return;
    }

    const unsubscribe = subscribeSharedAnimationTick((frameTime) => {
      const previousRenderPosition = renderPositionRef.current;

      advanceCompanionMotionTick({
        activityArea,
        addLog,
        clampCompanionPosition,
        commitCompanionFoodEat,
        commitCompanionUpdates,
        configRef,
        consecutiveBlockedStepsRef,
        createCompanionRoamTarget,
        draggingCompanionPetIdRef,
        frameTime,
        getLiveCompanionPet,
        hungerAutoEatStopThreshold,
        hungerTriggerThreshold,
        hungryDriveRef,
        lastStepAtRef,
        manualEatingUntilByPetIdRef,
        movementPausedRef,
        nextDecisionAtRef,
        onEatScaleBoost,
        planRef,
        renderPositionRef,
        resetMotionState,
        satiatedThreshold,
        setRenderAction,
        setRenderPosition,
        temporarilyMovementPausedRef,
        updateRenderMotionTarget,
        actionUntilRef,
      });

      const nextRenderPosition = renderPositionRef.current;
      if (
        areRuntimePositionsEqual(previousRenderPosition, nextRenderPosition)
        || draggingCompanionPetIdRef?.current === slot.id
        || !shouldSyncCompanionLivePosition({
          lastSyncedAt: lastLivePositionSyncAtRef.current,
          lastSyncedPosition: lastLivePositionSyncPosRef.current,
          nextPosition: nextRenderPosition,
          timestamp: frameTime,
        })
      ) {
        return;
      }

      const livePet = getLiveCompanionPet();
      if (
        !livePet
        || areRuntimePositionsEqual(livePet.position, nextRenderPosition)
      ) {
        lastLivePositionSyncAtRef.current = frameTime;
        lastLivePositionSyncPosRef.current = nextRenderPosition;
        return;
      }

      lastLivePositionSyncAtRef.current = frameTime;
      lastLivePositionSyncPosRef.current = nextRenderPosition;
      configRef.current = applyDesktopPetSlotChanges(configRef.current, slot.id, {
        position: nextRenderPosition,
      });
    });

    return () => {
      unsubscribe();
      lastStepAtRef.current = null;
    };
  }, [
    activityArea,
    addLog,
    clampCompanionPosition,
    commitCompanionFoodEat,
    commitCompanionUpdates,
    configRef,
    createCompanionRoamTarget,
    draggingCompanionPetIdRef,
    getLiveCompanionPet,
    hungerAutoEatStopThreshold,
    hungerTriggerThreshold,
    isMovementPaused,
    manualEatingUntilByPetIdRef,
    movementPausedRef,
    onEatScaleBoost,
    renderPositionRef,
    resetMotionState,
    satiatedThreshold,
    setRenderAction,
    setRenderPosition,
    temporarilyMovementPausedRef,
    updateRenderMotionTarget,
  ]);
}
