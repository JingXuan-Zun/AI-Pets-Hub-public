import { getDesktopPetSlots } from '../multiPetRoster';
import { useCompanionNeedSpeech } from './useCompanionNeedSpeech';
import { startTransition, useCallback, useEffect, useRef, useState, type SetStateAction } from 'react';
import { desktopPetChatStore } from '../chatStore';
import { loadPersistedPetConfig } from '../persistentPetConfig';
import { type PetAction, type PetConfig } from '../types';
import {
  INITIAL_LOGS,
  MAX_LOG_ENTRIES,
} from './petRuntimeStateUtils';
import { usePetRuntimeConfigController } from './usePetRuntimeConfigController';
import { useDesktopPetRuntimeLogs } from './useDesktopPetRuntimeLogs';
import { usePassivePetStatsTicker } from './usePassivePetStatsTicker';
import { usePetRuntimeNeedMonitors } from './usePetRuntimeNeedMonitors';
import { usePetRuntimeSpeechController } from './usePetRuntimeSpeechController';
import { useGptSovitsAutoWarmup } from './useGptSovitsAutoWarmup';
import { resolvePetVoiceSettings } from '../voice/petVoiceSettings';
import { useProductivityScheduler } from '../productivity/useProductivityScheduler';
import { usePersistedChatHistory } from './usePersistedChatHistory';
import { useDesktopActivityAwareness } from './useDesktopActivityAwareness';
import { isOnboardingActive, onChatModelConfigured, startOnboardingOnLaunch } from '../onboarding/onboardingController';
import { isChatModelConfigured } from '../onboarding/onboardingApiSetup';
import { setSharedConfig } from '../onboarding/onboardingConfigSource';
import { useLifeCompanionScreenWatch } from './useLifeCompanionScreenWatch';

export function usePetRuntimeState() {
  const chatHistoryReady = usePersistedChatHistory();
  const [config, setConfig] = useState<PetConfig>(() => loadPersistedPetConfig());
  const [logs, setLogs] = useState<string[]>(INITIAL_LOGS);
  const [isFatigueSleeping, setIsFatigueSleeping] = useState(false);
  const [statReactionAction, setStatReactionAction] = useState<PetAction | null>(null);
  const configRef = useRef(config);
  const eatingResetTimerRef = useRef<number | null>(null);
  const fatigueSleepTimerRef = useRef<number | null>(null);
  const hungerCoaxTimerRef = useRef<number | null>(null);
  const statReactionTimerRef = useRef<number | null>(null);
  const hungryStartedAtRef = useRef<number | null>(null);
  const fatigueSleepTriggeredRef = useRef(false);
  const highHungerPromptedRef = useRef(false);
  const highHungerCoaxedRef = useRef(false);
  const lowEnergyLoggedRef = useRef(false);
  const lastObservedStatsRef = useRef(config.stats);
  const startupGreetingScheduledRef = useRef(false);
  const startupGreetingTimerRef = useRef<number | null>(null);

  const applyConfigStateUpdate = useCallback((
    updater: SetStateAction<PetConfig>,
    priority: 'normal' | 'low' = 'normal',
  ) => {
    if (priority === 'low') {
      startTransition(() => {
        setConfig(updater);
      });
      return;
    }

    setConfig(updater);
  }, []);

  const appendLogLine = useCallback((line: string) => {
    if (!line.trim()) {
      return;
    }

    setLogs((prev) => {
      if (prev[0] === line) {
        return prev;
      }

      return [line, ...prev.filter((entry) => entry !== line).slice(0, MAX_LOG_ENTRIES - 1)];
    });
  }, []);

  const addLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
    appendLogLine(`[${time}][业务] ${msg}`);
  }, [appendLogLine]);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useDesktopPetRuntimeLogs({ appendLogLine });
  const { cleanupAutoSpeech, enqueueStartupGreeting, enqueueTriggeredPetSpeech } = usePetRuntimeSpeechController({
    addLog,
    configRef,
  });
  // The first line after launch usually comes from slot 1, so its voice is the one worth preloading.
  useGptSovitsAutoWarmup(resolvePetVoiceSettings(config, 'primary'));
  const {
    cleanupNeedMonitors,
    clearHighHungerCoaxTimer,
    scheduleHighHungerCoaxTimer,
  } = usePetRuntimeNeedMonitors({
    config,
    configRef,
    enqueueTriggeredPetSpeech,
    fatigueSleepTimerRef,
    fatigueSleepTriggeredRef,
    highHungerCoaxedRef,
    highHungerPromptedRef,
    hungryStartedAtRef,
    hungerCoaxTimerRef,
    isFatigueSleeping,
    lastObservedStatsRef,
    lowEnergyLoggedRef,
    setIsFatigueSleeping,
    setStatReactionAction,
    statReactionTimerRef,
  });
  useCompanionNeedSpeech({ config, enqueueTriggeredPetSpeech });
  usePassivePetStatsTicker({
    addLog,
    applyConfigStateUpdate,
    hungryStartedAtRef,
    lowEnergyLoggedRef,
  });
  useDesktopActivityAwareness(configRef);
  useLifeCompanionScreenWatch({
    applyConfig: applyConfigStateUpdate,
    configRef,
    consented: config.settings.lifeCompanion.screenWatchConsented,
  });

  // First run (no chat model yet): 小玲's guide speaks instead of the startup greeting.
  const onboardingStartedRef = useRef(false);
  useEffect(() => {
    if (!chatHistoryReady || onboardingStartedRef.current || !isOnboardingActive(configRef.current)) return undefined;
    onboardingStartedRef.current = true;
    startupGreetingScheduledRef.current = true;
    const timer = window.setTimeout(() => { void startOnboardingOnLaunch(configRef.current); }, 1500);
    return () => window.clearTimeout(timer);
  }, [chatHistoryReady, configRef]);

  // The model was set up in the settings window (or the key changed while the guide is open).
  const lastModelKeyRef = useRef<string | null>(null);
  useEffect(() => {
    setSharedConfig(config);
    const settings = config.settings;
    const key = isChatModelConfigured(settings) ? `${settings.llmProvider}|${settings.customApiUrl}|${settings.customApiKey}|${settings.geminiApiKey}` : null;
    const previous = lastModelKeyRef.current;
    lastModelKeyRef.current = key;
    if (!chatHistoryReady || !key || key === previous || previous === undefined) return;
    void onChatModelConfigured(config);
  }, [chatHistoryReady, config]);

  useEffect(() => {
    if (
      !chatHistoryReady
      || !config.settings.lifeCompanion.startupGreetingEnabled
      || startupGreetingScheduledRef.current
      || isOnboardingActive(configRef.current)
    ) {
      return undefined;
    }

    startupGreetingTimerRef.current = window.setTimeout(() => {
      startupGreetingTimerRef.current = null;
      startupGreetingScheduledRef.current = true;
      const chatState = desktopPetChatStore.getState();
      if (chatState.messages.length > 0 || chatState.isTyping || chatState.isSpeaking) {
        return;
      }

      // Every character on the desktop says hello, one after another.
      enqueueStartupGreeting(getDesktopPetSlots(configRef.current)
        .filter((slot) => slot.isPrimary || slot.enabled)
        .map((slot) => slot.id));
    }, 1200);

    return () => {
      if (startupGreetingTimerRef.current !== null) {
        window.clearTimeout(startupGreetingTimerRef.current);
        startupGreetingTimerRef.current = null;
      }
    };
  }, [chatHistoryReady, config.settings.lifeCompanion.startupGreetingEnabled, configRef, enqueueStartupGreeting]);

  const { handleUpdateConfig, resetFolders, setAction } = usePetRuntimeConfigController({
    addLog,
    applyConfigStateUpdate,
    clearHighHungerCoaxTimer,
    config,
    eatingResetTimerRef,
    highHungerCoaxedRef,
    highHungerPromptedRef,
    scheduleHighHungerCoaxTimer,
  });
  useProductivityScheduler({ configRef, onUpdateConfig: handleUpdateConfig });

  useEffect(() => {
    return () => {
      if (eatingResetTimerRef.current !== null) {
        window.clearTimeout(eatingResetTimerRef.current);
        eatingResetTimerRef.current = null;
      }
      cleanupNeedMonitors();
      cleanupAutoSpeech();
      if (startupGreetingTimerRef.current !== null) {
        window.clearTimeout(startupGreetingTimerRef.current);
        startupGreetingTimerRef.current = null;
      }
    };
  }, [cleanupAutoSpeech, cleanupNeedMonitors]);

  return {
    addLog,
    config,
    handleUpdateConfig,
    isFatigueSleeping,
    logs,
    resetFolders,
    setAction,
    setConfig,
    statReactionAction,
  };
}
