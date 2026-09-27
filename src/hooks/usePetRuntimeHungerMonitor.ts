import { useCallback, useEffect, type MutableRefObject } from 'react';
import { type PetConfig } from '../types';
import {
  PET_HUNGER_COAX_DELAY_MS,
  isPetHungry,
} from '../components/pet/petStatsMath';

interface UsePetRuntimeHungerMonitorOptions {
  config: PetConfig;
  configRef: MutableRefObject<PetConfig>;
  enqueueTriggeredPetSpeech: (trigger: import('../types').PetAutoSpeechTrigger) => void;
  highHungerCoaxedRef: MutableRefObject<boolean>;
  highHungerPromptedRef: MutableRefObject<boolean>;
  hungryStartedAtRef: MutableRefObject<number | null>;
  hungerCoaxTimerRef: MutableRefObject<number | null>;
  lowEnergyLoggedRef: MutableRefObject<boolean>;
}

export function usePetRuntimeHungerMonitor({
  config,
  configRef,
  enqueueTriggeredPetSpeech,
  highHungerCoaxedRef,
  highHungerPromptedRef,
  hungryStartedAtRef,
  hungerCoaxTimerRef,
  lowEnergyLoggedRef,
}: UsePetRuntimeHungerMonitorOptions) {
  const clearHighHungerCoaxTimer = useCallback(() => {
    if (hungerCoaxTimerRef.current !== null) {
      window.clearTimeout(hungerCoaxTimerRef.current);
      hungerCoaxTimerRef.current = null;
    }
  }, [hungerCoaxTimerRef]);

  const scheduleHighHungerCoaxTimer = useCallback(() => {
    clearHighHungerCoaxTimer();
    hungerCoaxTimerRef.current = window.setTimeout(() => {
      hungerCoaxTimerRef.current = null;
      if (!isPetHungry(configRef.current.stats.hunger) || highHungerCoaxedRef.current) {
        return;
      }

      highHungerCoaxedRef.current = true;
      const hungryDurationMs = hungryStartedAtRef.current === null
        ? PET_HUNGER_COAX_DELAY_MS
        : Date.now() - hungryStartedAtRef.current;

      enqueueTriggeredPetSpeech({
        kind: 'high-hunger-coax',
        hungryDurationMs,
        stats: configRef.current.stats,
      });
    }, PET_HUNGER_COAX_DELAY_MS);
  }, [
    clearHighHungerCoaxTimer,
    configRef,
    enqueueTriggeredPetSpeech,
    highHungerCoaxedRef,
    hungryStartedAtRef,
    hungerCoaxTimerRef,
  ]);

  useEffect(() => {
    if (isPetHungry(config.stats.hunger)) {
      hungryStartedAtRef.current ??= Date.now();
      if (!highHungerPromptedRef.current) {
        highHungerPromptedRef.current = true;
        highHungerCoaxedRef.current = false;
        enqueueTriggeredPetSpeech({
          kind: 'high-hunger-entry',
          hungryDurationMs: hungryStartedAtRef.current === null ? 0 : Date.now() - hungryStartedAtRef.current,
          stats: config.stats,
        });
        scheduleHighHungerCoaxTimer();
      }
      return;
    }

    hungryStartedAtRef.current = null;
    highHungerPromptedRef.current = false;
    highHungerCoaxedRef.current = false;
    lowEnergyLoggedRef.current = false;
    clearHighHungerCoaxTimer();
  }, [
    clearHighHungerCoaxTimer,
    config.settings,
    config.stats.hunger,
    enqueueTriggeredPetSpeech,
    highHungerCoaxedRef,
    highHungerPromptedRef,
    hungryStartedAtRef,
    lowEnergyLoggedRef,
    scheduleHighHungerCoaxTimer,
  ]);

  return {
    clearHighHungerCoaxTimer,
    scheduleHighHungerCoaxTimer,
  };
}
