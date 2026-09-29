import { type PetAudioAsset } from './types';

const MAX_AUDIO_ASSETS = 80;
const MAX_AUDIO_DURATION_MS = 60 * 60 * 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function createFallbackAudioId(index: number) {
  return `audio-${index + 1}`;
}

function normalizeDurationMs(value: unknown) {
  const numericValue = typeof value === 'number'
    ? value
    : trimString(value) ? Number(value) : NaN;
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return undefined;
  }

  return Math.min(MAX_AUDIO_DURATION_MS, Math.round(numericValue));
}

function normalizeStringList(value: unknown) {
  return Array.isArray(value)
    ? Array.from(new Set(value.map(trimString).filter(Boolean)))
    : [];
}

export function normalizePetAudioAsset(value: unknown, index: number): PetAudioAsset | null {
  if (!isRecord(value)) {
    return null;
  }

  const url = trimString(value.url ?? value.audioUrl ?? value.sourceUrl ?? value.sourceRef ?? value.filePath ?? value.path);
  if (!url) {
    return null;
  }

  const name = trimString(value.name ?? value.title ?? value.label);
  const id = trimString(value.id ?? value.audioId ?? value.musicId ?? value.songId)
    || name
    || createFallbackAudioId(index);
  const durationMs = normalizeDurationMs(value.durationMs ?? value.audioDurationMs);

  return {
    aliases: normalizeStringList(value.aliases ?? value.semanticAliases),
    ...(durationMs === undefined ? {} : { durationMs }),
    id,
    name: name || id,
    url,
  };
}

export function normalizePetAudioAssets(value: unknown): PetAudioAsset[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(normalizePetAudioAsset)
    .filter((asset): asset is PetAudioAsset => Boolean(asset))
    .slice(0, MAX_AUDIO_ASSETS);
}

export function createPetAudioAssetFromDraft(options: {
  aliasesText?: string;
  durationMs?: string;
  id?: string;
  name?: string;
  url?: string;
}): PetAudioAsset | null {
  const url = trimString(options.url);
  if (!url) {
    return null;
  }

  return normalizePetAudioAsset({
    aliases: options.aliasesText?.split(/[,，]/u),
    durationMs: options.durationMs,
    id: options.id,
    name: options.name,
    url,
  }, 0);
}
