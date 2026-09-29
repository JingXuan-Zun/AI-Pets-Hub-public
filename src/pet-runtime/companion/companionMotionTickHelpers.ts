import { type MutableRefObject } from 'react';
import { type DesktopPetSlot } from '../../multiPetRoster';
import { type CompanionPetConfig, type PetAction, type PetConfig } from '../../types';
import { type PetRuntimePosition } from '../core/petRuntimeTypes';
import { type CompanionPlan, type CompanionPositionClamp, measureDistance, resolveUsableRoamTarget } from './companionPetRuntimeUtils';
import {
  completeCompanionPlan,
  resolveBlockedCompanionPlan,
  resolveCompanionPlan,
  resolveCompanionPlanTarget,
} from './companionPetMotionLoopUtils';

interface SyncCompanionEatingStateOptions {
  actionUntil: number;
  actionUntilRef: MutableRefObject<number>;
  commitCompanionUpdates: (
    updates: Partial<Pick<DesktopPetSlot, 'currentAction' | 'position' | 'stats'>>,
  ) => void;
  consecutiveBlockedStepsRef: MutableRefObject<number>;
  manualEatingUntilByPetIdRef?: MutableRefObject<Record<string, number>>;
  now: number;
  pet: CompanionPetConfig;
  setRenderAction: (nextAction: PetAction) => void;
  updateRenderMotionTarget: (nextTarget: PetRuntimePosition | null) => void;
}

interface AdvanceCompanionPlanStepOptions {
  actionUntilRef: MutableRefObject<number>;
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
  currentPosition: PetRuntimePosition;
  deltaSeconds: number;
  hungerTriggerThreshold: number;
  hungryDrive: boolean;
  nextDecisionAtRef: MutableRefObject<number>;
  now: number;
  onEatScaleBoost?: (slotId: string) => void;
  pet: CompanionPetConfig;
  planRef: MutableRefObject<CompanionPlan>;
  satiatedThreshold: number;
  setRenderAction: (nextAction: PetAction) => void;
  setRenderPosition: (nextPosition: PetRuntimePosition) => void;
  updateRenderMotionTarget: (nextTarget: PetRuntimePosition | null) => void;
}

export function syncCompanionEatingState({
  actionUntil,
  actionUntilRef,
  commitCompanionUpdates,
  consecutiveBlockedStepsRef,
  manualEatingUntilByPetIdRef,
  now,
  pet,
  setRenderAction,
  updateRenderMotionTarget,
}: SyncCompanionEatingStateOptions) {
  if (pet.currentAction === 'EATING' && actionUntil > now) {
    updateRenderMotionTarget(null);
    setRenderAction('EATING');
    return true;
  }

  if (pet.currentAction === 'EATING' && actionUntil <= now) {
    actionUntilRef.current = 0;
    consecutiveBlockedStepsRef.current = 0;
    if (manualEatingUntilByPetIdRef?.current[pet.id]) {
      delete manualEatingUntilByPetIdRef.current[pet.id];
    }
    commitCompanionUpdates({ currentAction: 'IDLE' });
    updateRenderMotionTarget(null);
    setRenderAction('IDLE');
    return true;
  }

  return false;
}

export function advanceCompanionPlanStep({
  actionUntilRef,
  activityArea,
  addLog,
  clampCompanionPosition,
  commitCompanionFoodEat,
  commitCompanionUpdates,
  configRef,
  consecutiveBlockedStepsRef,
  createCompanionRoamTarget,
  currentPosition,
  deltaSeconds,
  hungerTriggerThreshold,
  hungryDrive,
  nextDecisionAtRef,
  now,
  onEatScaleBoost,
  pet,
  planRef,
  satiatedThreshold,
  setRenderAction,
  setRenderPosition,
  updateRenderMotionTarget,
}: AdvanceCompanionPlanStepOptions) {
  let plan = planRef.current;

  if (!plan && nextDecisionAtRef.current <= now) {
    plan = resolveCompanionPlan({
      activityArea,
      clampCompanionPosition,
      createCompanionRoamTarget,
      currentPosition,
      folders: configRef.current.folders,
      hungerTriggerThreshold,
      hungryDrive,
      pet,
      satiatedThreshold,
    });
    planRef.current = plan;
    updateRenderMotionTarget(
      plan === null
        ? null
        : resolveCompanionPlanTarget(configRef.current.folders, plan),
    );
    consecutiveBlockedStepsRef.current = 0;
  }

  if (!plan) {
    return;
  }

  const movementTarget = resolveCompanionPlanTarget(configRef.current.folders, plan);
  if (!movementTarget) {
    planRef.current = null;
    updateRenderMotionTarget(null);
    nextDecisionAtRef.current = now + 500;
    consecutiveBlockedStepsRef.current = 0;
    commitCompanionUpdates({ currentAction: 'IDLE' });
    setRenderAction('IDLE');
    return;
  }

  const positionedPet = { ...pet, position: currentPosition };
  const clampedTarget = clampCompanionPosition(movementTarget, positionedPet);
  updateRenderMotionTarget(clampedTarget);

  const dx = clampedTarget.x - currentPosition.x;
  const dy = clampedTarget.y - currentPosition.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const maxStep = Math.max(1, plan.speed * deltaSeconds);

  if (distance <= Math.max(10, maxStep)) {
    const completion = completeCompanionPlan({
      addLog,
      commitCompanionFoodEat,
      commitCompanionUpdates,
      now,
      onEatScaleBoost,
      pet,
      plan,
      satiatedThreshold,
      setRenderAction,
      setRenderPosition,
      targetPosition: clampedTarget,
      updateRenderMotionTarget,
      hungerTriggerThreshold,
      folders: configRef.current.folders,
    });
    actionUntilRef.current = completion.actionUntil;
    planRef.current = null;
    consecutiveBlockedStepsRef.current = 0;
    nextDecisionAtRef.current = completion.nextDecisionAt;
    return;
  }

  const nextPosition = clampCompanionPosition({
    x: currentPosition.x + (dx / distance) * maxStep,
    y: currentPosition.y + (dy / distance) * maxStep,
  }, positionedPet);
  const movedDistance = measureDistance(currentPosition, nextPosition);

  consecutiveBlockedStepsRef.current = movedDistance < 0.5
    ? consecutiveBlockedStepsRef.current + 1
    : 0;

  if (
    consecutiveBlockedStepsRef.current >= 4
    && distance > Math.max(22, maxStep * 1.5)
  ) {
    consecutiveBlockedStepsRef.current = 0;

    const nextPlan = resolveBlockedCompanionPlan({
      activityArea,
      clampCompanionPosition,
      clampedTarget,
      createCompanionRoamTarget,
      currentPosition,
      pet,
      plan,
    });

    if (nextPlan) {
      planRef.current = nextPlan;
      updateRenderMotionTarget(resolveCompanionPlanTarget(configRef.current.folders, nextPlan));
      setRenderAction(nextPlan.action);
      return;
    }

    planRef.current = null;
    updateRenderMotionTarget(null);
    nextDecisionAtRef.current = now + 400;
    setRenderAction('IDLE');
    commitCompanionUpdates({ currentAction: 'IDLE' });
    return;
  }

  setRenderPosition(nextPosition);
  setRenderAction(plan.action);
}
