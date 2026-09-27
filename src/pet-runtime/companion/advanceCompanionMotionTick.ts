import { type MutableRefObject } from 'react';
import { resolvePetMovementDeltaSeconds } from '../../components/pet/petBehaviorMath';
import { type DesktopPetSlot } from '../../multiPetRoster';
import { type CompanionPetConfig, type PetAction, type PetConfig } from '../../types';
import { type PetRuntimePosition } from '../core/petRuntimeTypes';
import { COMPANION_STEP_INTERVAL_MS, type CompanionPlan, type CompanionPositionClamp, resolveUsableRoamTarget } from './companionPetRuntimeUtils';
import { updateCompanionHungryDrive } from './companionPetMotionLoopUtils';
import { advanceCompanionPlanStep, syncCompanionEatingState } from './companionMotionTickHelpers';

interface AdvanceCompanionMotionTickOptions {
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
  consecutiveBlockedStepsRef: MutableRefObject<number>;
  createCompanionRoamTarget?: (pet: CompanionPetConfig) => PetRuntimePosition;
  draggingCompanionPetIdRef?: MutableRefObject<string | null>;
  frameTime: number;
  getLiveCompanionPet: () => CompanionPetConfig | null;
  hungerAutoEatStopThreshold: number;
  hungerTriggerThreshold: number;
  hungryDriveRef: MutableRefObject<boolean>;
  lastStepAtRef: MutableRefObject<number | null>;
  manualEatingUntilByPetIdRef?: MutableRefObject<Record<string, number>>;
  movementPausedRef: MutableRefObject<boolean>;
  nextDecisionAtRef: MutableRefObject<number>;
  onEatScaleBoost?: (slotId: string) => void;
  planRef: MutableRefObject<CompanionPlan>;
  renderPositionRef: MutableRefObject<PetRuntimePosition>;
  resetMotionState: () => void;
  satiatedThreshold: number;
  setRenderAction: (nextAction: PetAction) => void;
  setRenderPosition: (nextPosition: PetRuntimePosition) => void;
  temporarilyMovementPausedRef: MutableRefObject<boolean>;
  updateRenderMotionTarget: (nextTarget: PetRuntimePosition | null) => void;
  actionUntilRef: MutableRefObject<number>;
}

export function advanceCompanionMotionTick({
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
}: AdvanceCompanionMotionTickOptions) {
  const pet = getLiveCompanionPet();
  if (!pet || !pet.enabled || !pet.modelVisible) {
    return;
  }

  if (movementPausedRef.current) {
    resetMotionState();
    setRenderAction('IDLE');
    return;
  }

  if (temporarilyMovementPausedRef.current) {
    lastStepAtRef.current = null;
    return;
  }

  const now = Date.now();
  const deltaSeconds = resolvePetMovementDeltaSeconds(
    lastStepAtRef.current,
    frameTime,
    COMPANION_STEP_INTERVAL_MS,
  );
  lastStepAtRef.current = frameTime;

  if (draggingCompanionPetIdRef?.current === pet.id) {
    updateRenderMotionTarget(null);
    return;
  }

  hungryDriveRef.current = updateCompanionHungryDrive(
    pet.stats.hunger,
    hungerTriggerThreshold,
    hungerAutoEatStopThreshold,
    hungryDriveRef.current,
  );

  const actionUntil = Math.max(
    actionUntilRef.current,
    manualEatingUntilByPetIdRef?.current[pet.id] ?? 0,
  );

  if (syncCompanionEatingState({
    actionUntil,
    actionUntilRef,
    commitCompanionUpdates,
    consecutiveBlockedStepsRef,
    manualEatingUntilByPetIdRef,
    now,
    pet,
    setRenderAction,
    updateRenderMotionTarget,
  })) {
    return;
  }

  advanceCompanionPlanStep({
    actionUntilRef,
    activityArea,
    addLog,
    clampCompanionPosition,
    commitCompanionFoodEat,
    commitCompanionUpdates,
    configRef,
    consecutiveBlockedStepsRef,
    createCompanionRoamTarget,
    currentPosition: renderPositionRef.current,
    deltaSeconds,
    hungerTriggerThreshold,
    hungryDrive: hungryDriveRef.current && configRef.current.folders.length > 0,
    nextDecisionAtRef,
    now,
    onEatScaleBoost,
    pet,
    planRef,
    satiatedThreshold,
    setRenderAction,
    setRenderPosition,
    updateRenderMotionTarget,
  });
}
