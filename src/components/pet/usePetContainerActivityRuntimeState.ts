import { useMemo, type MutableRefObject, type RefObject } from 'react';
import { type PetConfig, type PetConfigUpdateHandler } from '../../types';
import { type Area, type DirectionalExtents } from './petActivityRegionMath';
import { usePetActivityRegion } from './usePetActivityRegion';
import { usePetActivityScene } from './usePetActivityScene';
import { usePetContainerFoodActions } from './usePetContainerEnvironmentState';

type Position = { x: number; y: number };

interface UsePetContainerActivityRuntimeStateOptions {
  addLog: (msg: string) => void;
  config: PetConfig;
  configRef: MutableRefObject<PetConfig>;
  folderBoundaryExtents: DirectionalExtents;
  folderHalfHeight: number;
  folderHalfWidth: number;
  onActivityRegionNativeShapePreview?: (preview: {
    activityArea?: Area;
    activityCenter: Position;
    previousActivityCenter: Position;
    previousPrimaryPosition?: Position;
    primaryPosition?: Position;
  }) => void;
  onUpdateConfig: PetConfigUpdateHandler;
  pendingPetConfigSyncRef: MutableRefObject<boolean>;
  petPosRef: MutableRefObject<Position>;
  petVisualBounds: DirectionalExtents;
  pointerInteractionLockRef: MutableRefObject<boolean>;
  sceneRef: RefObject<HTMLDivElement | null>;
  setPetPos: (position: Position) => void;
}

export function usePetContainerActivityRuntimeState({
  addLog,
  config,
  configRef,
  folderBoundaryExtents,
  folderHalfHeight,
  folderHalfWidth,
  onActivityRegionNativeShapePreview,
  onUpdateConfig,
  pendingPetConfigSyncRef,
  petPosRef,
  petVisualBounds,
  pointerInteractionLockRef,
  sceneRef,
  setPetPos,
}: UsePetContainerActivityRuntimeStateOptions) {
  const activityRegionState = usePetActivityRegion({
    addLog,
    config,
    configRef,
    folderHalfHeight,
    folderHalfWidth,
    folderBoundaryExtents,
    onActivityRegionNativeShapePreview,
    onUpdateConfig,
    pendingPetConfigSyncRef,
    petPosRef,
    petVisualBounds,
    pointerInteractionLockRef,
    sceneRef,
    setPetPos,
  });
  const activitySceneState = usePetActivityScene({
    activityArea: activityRegionState.activityArea,
    activityCenter: activityRegionState.activityCenter,
    activityViewport: activityRegionState.activityViewport,
    config,
    configRef,
    folderHalfHeight,
    folderHalfWidth,
    folderBoundaryExtents,
    petVisualBounds,
    sceneRef,
    sceneSize: activityRegionState.sceneSize,
    selectedDisplayScaleFactor: activityRegionState.selectedDisplayScaleFactor,
  });
  const { handleCreateFood } = usePetContainerFoodActions({
    activityArea: activityRegionState.activityArea,
    addLog,
    clampPositionToRenderedActivityArea: activitySceneState.clampPositionToRenderedActivityArea,
    configRef,
    folderBoundaryExtents,
    onUpdateConfig,
  });
  const petEatReachThreshold = useMemo(
    () => activitySceneState.getPetEatReachThreshold(),
    [activitySceneState.getPetEatReachThreshold],
  );

  return {
    ...activityRegionState,
    ...activitySceneState,
    handleCreateFood,
    petEatReachThreshold,
  };
}
