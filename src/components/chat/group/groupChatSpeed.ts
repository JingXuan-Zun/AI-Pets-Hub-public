export const GROUP_CHAT_MIN_DELAY_MS = 5_000;
export const GROUP_CHAT_MAX_DELAY_MS = 30_000;
export const GROUP_CHAT_DEFAULT_DELAY_MS = 6_000;

export function normalizeGroupChatSpeedDelay(value: number) {
  if (!Number.isFinite(value)) return GROUP_CHAT_DEFAULT_DELAY_MS;
  return Math.min(
    GROUP_CHAT_MAX_DELAY_MS,
    Math.max(GROUP_CHAT_MIN_DELAY_MS, Math.round(value / 1_000) * 1_000),
  );
}
