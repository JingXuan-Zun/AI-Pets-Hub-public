import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import { type FolderItem, type PetConfig, type PetConfigUpdateHandler, type PetItemInteractionType } from '../../types';
import { resolveFoodInteractionType } from '../../foodAppearances';
import { resolvePetItemInteractionEffects } from './petItemInteractionEffects';
import { publishVideoItemInteraction } from '../video2d/videoItemInteraction';
import { measurePetRuntimeDistance } from './petMovementController';
import { type PetRuntimePosition } from './petRuntimeTypes';

type FolderDragPreview = {
  folderId: string;
  position: PetRuntimePosition;
} | null;

interface UsePetNeedsControllerOptions {
  clampPetPosition: (position: PetRuntimePosition) => PetRuntimePosition;
  config: PetConfig;
  configRef: MutableRefObject<PetConfig>;
  folderDragPreviewRef: MutableRefObject<FolderDragPreview>;
  hungerAutoEatStopThreshold: number;
  hungerTriggerThreshold: number;
  onFoodConsumed?: () => void;
  onUpdateConfig: PetConfigUpdateHandler;
  pendingPetConfigSyncRef: MutableRefObject<boolean>;
  petEatReachThreshold: number;
  onItemInteraction?: (type: PetItemInteractionType) => void;
}

export function usePetNeedsController({
  clampPetPosition,
  config,
  configRef,
  folderDragPreviewRef,
  hungerAutoEatStopThreshold,
  hungerTriggerThreshold,
  onFoodConsumed,
  onUpdateConfig,
  pendingPetConfigSyncRef,
  petEatReachThreshold,
  onItemInteraction,
}: UsePetNeedsControllerOptions) {
  const foodDriveActiveRef = useRef(config.stats.hunger >= hungerTriggerThreshold);
  const interactionQueueRef = useRef(Promise.resolve());

  const resolveFolderTargetPosition = useCallback((
    folderId: string,
    fallbackPosition: PetRuntimePosition,
  ) => (
    folderDragPreviewRef.current?.folderId === folderId
      ? folderDragPreviewRef.current.position
      : fallbackPosition
  ), [folderDragPreviewRef]);

  const canEatFoodFromPosition = useCallback((position: PetRuntimePosition, foodPosition: PetRuntimePosition) => {
    const closestReachablePosition = clampPetPosition(foodPosition);
    const boundaryGap = measurePetRuntimeDistance(foodPosition, closestReachablePosition);
    return measurePetRuntimeDistance(position, foodPosition) <= petEatReachThreshold + boundaryGap;
  }, [clampPetPosition, petEatReachThreshold]);

  const canInteractWithFolder = canEatFoodFromPosition;

  const interactWithFolder = useCallback((folder: FolderItem, positionOverride?: PetRuntimePosition, isManualHandoff = false) => {
    interactionQueueRef.current = interactionQueueRef.current.then(() => {
    const currentConfig = configRef.current;
    const interactionType = resolveFoodInteractionType(folder, currentConfig.foodAppearances);
    const deliveredToVideoPet = isManualHandoff && publishVideoItemInteraction(currentConfig, folder);
    const effects = resolvePetItemInteractionEffects(
      currentConfig.folders,
      currentConfig.stats,
      folder,
      interactionType,
      positionOverride,
      deliveredToVideoPet || interactionType === 'eat',
    );
    const nextConfig = {
      ...currentConfig,
      position: positionOverride ?? currentConfig.position,
      ...effects,
    };
    pendingPetConfigSyncRef.current = true;
    configRef.current = nextConfig;
    onUpdateConfig(nextConfig, { normalize: false });
    if (interactionType === 'eat') {
      onFoodConsumed?.();
    }
    if (interactionType !== 'custom') onItemInteraction?.(interactionType);
    }).catch(() => undefined);

  }, [configRef, interactionQueueRef, onFoodConsumed, onItemInteraction, onUpdateConfig, pendingPetConfigSyncRef]);

  const eatFolder = useCallback((folder: FolderItem, positionOverride?: PetRuntimePosition) => {
    if (resolveFoodInteractionType(folder, configRef.current.foodAppearances) === 'eat') {
      interactWithFolder(folder, positionOverride);
    }
  }, [configRef, interactWithFolder]);

  const checkCollision = useCallback((x: number, y: number) => {
    const petPosition = { x, y };
    const folderToEat = configRef.current.folders.find((folder) => (
      resolveFoodInteractionType(folder, configRef.current.foodAppearances) === 'eat'
      && canEatFoodFromPosition(petPosition, folder.position)
    ));

    if (folderToEat) {
      eatFolder(folderToEat, petPosition);
    }
  }, [canEatFoodFromPosition, configRef, eatFolder]);

  const findNearestFolder = useCallback((from: PetRuntimePosition) => {
    const folders = configRef.current.folders.filter((folder) => (
      resolveFoodInteractionType(folder, configRef.current.foodAppearances) === 'eat'
    ));
    if (folders.length === 0) {
      return null;
    }

    return folders.reduce<FolderItem | null>((closestFolder, folder) => {
      if (!closestFolder) {
        return folder;
      }

      const closestDistance = measurePetRuntimeDistance(
        from,
        resolveFolderTargetPosition(closestFolder.id, closestFolder.position),
      );
      const nextDistance = measurePetRuntimeDistance(
        from,
        resolveFolderTargetPosition(folder.id, folder.position),
      );

      return nextDistance < closestDistance ? folder : closestFolder;
    }, null);
  }, [configRef, resolveFolderTargetPosition]);

  const updateStat = useCallback((key: 'affection' | 'hunger' | 'fatigue', value: number | number[]) => {
    const nextValue = Math.max(0, Math.min(100, Array.isArray(value) ? value[0] : value));
    const currentConfig = configRef.current;
    const nextConfig = {
      ...currentConfig,
      stats: {
        ...currentConfig.stats,
        [key]: nextValue,
      },
    };

    configRef.current = nextConfig;
    onUpdateConfig(nextConfig, { normalize: false });
  }, [configRef, onUpdateConfig]);

  useEffect(() => {
    if (config.stats.hunger >= hungerTriggerThreshold) {
      foodDriveActiveRef.current = true;
      return;
    }

    if (config.stats.hunger < hungerAutoEatStopThreshold) {
      foodDriveActiveRef.current = false;
    }
  }, [config.stats.hunger, hungerAutoEatStopThreshold, hungerTriggerThreshold]);

  return {
    canEatFoodFromPosition,
    canInteractWithFolder,
    checkCollision,
    eatFolder,
    findNearestFolder,
    foodDriveActiveRef,
    interactWithFolder,
    resolveFolderTargetPosition,
    updateStat,
  };
}
