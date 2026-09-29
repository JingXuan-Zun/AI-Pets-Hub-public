import {
  separateOverlappingPetPosition,
  type DirectionalExtents,
  type Position,
} from './petActivityRegionMath';

export type PetCollisionEntry = {
  id: string;
  position: Position;
  bounds: DirectionalExtents;
};

type ClampPetPosition = (
  position: Position,
  petScale: number,
  visualBounds: DirectionalExtents,
) => Position;

interface ResolvePetPositionAgainstCollisionEntriesOptions {
  candidatePosition: Position;
  clampBounds: DirectionalExtents;
  collisionBounds: DirectionalExtents;
  clampPetPosition: ClampPetPosition;
  gap?: number;
  maxPasses?: number;
  otherEntries: PetCollisionEntry[];
  petScale: number;
}

const DEFAULT_COLLISION_RESOLUTION_PASSES = 4;

function arePositionsEqual(left: Position, right: Position) {
  return left.x === right.x && left.y === right.y;
}

function sanitizePassCount(value: number | undefined) {
  if (!Number.isFinite(value)) {
    return DEFAULT_COLLISION_RESOLUTION_PASSES;
  }

  return Math.max(1, Math.round(value));
}

export function resolvePetPositionAgainstCollisionEntries({
  candidatePosition,
  clampBounds,
  collisionBounds,
  clampPetPosition,
  gap = 0,
  maxPasses,
  otherEntries,
  petScale,
}: ResolvePetPositionAgainstCollisionEntriesOptions) {
  let resolvedPosition = clampPetPosition(candidatePosition, petScale, clampBounds);
  if (otherEntries.length === 0) {
    return resolvedPosition;
  }

  const passCount = sanitizePassCount(maxPasses);
  for (let passIndex = 0; passIndex < passCount; passIndex += 1) {
    const passStartPosition = resolvedPosition;
    let nextPosition = resolvedPosition;

    otherEntries.forEach((entry) => {
      nextPosition = separateOverlappingPetPosition(
        nextPosition,
        collisionBounds,
        entry.position,
        entry.bounds,
        gap,
      );
      nextPosition = clampPetPosition(nextPosition, petScale, clampBounds);
    });

    resolvedPosition = nextPosition;
    if (arePositionsEqual(passStartPosition, resolvedPosition)) {
      break;
    }
  }

  return resolvedPosition;
}
