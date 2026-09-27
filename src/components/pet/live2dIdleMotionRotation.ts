import { type PetAction } from '../../types';

const LIVE2D_IDLE_MOTION_ROTATION_MIN_MS = 8500;
const LIVE2D_IDLE_MOTION_ROTATION_RANGE_MS = 4500;

function normalizeRotationIndex(rotationIndex: number, candidateCount: number) {
  if (candidateCount <= 0) {
    return 0;
  }

  const normalizedIndex = Math.trunc(rotationIndex) % candidateCount;
  return normalizedIndex >= 0
    ? normalizedIndex
    : normalizedIndex + candidateCount;
}

function resolveStableHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

export function canRotateLive2DIdleMotion(options: {
  action: PetAction;
  availableCandidateCount: number;
  isMoving: boolean;
  manualMotionActive: boolean;
}) {
  return options.action === 'IDLE'
    && !options.isMoving
    && !options.manualMotionActive
    && options.availableCandidateCount > 1;
}

export function rotateLive2DMotionCandidates(candidates: readonly string[], rotationIndex: number) {
  if (candidates.length <= 1) {
    return [...candidates];
  }

  const normalizedIndex = normalizeRotationIndex(rotationIndex, candidates.length);
  return [
    ...candidates.slice(normalizedIndex),
    ...candidates.slice(0, normalizedIndex),
  ];
}

export function resolveLive2DIdleMotionRotationDelayMs(signature: string, turnIndex: number) {
  return LIVE2D_IDLE_MOTION_ROTATION_MIN_MS
    + (resolveStableHash(`${signature}:${Math.trunc(turnIndex)}`) % LIVE2D_IDLE_MOTION_ROTATION_RANGE_MS);
}
