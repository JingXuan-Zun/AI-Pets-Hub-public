import { useEffect, type MutableRefObject, type SetStateAction } from 'react';
import { type PetConfig } from '../types';
import {
  PET_STATS_TICK_MS,
  isPetHungry,
} from '../components/pet/petStatsMath';
import { applyLifeCompanionPassiveGrowthTick } from '../life-companion/lifeCompanionGrowthController';
import { LOW_ENERGY_LOG } from './petRuntimeStateUtils';

interface UsePassivePetStatsTickerOptions {
  addLog: (message: string) => void;
  applyConfigStateUpdate: (
    updater: SetStateAction<PetConfig>,
    priority?: 'normal' | 'low',
  ) => void;
  hungryStartedAtRef: MutableRefObject<number | null>;
  lowEnergyLoggedRef: MutableRefObject<boolean>;
}

export function usePassivePetStatsTicker({
  addLog,
  applyConfigStateUpdate,
  hungryStartedAtRef,
  lowEnergyLoggedRef,
}: UsePassivePetStatsTickerOptions) {
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();

      applyConfigStateUpdate((prev) => {
        const nextHunger = Math.min(100, prev.stats.hunger + 1);

        if (isPetHungry(nextHunger)) {
          hungryStartedAtRef.current ??= now;
        } else {
          hungryStartedAtRef.current = null;
          lowEnergyLoggedRef.current = false;
        }

        const hungryDurationMs = hungryStartedAtRef.current === null
          ? 0
          : now - hungryStartedAtRef.current;
        const growthResult = applyLifeCompanionPassiveGrowthTick({
          hungryDurationMs,
          stats: prev.stats,
          tickMs: PET_STATS_TICK_MS,
        });
        const nextStats = growthResult.nextStats;

        if (isPetHungry(nextStats.hunger) && !lowEnergyLoggedRef.current) {
          addLog(LOW_ENERGY_LOG);
          lowEnergyLoggedRef.current = true;
        }

        return {
          ...prev,
          stats: nextStats,
        };
      }, 'low');
    }, PET_STATS_TICK_MS);

    return () => clearInterval(interval);
  }, [addLog, applyConfigStateUpdate, hungryStartedAtRef, lowEnergyLoggedRef]);
}
