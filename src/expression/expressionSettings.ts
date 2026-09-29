export interface ExpressionReplySettings {
  enabled: boolean;
  imageLibraryEnabled: boolean;
  imageLibraryMode: 'external' | 'managed' | null;
  imageLibraryWeightInitialized: boolean;
  imageStickerWeight: number;
  kaomojiWeight: number;
  recentExpressionWindow: number;
  systemEmojiWeight: number;
}

export const DEFAULT_EXPRESSION_REPLY_SETTINGS: ExpressionReplySettings = {
  enabled: true,
  imageLibraryEnabled: false,
  imageLibraryMode: null,
  imageLibraryWeightInitialized: true,
  imageStickerWeight: 0,
  kaomojiWeight: 30,
  recentExpressionWindow: 5,
  systemEmojiWeight: 20,
};

function clampInteger(value: unknown, fallback: number, minimum: number, maximum: number) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.round(numericValue)));
}

export function normalizeExpressionReplySettings(value: unknown): ExpressionReplySettings {
  const input = value && typeof value === 'object'
    ? value as Partial<ExpressionReplySettings>
    : {};

  const imageLibraryWeightInitialized = input.imageLibraryWeightInitialized === true;
  const migrateEnabledLibraryWeight = input.imageLibraryEnabled === true && !imageLibraryWeightInitialized;
  return {
    enabled: typeof input.enabled === 'boolean'
      ? input.enabled
      : DEFAULT_EXPRESSION_REPLY_SETTINGS.enabled,
    imageLibraryEnabled: typeof input.imageLibraryEnabled === 'boolean'
      ? input.imageLibraryEnabled
      : DEFAULT_EXPRESSION_REPLY_SETTINGS.imageLibraryEnabled,
    imageLibraryMode: input.imageLibraryMode === 'managed' || input.imageLibraryMode === 'external'
      ? input.imageLibraryMode
      : null,
    imageLibraryWeightInitialized: true,
    imageStickerWeight: migrateEnabledLibraryWeight ? 0 : clampInteger(
      input.imageStickerWeight,
      DEFAULT_EXPRESSION_REPLY_SETTINGS.imageStickerWeight,
      0,
      100,
    ),
    kaomojiWeight: clampInteger(input.kaomojiWeight, 30, 0, 100),
    recentExpressionWindow: clampInteger(input.recentExpressionWindow, 5, 1, 20),
    systemEmojiWeight: clampInteger(input.systemEmojiWeight, 20, 0, 100),
  };
}

export function calculateExpressionReplyPercentages(settings: ExpressionReplySettings) {
  const total = settings.imageStickerWeight + settings.systemEmojiWeight + settings.kaomojiWeight;
  if (total <= 0) return { imageSticker: 0, kaomoji: 0, systemEmoji: 0 };
  return {
    imageSticker: Math.round((settings.imageStickerWeight / total) * 100),
    kaomoji: Math.round((settings.kaomojiWeight / total) * 100),
    systemEmoji: Math.round((settings.systemEmojiWeight / total) * 100),
  };
}

export function calculateEffectiveExpressionReplySettings(
  settings: ExpressionReplySettings,
  imageCandidateCount: number,
): ExpressionReplySettings {
  return {
    ...settings,
    imageStickerWeight: settings.imageLibraryEnabled && settings.imageLibraryMode && imageCandidateCount > 0
      ? settings.imageStickerWeight
      : 0,
  };
}
