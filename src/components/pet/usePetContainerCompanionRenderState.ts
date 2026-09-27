import { useEffect, useMemo, type MutableRefObject } from 'react';
import { type DesktopPetSlot } from '../../multiPetRoster';
import { getVisibleDesktopPetModelSlots } from '../../multiPetRoster';
import { type PetConfig } from '../../types';
import { type DirectionalExtents } from './petActivityRegionMath';

type Position = { x: number; y: number };

type CompanionRenderSlot = DesktopPetSlot & {
  position: Position;
};

interface UsePetContainerCompanionRenderStateOptions {
  clampPetToRenderedActivityAreaWithMetrics: (
    position: Position,
    petScale: number,
    visualBounds: DirectionalExtents,
  ) => Position;
  companionDragPreview: { petId: string; position: Position } | null;
  companionRenderedPositionByIdRef: MutableRefObject<Record<string, Position>>;
  config: PetConfig;
  getScaledCompanionVisualBounds: (petId: string, scale: number) => DirectionalExtents;
}

function resolveSequenceFrameDurationMultiplier(totalActivePetCount: number) {
  if (totalActivePetCount >= 8) {
    return 1.12;
  }

  if (totalActivePetCount >= 6) {
    return 1.08;
  }

  if (totalActivePetCount >= 4) {
    return 1.04;
  }

  return 1;
}

export function usePetContainerCompanionRenderState({
  clampPetToRenderedActivityAreaWithMetrics,
  companionDragPreview,
  companionRenderedPositionByIdRef,
  config,
  getScaledCompanionVisualBounds,
}: UsePetContainerCompanionRenderStateOptions) {
  const companionRenderSlots = useMemo(() => (
    getVisibleDesktopPetModelSlots(config)
      .filter((slot) => !slot.isPrimary)
      .map((slot) => ({
        ...slot,
        position: clampPetToRenderedActivityAreaWithMetrics(
          companionDragPreview?.petId === slot.id
            ? companionDragPreview.position
            : slot.position,
          slot.scale,
          getScaledCompanionVisualBounds(slot.id, slot.scale),
        ),
      }))
  ), [
    clampPetToRenderedActivityAreaWithMetrics,
    companionDragPreview,
    config,
    getScaledCompanionVisualBounds,
  ]);

  useEffect(() => {
    const nextRenderedPositions: Record<string, Position> = {};
    companionRenderSlots.forEach((slot) => {
      nextRenderedPositions[slot.id] = slot.position;
    });
    companionRenderedPositionByIdRef.current = nextRenderedPositions;
  }, [companionRenderSlots, companionRenderedPositionByIdRef]);

  const active3DSceneCount = useMemo(() => (
    (config.modelType === '3d' ? 1 : 0)
    + companionRenderSlots.filter((slot) => slot.modelType === '3d').length
  ), [companionRenderSlots, config.modelType]);

  const sequenceFrameDurationMultiplier = useMemo(
    () => resolveSequenceFrameDurationMultiplier(1 + companionRenderSlots.length),
    [companionRenderSlots.length],
  );

  return {
    active3DSceneCount,
    companionRenderSlots: companionRenderSlots as CompanionRenderSlot[],
    sequenceFrameDurationMultiplier,
  };
}
