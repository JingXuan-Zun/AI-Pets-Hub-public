import { useCallback, type MutableRefObject, type SetStateAction } from 'react';
import { DEFAULT_CONFIG } from '../constants';
import { persistPetConfig } from '../persistentPetConfig';
import { normalizePetConfig } from '../petConfigNormalization';
import { type PetAction, type PetConfig, type PetConfigUpdateOptions } from '../types';
import { isPetHungry } from '../components/pet/petStatsMath';
import { measureDistance, PRIMARY_PET_EAT_CONFIRM_RADIUS, RESET_FOOD_LOG } from './petRuntimeStateUtils';

interface UsePetRuntimeConfigControllerOptions {
  addLog: (message: string) => void;
  applyConfigStateUpdate: (
    updater: SetStateAction<PetConfig>,
    priority?: 'normal' | 'low',
  ) => void;
  clearHighHungerCoaxTimer: () => void;
  config: PetConfig;
  eatingResetTimerRef: MutableRefObject<number | null>;
  highHungerCoaxedRef: MutableRefObject<boolean>;
  highHungerPromptedRef: MutableRefObject<boolean>;
  scheduleHighHungerCoaxTimer: () => void;
}

export function usePetRuntimeConfigController({
  addLog,
  applyConfigStateUpdate,
  clearHighHungerCoaxTimer,
  config,
  eatingResetTimerRef,
  highHungerCoaxedRef,
  highHungerPromptedRef,
  scheduleHighHungerCoaxTimer,
}: UsePetRuntimeConfigControllerOptions) {
  const handleUpdateConfig = useCallback((newConfig: PetConfig, options?: PetConfigUpdateOptions) => {
    let shouldResetEatingAction = false;
    const normalizedConfig = options?.normalize === false
      ? newConfig
      : normalizePetConfig(newConfig);

    applyConfigStateUpdate((prev) => {
      if (normalizedConfig.folders.length < prev.folders.length) {
        const eatenFolder = prev.folders.find(
          (folder) => !normalizedConfig.folders.find((nextFolder) => nextFolder.id === folder.id),
        );

        if (eatenFolder) {
          const primaryPetLikelyAteFood = measureDistance(
            normalizedConfig.position ?? prev.position,
            eatenFolder.position,
          ) <= PRIMARY_PET_EAT_CONFIRM_RADIUS;

          if (!primaryPetLikelyAteFood) {
            return normalizedConfig;
          }

          shouldResetEatingAction = true;
          addLog(`检测到进食事件：${eatenFolder.name}`);
          if (isPetHungry(normalizedConfig.stats.hunger)) {
            highHungerCoaxedRef.current = false;
            scheduleHighHungerCoaxTimer();
          } else {
            highHungerPromptedRef.current = false;
            highHungerCoaxedRef.current = false;
            clearHighHungerCoaxTimer();
          }
          return { ...normalizedConfig, currentAction: 'EATING' as PetAction };
        }
      }

      return normalizedConfig;
    }, options?.priority ?? 'normal');

    if (options?.persist) {
      void persistPetConfig(normalizedConfig).then((didPersistConfig) => {
        addLog(
          didPersistConfig
          ? '设置已保存，下次启动会自动恢复。'
          : '设置已应用，但本地保存失败，请稍后重试。',
        );
      });
    }

    if (!shouldResetEatingAction) {
      return;
    }

    if (eatingResetTimerRef.current !== null) {
      window.clearTimeout(eatingResetTimerRef.current);
    }

    eatingResetTimerRef.current = window.setTimeout(() => {
      eatingResetTimerRef.current = null;
      applyConfigStateUpdate((prev) => (
        prev.currentAction === 'EATING'
          ? { ...prev, currentAction: 'IDLE' }
          : prev
      ));
    }, 2000);
  }, [
    addLog,
    applyConfigStateUpdate,
    clearHighHungerCoaxTimer,
    eatingResetTimerRef,
    highHungerCoaxedRef,
    highHungerPromptedRef,
    scheduleHighHungerCoaxTimer,
  ]);

  const setAction = useCallback((action: PetAction) => {
    applyConfigStateUpdate((prev) => ({ ...prev, currentAction: action }));
    addLog(`执行动作序列：${action}`);
  }, [addLog, applyConfigStateUpdate]);

  const resetFolders = useCallback(() => {
    handleUpdateConfig({ ...config, folders: DEFAULT_CONFIG.folders });
    addLog(RESET_FOOD_LOG);
  }, [addLog, config, handleUpdateConfig]);

  return {
    handleUpdateConfig,
    resetFolders,
    setAction,
  };
}
