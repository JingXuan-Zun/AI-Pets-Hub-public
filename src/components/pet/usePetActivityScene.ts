import {
  useCallback,
  type MutableRefObject,
  type RefObject,
} from 'react';
import { resolveActivityAreaSize } from '../../activityArea';
import { type PetConfig } from '../../types';
import {
  type Area,
  type DirectionalExtents,
  type Position,
  clampSceneEntityToActivityArea,
  resolvePetCollisionRadius,
  resolveViewportActivitySettings,
} from './petActivityRegionMath';

type ActivityViewport = {
  x: number;
  y: number;
  width: number;
  height: number;
};

interface UsePetActivitySceneOptions {
  activityArea: Area;
  activityCenter: Position;
  activityViewport: ActivityViewport;
  config: PetConfig;
  configRef: MutableRefObject<PetConfig>;
  folderHalfHeight: number;
  folderHalfWidth: number;
  folderBoundaryExtents: DirectionalExtents;
  petVisualBounds: DirectionalExtents;
  sceneRef: RefObject<HTMLDivElement | null>;
  sceneSize: Area;
  selectedDisplayScaleFactor: number;
}

export function usePetActivityScene({
  activityArea,
  activityCenter,
  activityViewport,
  config,
  configRef,
  folderHalfHeight,
  folderHalfWidth,
  folderBoundaryExtents,
  petVisualBounds,
  sceneRef,
  sceneSize,
  selectedDisplayScaleFactor,
}: UsePetActivitySceneOptions) {
  const getViewportActivitySettings = useCallback((
    settings: PetConfig['settings'] = configRef.current.settings,
  ) => resolveViewportActivitySettings(
    settings,
    selectedDisplayScaleFactor,
  ), [configRef, selectedDisplayScaleFactor]);

  const resolveSceneActivityArea = useCallback((
    settings: PetConfig['settings'] = configRef.current.settings,
  ) => {
    if (!settings.activityAreaLimitEnabled) {
      return activityArea;
    }

    return resolveActivityAreaSize(
      activityViewport.width,
      activityViewport.height,
      getViewportActivitySettings(settings),
    );
  }, [activityArea, activityViewport.height, activityViewport.width, configRef, getViewportActivitySettings]);

  const clampPositionWithinArea = useCallback((
    position: Position,
    area: Area,
    type: 'pet' | 'folder',
    petScale = configRef.current.scale,
    petVisualBoundsOverride: DirectionalExtents | null | undefined = petVisualBounds,
  ) => clampSceneEntityToActivityArea(position, area, type, {
    folderHalfHeight,
    folderHalfWidth,
    folderBoundaryExtents,
    petScale,
    petVisualBounds: petVisualBoundsOverride,
  }), [configRef, folderBoundaryExtents, folderHalfHeight, folderHalfWidth, petVisualBounds]);

  const getScenePositionFromViewportPoint = useCallback((point: Position) => {
    const sceneRect = sceneRef.current?.getBoundingClientRect();

    if (!sceneRect) {
      return {
        x: point.x,
        y: point.y,
      };
    }

    return {
      x: point.x - sceneRect.left - activityCenter.x,
      y: point.y - sceneRect.top - activityCenter.y,
    };
  }, [activityCenter.x, activityCenter.y, sceneRef]);

  const clampToScene = useCallback((position: Position, type: 'pet' | 'folder') => {
    if (activityViewport.width <= 0 || activityViewport.height <= 0) {
      return position;
    }

    return clampPositionWithinArea(
      position,
      resolveSceneActivityArea(configRef.current.settings),
      type,
      configRef.current.scale,
    );
  }, [activityViewport.height, activityViewport.width, clampPositionWithinArea, configRef, resolveSceneActivityArea]);

  const clampPetToSceneWithScale = useCallback((position: Position, petScale: number) => {
    if (activityViewport.width <= 0 || activityViewport.height <= 0) {
      return position;
    }

    return clampPositionWithinArea(
      position,
      resolveSceneActivityArea(configRef.current.settings),
      'pet',
      petScale,
      petVisualBounds,
    );
  }, [activityViewport.height, activityViewport.width, clampPositionWithinArea, configRef, petVisualBounds, resolveSceneActivityArea]);

  const clampPetToSceneWithMetrics = useCallback((
    position: Position,
    petScale: number,
    petVisualBoundsOverride?: DirectionalExtents | null,
  ) => {
    if (activityViewport.width <= 0 || activityViewport.height <= 0) {
      return position;
    }

    return clampPositionWithinArea(
      position,
      resolveSceneActivityArea(configRef.current.settings),
      'pet',
      petScale,
      petVisualBoundsOverride,
    );
  }, [activityViewport.height, activityViewport.width, clampPositionWithinArea, configRef, resolveSceneActivityArea]);

  const clampPositionToRenderedActivityArea = useCallback((
    position: Position,
    type: 'pet' | 'folder',
  ) => clampPositionWithinArea(position, activityArea, type, config.scale), [activityArea, clampPositionWithinArea, config.scale]);

  const clampPetToRenderedActivityAreaWithScale = useCallback((
    position: Position,
    petScale: number,
  ) => clampPositionWithinArea(position, activityArea, 'pet', petScale, petVisualBounds), [activityArea, clampPositionWithinArea, petVisualBounds]);

  const clampPetToRenderedActivityAreaWithMetrics = useCallback((
    position: Position,
    petScale: number,
    petVisualBoundsOverride?: DirectionalExtents | null,
  ) => clampPositionWithinArea(position, activityArea, 'pet', petScale, petVisualBoundsOverride), [activityArea, clampPositionWithinArea]);

  const clampPrimaryPetToAllowedAreaWithMetrics = useCallback((
    position: Position,
    petScale: number,
    petVisualBoundsOverride?: DirectionalExtents | null,
  ) => clampPositionWithinArea(
    position,
    activityArea,
    'pet',
    petScale,
    petVisualBoundsOverride,
  ), [
    activityArea,
    clampPositionWithinArea,
  ]);

  const clampPrimaryPetToAllowedArea = useCallback((position: Position) => (
    clampPrimaryPetToAllowedAreaWithMetrics(position, configRef.current.scale, petVisualBounds)
  ), [clampPrimaryPetToAllowedAreaWithMetrics, configRef, petVisualBounds]);

  const getPetEatReachThreshold = useCallback(() => Math.max(
    24,
    Math.round(resolvePetCollisionRadius(config.scale, activityArea) + Math.max(folderBoundaryExtents.left, folderBoundaryExtents.right) + 10),
  ), [activityArea, config.scale, folderBoundaryExtents.bottom, folderBoundaryExtents.left, folderBoundaryExtents.right, folderBoundaryExtents.top]);

  const getPetEatReachThresholdForScale = useCallback((petScale: number) => Math.max(
    24,
    Math.round(resolvePetCollisionRadius(petScale, activityArea) + Math.max(folderBoundaryExtents.left, folderBoundaryExtents.right) + 10),
  ), [activityArea, folderBoundaryExtents.bottom, folderBoundaryExtents.left, folderBoundaryExtents.right, folderBoundaryExtents.top]);

  return {
    clampPositionToRenderedActivityArea,
    clampPetToRenderedActivityAreaWithMetrics,
    clampPrimaryPetToAllowedArea,
    clampPrimaryPetToAllowedAreaWithMetrics,
    clampPetToRenderedActivityAreaWithScale,
    clampPetToSceneWithMetrics,
    clampPetToSceneWithScale,
    clampToScene,
    getPetEatReachThreshold,
    getPetEatReachThresholdForScale,
    getScenePositionFromViewportPoint,
    resolveSceneActivityArea,
  };
}
