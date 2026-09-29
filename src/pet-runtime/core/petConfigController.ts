import { useCallback, type MutableRefObject } from 'react';
import { type PetAction, type PetConfig, type PetConfigUpdateHandler } from '../../types';
import { type PetRuntimePosition } from './petRuntimeTypes';

interface UsePetConfigControllerOptions {
  configRef: MutableRefObject<PetConfig>;
  onUpdateConfig: PetConfigUpdateHandler;
  pendingPetConfigSyncRef?: MutableRefObject<boolean>;
}

export function usePetConfigController({
  configRef,
  onUpdateConfig,
  pendingPetConfigSyncRef,
}: UsePetConfigControllerOptions) {
  const commitConfig = useCallback((nextConfig: PetConfig, markPendingPositionSync = false) => {
    if (markPendingPositionSync && pendingPetConfigSyncRef) {
      pendingPetConfigSyncRef.current = true;
    }

    configRef.current = nextConfig;
    onUpdateConfig(nextConfig, { normalize: false });
  }, [configRef, onUpdateConfig, pendingPetConfigSyncRef]);

  const updatePetAction = useCallback((action: PetAction) => {
    const currentConfig = configRef.current;
    if (currentConfig.currentAction === action) {
      return;
    }

    commitConfig({
      ...currentConfig,
      currentAction: action,
    });
  }, [commitConfig, configRef]);

  const updatePetPosition = useCallback((position: PetRuntimePosition) => {
    commitConfig({
      ...configRef.current,
      position,
    }, true);
  }, [commitConfig, configRef]);

  const updateFolderPosition = useCallback((folderId: string, position: PetRuntimePosition) => {
    const currentConfig = configRef.current;
    commitConfig({
      ...currentConfig,
      folders: currentConfig.folders.map((folder) => (
        folder.id === folderId
          ? { ...folder, position }
          : folder
      )),
    });
  }, [commitConfig, configRef]);

  return {
    updateFolderPosition,
    updatePetAction,
    updatePetPosition,
  };
}
