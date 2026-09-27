import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { type PetAction, type PetConfig, type PetStats } from '../types';
import { usePetRuntimeFatigueMonitor } from './usePetRuntimeFatigueMonitor';
import { usePetRuntimeHungerMonitor } from './usePetRuntimeHungerMonitor';
import { usePetRuntimeStatReactionMonitor } from './usePetRuntimeStatReactionMonitor';

interface UsePetRuntimeNeedMonitorsOptions {
  config: PetConfig;
  configRef: MutableRefObject<PetConfig>;
  enqueueTriggeredPetSpeech: (trigger: import('../types').PetAutoSpeechTrigger) => void;
  hungryStartedAtRef: MutableRefObject<number | null>;
  highHungerCoaxedRef: MutableRefObject<boolean>;
  highHungerPromptedRef: MutableRefObject<boolean>;
  hungerCoaxTimerRef: MutableRefObject<number | null>;
  isFatigueSleeping: boolean;
  lastObservedStatsRef: MutableRefObject<PetStats>;
  lowEnergyLoggedRef: MutableRefObject<boolean>;
  setIsFatigueSleeping: Dispatch<SetStateAction<boolean>>;
  setStatReactionAction: Dispatch<SetStateAction<PetAction | null>>;
  statReactionTimerRef: MutableRefObject<number | null>;
  fatigueSleepTimerRef: MutableRefObject<number | null>;
  fatigueSleepTriggeredRef: MutableRefObject<boolean>;
}

export function usePetRuntimeNeedMonitors({
  config,
  configRef,
  enqueueTriggeredPetSpeech,
  hungryStartedAtRef,
  highHungerCoaxedRef,
  highHungerPromptedRef,
  hungerCoaxTimerRef,
  isFatigueSleeping,
  lastObservedStatsRef,
  lowEnergyLoggedRef,
  setIsFatigueSleeping,
  setStatReactionAction,
  statReactionTimerRef,
  fatigueSleepTimerRef,
  fatigueSleepTriggeredRef,
}: UsePetRuntimeNeedMonitorsOptions) {
  const { clearHighHungerCoaxTimer, scheduleHighHungerCoaxTimer } = usePetRuntimeHungerMonitor({
    config,
    configRef,
    enqueueTriggeredPetSpeech,
    highHungerCoaxedRef,
    highHungerPromptedRef,
    hungryStartedAtRef,
    hungerCoaxTimerRef,
    lowEnergyLoggedRef,
  });
  const { clearFatigueSleepTimer } = usePetRuntimeFatigueMonitor({
    config,
    fatigueSleepTimerRef,
    fatigueSleepTriggeredRef,
    setIsFatigueSleeping,
    setStatReactionAction,
    statReactionTimerRef,
  });
  usePetRuntimeStatReactionMonitor({
    config,
    enqueueTriggeredPetSpeech,
    isFatigueSleeping,
    lastObservedStatsRef,
    setStatReactionAction,
    statReactionTimerRef,
  });

  const cleanupNeedMonitors = useCallback(() => {
    clearFatigueSleepTimer();
    clearHighHungerCoaxTimer();
    if (statReactionTimerRef.current !== null) {
      window.clearTimeout(statReactionTimerRef.current);
      statReactionTimerRef.current = null;
    }
  }, [clearFatigueSleepTimer, clearHighHungerCoaxTimer, statReactionTimerRef]);

  return {
    cleanupNeedMonitors,
    clearHighHungerCoaxTimer,
    scheduleHighHungerCoaxTimer,
  };
}
