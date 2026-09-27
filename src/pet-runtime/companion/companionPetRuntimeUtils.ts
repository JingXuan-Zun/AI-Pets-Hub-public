import { createRandomPositionInActivityArea } from '../../components/pet/petActivityRegionMath';
import { type CompanionPetConfig, type PetAction } from '../../types';
import { type PetRuntimeActivityArea, type PetRuntimePosition } from '../core/petRuntimeTypes';

export type CompanionPlan =
  | {
      kind: 'food';
      folderId: string;
      action: Extract<PetAction, 'WALKING' | 'RUNNING'>;
      speed: number;
    }
  | {
      kind: 'roam';
      target: PetRuntimePosition;
      action: Extract<PetAction, 'WALKING' | 'RUNNING' | 'SWIMMING'>;
      speed: number;
    }
  | null;

export type CompanionRoamProfile = {
  action: Extract<PetAction, 'WALKING' | 'RUNNING' | 'SWIMMING'>;
  speed: number;
  restMinMs: number;
  restMaxMs: number;
};

export type CompanionPositionClamp = (
  position: PetRuntimePosition,
  pet: CompanionPetConfig,
) => PetRuntimePosition;

interface ResolveUsableRoamTargetOptions {
  activityArea: PetRuntimeActivityArea;
  clampCompanionPosition: CompanionPositionClamp;
  createCompanionRoamTarget?: (pet: CompanionPetConfig) => PetRuntimePosition;
  currentPosition: PetRuntimePosition;
  pet: CompanionPetConfig;
}

export const COMPANION_STEP_INTERVAL_MS = 16;
export const COMPANION_EATING_DURATION_MS = 1600;

export function measureDistance(from: PetRuntimePosition, to: PetRuntimePosition) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function positionsMatch(left: PetRuntimePosition, right: PetRuntimePosition) {
  return left.x === right.x && left.y === right.y;
}

export function resolveRoamProfile(
  hunger: number,
  satiatedThreshold: number,
  hungerTriggerThreshold: number,
): CompanionRoamProfile {
  if (hunger < satiatedThreshold) {
    const profiles = [
      { action: 'WALKING' as const, speed: 72, restMinMs: 900, restMaxMs: 1800 },
      { action: 'SWIMMING' as const, speed: 82, restMinMs: 1100, restMaxMs: 1900 },
    ];

    return profiles[Math.floor(Math.random() * profiles.length)] ?? profiles[0];
  }

  if (hunger < hungerTriggerThreshold) {
    const profiles = [
      { action: 'WALKING' as const, speed: 88, restMinMs: 600, restMaxMs: 1500 },
      { action: 'RUNNING' as const, speed: 112, restMinMs: 800, restMaxMs: 1600 },
    ];

    return profiles[Math.floor(Math.random() * profiles.length)] ?? profiles[0];
  }

  return {
    action: 'WALKING' as const,
    speed: 96,
    restMinMs: 500,
    restMaxMs: 1100,
  };
}

export function createRoamDelayMs(restMinMs: number, restMaxMs: number) {
  return Math.round(restMinMs + Math.random() * Math.max(0, restMaxMs - restMinMs));
}

export function pickCompanionAvoidanceTarget(
  currentPosition: PetRuntimePosition,
  targetPosition: PetRuntimePosition,
  pet: CompanionPetConfig,
  clampCompanionPosition: CompanionPositionClamp,
) {
  const dx = targetPosition.x - currentPosition.x;
  const dy = targetPosition.y - currentPosition.y;
  const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
  const unitX = dx / distance;
  const unitY = dy / distance;
  const sideDistance = Math.max(88, Math.min(176, distance * 0.55));
  const forwardDistance = Math.max(24, Math.min(68, distance * 0.2));
  const candidates = [
    {
      x: currentPosition.x - unitY * sideDistance + unitX * forwardDistance,
      y: currentPosition.y + unitX * sideDistance + unitY * forwardDistance,
    },
    {
      x: currentPosition.x + unitY * sideDistance + unitX * forwardDistance,
      y: currentPosition.y - unitX * sideDistance + unitY * forwardDistance,
    },
    {
      x: currentPosition.x - unitX * Math.max(56, sideDistance * 0.7),
      y: currentPosition.y - unitY * Math.max(56, sideDistance * 0.7),
    },
  ];
  let bestCandidate: PetRuntimePosition | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  candidates.forEach((candidate) => {
    const clampedCandidate = clampCompanionPosition(candidate, pet);
    const movedDistance = measureDistance(currentPosition, clampedCandidate);
    if (movedDistance < 18) {
      return;
    }

    const remainingDistance = measureDistance(clampedCandidate, targetPosition);
    const score = movedDistance - remainingDistance * 0.12;
    if (score > bestScore) {
      bestScore = score;
      bestCandidate = clampedCandidate;
    }
  });

  return bestCandidate;
}

export function resolveUsableRoamTarget({
  activityArea,
  clampCompanionPosition,
  createCompanionRoamTarget,
  currentPosition,
  pet,
}: ResolveUsableRoamTargetOptions) {
  const positionedPet = { ...pet, position: currentPosition };
  const createTarget = () => (
    createCompanionRoamTarget
      ? createCompanionRoamTarget(positionedPet)
      : clampCompanionPosition(
          createRandomPositionInActivityArea(activityArea, 110, 110),
          positionedPet,
        )
  );

  let fallbackTarget = createTarget();
  let farthestTarget = fallbackTarget;
  let farthestDistance = measureDistance(currentPosition, fallbackTarget);

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const nextTarget = createTarget();
    const nextDistance = measureDistance(currentPosition, nextTarget);
    if (nextDistance > farthestDistance) {
      farthestTarget = nextTarget;
      farthestDistance = nextDistance;
    }
    if (nextDistance >= 24) {
      return nextTarget;
    }
    fallbackTarget = nextTarget;
  }

  return farthestDistance > 0 ? farthestTarget : fallbackTarget;
}
