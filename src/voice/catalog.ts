import { desktopPetShellRuntime } from '../desktopShellRuntime';
import { type LocalVoiceAssets } from '../types';
import { EMPTY_LOCAL_VOICE_ASSETS } from './shared';

const LOCAL_VOICE_ASSET_CACHE_TTL_MS = 15000;

interface ListLocalVoiceAssetsOptions {
  forceRefresh?: boolean;
}

let cachedLocalVoiceAssets: LocalVoiceAssets | null = null;
let cachedLocalVoiceAssetsAt = 0;
let pendingLocalVoiceAssetsPromise: Promise<LocalVoiceAssets> | null = null;

function normalizeModelOptions(input: unknown) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter((entry): entry is { id?: unknown; label?: unknown; path?: unknown } => Boolean(entry && typeof entry === 'object'))
    .map((entry) => ({
      id: typeof entry.id === 'string' ? entry.id : '',
      label: typeof entry.label === 'string' ? entry.label : '',
      path: typeof entry.path === 'string' ? entry.path : '',
    }))
    .filter((entry) => entry.id && entry.label && entry.path);
}

function normalizeReferenceOptions(input: unknown) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter((entry): entry is { id?: unknown; label?: unknown; path?: unknown; sampleCount?: unknown; sampleFiles?: unknown } => Boolean(entry && typeof entry === 'object'))
    .map((entry) => ({
      id: typeof entry.id === 'string' ? entry.id : '',
      label: typeof entry.label === 'string' ? entry.label : '',
      path: typeof entry.path === 'string' ? entry.path : '',
      sampleCount: typeof entry.sampleCount === 'number' && Number.isFinite(entry.sampleCount) ? entry.sampleCount : 0,
      sampleFiles: Array.isArray(entry.sampleFiles)
        ? entry.sampleFiles.filter((item): item is string => typeof item === 'string')
        : [],
    }))
    .filter((entry) => entry.id && entry.label && entry.path);
}

export function normalizeLocalVoiceAssets(input: unknown): LocalVoiceAssets {
  if (!input || typeof input !== 'object') {
    return EMPTY_LOCAL_VOICE_ASSETS;
  }

  return {
    rootPath: typeof (input as { rootPath?: unknown }).rootPath === 'string'
      ? (input as { rootPath: string }).rootPath
      : null,
    ttsModels: normalizeModelOptions((input as { ttsModels?: unknown }).ttsModels),
    sttModels: normalizeModelOptions((input as { sttModels?: unknown }).sttModels),
    references: normalizeReferenceOptions((input as { references?: unknown }).references),
  };
}

export async function listLocalVoiceAssets(options: ListLocalVoiceAssetsOptions = {}) {
  const forceRefresh = Boolean(options.forceRefresh);
  const now = Date.now();

  if (!forceRefresh && cachedLocalVoiceAssets && now - cachedLocalVoiceAssetsAt < LOCAL_VOICE_ASSET_CACHE_TTL_MS) {
    return cachedLocalVoiceAssets;
  }

  if (!forceRefresh && pendingLocalVoiceAssetsPromise) {
    return pendingLocalVoiceAssetsPromise;
  }

  const request = desktopPetShellRuntime.listLocalVoiceAssets({ forceRefresh })
    .then((result) => {
      const normalized = normalizeLocalVoiceAssets(result);
      cachedLocalVoiceAssets = normalized;
      cachedLocalVoiceAssetsAt = Date.now();
      return normalized;
    })
    .catch(() => cachedLocalVoiceAssets ?? EMPTY_LOCAL_VOICE_ASSETS)
    .finally(() => {
      if (pendingLocalVoiceAssetsPromise === request) {
        pendingLocalVoiceAssetsPromise = null;
      }
    });

  pendingLocalVoiceAssetsPromise = request;
  return request;
}
