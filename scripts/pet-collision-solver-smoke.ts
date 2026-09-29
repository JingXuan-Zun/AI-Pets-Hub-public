import assert from 'node:assert/strict';
import {
  clampPositionToActivityAreaBoundsWithExtents,
  type DirectionalExtents,
  type Position,
} from '../src/components/pet/petActivityRegionMath';
import {
  resolvePetPositionAgainstCollisionEntries,
  type PetCollisionEntry,
} from '../src/components/pet/petCollisionSolver';

const activityArea = { width: 240, height: 200 };
const visualBounds: DirectionalExtents = {
  bottom: 20,
  left: 20,
  right: 20,
  top: 20,
};
const collisionBounds: DirectionalExtents = {
  bottom: 18,
  left: 18,
  right: 18,
  top: 18,
};
const primaryEntry: PetCollisionEntry = {
  bounds: collisionBounds,
  id: 'primary',
  position: { x: 0, y: 0 },
};

function clampPetPosition(
  position: Position,
  _petScale: number,
  bounds: DirectionalExtents,
) {
  return clampPositionToActivityAreaBoundsWithExtents(position, activityArea, bounds);
}

assert.deepEqual(
  resolvePetPositionAgainstCollisionEntries({
    candidatePosition: { x: 70, y: 0 },
    clampBounds: visualBounds,
    clampPetPosition,
    collisionBounds,
    otherEntries: [primaryEntry],
    petScale: 1,
  }),
  { x: 70, y: 0 },
  'non-overlapping pets should keep their candidate position',
);

assert.deepEqual(
  resolvePetPositionAgainstCollisionEntries({
    candidatePosition: { x: 0, y: 0 },
    clampBounds: visualBounds,
    clampPetPosition,
    collisionBounds,
    otherEntries: [primaryEntry],
    petScale: 1,
  }),
  { x: 36, y: 0 },
  'overlapping pets should separate along the smallest available axis',
);

assert.deepEqual(
  resolvePetPositionAgainstCollisionEntries({
    candidatePosition: { x: 999, y: 999 },
    clampBounds: visualBounds,
    clampPetPosition,
    collisionBounds,
    otherEntries: [],
    petScale: 1,
  }),
  { x: 100, y: 80 },
  'position resolution should still clamp pets into the activity area',
);

assert.deepEqual(
  resolvePetPositionAgainstCollisionEntries({
    candidatePosition: { x: 0, y: 0 },
    clampBounds: visualBounds,
    clampPetPosition,
    collisionBounds,
    otherEntries: [
      primaryEntry,
      {
        bounds: collisionBounds,
        id: 'companion-b',
        position: { x: 72, y: 0 },
      },
    ],
    petScale: 1,
  }),
  { x: 36, y: 0 },
  'multiple entries should be evaluated without introducing a new overlap',
);

console.log('pet-collision-solver smoke passed');
