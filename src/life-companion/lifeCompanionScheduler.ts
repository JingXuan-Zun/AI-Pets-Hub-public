import type { PetStats } from '../types';
import {
  createLifeCompanionStatus,
  normalizeLifeCompanionSettings,
  type LifeCompanionStatus,
  type PetLifeCompanionSettings,
} from './lifeCompanionSettings';

const MINUTE_MS = 60 * 1000;
const TIME_PART_PATTERN = /^(\d{2}):(\d{2})$/u;

function clampUnitInterval(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

function parseTimeOfDayMinutes(value: string) {
  const match = TIME_PART_PATTERN.exec(value);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
}

function resolveNowMinutes(now: Date) {
  return now.getHours() * 60 + now.getMinutes();
}

export function isLifeCompanionQuietHour(
  settings: PetLifeCompanionSettings,
  now = new Date(),
) {
  const normalizedSettings = normalizeLifeCompanionSettings(settings);
  if (!normalizedSettings.quietHoursEnabled) {
    return false;
  }

  const startMinutes = parseTimeOfDayMinutes(normalizedSettings.quietHoursStart);
  const endMinutes = parseTimeOfDayMinutes(normalizedSettings.quietHoursEnd);
  if (startMinutes === null || endMinutes === null || startMinutes === endMinutes) {
    return false;
  }

  const nowMinutes = resolveNowMinutes(now);
  return startMinutes < endMinutes
    ? nowMinutes >= startMinutes && nowMinutes < endMinutes
    : nowMinutes >= startMinutes || nowMinutes < endMinutes;
}

export function shouldScheduleLifeCompanionInteraction(
  settings: PetLifeCompanionSettings,
  now = new Date(),
) {
  const normalizedSettings = normalizeLifeCompanionSettings(settings);

  return normalizedSettings.proactiveEnabled
    && normalizedSettings.randomInteractionEnabled
    && !isLifeCompanionQuietHour(normalizedSettings, now);
}

export function shouldPublishLifeCompanionTextPrompt(options: {
  lastPromptAt: number | null;
  now?: number;
  settings: PetLifeCompanionSettings;
}) {
  const normalizedSettings = normalizeLifeCompanionSettings(options.settings);
  if (!normalizedSettings.textPromptEnabled) {
    return false;
  }
  if (options.lastPromptAt === null) {
    return true;
  }

  const now = Number.isFinite(options.now) ? options.now as number : Date.now();
  const cooldownMs = normalizedSettings.textPromptCooldownMinutes * MINUTE_MS;

  return now - options.lastPromptAt >= cooldownMs;
}

export function shouldGenerateLifeCompanionLlmTextPrompt(options: {
  lastPromptAt: number | null;
  now?: number;
  settings: PetLifeCompanionSettings;
}) {
  const normalizedSettings = normalizeLifeCompanionSettings(options.settings);
  if (!normalizedSettings.llmTextPromptEnabled) {
    return false;
  }
  if (options.lastPromptAt === null) {
    return true;
  }

  const now = Number.isFinite(options.now) ? options.now as number : Date.now();
  const cooldownMs = normalizedSettings.llmTextPromptCooldownMinutes * MINUTE_MS;

  return now - options.lastPromptAt >= cooldownMs;
}

export function resolveLifeCompanionSchedulerDelayMs(
  settings: PetLifeCompanionSettings,
  random = Math.random,
) {
  const normalizedSettings = normalizeLifeCompanionSettings(settings);
  const minMinutes = normalizedSettings.minRandomIntervalMinutes;
  const maxMinutes = normalizedSettings.maxRandomIntervalMinutes;
  const randomValue = clampUnitInterval(random());
  const rangeMinutes = maxMinutes - minMinutes;
  const delayMinutes = minMinutes + Math.round(rangeMinutes * randomValue);

  return delayMinutes * MINUTE_MS;
}

export function createLifeCompanionDraftPrompt(
  status: LifeCompanionStatus,
  petName = '桌宠',
) {
  if (status.mood === 'hungry') {
    return `${petName}好像有点饿了，要不要陪我聊聊吃点什么？`;
  }
  if (status.mood === 'tired') {
    return `${petName}有点困，想安静陪你一会儿。`;
  }
  if (status.mood === 'distant') {
    return `${petName}想和你多熟悉一点，要不要聊两句？`;
  }
  if (status.mood === 'close') {
    return `${petName}心情不错，想主动和你分享一下近况。`;
  }

  return `${petName}想陪你聊一会儿。`;
}

export function createLifeCompanionDraftFromState(
  stats: PetStats,
  settings: PetLifeCompanionSettings,
  petName?: string,
) {
  const status = createLifeCompanionStatus(stats, settings);

  return {
    prompt: createLifeCompanionDraftPrompt(status, petName),
    status,
  };
}
