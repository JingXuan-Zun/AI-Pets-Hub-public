import { type MutableRefObject } from 'react';
import { useCompanionPetInteractionController } from '../../pet-runtime/interactions/useCompanionPetInteractionController';
import { type PetConfig, type PetConfigUpdateHandler } from '../../types';
import { type DirectionalExtents } from './petActivityRegionMath';
import { usePetContainerCompanionDragHandlers } from './usePetContainerCompanionDragHandlers';
import { usePetContainerCompanionRenderState } from './usePetContainerCompanionRenderState';

type Position = { x: number; y: number };

interface UsePetContainerCompanionRuntimeStateOptions {
  addLog: (msg: string) => void;
  clampCompanionPosition: (
    position: Position,
    pet: Pick<PetConfig['companionPets'][number], 'id' | 'scale'>,
  ) => Position;
  clampCompanionDragPosition: (
    position: Position,
    pet: Pick<PetConfig['companionPets'][number], 'id' | 'scale'>,
  ) => Position;
  clampPetToRenderedActivityAreaWithMetrics: (
    position: Position,
    petScale: number,
    visualBounds: DirectionalExtents,
  ) => Position;
  companionEatingDurationMs: number;
  companionRenderedPositionByIdRef: MutableRefObject<Record<string, Position>>;
  config: PetConfig;
  configRef: MutableRefObject<PetConfig>;
  getPetEatReachThresholdForScale: (scale: number) => number;
  getScenePositionFromViewportPoint: (point: Position) => Position;
  getScaledCompanionVisualBounds: (petId: string, scale: number) => DirectionalExtents;
  manualEatingUntilByPetIdRef: MutableRefObject<Record<string, number>>;
  minPetScale: number;
  onCompanionEatScaleBoost: (petId: string) => void;
  onCompanionDragNativeRegionPreview?: (preview: {
    petId: string;
    position: Position;
    previousPosition: Position;
  }) => void;
  onCompanionDragNativeShapeActiveChange?: (active: boolean) => void;
  onUpdateConfig: PetConfigUpdateHandler;
  petScaleStep: number;
  pointerInteractionLockRef: MutableRefObject<boolean>;
  resolveCompanionMaxScale: (petId: string, currentScale: number) => number;
  resolveScaledCompanionPosition: (
    petId: string,
    currentPosition: Position,
    currentScale: number,
    nextScale: number,
  ) => Position;
  selectPanelPet: (petId: string) => void;
}

export function usePetContainerCompanionRuntimeState({
  addLog,
  clampCompanionPosition,
  clampCompanionDragPosition,
  clampPetToRenderedActivityAreaWithMetrics,
  companionEatingDurationMs,
  companionRenderedPositionByIdRef,
  config,
  configRef,
  getPetEatReachThresholdForScale,
  getScenePositionFromViewportPoint,
  getScaledCompanionVisualBounds,
  manualEatingUntilByPetIdRef,
  minPetScale,
  onCompanionEatScaleBoost,
  onCompanionDragNativeRegionPreview,
  onCompanionDragNativeShapeActiveChange,
  onUpdateConfig,
  petScaleStep,
  pointerInteractionLockRef,
  resolveCompanionMaxScale,
  resolveScaledCompanionPosition,
  selectPanelPet,
}: UsePetContainerCompanionRuntimeStateOptions) {
  const {
    companionDragPreview,
    companionDragDelta,
    companionDragState,
    draggingCompanionPetIdRef,
    handleCompanionWheelScale,
    isCompanionDragActive,
    startCompanionDrag,
  } = useCompanionPetInteractionController({
    addLog,
    clampCompanionPosition,
    clampCompanionDragPosition,
    companionEatingDurationMs,
    configRef,
    getPetEatReachThresholdForScale,
    getScenePositionFromViewportPoint,
    manualEatingUntilByPetIdRef,
    minPetScale,
    onCompanionEatScaleBoost,
    onCompanionDragNativeRegionPreview,
    onCompanionDragNativeShapeActiveChange,
    onUpdateConfig,
    petScaleStep,
    pointerInteractionLockRef,
    resolveCompanionMaxScale,
    resolveScaledCompanionPosition,
  });
  const { handleStartCompanionPetDrag } = usePetContainerCompanionDragHandlers({
    selectPanelPet,
    startCompanionDrag,
  });
  const {
    active3DSceneCount,
    companionRenderSlots,
    sequenceFrameDurationMultiplier,
  } = usePetContainerCompanionRenderState({
    clampPetToRenderedActivityAreaWithMetrics,
    companionDragPreview,
    companionRenderedPositionByIdRef,
    config,
    getScaledCompanionVisualBounds,
  });

  return {
    active3DSceneCount,
    companionDragDelta,
    companionDragState,
    companionRenderSlots,
    draggingCompanionPetId: companionDragPreview?.petId ?? null,
    draggingCompanionPetIdRef,
    handleCompanionWheelScale,
    handleStartCompanionPetDrag,
    isCompanionDragActive,
    sequenceFrameDurationMultiplier,
  };
}
