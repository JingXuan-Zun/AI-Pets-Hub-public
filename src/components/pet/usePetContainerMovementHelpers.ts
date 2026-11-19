import { useCallback, type MutableRefObject } from 'react';
import { PRIMARY_DESKTOP_PET_SLOT_ID, isPrimaryDesktopPetShown } from '../../multiPetRoster';
import { type PetConfig } from '../../types';
import { createRoamTargetInActivityArea } from './petBehaviorMath';
import { type DirectionalExtents } from './petActivityRegionMath';
import {
  resolvePetPositionAgainstCollisionEntries,
  type PetCollisionEntry,
} from './petCollisionSolver';

type Position = { x: number; y: number };
type CompanionPetLike = { id: string; position: Position; scale: number };

interface UsePetContainerMovementHelpersOptions {
  activityArea: { width: number; height: number };
  clampPrimaryPetToAllowedAreaWithMetrics: (
    position: Position,
    petScale: number,
    visualBounds: DirectionalExtents,
  ) => Position;
  clampPetToRenderedActivityAreaWithMetrics: (
    position: Position,
    petScale: number,
    visualBounds: DirectionalExtents,
  ) => Position;
  configRef: MutableRefObject<PetConfig>;
  /** Where each other pet is on screen right now; their saved position only changes when a walk ends. */
  companionRenderedPositionByIdRef?: MutableRefObject<Record<string, Position>>;
  getScaledCompanionCollisionBounds: (
    petId: string,
    currentScale: number,
    nextScale?: number,
  ) => DirectionalExtents;
  getScaledCompanionVisualBounds: (
    petId: string,
    currentScale: number,
    nextScale?: number,
  ) => DirectionalExtents;
  petCollisionBounds: DirectionalExtents;
  petPosRef: MutableRefObject<Position>;
  petVisualBounds: DirectionalExtents;
}

type UsePetContainerRoamTargetHelpersOptions = Pick<
  UsePetContainerMovementHelpersOptions,
  'activityArea' | 'getScaledCompanionVisualBounds' | 'petVisualBounds'
>;

export function usePetContainerCollisionClampHelpers({
  clampPrimaryPetToAllowedAreaWithMetrics,
  clampPetToRenderedActivityAreaWithMetrics,
  companionRenderedPositionByIdRef,
  configRef,
  getScaledCompanionCollisionBounds,
  getScaledCompanionVisualBounds,
  petCollisionBounds,
  petPosRef,
  petVisualBounds,
}: UsePetContainerMovementHelpersOptions) {
  const getPetCollisionEntries = useCallback((): PetCollisionEntry[] => {
    const currentConfig = configRef.current;
    const primaryEntries = isPrimaryDesktopPetShown(currentConfig) ? [{
      id: PRIMARY_DESKTOP_PET_SLOT_ID,
      position: petPosRef.current,
      bounds: petCollisionBounds,
    }] : [];
    return [...primaryEntries, ...currentConfig.companionPets.filter((pet) => pet.enabled && pet.modelVisible).map((pet) => ({
      id: pet.id,
      // Where she is now, not where she started her walk (an empty spot is not an obstacle).
      position: companionRenderedPositionByIdRef?.current[pet.id] ?? pet.position,
      bounds: getScaledCompanionCollisionBounds(pet.id, pet.scale),
    }))];
  }, [companionRenderedPositionByIdRef, configRef, getScaledCompanionCollisionBounds, petCollisionBounds, petPosRef]);

  const resolvePetPositionAgainstEntries = useCallback((
    candidatePosition: Position,
    petScale: number,
    clampBounds: DirectionalExtents,
    collisionBounds: DirectionalExtents,
    otherEntries: PetCollisionEntry[],
  ) => resolvePetPositionAgainstCollisionEntries({
    candidatePosition,
    clampBounds,
    clampPetPosition: clampPetToRenderedActivityAreaWithMetrics,
    collisionBounds,
    otherEntries,
    petScale,
  }), [clampPetToRenderedActivityAreaWithMetrics]);

  const clampPrimaryPetPosition = useCallback((position: Position) => (
    clampPrimaryPetToAllowedAreaWithMetrics(position, configRef.current.scale, petVisualBounds)
  ), [clampPrimaryPetToAllowedAreaWithMetrics, configRef, petVisualBounds]);

  const clampCompanionPosition = useCallback((position: Position, pet: CompanionPetLike) => (
    resolvePetPositionAgainstEntries(
      position,
      pet.scale,
      getScaledCompanionVisualBounds(pet.id, pet.scale),
      getScaledCompanionCollisionBounds(pet.id, pet.scale),
      getPetCollisionEntries().filter((entry) => entry.id !== pet.id),
    )
  ), [
    getPetCollisionEntries,
    getScaledCompanionCollisionBounds,
    getScaledCompanionVisualBounds,
    resolvePetPositionAgainstEntries,
  ]);

  const clampCompanionDragPosition = useCallback((position: Position, pet: CompanionPetLike) => (
    clampPetToRenderedActivityAreaWithMetrics(
      position,
      pet.scale,
      getScaledCompanionVisualBounds(pet.id, pet.scale),
    )
  ), [clampPetToRenderedActivityAreaWithMetrics, getScaledCompanionVisualBounds]);

  return {
    clampCompanionPosition,
    clampCompanionDragPosition,
    clampPrimaryPetPosition,
    getPetCollisionEntries,
    resolvePetPositionAgainstEntries,
  };
}

export function usePetContainerRoamTargetHelpers({
  activityArea,
  getScaledCompanionVisualBounds,
  petVisualBounds,
}: UsePetContainerRoamTargetHelpersOptions, clampCompanionPosition: (position: Position, pet: CompanionPetLike) => Position) {
  const createPrimaryPetRoamTarget = useCallback((from: Position) => (
    createRoamTargetInActivityArea(activityArea, petVisualBounds, from)
  ), [activityArea, petVisualBounds]);

  const createCompanionRoamTarget = useCallback((pet: CompanionPetLike) => (
    clampCompanionPosition(
      createRoamTargetInActivityArea(
        activityArea,
        getScaledCompanionVisualBounds(pet.id, pet.scale),
        pet.position,
      ),
      pet,
    )
  ), [activityArea, clampCompanionPosition, getScaledCompanionVisualBounds]);

  return {
    createCompanionRoamTarget,
    createPrimaryPetRoamTarget,
  };
}
