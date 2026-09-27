import { PetConfig } from './types';

const DATE_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  weekday: 'long',
});

const TIME_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

function resolveDayPeriod(date: Date) {
  const hour = date.getHours();

  if (hour < 5) {
    return '\u6df1\u591c';
  }
  if (hour < 8) {
    return '\u6e05\u6668';
  }
  if (hour < 11) {
    return '\u4e0a\u5348';
  }
  if (hour < 13) {
    return '\u4e2d\u5348';
  }
  if (hour < 18) {
    return '\u4e0b\u5348';
  }
  if (hour < 22) {
    return '\u665a\u4e0a';
  }

  return '\u591c\u95f4';
}

export function isRealWorldTimeAwarenessEnabled(settings: PetConfig['settings']) {
  return settings.timeAwarenessEnabled !== false;
}

export function getRealWorldTimeSnapshot(now = new Date()) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local';

  return {
    dateText: DATE_FORMATTER.format(now),
    timeText: TIME_FORMATTER.format(now),
    timezone,
    dayPeriod: resolveDayPeriod(now),
    isoText: now.toISOString(),
  };
}

export function buildRealWorldTimeSystemInstruction(
  baseInstruction: string,
  settings: PetConfig['settings'],
  now = new Date(),
) {
  if (!isRealWorldTimeAwarenessEnabled(settings)) {
    return baseInstruction;
  }

  const snapshot = getRealWorldTimeSnapshot(now);
  const awarenessBlock = [
    '\u8865\u5145\u7cfb\u7edf\u4fe1\u606f\uff1a\u73b0\u5b9e\u4e16\u754c\u65f6\u95f4\u611f\u77e5\u5df2\u542f\u7528\u3002',
    `\u5f53\u524d\u672c\u5730\u65e5\u671f\uff1a${snapshot.dateText}`,
    `\u5f53\u524d\u672c\u5730\u65f6\u95f4\uff1a${snapshot.timeText}`,
    `\u5f53\u524d\u65f6\u533a\uff1a${snapshot.timezone}`,
    `\u5f53\u524d\u65f6\u95f4\u6bb5\uff1a${snapshot.dayPeriod}`,
    '\u5f53\u7528\u6237\u63d0\u5230\u201c\u4eca\u5929\u201d\u3001\u201c\u660e\u5929\u201d\u3001\u201c\u521a\u521a\u201d\u3001\u201c\u73b0\u5728\u201d\u3001\u201c\u65e9\u4e0a\u201d\u3001\u201c\u665a\u4e0a\u201d\u7b49\u76f8\u5bf9\u65f6\u95f4\u65f6\uff0c\u8bf7\u4ee5\u4e0a\u8ff0\u771f\u5b9e\u65f6\u95f4\u4e3a\u51c6\u3002',
  ].join('\n');

  const trimmedInstruction = baseInstruction.trim();
  return trimmedInstruction
    ? `${trimmedInstruction}\n\n${awarenessBlock}`
    : awarenessBlock;
}
