import { useEffect, type MutableRefObject } from 'react';
import {
  PRIMARY_DESKTOP_PET_SLOT_ID,
  applyDesktopPetSlotChanges,
} from '../../multiPetRoster';
import { type PetConfig, type PetConfigUpdateHandler } from '../../types';
import { type DirectionalExtents } from './petActivityRegionMath';

type Position = { x: number; y: number };

type PetCollisionEntry = {
  id: string;
  position: Position;
  bounds: DirectionalExtents;
};

interface UsePetContainerCompanionCollisionSyncEffectOptions {
  config: PetConfig;
  configRef: MutableRefObject<PetConfig>;
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
  onUpdateConfig: PetConfigUpdateHandler;
  petCollisionBounds: DirectionalExtents;
  petPos: Position;
  petPosRef: MutableRefObject<Position>;
  resolvePetPositionAgainstEntries: (
    candidatePosition: Position,
    petScale: number,
    clampBounds: DirectionalExtents,
    collisionBounds: DirectionalExtents,
    otherEntries: PetCollisionEntry[],
  ) => Position;
}

export function usePetContainerCompanionCollisionSyncEffect({
  config,
  configRef,
  getScaledCompanionCollisionBounds,
  getScaledCompanionVisualBounds,
  onUpdateConfig,
  petCollisionBounds,
  petPos,
  petPosRef,
  resolvePetPositionAgainstEntries,
}: UsePetContainerCompanionCollisionSyncEffectOptions) {
  useEffect(() => {
    const currentConfig = configRef.current;
    let nextConfig = currentConfig;
    const placedEntries: PetCollisionEntry[] = [
      {
        id: PRIMARY_DESKTOP_PET_SLOT_ID,
        position: petPosRef.current,
        bounds: petCollisionBounds,
      },
    ];

    currentConfig.companionPets.forEach((pet) => {
      if (!pet.enabled || !pet.modelVisible) {
        return;
      }

      const clampBounds = getScaledCompanionVisualBounds(pet.id, pet.scale);
      const collisionBounds = getScaledCompanionCollisionBounds(pet.id, pet.scale);
      const nextPosition = resolvePetPositionAgainstEntries(
        pet.position,
        pet.scale,
        clampBounds,
        collisionBounds,
        placedEntries,
      );

      placedEntries.push({
        id: pet.id,
        position: nextPosition,
        bounds: collisionBounds,
      });

      if (nextPosition.x === pet.position.x && nextPosition.y === pet.position.y) {
        return;
      }

      nextConfig = applyDesktopPetSlotChanges(nextConfig, pet.id, {
        position: nextPosition,
      });
    });

    if (nextConfig === currentConfig) {
      return;
    }

    configRef.current = nextConfig;
    onUpdateConfig(nextConfig, { normalize: false });
  }, [
    config.companionPets,
    configRef,
    getScaledCompanionCollisionBounds,
    getScaledCompanionVisualBounds,
    onUpdateConfig,
    petCollisionBounds,
    petPos.x,
    petPos.y,
    petPosRef,
    resolvePetPositionAgainstEntries,
  ]);
}
