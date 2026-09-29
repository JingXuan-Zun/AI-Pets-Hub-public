import { type DesktopPetAnimationToolTriggerAudio } from '../../chatState';
import { resolve3DModelLoaderUrl } from '../../model3dFormatSupport';

export type DesktopPetPlayableAnimationToolTriggerAudio = DesktopPetAnimationToolTriggerAudio & {
  playbackUrl: string;
};

const AUDIO_FILE_EXTENSION_PATTERN = /\.(?:aac|flac|m4a|mp3|oga|ogg|opus|wav|webm)(?:[?#].*)?$/iu;
const AUDIO_DATA_URL_PATTERN = /^data:audio\//iu;

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function finiteMsInput(value: unknown) {
  const numericValue = typeof value === 'number'
    ? value
    : trimString(value) ? Number(value) : NaN;
  return Number.isFinite(numericValue) ? Math.max(0, Math.round(numericValue)) : undefined;
}

function resolveStartDelayMs(audio: DesktopPetAnimationToolTriggerAudio) {
  return finiteMsInput((audio as { startDelayMs?: unknown; delayMs?: unknown }).startDelayMs
    ?? (audio as { delayMs?: unknown }).delayMs)
    ?? 0;
}

function resolvePlayableAudioUrl(source: DesktopPetAnimationToolTriggerAudio['source'], sourceRef: string) {
  const normalizedRef = sourceRef.trim().replace(/\\/g, '/');
  if (!normalizedRef || source === 'metadata') {
    return undefined;
  }

  if (AUDIO_DATA_URL_PATTERN.test(normalizedRef) || /^blob:/iu.test(normalizedRef)) {
    return normalizedRef;
  }

  if (/^https?:/iu.test(normalizedRef)) {
    return source === 'audio' || AUDIO_FILE_EXTENSION_PATTERN.test(normalizedRef)
      ? normalizedRef
      : undefined;
  }

  if (/^file:/iu.test(normalizedRef) || AUDIO_FILE_EXTENSION_PATTERN.test(normalizedRef)) {
    return resolve3DModelLoaderUrl(normalizedRef);
  }

  return undefined;
}

export function normalizeAnimationToolTriggerAudio(
  audio: DesktopPetAnimationToolTriggerAudio | null | undefined,
) {
  const sourceRef = trimString(audio?.sourceRef);
  if (!audio || !sourceRef) {
    return undefined;
  }

  const source = audio.source ?? 'metadata';
  const durationMs = finiteMsInput(audio.durationMs);
  const offsetMs = finiteMsInput(audio.offsetMs);
  const startDelayMs = resolveStartDelayMs(audio);
  const playbackUrl = trimString(audio.playbackUrl)
    || resolvePlayableAudioUrl(source, sourceRef);

  return {
    ...(durationMs === undefined ? {} : { durationMs }),
    ...(offsetMs === undefined ? {} : { offsetMs }),
    ...(playbackUrl ? { playbackUrl } : {}),
    source,
    sourceRef,
    ...(startDelayMs > 0 ? { startDelayMs } : {}),
  } satisfies DesktopPetAnimationToolTriggerAudio;
}

export function resolveAnimationToolTriggerAudioStartDelayMs(
  audio: DesktopPetAnimationToolTriggerAudio | null | undefined,
) {
  return Math.max(0, normalizeAnimationToolTriggerAudio(audio)?.startDelayMs ?? 0);
}

export function resolveAnimationToolTriggerPlayableAudio(
  audio: DesktopPetAnimationToolTriggerAudio | null | undefined,
) {
  const normalizedAudio = normalizeAnimationToolTriggerAudio(audio);
  return normalizedAudio?.playbackUrl
    ? normalizedAudio as DesktopPetPlayableAnimationToolTriggerAudio
    : null;
}
