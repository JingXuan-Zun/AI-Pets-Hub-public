export const DEFAULT_SPEECH_PLAYBACK_RATE = 1;
export const MIN_SPEECH_PLAYBACK_RATE = 0.6;
export const MAX_SPEECH_PLAYBACK_RATE = 1.6;

export function clampSpeechPlaybackRate(value: unknown, fallback = DEFAULT_SPEECH_PLAYBACK_RATE) {
  const numericValue = typeof value === 'number' ? value : Number(value);
  const fallbackValue = Number.isFinite(fallback) ? fallback : DEFAULT_SPEECH_PLAYBACK_RATE;
  const safeValue = Number.isFinite(numericValue) ? numericValue : fallbackValue;
  const clampedValue = Math.min(MAX_SPEECH_PLAYBACK_RATE, Math.max(MIN_SPEECH_PLAYBACK_RATE, safeValue));

  return Number(clampedValue.toFixed(2));
}

export function formatSpeechPlaybackRate(value: unknown) {
  return `${clampSpeechPlaybackRate(value).toFixed(2).replace(/\.?0+$/u, '')}x`;
}
