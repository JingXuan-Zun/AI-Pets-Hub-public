import type { PetStats } from '../types';

export type LifeCompanionNeedLevel = 'critical' | 'high' | 'low' | 'normal';
export type LifeCompanionMood = 'close' | 'distant' | 'hungry' | 'steady' | 'tired';

export interface PetLifeCompanionSettings {
  desktopActivityAwarenessEnabled: boolean;
  affectionEnabled: boolean;
  hungerEnabled: boolean;
  startupGreetingEnabled: boolean;
  llmTextPromptCooldownMinutes: number;
  llmTextPromptEnabled: boolean;
  maxRandomIntervalMinutes: number;
  minRandomIntervalMinutes: number;
  proactiveEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursEnd: string;
  quietHoursStart: string;
  randomInteractionEnabled: boolean;
  textPromptCooldownMinutes: number;
  textPromptEnabled: boolean;
}

export interface LifeCompanionStatus {
  affectionLevel: LifeCompanionNeedLevel;
  hungerLevel: LifeCompanionNeedLevel;
  mood: LifeCompanionMood;
  proactiveReady: boolean;
  summary: string;
}

const DEFAULT_MIN_RANDOM_INTERVAL_MINUTES = 30;
const DEFAULT_MAX_RANDOM_INTERVAL_MINUTES = 180;
const DEFAULT_LLM_TEXT_PROMPT_COOLDOWN_MINUTES = 240;
const DEFAULT_TEXT_PROMPT_COOLDOWN_MINUTES = 120;
const MIN_RANDOM_INTERVAL_MINUTES = 5;
const MAX_RANDOM_INTERVAL_MINUTES = 720;
const MIN_LLM_TEXT_PROMPT_COOLDOWN_MINUTES = 30;
const MAX_LLM_TEXT_PROMPT_COOLDOWN_MINUTES = 1440;
const MIN_TEXT_PROMPT_COOLDOWN_MINUTES = 15;
const MAX_TEXT_PROMPT_COOLDOWN_MINUTES = 1440;
const TIME_OF_DAY_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/u;

export const DEFAULT_LIFE_COMPANION_SETTINGS: PetLifeCompanionSettings = {
  desktopActivityAwarenessEnabled: false,
  affectionEnabled: true,
  hungerEnabled: true,
  startupGreetingEnabled: true,
  llmTextPromptCooldownMinutes: DEFAULT_LLM_TEXT_PROMPT_COOLDOWN_MINUTES,
  llmTextPromptEnabled: false,
  maxRandomIntervalMinutes: DEFAULT_MAX_RANDOM_INTERVAL_MINUTES,
  minRandomIntervalMinutes: DEFAULT_MIN_RANDOM_INTERVAL_MINUTES,
  proactiveEnabled: false,
  quietHoursEnabled: true,
  quietHoursEnd: '09:00',
  quietHoursStart: '23:00',
  randomInteractionEnabled: false,
  textPromptCooldownMinutes: DEFAULT_TEXT_PROMPT_COOLDOWN_MINUTES,
  textPromptEnabled: false,
};

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function integerRangeValue(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function timeOfDayValue(value: unknown, fallback: string) {
  return typeof value === 'string' && TIME_OF_DAY_PATTERN.test(value.trim())
    ? value.trim()
    : fallback;
}

export function normalizeLifeCompanionSettings(value: unknown): PetLifeCompanionSettings {
  const input = value && typeof value === 'object'
    ? value as Partial<PetLifeCompanionSettings>
    : {};
  const minRandomIntervalMinutes = integerRangeValue(
    input.minRandomIntervalMinutes,
    DEFAULT_LIFE_COMPANION_SETTINGS.minRandomIntervalMinutes,
    MIN_RANDOM_INTERVAL_MINUTES,
    MAX_RANDOM_INTERVAL_MINUTES,
  );
  const maxRandomIntervalMinutes = integerRangeValue(
    input.maxRandomIntervalMinutes,
    DEFAULT_LIFE_COMPANION_SETTINGS.maxRandomIntervalMinutes,
    minRandomIntervalMinutes,
    MAX_RANDOM_INTERVAL_MINUTES,
  );
  const llmTextPromptCooldownMinutes = integerRangeValue(
    input.llmTextPromptCooldownMinutes,
    DEFAULT_LIFE_COMPANION_SETTINGS.llmTextPromptCooldownMinutes,
    MIN_LLM_TEXT_PROMPT_COOLDOWN_MINUTES,
    MAX_LLM_TEXT_PROMPT_COOLDOWN_MINUTES,
  );
  const textPromptCooldownMinutes = integerRangeValue(
    input.textPromptCooldownMinutes,
    DEFAULT_LIFE_COMPANION_SETTINGS.textPromptCooldownMinutes,
    MIN_TEXT_PROMPT_COOLDOWN_MINUTES,
    MAX_TEXT_PROMPT_COOLDOWN_MINUTES,
  );

  return {
    desktopActivityAwarenessEnabled: booleanValue(
      input.desktopActivityAwarenessEnabled,
      DEFAULT_LIFE_COMPANION_SETTINGS.desktopActivityAwarenessEnabled,
    ),
    affectionEnabled: booleanValue(input.affectionEnabled, DEFAULT_LIFE_COMPANION_SETTINGS.affectionEnabled),
    hungerEnabled: booleanValue(input.hungerEnabled, DEFAULT_LIFE_COMPANION_SETTINGS.hungerEnabled),
    startupGreetingEnabled: booleanValue(
      input.startupGreetingEnabled,
      DEFAULT_LIFE_COMPANION_SETTINGS.startupGreetingEnabled,
    ),
    llmTextPromptCooldownMinutes,
    llmTextPromptEnabled: booleanValue(
      input.llmTextPromptEnabled,
      DEFAULT_LIFE_COMPANION_SETTINGS.llmTextPromptEnabled,
    ),
    maxRandomIntervalMinutes,
    minRandomIntervalMinutes,
    proactiveEnabled: booleanValue(input.proactiveEnabled, DEFAULT_LIFE_COMPANION_SETTINGS.proactiveEnabled),
    quietHoursEnabled: booleanValue(input.quietHoursEnabled, DEFAULT_LIFE_COMPANION_SETTINGS.quietHoursEnabled),
    quietHoursEnd: timeOfDayValue(input.quietHoursEnd, DEFAULT_LIFE_COMPANION_SETTINGS.quietHoursEnd),
    quietHoursStart: timeOfDayValue(input.quietHoursStart, DEFAULT_LIFE_COMPANION_SETTINGS.quietHoursStart),
    randomInteractionEnabled: booleanValue(
      input.randomInteractionEnabled,
      DEFAULT_LIFE_COMPANION_SETTINGS.randomInteractionEnabled,
    ),
    textPromptCooldownMinutes,
    textPromptEnabled: booleanValue(input.textPromptEnabled, DEFAULT_LIFE_COMPANION_SETTINGS.textPromptEnabled),
  };
}

function affectionLevel(value: number): LifeCompanionNeedLevel {
  if (value <= 20) {
    return 'critical';
  }
  if (value <= 45) {
    return 'low';
  }
  if (value >= 80) {
    return 'high';
  }

  return 'normal';
}

function hungerLevel(value: number): LifeCompanionNeedLevel {
  if (value >= 90) {
    return 'critical';
  }
  if (value >= 70) {
    return 'high';
  }
  if (value <= 20) {
    return 'low';
  }

  return 'normal';
}

function resolveMood(stats: PetStats): LifeCompanionMood {
  if (stats.hunger >= 75) {
    return 'hungry';
  }
  if (stats.fatigue >= 80) {
    return 'tired';
  }
  if (stats.affection >= 80) {
    return 'close';
  }
  if (stats.affection <= 35) {
    return 'distant';
  }

  return 'steady';
}

export function createLifeCompanionStatus(
  stats: PetStats,
  settings: PetLifeCompanionSettings,
): LifeCompanionStatus {
  const normalizedSettings = normalizeLifeCompanionSettings(settings);
  const mood = resolveMood(stats);
  const proactiveReady = normalizedSettings.proactiveEnabled
    && normalizedSettings.randomInteractionEnabled
    && normalizedSettings.minRandomIntervalMinutes <= normalizedSettings.maxRandomIntervalMinutes;

  return {
    affectionLevel: affectionLevel(stats.affection),
    hungerLevel: hungerLevel(stats.hunger),
    mood,
    proactiveReady,
    summary: [
      `mood=${mood}`,
      `affection=${Math.round(stats.affection)}`,
      `hunger=${Math.round(stats.hunger)}`,
      `proactive=${proactiveReady ? 'ready' : 'off'}`,
    ].join(' '),
  };
}
