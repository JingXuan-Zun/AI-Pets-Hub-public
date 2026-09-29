import type { PetConfig } from '../types';
import type { LifeCompanionLlmBackoffState } from './lifeCompanionLlmBackoff';
import { runLifeCompanionInteraction } from './lifeCompanionInteractionRunner';
import {
  resolveLifeCompanionSchedulerDelayMs,
  shouldScheduleLifeCompanionInteraction,
} from './lifeCompanionScheduler';
import {
  createLifeCompanionRuntimeStatusSnapshot,
  lifeCompanionRuntimeStatusStore,
  type LifeCompanionRuntimeEvent,
} from './lifeCompanionRuntimeStatus';
import type { LifeCompanionRuntimeOverrideState } from './lifeCompanionRuntimeOverride';

interface MutableValue<T> {
  current: T;
}

interface LifeCompanionSchedulerRefs {
  lastLlmTextPromptAtRef: MutableValue<number | null>;
  lastTextPromptAtRef: MutableValue<number | null>;
  llmBackoffStateRef: MutableValue<LifeCompanionLlmBackoffState>;
  timerRef: MutableValue<number | null>;
}

export interface LifeCompanionRuntimeSchedulerOptions extends LifeCompanionSchedulerRefs {
  addLog: (message: string) => void;
  configRef: MutableValue<PetConfig>;
  isDisposed: () => boolean;
  override: LifeCompanionRuntimeOverrideState;
  scheduleNext: () => void;
}

export function clearLifeCompanionSchedulerTimer(timerRef: MutableValue<number | null>) {
  if (timerRef.current === null) {
    return;
  }

  window.clearTimeout(timerRef.current);
  timerRef.current = null;
}

export function publishLifeCompanionRuntimeStatus(options: {
  config: PetConfig;
  event?: LifeCompanionRuntimeEvent;
  eventAt?: number | null;
  lastLlmTextPromptAt: number | null;
  lastTextPromptAt: number | null;
  llmBackoffState: LifeCompanionLlmBackoffState;
  nextInteractionAt?: number | null;
  override: LifeCompanionRuntimeOverrideState;
}) {
  lifeCompanionRuntimeStatusStore.setStatus(createLifeCompanionRuntimeStatusSnapshot({
    lastEvent: options.event,
    lastEventAt: options.eventAt,
    lastLlmTextPromptAt: options.lastLlmTextPromptAt,
    lastTextPromptAt: options.lastTextPromptAt,
    llmBackoffRetryAfter: options.llmBackoffState.retryAfter,
    llmLastErrorMessage: options.llmBackoffState.lastErrorMessage,
    nextInteractionAt: options.nextInteractionAt,
    override: options.override,
    settings: options.config.settings.lifeCompanion,
  }));
}

function publishStatusFromRefs(
  options: LifeCompanionRuntimeSchedulerOptions,
  nextInteractionAt?: number | null,
) {
  publishLifeCompanionRuntimeStatus({
    config: options.configRef.current,
    lastLlmTextPromptAt: options.lastLlmTextPromptAtRef.current,
    lastTextPromptAt: options.lastTextPromptAtRef.current,
    llmBackoffState: options.llmBackoffStateRef.current,
    nextInteractionAt,
    override: options.override,
  });
}

async function runScheduledInteraction(options: LifeCompanionRuntimeSchedulerOptions) {
  const currentConfig = options.configRef.current;
  if (!shouldScheduleLifeCompanionInteraction(currentConfig.settings.lifeCompanion)) {
    return;
  }

  const result = await runLifeCompanionInteraction({
    config: currentConfig,
    lastLlmTextPromptAt: options.lastLlmTextPromptAtRef.current,
    lastTextPromptAt: options.lastTextPromptAtRef.current,
    llmBackoffState: options.llmBackoffStateRef.current,
  });
  options.llmBackoffStateRef.current = result.llmBackoffState;
  options.lastLlmTextPromptAtRef.current = result.lastLlmTextPromptAt;
  options.lastTextPromptAtRef.current = result.lastTextPromptAt;
  publishLifeCompanionRuntimeStatus({
    config: currentConfig,
    event: result.event,
    eventAt: Date.now(),
    lastLlmTextPromptAt: options.lastLlmTextPromptAtRef.current,
    lastTextPromptAt: options.lastTextPromptAtRef.current,
    llmBackoffState: options.llmBackoffStateRef.current,
    override: options.override,
  });
  options.addLog(`主动陪伴已准备：${result.statusSummary}`);
}

function createSchedulerTimerHandler(options: LifeCompanionRuntimeSchedulerOptions) {
  return async () => {
    options.timerRef.current = null;
    if (options.isDisposed()) {
      return;
    }

    await runScheduledInteraction(options);
    options.scheduleNext();
  };
}

export function scheduleLifeCompanionRuntime(options: LifeCompanionRuntimeSchedulerOptions) {
  clearLifeCompanionSchedulerTimer(options.timerRef);
  if (options.override.manualSuspended) {
    publishStatusFromRefs(options);
    return;
  }

  const currentSettings = options.configRef.current.settings.lifeCompanion;
  if (!shouldScheduleLifeCompanionInteraction(currentSettings)) {
    publishStatusFromRefs(options);
    return;
  }

  const delayMs = resolveLifeCompanionSchedulerDelayMs(currentSettings);
  const nextInteractionAt = Date.now() + delayMs;
  publishStatusFromRefs(options, nextInteractionAt);
  options.timerRef.current = window.setTimeout(createSchedulerTimerHandler(options), delayMs);
}
