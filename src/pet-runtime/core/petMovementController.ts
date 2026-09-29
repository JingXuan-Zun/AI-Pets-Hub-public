import { type PetAction } from '../../types';
import { type DesktopIconInteractionTarget } from '../../components/pet/desktopIconTargets';
import { type DesktopMouseInteractionTarget } from '../../components/pet/desktopMouseTarget';
import { type PetRuntimePosition } from './petRuntimeTypes';

export type MainPetAutoMovePlan =
  | {
      kind: 'food';
      folderId: string;
      action: PetAction;
      speed: number;
    }
  | {
      kind: 'roam';
      target: PetRuntimePosition;
      action: Extract<PetAction, 'WALKING' | 'RUNNING' | 'SWIMMING'>;
      speed: number;
    }
  | {
      kind: 'desktop-icon';
      iconId: string;
      iconName: string;
      target: PetRuntimePosition;
      action: Extract<PetAction, 'WALKING' | 'RUNNING'>;
      speed: number;
    }
  | {
      kind: 'desktop-mouse';
      target: PetRuntimePosition;
      action: Extract<PetAction, 'WALKING' | 'RUNNING'>;
      speed: number;
    }
  | null;

export type MainPetRoamProfile = {
  action: Extract<PetAction, 'WALKING' | 'RUNNING' | 'SWIMMING'>;
  delayMaxMs: number;
  delayMinMs: number;
  label: string;
  speed: number;
};

export function measurePetRuntimeDistance(from: PetRuntimePosition, to: PetRuntimePosition) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function resolveMainPetRoamProfile(
  hunger: number,
  satiatedThreshold: number,
  hungerTriggerThreshold: number,
): MainPetRoamProfile {
  if (hunger < satiatedThreshold) {
    const relaxedProfiles: MainPetRoamProfile[] = [
      { action: 'WALKING', speed: 95, label: '吃饱后开始悠闲散步', delayMinMs: 1800, delayMaxMs: 3400 },
      { action: 'RUNNING', speed: 175, label: '吃饱后开始兴奋奔跑', delayMinMs: 2200, delayMaxMs: 3600 },
      { action: 'SWIMMING', speed: 120, label: '吃饱后开始轻快游动', delayMinMs: 2000, delayMaxMs: 3500 },
    ];

    return relaxedProfiles[Math.floor(Math.random() * relaxedProfiles.length)] ?? relaxedProfiles[0];
  }

  if (hunger < hungerTriggerThreshold) {
    const idleProfiles: MainPetRoamProfile[] = [
      { action: 'WALKING', speed: 88, label: '正在四处活动', delayMinMs: 2200, delayMaxMs: 4200 },
      { action: 'SWIMMING', speed: 108, label: '正在轻轻漂动', delayMinMs: 2400, delayMaxMs: 4400 },
    ];

    return idleProfiles[Math.floor(Math.random() * idleProfiles.length)] ?? idleProfiles[0];
  }

  return {
    action: 'WALKING',
    speed: 112,
    label: '正在一边活动一边找吃的',
    delayMinMs: 1200,
    delayMaxMs: 2600,
  };
}

export function pickMainPetAvoidanceTarget(
  currentPosition: PetRuntimePosition,
  targetPosition: PetRuntimePosition,
  clampPetPosition: (position: PetRuntimePosition) => PetRuntimePosition,
) {
  const dx = targetPosition.x - currentPosition.x;
  const dy = targetPosition.y - currentPosition.y;
  const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
  const unitX = dx / distance;
  const unitY = dy / distance;
  const sideDistance = Math.max(92, Math.min(188, distance * 0.58));
  const forwardDistance = Math.max(24, Math.min(72, distance * 0.2));
  const candidates = [
    clampPetPosition({
      x: currentPosition.x - unitY * sideDistance + unitX * forwardDistance,
      y: currentPosition.y + unitX * sideDistance + unitY * forwardDistance,
    }),
    clampPetPosition({
      x: currentPosition.x + unitY * sideDistance + unitX * forwardDistance,
      y: currentPosition.y - unitX * sideDistance + unitY * forwardDistance,
    }),
    clampPetPosition({
      x: currentPosition.x - unitX * Math.max(64, sideDistance * 0.72),
      y: currentPosition.y - unitY * Math.max(64, sideDistance * 0.72),
    }),
  ];
  let bestCandidate: PetRuntimePosition | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  candidates.forEach((candidate) => {
    const movedDistance = measurePetRuntimeDistance(currentPosition, candidate);
    if (movedDistance < 18) {
      return;
    }

    const remainingDistance = measurePetRuntimeDistance(candidate, targetPosition);
    const score = movedDistance - remainingDistance * 0.12;
    if (score > bestScore) {
      bestScore = score;
      bestCandidate = candidate;
    }
  });

  return bestCandidate;
}

export function resolveUsableMainPetRoamTarget(
  from: PetRuntimePosition,
  clampPetPosition: (position: PetRuntimePosition) => PetRuntimePosition,
  createRoamTarget: (from: PetRuntimePosition) => PetRuntimePosition,
) {
  let fallbackTarget = clampPetPosition(createRoamTarget(from));
  let farthestTarget = fallbackTarget;
  let farthestDistance = measurePetRuntimeDistance(from, fallbackTarget);
  const minimumUsefulDistance = 28;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const nextTarget = clampPetPosition(createRoamTarget(from));
    const nextDistance = measurePetRuntimeDistance(from, nextTarget);

    if (nextDistance > farthestDistance) {
      farthestTarget = nextTarget;
      farthestDistance = nextDistance;
    }

    if (nextDistance >= minimumUsefulDistance) {
      return nextTarget;
    }

    fallbackTarget = nextTarget;
  }

  return farthestDistance > 0 ? farthestTarget : fallbackTarget;
}

export function pickMainPetDesktopIconTarget(
  from: PetRuntimePosition,
  targets: DesktopIconInteractionTarget[],
) {
  if (!targets.length) {
    return null;
  }

  if (Math.random() >= 0.58) {
    return targets[Math.floor(Math.random() * targets.length)] ?? targets[0];
  }

  return targets.reduce<DesktopIconInteractionTarget | null>((closestTarget, target) => {
    if (!closestTarget) {
      return target;
    }

    return measurePetRuntimeDistance(from, target.position) < measurePetRuntimeDistance(from, closestTarget.position)
      ? target
      : closestTarget;
  }, null);
}

export function pickMainPetDesktopMouseTarget(
  from: PetRuntimePosition,
  mouseTarget: DesktopMouseInteractionTarget | null,
  clampPetPosition: (position: PetRuntimePosition) => PetRuntimePosition,
) {
  if (!mouseTarget || Date.now() - mouseTarget.updatedAt > 2500) {
    return null;
  }

  const mousePosition = mouseTarget.position;
  const distance = measurePetRuntimeDistance(from, mousePosition);
  if (distance < 72 || distance > 560) {
    return null;
  }

  if (distance < 128) {
    const avoidanceTarget = pickMainPetAvoidanceTarget(from, mousePosition, clampPetPosition);
    if (!avoidanceTarget) {
      return null;
    }

    return {
      action: 'RUNNING' as const,
      label: 'Primary pet dodging the mouse',
      speed: 172,
      target: avoidanceTarget,
    };
  }

  const dx = mousePosition.x - from.x;
  const dy = mousePosition.y - from.y;
  const safeDistance = Math.max(1, distance);
  const unitX = dx / safeDistance;
  const unitY = dy / safeDistance;
  const side = Math.random() < 0.5 ? -1 : 1;
  const target = clampPetPosition({
    x: mousePosition.x - unitX * 96 - unitY * side * 34,
    y: mousePosition.y - unitY * 96 + unitX * side * 34,
  });

  if (measurePetRuntimeDistance(from, target) < 24) {
    return null;
  }

  return {
    action: 'WALKING' as const,
    label: 'Primary pet curiously following the mouse',
    speed: 118,
    target,
  };
}
