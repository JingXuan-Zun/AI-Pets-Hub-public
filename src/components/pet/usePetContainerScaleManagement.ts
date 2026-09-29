import { useCallback, useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import {
  PRIMARY_DESKTOP_PET_SLOT_ID,
  applyDesktopPetSlotChanges,
  getDesktopPetSlot,
} from '../../multiPetRoster';
import { type PetConfig, type PetConfigUpdateHandler } from '../../types';
import { type DirectionalExtents } from './petActivityRegionMath';
import {
  MIN_PET_SCALE,
  resolveEatScaleBoostAmount,
  resolveMaxScaleToFitActivityArea,
  resolvePetScaleCap,
  resolveScaledPetPositionWithBounds,
  scaleDirectionalExtents,
} from './petContainerMath';

type Position = { x: number; y: number };

type PetCollisionEntry = {
  id: string;
  position: Position;
  bounds: DirectionalExtents;
};

const PET_EAT_SCALE_DURATION_MS = 5 * 60 * 1000;

interface UsePetContainerScaleManagementOptions {
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
  config: PetConfig;
  configRef: MutableRefObject<PetConfig>;
  getPetCollisionEntries: () => PetCollisionEntry[];
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
  petPosRef: MutableRefObject<Position>;
  petVisualBounds: DirectionalExtents;
  resolvePetPositionAgainstEntries: (
    candidatePosition: Position,
    petScale: number,
    clampBounds: DirectionalExtents,
    collisionBounds: DirectionalExtents,
    otherEntries: PetCollisionEntry[],
  ) => Position;
  setPetPos: (position: Position) => void;
}

export function usePetContainerScaleManagement({
  activityArea,
  clampPrimaryPetToAllowedAreaWithMetrics,
  clampPetToRenderedActivityAreaWithMetrics,
  config,
  configRef,
  getPetCollisionEntries,
  getScaledCompanionCollisionBounds,
  getScaledCompanionVisualBounds,
  onUpdateConfig,
  petPosRef,
  petVisualBounds,
  resolvePetPositionAgainstEntries,
  setPetPos,
}: UsePetContainerScaleManagementOptions) {
  const manualCompanionEatingUntilByPetIdRef = useRef<Record<string, number>>({});
  const primaryEatScaleBoostRef = useRef(0);
  const companionEatScaleBoostByIdRef = useRef<Record<string, number>>({});
  const eatScaleTimeoutByPetIdRef = useRef<Record<string, number>>({});

  const resolveCompanionMaxScale = useCallback((petId: string, currentScale: number) => (
    resolveMaxScaleToFitActivityArea(
      activityArea,
      getScaledCompanionVisualBounds(petId, currentScale),
      currentScale,
      resolvePetScaleCap(getDesktopPetSlot(configRef.current, petId)?.modelType ?? '2d'),
    )
  ), [activityArea, configRef, getScaledCompanionVisualBounds]);

  const resolveScaledCompanionPosition = useCallback((
    petId: string,
    currentPosition: Position,
    currentScale: number,
    nextScale: number,
  ) => (
    resolvePetPositionAgainstEntries(
      currentPosition,
      nextScale,
      getScaledCompanionVisualBounds(petId, currentScale, nextScale),
      getScaledCompanionCollisionBounds(petId, currentScale, nextScale),
      getPetCollisionEntries().filter((entry) => entry.id !== petId),
    )
  ), [
    getPetCollisionEntries,
    getScaledCompanionCollisionBounds,
    getScaledCompanionVisualBounds,
    resolvePetPositionAgainstEntries,
  ]);

  const mainPetMaxScale = useMemo(() => resolveMaxScaleToFitActivityArea(
    activityArea,
    petVisualBounds,
    config.scale,
    resolvePetScaleCap(config.modelType),
  ), [activityArea, config.modelType, config.scale, petVisualBounds]);

  const resolveScaledPrimaryPetPosition = useCallback((
    currentPosition: Position,
    currentScale: number,
    nextScale: number,
  ) => (
    resolveScaledPetPositionWithBounds(
      currentPosition,
      currentScale,
      nextScale,
      petVisualBounds,
      clampPrimaryPetToAllowedAreaWithMetrics,
    )
  ), [
    clampPrimaryPetToAllowedAreaWithMetrics,
    petVisualBounds,
  ]);

  const clearEatScaleTimeout = useCallback((petId: string) => {
    const currentTimeoutId = eatScaleTimeoutByPetIdRef.current[petId];
    if (typeof currentTimeoutId === 'number') {
      window.clearTimeout(currentTimeoutId);
      delete eatScaleTimeoutByPetIdRef.current[petId];
    }
  }, []);

  const applyPrimaryScaleChange = useCallback((nextScale: number) => {
    const currentConfig = configRef.current;
    const currentScale = currentConfig.scale;
    const safeNextScale = Math.max(
      MIN_PET_SCALE,
      Math.min(resolvePetScaleCap(currentConfig.modelType), Number(nextScale.toFixed(2))),
    );

    if (Math.abs(safeNextScale - currentScale) < 0.001) {
      return 0;
    }

    const nextPosition = resolveScaledPrimaryPetPosition(
      petPosRef.current,
      currentScale,
      safeNextScale,
    );
    const nextConfig = {
      ...currentConfig,
      scale: safeNextScale,
      position: nextPosition,
    };

    petPosRef.current = nextPosition;
    setPetPos(nextPosition);
    configRef.current = nextConfig;
    onUpdateConfig(nextConfig, { normalize: false });
    return Number((safeNextScale - currentScale).toFixed(2));
  }, [
    configRef,
    onUpdateConfig,
    petPosRef,
    resolveScaledPrimaryPetPosition,
    setPetPos,
  ]);

  const applyCompanionScaleChange = useCallback((petId: string, nextScale: number) => {
    const currentConfig = configRef.current;
    const currentSlot = getDesktopPetSlot(currentConfig, petId);
    if (!currentSlot || currentSlot.isPrimary) {
      return 0;
    }

    const currentScale = currentSlot.scale;
    const safeNextScale = Math.max(
      MIN_PET_SCALE,
      Math.min(resolvePetScaleCap(currentSlot.modelType), Number(nextScale.toFixed(2))),
    );
    if (Math.abs(safeNextScale - currentScale) < 0.001) {
      return 0;
    }

    const currentVisualBounds = getScaledCompanionVisualBounds(petId, currentScale);
    const nextVisualBounds = scaleDirectionalExtents(currentVisualBounds, currentScale, safeNextScale);
    const nextPosition = clampPetToRenderedActivityAreaWithMetrics(
      currentSlot.position,
      safeNextScale,
      nextVisualBounds,
    );
    const nextConfig = applyDesktopPetSlotChanges(currentConfig, petId, {
      scale: safeNextScale,
      position: nextPosition,
    });

    configRef.current = nextConfig;
    onUpdateConfig(nextConfig, { normalize: false });
    return Number((safeNextScale - currentScale).toFixed(2));
  }, [
    clampPetToRenderedActivityAreaWithMetrics,
    configRef,
    getScaledCompanionVisualBounds,
    onUpdateConfig,
  ]);

  const triggerPetEatScaleBoost = useCallback((petId: string) => {
    const isPrimaryPet = petId === PRIMARY_DESKTOP_PET_SLOT_ID;
    const activeBoost = isPrimaryPet
      ? primaryEatScaleBoostRef.current
      : (companionEatScaleBoostByIdRef.current[petId] ?? 0);

    if (activeBoost <= 0) {
      const appliedBoost = isPrimaryPet
        ? applyPrimaryScaleChange(
            configRef.current.scale + resolveEatScaleBoostAmount(configRef.current.scale),
          )
        : applyCompanionScaleChange(
            petId,
            (() => {
              const currentScale = getDesktopPetSlot(configRef.current, petId)?.scale ?? 1;
              return currentScale + resolveEatScaleBoostAmount(currentScale);
            })(),
          );

      if (appliedBoost > 0) {
        if (isPrimaryPet) {
          primaryEatScaleBoostRef.current = appliedBoost;
        } else {
          companionEatScaleBoostByIdRef.current[petId] = appliedBoost;
        }
      }
    }

    clearEatScaleTimeout(petId);
    eatScaleTimeoutByPetIdRef.current[petId] = window.setTimeout(() => {
      if (petId === PRIMARY_DESKTOP_PET_SLOT_ID) {
        const boostToRemove = primaryEatScaleBoostRef.current;
        primaryEatScaleBoostRef.current = 0;
        clearEatScaleTimeout(petId);
        if (boostToRemove > 0) {
          applyPrimaryScaleChange(configRef.current.scale - boostToRemove);
        }
        return;
      }

      const boostToRemove = companionEatScaleBoostByIdRef.current[petId] ?? 0;
      delete companionEatScaleBoostByIdRef.current[petId];
      clearEatScaleTimeout(petId);
      if (boostToRemove > 0) {
        const currentSlot = getDesktopPetSlot(configRef.current, petId);
        if (currentSlot && !currentSlot.isPrimary) {
          applyCompanionScaleChange(petId, currentSlot.scale - boostToRemove);
        }
      }
    }, PET_EAT_SCALE_DURATION_MS);
  }, [applyCompanionScaleChange, applyPrimaryScaleChange, clearEatScaleTimeout, configRef]);

  useEffect(() => () => {
    Object.values(eatScaleTimeoutByPetIdRef.current).forEach((timeoutId) => {
      window.clearTimeout(timeoutId);
    });
    eatScaleTimeoutByPetIdRef.current = {};
    companionEatScaleBoostByIdRef.current = {};
    primaryEatScaleBoostRef.current = 0;
  }, []);

  return {
    mainPetMaxScale,
    manualCompanionEatingUntilByPetIdRef,
    resolveCompanionMaxScale,
    resolveScaledPrimaryPetPosition,
    resolveScaledCompanionPosition,
    triggerPetEatScaleBoost,
  };
}
