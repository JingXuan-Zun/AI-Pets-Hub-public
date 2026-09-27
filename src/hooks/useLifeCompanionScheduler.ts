import { useEffect, useRef, type MutableRefObject } from 'react';
import {
  clearLifeCompanionSchedulerTimer,
  publishLifeCompanionRuntimeStatus,
  scheduleLifeCompanionRuntime,
} from '../life-companion/lifeCompanionRuntimeScheduler';
import { useLifeCompanionRuntimeOverride } from '../life-companion/lifeCompanionRuntimeOverride';
import { DEFAULT_LIFE_COMPANION_LLM_BACKOFF_STATE } from '../life-companion/lifeCompanionLlmBackoff';
import type { PetConfig } from '../types';

interface UseLifeCompanionSchedulerOptions {
  addLog: (message: string) => void;
  config: PetConfig;
  configRef: MutableRefObject<PetConfig>;
}

export function useLifeCompanionScheduler({
  addLog,
  config,
  configRef,
}: UseLifeCompanionSchedulerOptions) {
  const timerRef = useRef<number | null>(null);
  const llmBackoffStateRef = useRef({ ...DEFAULT_LIFE_COMPANION_LLM_BACKOFF_STATE });
  const lastLlmTextPromptAtRef = useRef<number | null>(null);
  const lastTextPromptAtRef = useRef<number | null>(null);
  const override = useLifeCompanionRuntimeOverride();
  const settings = config.settings.lifeCompanion;

  useEffect(() => {
    let disposed = false;

    const scheduleNext = () => {
      scheduleLifeCompanionRuntime({
        addLog,
        configRef,
        isDisposed: () => disposed,
        lastLlmTextPromptAtRef,
        lastTextPromptAtRef,
        llmBackoffStateRef,
        override,
        scheduleNext,
        timerRef,
      });
    };

    scheduleNext();

    return () => {
      disposed = true;
      clearLifeCompanionSchedulerTimer(timerRef);
      publishLifeCompanionRuntimeStatus({
        config: configRef.current,
        lastLlmTextPromptAt: lastLlmTextPromptAtRef.current,
        llmBackoffState: llmBackoffStateRef.current,
        lastTextPromptAt: lastTextPromptAtRef.current,
        override,
      });
    };
  }, [
    addLog,
    configRef,
    override.manualSuspended,
    settings.maxRandomIntervalMinutes,
    settings.minRandomIntervalMinutes,
    settings.proactiveEnabled,
    settings.quietHoursEnabled,
    settings.quietHoursEnd,
    settings.quietHoursStart,
    settings.randomInteractionEnabled,
    settings.llmTextPromptCooldownMinutes,
    settings.llmTextPromptEnabled,
    settings.textPromptCooldownMinutes,
    settings.textPromptEnabled,
  ]);
}
