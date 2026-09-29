import { useCallback, useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { type PetAction, type PetConfig } from '../types';
import {
  PET_FATIGUE_SLEEP_DURATION_MS,
  isPetExhausted,
} from '../components/pet/petStatsMath';

interface UsePetRuntimeFatigueMonitorOptions {
  config: PetConfig;
  fatigueSleepTimerRef: MutableRefObject<number | null>;
  fatigueSleepTriggeredRef: MutableRefObject<boolean>;
  setIsFatigueSleeping: Dispatch<SetStateAction<boolean>>;
  setStatReactionAction: Dispatch<SetStateAction<PetAction | null>>;
  statReactionTimerRef: MutableRefObject<number | null>;
}

export function usePetRuntimeFatigueMonitor({
  config,
  fatigueSleepTimerRef,
  fatigueSleepTriggeredRef,
  setIsFatigueSleeping,
  setStatReactionAction,
  statReactionTimerRef,
}: UsePetRuntimeFatigueMonitorOptions) {
  const clearFatigueSleepTimer = useCallback(() => {
    if (fatigueSleepTimerRef.current !== null) {
      window.clearTimeout(fatigueSleepTimerRef.current);
      fatigueSleepTimerRef.current = null;
    }
  }, [fatigueSleepTimerRef]);

  const startFatigueSleep = useCallback(() => {
    clearFatigueSleepTimer();
    if (statReactionTimerRef.current !== null) {
      window.clearTimeout(statReactionTimerRef.current);
      statReactionTimerRef.current = null;
    }

    setStatReactionAction(null);
    setIsFatigueSleeping(true);
    fatigueSleepTimerRef.current = window.setTimeout(() => {
      fatigueSleepTimerRef.current = null;
      setIsFatigueSleeping(false);
    }, PET_FATIGUE_SLEEP_DURATION_MS);
  }, [
    clearFatigueSleepTimer,
    fatigueSleepTimerRef,
    setIsFatigueSleeping,
    setStatReactionAction,
    statReactionTimerRef,
  ]);

  useEffect(() => {
    if (isPetExhausted(config.stats.fatigue)) {
      if (!fatigueSleepTriggeredRef.current) {
        fatigueSleepTriggeredRef.current = true;
        startFatigueSleep();
      }
      return;
    }

    fatigueSleepTriggeredRef.current = false;
  }, [config.stats.fatigue, fatigueSleepTriggeredRef, startFatigueSleep]);

  return {
    clearFatigueSleepTimer,
  };
}
