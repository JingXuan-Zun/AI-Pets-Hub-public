import { type MutableRefObject } from 'react';
import { type PetConfig } from '../../types';
import { usePetContainerFolderVisualMetrics } from './usePetContainerEnvironmentState';
import { type DirectionalExtents } from './petActivityRegionMath';
import { usePetVisualBoundsController } from './usePetVisualBoundsController';

interface UsePetContainerVisualSceneStateOptions {
  config: PetConfig;
  configRef: MutableRefObject<PetConfig>;
  defaultPetVisualBounds: DirectionalExtents;
}

export function usePetContainerVisualSceneState({
  config,
  configRef,
  defaultPetVisualBounds,
}: UsePetContainerVisualSceneStateOptions) {
  const visualBoundsState = usePetVisualBoundsController({
    config,
    configRef,
    defaultPetVisualBounds,
  });
  const folderVisualMetricsState = usePetContainerFolderVisualMetrics();

  return {
    ...folderVisualMetricsState,
    ...visualBoundsState,
  };
}
