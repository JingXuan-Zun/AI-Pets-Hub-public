import { type MutableRefObject } from 'react';
import { type PetConfig, type PetConfigUpdateHandler } from '../../types';
import { type DirectionalExtents } from './petActivityRegionMath';
import {
  usePetContainerCollisionClampHelpers,
  usePetContainerRoamTargetHelpers,
} from './usePetContainerMovementHelpers';
import { usePetContainerScaleManagement } from './usePetContainerScaleManagement';

type Position = { x: number; y: number };

interface UsePetContainerMovementScaleRuntimeStateOptions {
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
  petPosRef: MutableRefObject<Position>;
  petVisualBounds: DirectionalExtents;
  setPetPos: (position: Position) => void;
}

export function usePetContainerMovementScaleRuntimeState({
  activityArea,
  clampPrimaryPetToAllowedAreaWithMetrics,
  clampPetToRenderedActivityAreaWithMetrics,
  config,
  configRef,
  getScaledCompanionCollisionBounds,
  getScaledCompanionVisualBounds,
  onUpdateConfig,
  petCollisionBounds,
  petPosRef,
  petVisualBounds,
  setPetPos,
}: UsePetContainerMovementScaleRuntimeStateOptions) {
  const collisionClampState = usePetContainerCollisionClampHelpers({
    activityArea,
    clampPrimaryPetToAllowedAreaWithMetrics,
    clampPetToRenderedActivityAreaWithMetrics,
    configRef,
    getScaledCompanionCollisionBounds,
    getScaledCompanionVisualBounds,
    petCollisionBounds,
    petPosRef,
    petVisualBounds,
  });
  const roamTargetState = usePetContainerRoamTargetHelpers({
    activityArea,
    getScaledCompanionVisualBounds,
    petVisualBounds,
  }, collisionClampState.clampCompanionPosition);
  const scaleState = usePetContainerScaleManagement({
    activityArea,
    clampPrimaryPetToAllowedAreaWithMetrics,
    clampPetToRenderedActivityAreaWithMetrics,
    config,
    configRef,
    getPetCollisionEntries: collisionClampState.getPetCollisionEntries,
    getScaledCompanionCollisionBounds,
    getScaledCompanionVisualBounds,
    onUpdateConfig,
    petPosRef,
    petVisualBounds,
    resolvePetPositionAgainstEntries: collisionClampState.resolvePetPositionAgainstEntries,
    setPetPos,
  });

  return {
    ...collisionClampState,
    ...roamTargetState,
    ...scaleState,
  };
}
