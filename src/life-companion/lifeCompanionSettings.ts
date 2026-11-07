export interface PetLifeCompanionSettings {
  /** Minutes before activity awareness may start another conversation. */
  desktopActivityAwarenessIntervalMinutes: number;
  desktopActivityAwarenessEnabled: boolean;
  affectionEnabled: boolean;
  /** When a task needs permission the character asks out loud, and reminds (shaking the chat) if unanswered. */
  approvalVoicePromptEnabled: boolean;
  /** Each character keeps a small "what is on her mind" state (mood, concerns) that shapes who speaks and what she brings up (cognition layer, 2026-11-06). */
  characterCognitionEnabled: boolean;
  /**
   * Her feelings toward the user only grow (user, 2026-11-06: "角色们永远都保持最高的好感度，不会掉只会
   * 增加"): affection stays at the top, hunger no longer costs affection, and the cognition layer
   * never turns her cold toward the user, whatever a persona reading says.
   */
  feelingsNeverDrop: boolean;
  /** 角色之间互通近况: characters know what the others are up to (docs/cross-chat-character-awareness-design-20261008.md). */
  crossChatAwarenessEnabled: boolean;
  hungerEnabled: boolean;
  startupGreetingEnabled: boolean;
  /**
   * Characters may speak first when something on their mind has built up (cognition layer
   * phase 2, src/character-cognition/proactiveSpeechRules.ts holds the limits).
   */
  proactiveEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursEnd: string;
  quietHoursStart: string;
  /** The user let the character watch the screen; stays on until they disconnect. */
  screenWatchConsented: boolean;
  /** Seconds between looks while watching the screen. */
  screenWatchIntervalSeconds: number;
}

export const LIFE_COMPANION_AWARENESS_INTERVAL_RANGE = { max: 120, min: 1 } as const;
export const LIFE_COMPANION_SCREEN_WATCH_INTERVAL_RANGE = { max: 900, min: 30 } as const;
const TIME_OF_DAY_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/u;

export const DEFAULT_LIFE_COMPANION_SETTINGS: PetLifeCompanionSettings = {
  desktopActivityAwarenessIntervalMinutes: 15,
  desktopActivityAwarenessEnabled: false,
  affectionEnabled: true,
  approvalVoicePromptEnabled: true,
  characterCognitionEnabled: true,
  feelingsNeverDrop: true,
  crossChatAwarenessEnabled: false,
  hungerEnabled: true,
  startupGreetingEnabled: true,
  proactiveEnabled: false,
  quietHoursEnabled: true,
  quietHoursEnd: '09:00',
  quietHoursStart: '23:00',
  screenWatchConsented: false,
  screenWatchIntervalSeconds: 300,
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
  return {
    desktopActivityAwarenessIntervalMinutes: integerRangeValue(
      input.desktopActivityAwarenessIntervalMinutes,
      DEFAULT_LIFE_COMPANION_SETTINGS.desktopActivityAwarenessIntervalMinutes,
      LIFE_COMPANION_AWARENESS_INTERVAL_RANGE.min,
      LIFE_COMPANION_AWARENESS_INTERVAL_RANGE.max,
    ),
    desktopActivityAwarenessEnabled: booleanValue(
      input.desktopActivityAwarenessEnabled,
      DEFAULT_LIFE_COMPANION_SETTINGS.desktopActivityAwarenessEnabled,
    ),
    affectionEnabled: booleanValue(input.affectionEnabled, DEFAULT_LIFE_COMPANION_SETTINGS.affectionEnabled),
    approvalVoicePromptEnabled: booleanValue(input.approvalVoicePromptEnabled, DEFAULT_LIFE_COMPANION_SETTINGS.approvalVoicePromptEnabled),
    characterCognitionEnabled: booleanValue(input.characterCognitionEnabled, DEFAULT_LIFE_COMPANION_SETTINGS.characterCognitionEnabled),
    feelingsNeverDrop: booleanValue(input.feelingsNeverDrop, DEFAULT_LIFE_COMPANION_SETTINGS.feelingsNeverDrop),
    crossChatAwarenessEnabled: booleanValue(input.crossChatAwarenessEnabled, DEFAULT_LIFE_COMPANION_SETTINGS.crossChatAwarenessEnabled),
    hungerEnabled: booleanValue(input.hungerEnabled, DEFAULT_LIFE_COMPANION_SETTINGS.hungerEnabled),
    startupGreetingEnabled: booleanValue(
      input.startupGreetingEnabled,
      DEFAULT_LIFE_COMPANION_SETTINGS.startupGreetingEnabled,
    ),
    proactiveEnabled: booleanValue(input.proactiveEnabled, DEFAULT_LIFE_COMPANION_SETTINGS.proactiveEnabled),
    quietHoursEnabled: booleanValue(input.quietHoursEnabled, DEFAULT_LIFE_COMPANION_SETTINGS.quietHoursEnabled),
    quietHoursEnd: timeOfDayValue(input.quietHoursEnd, DEFAULT_LIFE_COMPANION_SETTINGS.quietHoursEnd),
    quietHoursStart: timeOfDayValue(input.quietHoursStart, DEFAULT_LIFE_COMPANION_SETTINGS.quietHoursStart),
    screenWatchConsented: booleanValue(input.screenWatchConsented, DEFAULT_LIFE_COMPANION_SETTINGS.screenWatchConsented),
    screenWatchIntervalSeconds: integerRangeValue(
      input.screenWatchIntervalSeconds,
      DEFAULT_LIFE_COMPANION_SETTINGS.screenWatchIntervalSeconds,
      LIFE_COMPANION_SCREEN_WATCH_INTERVAL_RANGE.min,
      LIFE_COMPANION_SCREEN_WATCH_INTERVAL_RANGE.max,
    ),
  };
}
