import { normalizeLifeCompanionSettings, type PetLifeCompanionSettings } from './lifeCompanionSettings';

// Quiet hours, shared by everything that may speak up on its own (proactive speech, desktop
// awareness, screen watch).

const TIME_PART_PATTERN = /^(\d{2}):(\d{2})$/u;

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
