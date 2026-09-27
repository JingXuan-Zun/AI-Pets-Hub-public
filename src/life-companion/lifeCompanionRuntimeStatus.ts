import { useSyncExternalStore } from 'react';
import {
  isLifeCompanionQuietHour,
  shouldGenerateLifeCompanionLlmTextPrompt,
  shouldPublishLifeCompanionTextPrompt,
} from './lifeCompanionScheduler';
import {
  normalizeLifeCompanionSettings,
  type PetLifeCompanionSettings,
} from './lifeCompanionSettings';
import {
  DEFAULT_LIFE_COMPANION_RUNTIME_OVERRIDE,
  type LifeCompanionRuntimeOverrideState,
} from './lifeCompanionRuntimeOverride';

export type LifeCompanionRuntimePhase = 'armed' | 'disabled' | 'quiet-hours' | 'suspended';
export type LifeCompanionLlmTextPromptState = 'backoff' | 'cooldown' | 'off' | 'ready';
export type LifeCompanionTextPromptState = 'cooldown' | 'off' | 'ready';
export type LifeCompanionRuntimeEvent =
  | 'draft-ready'
  | 'llm-backoff'
  | 'llm-error'
  | 'llm-published'
  | 'none'
  | 'text-busy'
  | 'text-published';

export interface LifeCompanionRuntimeStatus {
  detail: string;
  lastEvent: LifeCompanionRuntimeEvent;
  lastEventAt: number | null;
  lastLlmTextPromptAt: number | null;
  llmBackoffRetryAfter: number | null;
  llmLastErrorMessage: string | null;
  lastTextPromptAt: number | null;
  llmTextPromptState: LifeCompanionLlmTextPromptState;
  nextInteractionAt: number | null;
  phase: LifeCompanionRuntimePhase;
  textPromptState: LifeCompanionTextPromptState;
  updatedAt: number;
}

interface RuntimeStatusSnapshotOptions {
  lastEvent?: LifeCompanionRuntimeEvent;
  lastEventAt?: number | null;
  lastLlmTextPromptAt?: number | null;
  llmBackoffRetryAfter?: number | null;
  llmLastErrorMessage?: string | null;
  lastTextPromptAt?: number | null;
  nextInteractionAt?: number | null;
  now?: number;
  override?: LifeCompanionRuntimeOverrideState;
  settings: PetLifeCompanionSettings;
}

type Listener = () => void;

export const DEFAULT_LIFE_COMPANION_RUNTIME_STATUS: LifeCompanionRuntimeStatus = {
  detail: 'not initialized',
  lastEvent: 'none',
  lastEventAt: null,
  lastLlmTextPromptAt: null,
  llmBackoffRetryAfter: null,
  llmLastErrorMessage: null,
  lastTextPromptAt: null,
  llmTextPromptState: 'off',
  nextInteractionAt: null,
  phase: 'disabled',
  textPromptState: 'off',
  updatedAt: 0,
};

function resolvePhase(
  settings: PetLifeCompanionSettings,
  now: number,
  override: LifeCompanionRuntimeOverrideState,
): LifeCompanionRuntimePhase {
  if (override.manualSuspended) {
    return 'suspended';
  }
  if (!settings.proactiveEnabled || !settings.randomInteractionEnabled) {
    return 'disabled';
  }

  return isLifeCompanionQuietHour(settings, new Date(now)) ? 'quiet-hours' : 'armed';
}

function resolveDetail(settings: PetLifeCompanionSettings, phase: LifeCompanionRuntimePhase) {
  if (phase === 'suspended') {
    return 'manual suspend';
  }
  if (phase === 'disabled') {
    return !settings.proactiveEnabled ? 'proactive off' : 'random off';
  }
  if (phase === 'quiet-hours') {
    return `quiet ${settings.quietHoursStart}-${settings.quietHoursEnd}`;
  }

  return 'waiting for next random window';
}

function resolveTextPromptState(options: {
  lastTextPromptAt: number | null;
  now: number;
  settings: PetLifeCompanionSettings;
}): LifeCompanionTextPromptState {
  if (!options.settings.textPromptEnabled) {
    return 'off';
  }

  return shouldPublishLifeCompanionTextPrompt({
    lastPromptAt: options.lastTextPromptAt,
    now: options.now,
    settings: options.settings,
  }) ? 'ready' : 'cooldown';
}

function resolveLlmTextPromptState(options: {
  lastLlmTextPromptAt: number | null;
  llmBackoffRetryAfter: number | null;
  now: number;
  settings: PetLifeCompanionSettings;
}): LifeCompanionLlmTextPromptState {
  if (!options.settings.llmTextPromptEnabled) {
    return 'off';
  }
  if (options.llmBackoffRetryAfter !== null && options.now < options.llmBackoffRetryAfter) {
    return 'backoff';
  }

  return shouldGenerateLifeCompanionLlmTextPrompt({
    lastPromptAt: options.lastLlmTextPromptAt,
    now: options.now,
    settings: options.settings,
  }) ? 'ready' : 'cooldown';
}

export function createLifeCompanionRuntimeStatusSnapshot(
  options: RuntimeStatusSnapshotOptions,
): LifeCompanionRuntimeStatus {
  const settings = normalizeLifeCompanionSettings(options.settings);
  const now = Number.isFinite(options.now) ? options.now as number : Date.now();
  const override = options.override ?? DEFAULT_LIFE_COMPANION_RUNTIME_OVERRIDE;
  const phase = resolvePhase(settings, now, override);
  const lastLlmTextPromptAt = options.lastLlmTextPromptAt ?? null;
  const llmBackoffRetryAfter = options.llmBackoffRetryAfter ?? null;
  const lastTextPromptAt = options.lastTextPromptAt ?? null;

  return {
    detail: resolveDetail(settings, phase),
    lastEvent: options.lastEvent ?? 'none',
    lastEventAt: options.lastEventAt ?? null,
    lastLlmTextPromptAt,
    llmBackoffRetryAfter,
    llmLastErrorMessage: options.llmLastErrorMessage ?? null,
    lastTextPromptAt,
    llmTextPromptState: resolveLlmTextPromptState({
      lastLlmTextPromptAt,
      llmBackoffRetryAfter,
      now,
      settings,
    }),
    nextInteractionAt: phase === 'armed' ? options.nextInteractionAt ?? null : null,
    phase,
    textPromptState: resolveTextPromptState({ lastTextPromptAt, now, settings }),
    updatedAt: now,
  };
}

function createLifeCompanionRuntimeStatusStore() {
  let status = DEFAULT_LIFE_COMPANION_RUNTIME_STATUS;
  const listeners = new Set<Listener>();

  return {
    getSnapshot() {
      return status;
    },
    setStatus(nextStatus: LifeCompanionRuntimeStatus) {
      status = nextStatus;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const lifeCompanionRuntimeStatusStore = createLifeCompanionRuntimeStatusStore();

export function useLifeCompanionRuntimeStatus() {
  return useSyncExternalStore(
    lifeCompanionRuntimeStatusStore.subscribe,
    lifeCompanionRuntimeStatusStore.getSnapshot,
    lifeCompanionRuntimeStatusStore.getSnapshot,
  );
}
