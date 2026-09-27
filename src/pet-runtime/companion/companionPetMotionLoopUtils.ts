import { type CompanionPetConfig, type PetAction, type PetConfig } from '../../types';
import { type DesktopPetSlot } from '../../multiPetRoster';
import { type PetRuntimePosition } from '../core/petRuntimeTypes';
import {
  COMPANION_EATING_DURATION_MS,
  type CompanionPlan,
  type CompanionPositionClamp,
  createRoamDelayMs,
  measureDistance,
  pickCompanionAvoidanceTarget,
  resolveRoamProfile,
  resolveUsableRoamTarget,
} from './companionPetRuntimeUtils';

interface ResolveCompanionPlanOptions {
  activityArea: Parameters<typeof resolveUsableRoamTarget>[0]['activityArea'];
  clampCompanionPosition: CompanionPositionClamp;
  createCompanionRoamTarget?: (pet: CompanionPetConfig) => PetRuntimePosition;
  currentPosition: PetRuntimePosition;
  folders: PetConfig['folders'];
  hungerTriggerThreshold: number;
  hungryDrive: boolean;
  pet: CompanionPetConfig;
  satiatedThreshold: number;
}

interface CompleteCompanionPlanOptions {
  addLog?: (message: string) => void;
  commitCompanionFoodEat: (
    pet: CompanionPetConfig,
    position: PetRuntimePosition,
    folderId: string,
    nextAction: PetAction,
  ) => void;
  commitCompanionUpdates: (
    updates: Partial<Pick<DesktopPetSlot, 'currentAction' | 'position' | 'stats'>>,
  ) => void;
  now: number;
  onEatScaleBoost?: (slotId: string) => void;
  pet: CompanionPetConfig;
  plan: NonNullable<CompanionPlan>;
  satiatedThreshold: number;
  setRenderAction: (nextAction: PetAction) => void;
  setRenderPosition: (nextPosition: PetRuntimePosition) => void;
  targetPosition: PetRuntimePosition;
  updateRenderMotionTarget: (nextTarget: PetRuntimePosition | null) => void;
  hungerTriggerThreshold: number;
  folders: PetConfig['folders'];
}

interface ResolveBlockedCompanionPlanOptions {
  activityArea: Parameters<typeof resolveUsableRoamTarget>[0]['activityArea'];
  clampCompanionPosition: CompanionPositionClamp;
  clampedTarget: PetRuntimePosition;
  createCompanionRoamTarget?: (pet: CompanionPetConfig) => PetRuntimePosition;
  currentPosition: PetRuntimePosition;
  pet: CompanionPetConfig;
  plan: NonNullable<CompanionPlan>;
}

export function updateCompanionHungryDrive(
  hunger: number,
  hungerTriggerThreshold: number,
  hungerAutoEatStopThreshold: number,
  currentHungryDrive: boolean,
) {
  if (hunger >= hungerTriggerThreshold) {
    return true;
  }

  if (hunger < hungerAutoEatStopThreshold) {
    return false;
  }

  return currentHungryDrive;
}

export function resolveCompanionPlan({
  activityArea,
  clampCompanionPosition,
  createCompanionRoamTarget,
  currentPosition,
  folders,
  hungerTriggerThreshold,
  hungryDrive,
  pet,
  satiatedThreshold,
}: ResolveCompanionPlanOptions): CompanionPlan {
  if (hungryDrive && folders.length > 0) {
    const nearestFood = folders.reduce<(typeof folders)[number] | null>((nearest, folder) => {
      if (!nearest) {
        return folder;
      }

      const nearestDistance = measureDistance(currentPosition, nearest.position);
      const nextDistance = measureDistance(currentPosition, folder.position);
      return nextDistance < nearestDistance ? folder : nearest;
    }, null);

    if (nearestFood) {
      return {
        kind: 'food',
        folderId: nearestFood.id,
        action: pet.stats.hunger >= 92 ? 'RUNNING' : 'WALKING',
        speed: pet.stats.hunger >= 92 ? 148 : 112,
      };
    }
  }

  const roamProfile = resolveRoamProfile(
    pet.stats.hunger,
    satiatedThreshold,
    hungerTriggerThreshold,
  );
  const roamTarget = resolveUsableRoamTarget({
    activityArea,
    clampCompanionPosition,
    createCompanionRoamTarget,
    currentPosition,
    pet,
  });

  return {
    kind: 'roam',
    target: roamTarget,
    action: roamProfile.action,
    speed: roamProfile.speed,
  };
}

export function resolveCompanionPlanTarget(
  folders: PetConfig['folders'],
  plan: NonNullable<CompanionPlan>,
) {
  return plan.kind === 'food'
    ? folders.find((folder) => folder.id === plan.folderId)?.position ?? null
    : plan.target;
}

export function completeCompanionPlan({
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
  targetPosition,
  updateRenderMotionTarget,
  hungerTriggerThreshold,
  folders,
}: CompleteCompanionPlanOptions) {
  setRenderPosition(targetPosition);

  if (plan.kind === 'food') {
    const targetFood = folders.find((folder) => folder.id === plan.folderId);
    if (targetFood) {
      const roamProfile = resolveRoamProfile(
        pet.stats.hunger,
        satiatedThreshold,
        hungerTriggerThreshold,
      );
      commitCompanionFoodEat(pet, targetPosition, plan.folderId, 'EATING');
      onEatScaleBoost?.(pet.id);
      updateRenderMotionTarget(null);
      setRenderAction('EATING');
      addLog?.(`${pet.personality.name} 吃掉了 ${targetFood.name}`);
      return {
        actionUntil: now + COMPANION_EATING_DURATION_MS,
        nextDecisionAt: now + createRoamDelayMs(roamProfile.restMinMs, roamProfile.restMaxMs),
      };
    }
  }

  commitCompanionUpdates({
    position: targetPosition,
    currentAction: 'IDLE',
  });
  updateRenderMotionTarget(null);
  setRenderAction('IDLE');

  const roamProfile = resolveRoamProfile(
    pet.stats.hunger,
    satiatedThreshold,
    hungerTriggerThreshold,
  );
  return {
    actionUntil: 0,
    nextDecisionAt: now + createRoamDelayMs(roamProfile.restMinMs, roamProfile.restMaxMs),
  };
}

export function resolveBlockedCompanionPlan({
  activityArea,
  clampCompanionPosition,
  clampedTarget,
  createCompanionRoamTarget,
  currentPosition,
  pet,
  plan,
}: ResolveBlockedCompanionPlanOptions): CompanionPlan {
  if (plan.kind === 'roam') {
    const replacementTarget = resolveUsableRoamTarget({
      activityArea,
      clampCompanionPosition,
      createCompanionRoamTarget,
      currentPosition,
      pet,
    });

    if (measureDistance(currentPosition, replacementTarget) > measureDistance(currentPosition, clampedTarget)) {
      return {
        ...plan,
        target: replacementTarget,
      };
    }
  }

  const avoidanceTarget = pickCompanionAvoidanceTarget(
    currentPosition,
    clampedTarget,
    { ...pet, position: currentPosition },
    clampCompanionPosition,
  );

  if (avoidanceTarget) {
    return {
      kind: 'roam',
      target: avoidanceTarget,
      action: 'WALKING',
      speed: Math.max(82, plan.speed * 0.84),
    };
  }

  return null;
}
