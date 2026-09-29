import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { resolvePetCollisionProfile } from '../../constants';
import { getDesktopPetSlot } from '../../multiPetRoster';
import { type PetConfig } from '../../types';
import {
  createCollisionBoundsFromVisualBounds,
  type DirectionalExtents,
} from './petActivityRegionMath';

interface UsePetVisualBoundsControllerOptions {
  config: PetConfig;
  configRef: MutableRefObject<PetConfig>;
  defaultPetVisualBounds: DirectionalExtents;
}

export function usePetVisualBoundsController({
  config,
  configRef,
  defaultPetVisualBounds,
}: UsePetVisualBoundsControllerOptions) {
  const [petVisualBounds, setPetVisualBounds] = useState(defaultPetVisualBounds);
  const [petCollisionBounds, setPetCollisionBounds] = useState(() => createCollisionBoundsFromVisualBounds(
    defaultPetVisualBounds,
    resolvePetCollisionProfile(config.modelType, config.modelUrl, config.customModelPresets),
    config.scale,
  ));
  const [companionVisualBoundsById, setCompanionVisualBoundsById] = useState<Record<string, DirectionalExtents>>({});
  const [companionCollisionBoundsById, setCompanionCollisionBoundsById] = useState<Record<string, DirectionalExtents>>({});
  const previousPetVisualBoundsRef = useRef<DirectionalExtents>(defaultPetVisualBounds);
  const previousCompanionVisualBoundsByIdRef = useRef<Record<string, DirectionalExtents>>({});

  const resolveCollisionBoundsForModel = useCallback((
    modelType: PetConfig['modelType'],
    modelUrl: string,
    modelScale: number,
    visualBounds: DirectionalExtents,
  ) => createCollisionBoundsFromVisualBounds(
    visualBounds,
    resolvePetCollisionProfile(modelType, modelUrl, configRef.current.customModelPresets),
    modelScale,
  ), [configRef]);

  const getCompanionCollisionBounds = useCallback((petId: string) => {
    const currentSlot = getDesktopPetSlot(configRef.current, petId);
    if (!currentSlot || currentSlot.isPrimary) {
      return resolveCollisionBoundsForModel('2d', '', 1, defaultPetVisualBounds);
    }

    return companionCollisionBoundsById[petId]
      ?? resolveCollisionBoundsForModel(currentSlot.modelType, currentSlot.modelUrl, currentSlot.scale, defaultPetVisualBounds);
  }, [companionCollisionBoundsById, configRef, defaultPetVisualBounds, resolveCollisionBoundsForModel]);

  const getCompanionVisualBounds = useCallback((petId: string) => (
    companionVisualBoundsById[petId] ?? defaultPetVisualBounds
  ), [companionVisualBoundsById, defaultPetVisualBounds]);

  const getScaledCompanionVisualBounds = useCallback((
    petId: string,
    currentScale: number,
    nextScale = currentScale,
  ) => {
    const ratio = (
      Number.isFinite(currentScale) && currentScale > 0
        ? Math.max(0.01, nextScale) / currentScale
        : 1
    );
    const bounds = getCompanionVisualBounds(petId);

    return {
      left: Math.max(1, Math.round(bounds.left * ratio)),
      right: Math.max(1, Math.round(bounds.right * ratio)),
      top: Math.max(1, Math.round(bounds.top * ratio)),
      bottom: Math.max(1, Math.round(bounds.bottom * ratio)),
    } satisfies DirectionalExtents;
  }, [getCompanionVisualBounds]);

  const getScaledCompanionCollisionBounds = useCallback((
    petId: string,
    currentScale: number,
    nextScale = currentScale,
  ) => {
    const ratio = (
      Number.isFinite(currentScale) && currentScale > 0
        ? Math.max(0.01, nextScale) / currentScale
        : 1
    );
    const bounds = getCompanionCollisionBounds(petId);

    return {
      left: Math.max(1, Math.round(bounds.left * ratio)),
      right: Math.max(1, Math.round(bounds.right * ratio)),
      top: Math.max(1, Math.round(bounds.top * ratio)),
      bottom: Math.max(1, Math.round(bounds.bottom * ratio)),
    } satisfies DirectionalExtents;
  }, [getCompanionCollisionBounds]);

  const handlePetVisualBoundsChange = useCallback((nextBounds: DirectionalExtents) => {
    setPetVisualBounds((currentBounds) => (
      currentBounds.left === nextBounds.left
      && currentBounds.right === nextBounds.right
      && currentBounds.top === nextBounds.top
      && currentBounds.bottom === nextBounds.bottom
        ? currentBounds
        : nextBounds
    ));
    setPetCollisionBounds((currentBounds) => {
      const nextCollisionBounds = resolveCollisionBoundsForModel(
        configRef.current.modelType,
        configRef.current.modelUrl,
        configRef.current.scale,
        nextBounds,
      );

      return (
        currentBounds.left === nextCollisionBounds.left
        && currentBounds.right === nextCollisionBounds.right
        && currentBounds.top === nextCollisionBounds.top
        && currentBounds.bottom === nextCollisionBounds.bottom
      )
        ? currentBounds
        : nextCollisionBounds;
    });
  }, [configRef, resolveCollisionBoundsForModel]);

  const handleCompanionVisualBoundsChange = useCallback((petId: string, nextBounds: DirectionalExtents) => {
    const currentSlot = getDesktopPetSlot(configRef.current, petId);
    const nextCollisionBounds = currentSlot
      ? resolveCollisionBoundsForModel(currentSlot.modelType, currentSlot.modelUrl, currentSlot.scale, nextBounds)
      : createCollisionBoundsFromVisualBounds(nextBounds);

    setCompanionVisualBoundsById((currentBoundsById) => {
      const currentBounds = currentBoundsById[petId];
      if (
        currentBounds
        && currentBounds.left === nextBounds.left
        && currentBounds.right === nextBounds.right
        && currentBounds.top === nextBounds.top
        && currentBounds.bottom === nextBounds.bottom
      ) {
        return currentBoundsById;
      }

      return {
        ...currentBoundsById,
        [petId]: nextBounds,
      };
    });

    setCompanionCollisionBoundsById((currentBoundsById) => {
      const currentBounds = currentBoundsById[petId];
      if (
        currentBounds
        && currentBounds.left === nextCollisionBounds.left
        && currentBounds.right === nextCollisionBounds.right
        && currentBounds.top === nextCollisionBounds.top
        && currentBounds.bottom === nextCollisionBounds.bottom
      ) {
        return currentBoundsById;
      }

      return {
        ...currentBoundsById,
        [petId]: nextCollisionBounds,
      };
    });
  }, [configRef, resolveCollisionBoundsForModel]);

  useEffect(() => {
    previousPetVisualBoundsRef.current = petVisualBounds;
  }, [petVisualBounds]);

  useEffect(() => {
    previousCompanionVisualBoundsByIdRef.current = companionVisualBoundsById;
  }, [companionVisualBoundsById]);

  useEffect(() => {
    setPetCollisionBounds(resolveCollisionBoundsForModel(
      config.modelType,
      config.modelUrl,
      config.scale,
      petVisualBounds,
    ));
  }, [config.customModelPresets, config.modelType, config.modelUrl, config.scale, petVisualBounds, resolveCollisionBoundsForModel]);

  useEffect(() => {
    const visibleCompanionPetIds = new Set(
      config.companionPets
        .filter((pet) => pet.enabled && pet.modelVisible)
        .map((pet) => pet.id),
    );
    setCompanionVisualBoundsById((currentValue) => {
      let hasChanges = false;
      const nextValue = Object.fromEntries(
        Object.entries(currentValue).filter(([petId]) => {
          const keepEntry = visibleCompanionPetIds.has(petId);
          if (!keepEntry) {
            hasChanges = true;
          }
          return keepEntry;
        }),
      ) as Record<string, DirectionalExtents>;

      return hasChanges ? nextValue : currentValue;
    });
    setCompanionCollisionBoundsById((currentValue) => {
      let hasChanges = false;
      const nextValue = Object.fromEntries(
        Object.entries(currentValue).filter(([petId]) => {
          const keepEntry = visibleCompanionPetIds.has(petId);
          if (!keepEntry) {
            hasChanges = true;
          }
          return keepEntry;
        }),
      ) as Record<string, DirectionalExtents>;

      return hasChanges ? nextValue : currentValue;
    });
  }, [config.companionPets]);

  return {
    companionCollisionBoundsById,
    companionVisualBoundsById,
    getCompanionCollisionBounds,
    getCompanionVisualBounds,
    getScaledCompanionCollisionBounds,
    getScaledCompanionVisualBounds,
    handleCompanionVisualBoundsChange,
    handlePetVisualBoundsChange,
    petCollisionBounds,
    petVisualBounds,
    previousCompanionVisualBoundsByIdRef,
    previousPetVisualBoundsRef,
    resolveCollisionBoundsForModel,
  };
}
