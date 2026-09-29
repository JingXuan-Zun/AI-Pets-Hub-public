import { type VoiceSettings } from './types';

const LOCAL_TTS_VOICE_TONE_STABILITY_MIN = 0;
const LOCAL_TTS_VOICE_TONE_STABILITY_MAX = 100;
const LOCAL_TTS_MAX_SEED = 2147483646;

export type LocalVoicePlaybackProfile = {
  voiceToneStability: number;
  lockVoiceTone: boolean;
  seed: number | null;
};

function hashTextToPositiveInt(text: string) {
  let hash = 2166136261;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) % 2147483646 + 1;
}

function parseLocalTtsRandomSeed(settings: VoiceSettings) {
  const rawValue = typeof settings.localTtsRandomSeed === 'string'
    ? settings.localTtsRandomSeed.trim()
    : '';
  if (!rawValue) {
    return null;
  }

  const numericValue = Number(rawValue);
  if (!Number.isFinite(numericValue)) {
    return null;
  }

  const normalizedValue = Math.trunc(Math.abs(numericValue));
  if (normalizedValue <= 0) {
    return null;
  }

  return Math.min(LOCAL_TTS_MAX_SEED, normalizedValue);
}

function buildStableLocalVoiceSeed(settings: VoiceSettings) {
  const explicitSeed = parseLocalTtsRandomSeed(settings);
  if (explicitSeed !== null) {
    return explicitSeed;
  }

  return hashTextToPositiveInt([
    settings.localTtsModelId || 'tts',
    settings.localVoiceReferenceId || 'reference',
    settings.localVoiceReferenceText.trim() || 'ref-text',
    settings.speechRecognitionLang || 'zh-CN',
  ].join('::'));
}

function clampLocalTtsVoiceToneStability(value: number) {
  return Math.min(
    LOCAL_TTS_VOICE_TONE_STABILITY_MAX,
    Math.max(LOCAL_TTS_VOICE_TONE_STABILITY_MIN, Math.round(value)),
  );
}

export function getLocalTtsVoiceToneStability(settings: VoiceSettings) {
  const numericValue = Number(settings.localTtsVoiceToneStability);
  if (Number.isFinite(numericValue)) {
    return clampLocalTtsVoiceToneStability(numericValue);
  }

  return settings.localTtsLockVoiceTone
    ? LOCAL_TTS_VOICE_TONE_STABILITY_MAX
    : LOCAL_TTS_VOICE_TONE_STABILITY_MIN;
}

export function resolveLocalVoicePlaybackProfile(settings: VoiceSettings): LocalVoicePlaybackProfile {
  const voiceToneStability = getLocalTtsVoiceToneStability(settings);

  return {
    voiceToneStability,
    lockVoiceTone: voiceToneStability > 0,
    seed: voiceToneStability > 0
      ? buildStableLocalVoiceSeed(settings)
      : null,
  };
}
