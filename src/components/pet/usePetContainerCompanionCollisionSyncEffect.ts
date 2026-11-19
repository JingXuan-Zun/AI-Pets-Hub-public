import { markCompanionSettling } from './companionSettleSignal';
import { useEffect, type MutableRefObject } from 'react';
import {
  PRIMARY_DESKTOP_PET_SLOT_ID,
  applyDesktopPetSlotChanges,
  isPrimaryDesktopPetShown,
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
  /** Where each pet is on screen right now; differs from the saved position while she walks. */
  companionRenderedPositionByIdRef?: MutableRefObject<Record<string, Position>>;
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
  companionRenderedPositionByIdRef,
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
    const placedEntries: PetCollisionEntry[] = isPrimaryDesktopPetShown(currentConfig) ? [
      {
        id: PRIMARY_DESKTOP_PET_SLOT_ID,
        position: petPosRef.current,
        bounds: petCollisionBounds,
      },
    ] : [];

    currentConfig.companionPets.forEach((pet) => {
      if (!pet.enabled || !pet.modelVisible) {
        return;
      }

      // A pet in the middle of a walk keeps clear of others step by step; moving her saved
      // (starting) position here made her jump sideways (user report, 2026-11-18).
      const live = companionRenderedPositionByIdRef?.current[pet.id];
      if (live && (Math.abs(live.x - pet.position.x) > 2 || Math.abs(live.y - pet.position.y) > 2)) {
        placedEntries.push({ id: pet.id, position: live, bounds: getScaledCompanionCollisionBounds(pet.id, pet.scale) });
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

      // Slide the pushed-aside pet out smoothly instead of snapping (see companionSettleSignal).
      markCompanionSettling(pet.id);
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
    companionRenderedPositionByIdRef,
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
