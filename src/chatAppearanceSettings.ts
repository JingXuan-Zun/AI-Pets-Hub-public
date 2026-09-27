export const CHAT_AVATAR_DISPLAY_SIZE_MIN = 24;
export const CHAT_AVATAR_DISPLAY_SIZE_MAX = 72;
export const CHAT_AVATAR_DISPLAY_SIZE_DEFAULT = 36;

export const CHAT_BACKGROUND_IMAGE_SIZE_MIN = 50;
export const CHAT_BACKGROUND_IMAGE_SIZE_MAX = 220;
export const CHAT_BACKGROUND_IMAGE_SIZE_DEFAULT = 100;

export const CHAT_BACKGROUND_IMAGE_VISIBILITY_MIN = 20;
export const CHAT_BACKGROUND_IMAGE_VISIBILITY_MAX = 100;
export const CHAT_BACKGROUND_IMAGE_VISIBILITY_DEFAULT = 100;

export const CHAT_FONT_SIZE_MIN = 10;
export const CHAT_FONT_SIZE_MAX = 50;
export const CHAT_FONT_SIZE_DEFAULT = 14;
export const CHAT_FONT_WEIGHT_MIN = 300;
export const CHAT_FONT_WEIGHT_MAX = 1000;
export const CHAT_FONT_WEIGHT_DEFAULT = 400;

export function clampChatBubbleTransparency(value: unknown) {
  return clampNumber(value, 0, 0, 100);
}

export function resolveChatBubbleBackgroundStyle(transparency: unknown, baseOpacity = 1) {
  return { backgroundColor: `rgba(255, 255, 255, ${Number((baseOpacity * (1 - clampChatBubbleTransparency(transparency) / 100)).toFixed(3))})` };
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const numericValue = typeof value === 'number' ? value : Number(value);
  const safeValue = Number.isFinite(numericValue) ? numericValue : fallback;

  return Math.min(max, Math.max(min, Math.round(safeValue)));
}

export function clampChatAvatarDisplaySize(value: unknown, fallback = CHAT_AVATAR_DISPLAY_SIZE_DEFAULT) {
  return clampNumber(value, fallback, CHAT_AVATAR_DISPLAY_SIZE_MIN, CHAT_AVATAR_DISPLAY_SIZE_MAX);
}

export function clampChatBackgroundImageSize(value: unknown, fallback = CHAT_BACKGROUND_IMAGE_SIZE_DEFAULT) {
  return clampNumber(value, fallback, CHAT_BACKGROUND_IMAGE_SIZE_MIN, CHAT_BACKGROUND_IMAGE_SIZE_MAX);
}

export function clampChatBackgroundImageVisibility(
  value: unknown,
  fallback = CHAT_BACKGROUND_IMAGE_VISIBILITY_DEFAULT,
) {
  return clampNumber(value, fallback, CHAT_BACKGROUND_IMAGE_VISIBILITY_MIN, CHAT_BACKGROUND_IMAGE_VISIBILITY_MAX);
}

export function clampChatFontSize(value: unknown, fallback = CHAT_FONT_SIZE_DEFAULT) {
  return clampNumber(value, fallback, CHAT_FONT_SIZE_MIN, CHAT_FONT_SIZE_MAX);
}

export function clampChatFontWeight(value: unknown, fallback = CHAT_FONT_WEIGHT_DEFAULT) {
  return clampNumber(value, fallback, CHAT_FONT_WEIGHT_MIN, CHAT_FONT_WEIGHT_MAX);
}

export function resolveChatMessageTextStyle(fontSize: unknown, fontWeight: unknown) {
  const size = clampChatFontSize(fontSize);
  const weight = clampChatFontWeight(fontWeight);
  const variableFontWeight = Math.min(900, weight);
  // System CJK fonts often collapse 300-1000 into only a few weights. A
  // small continuous stroke keeps the high end visibly responsive as well.
  const strokeWidth = Math.max(0, ((weight - 400) / 600) * 0.6);

  return {
    fontFamily: '"Geist Variable", "Segoe UI", "Microsoft YaHei UI", sans-serif',
    fontSize: `${size}px`,
    fontWeight: variableFontWeight,
    fontVariationSettings: `'wght' ${variableFontWeight}`,
    WebkitTextStroke: `${strokeWidth.toFixed(2)}px currentColor`,
  };
}
