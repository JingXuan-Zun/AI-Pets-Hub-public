import { useCallback, useState, type MutableRefObject } from 'react';
import { pickRandomFoodAppearanceId } from '../../foodAppearances';
import { type PetConfig, type PetConfigUpdateHandler } from '../../types';
import { createRandomPositionInActivityAreaWithExtents } from './petActivityRegionMath';

type Position = { x: number; y: number };

type FolderVisualMetrics = {
  boundaryExtents: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
  renderOffset: Position;
};

const DEFAULT_FOLDER_VISUAL_METRICS: FolderVisualMetrics = {
  boundaryExtents: { left: 24, right: 24, top: 24, bottom: 24 },
  renderOffset: { x: 24, y: 24 },
};

interface UsePetContainerFolderVisualMetricsOptions {
  activityArea: { width: number; height: number };
  addLog: (msg: string) => void;
  clampPositionToRenderedActivityArea: (position: Position, kind?: 'pet' | 'folder') => Position;
  configRef: MutableRefObject<PetConfig>;
  onUpdateConfig: PetConfigUpdateHandler;
}

interface UsePetContainerFoodActionsOptions {
  activityArea: { width: number; height: number };
  addLog: (msg: string) => void;
  clampPositionToRenderedActivityArea: (position: Position, kind?: 'pet' | 'folder') => Position;
  configRef: MutableRefObject<PetConfig>;
  folderBoundaryExtents: FolderVisualMetrics['boundaryExtents'];
  onUpdateConfig: PetConfigUpdateHandler;
}

export function usePetContainerFolderVisualMetrics() {
  const [folderVisualMetrics, setFolderVisualMetrics] = useState(DEFAULT_FOLDER_VISUAL_METRICS);

  const folderBoundaryExtents = folderVisualMetrics.boundaryExtents;
  const folderRenderOffset = folderVisualMetrics.renderOffset;
  const folderHalfWidth = Math.max(1, Math.round((folderBoundaryExtents.left + folderBoundaryExtents.right) / 2));
  const folderHalfHeight = Math.max(1, Math.round((folderBoundaryExtents.top + folderBoundaryExtents.bottom) / 2));

  const handleFolderVisualMetricsChange = useCallback((nextMetrics: FolderVisualMetrics) => {
    setFolderVisualMetrics((currentMetrics) => (
      currentMetrics.boundaryExtents.left === nextMetrics.boundaryExtents.left
      && currentMetrics.boundaryExtents.right === nextMetrics.boundaryExtents.right
      && currentMetrics.boundaryExtents.top === nextMetrics.boundaryExtents.top
      && currentMetrics.boundaryExtents.bottom === nextMetrics.boundaryExtents.bottom
      && currentMetrics.renderOffset.x === nextMetrics.renderOffset.x
      && currentMetrics.renderOffset.y === nextMetrics.renderOffset.y
        ? currentMetrics
        : nextMetrics
    ));
  }, []);

  return {
    folderBoundaryExtents,
    folderHalfHeight,
    folderHalfWidth,
    folderRenderOffset,
    handleFolderVisualMetricsChange,
  };
}

export function usePetContainerFoodActions({
  activityArea,
  addLog,
  clampPositionToRenderedActivityArea,
  configRef,
  folderBoundaryExtents,
  onUpdateConfig,
}: UsePetContainerFoodActionsOptions) {
  const handleCreateFood = useCallback((appearanceId?: string) => {
    const currentConfig = configRef.current;
    const nextFoodIndex = currentConfig.folders.length + 1;
    const createCandidatePosition = () => clampPositionToRenderedActivityArea(
      createRandomPositionInActivityAreaWithExtents(
        activityArea,
        folderBoundaryExtents,
      ),
      'folder',
    );
    const isOverlappingExistingFood = (position: Position) => currentConfig.folders.some((folder) => (
      Math.abs(folder.position.x - position.x) < folderBoundaryExtents.left + folderBoundaryExtents.right + 12
      && Math.abs(folder.position.y - position.y) < folderBoundaryExtents.top + folderBoundaryExtents.bottom + 12
    ));
    let randomPosition = createCandidatePosition();

    for (let attempt = 0; attempt < 24; attempt += 1) {
      if (!isOverlappingExistingFood(randomPosition)) {
        break;
      }

      randomPosition = createCandidatePosition();
    }

    const nextFolder = {
      id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `food-${Date.now()}-${Math.round(Math.random() * 1000)}`,
      name: `道具 ${nextFoodIndex}`,
      position: randomPosition,
      appearanceId: currentConfig.foodAppearances.some((appearance) => appearance.id === appearanceId)
        ? appearanceId
        : pickRandomFoodAppearanceId(currentConfig.foodAppearances),
      interactionType: undefined,
    };
    const nextConfig = {
      ...currentConfig,
      folders: [...currentConfig.folders, nextFolder],
    };

    configRef.current = nextConfig;
    onUpdateConfig(nextConfig, { normalize: false });
    addLog(`已在活动范围内创建 ${nextFolder.name}`);
  }, [
    activityArea,
    addLog,
    clampPositionToRenderedActivityArea,
    configRef,
    folderBoundaryExtents,
    onUpdateConfig,
  ]);

  return {
    handleCreateFood,
  };
}
