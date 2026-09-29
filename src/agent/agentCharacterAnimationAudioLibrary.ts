import { type DesktopPetAnimationToolTriggerAudio } from '../chatState';
import { type PetConfig } from '../types';
import { type AgentCharacterAnimationTimelineSync } from './agentCharacterAnimationTimelineSync';

export interface AgentCharacterAnimationAudioAsset {
  aliases: string[];
  durationMs?: number;
  id: string;
  name: string;
  url: string;
}

export interface AgentCharacterAnimationTriggerAudioResolution {
  audio: DesktopPetAnimationToolTriggerAudio | null;
  observations: string[];
}

const AUDIO_LIBRARY_KEYS = [
  'audioAssets',
  'musicAssets',
  'songAssets',
  'audioLibrary',
  'musicLibrary',
  'songs',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function finiteMsInput(value: unknown) {
  const numericValue = typeof value === 'number'
    ? value
    : trimString(value) ? Number(value) : NaN;
  return Number.isFinite(numericValue) ? Math.max(0, Math.round(numericValue)) : undefined;
}

function stringArrayInput(value: unknown) {
  return Array.isArray(value)
    ? value.map(trimString).filter(Boolean)
    : [];
}

function firstStringInput(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = trimString(record[key]);
    if (value) {
      return value;
    }
  }

  return '';
}

function normalizeAudioAssetRecord(
  record: Record<string, unknown>,
  fallbackId = '',
): AgentCharacterAnimationAudioAsset | null {
  const id = firstStringInput(record, ['id', 'audioId', 'musicId', 'songId']) || fallbackId;
  const name = firstStringInput(record, ['name', 'title', 'label']);
  const url = firstStringInput(record, ['url', 'audioUrl', 'sourceUrl', 'sourceRef', 'filePath', 'path']);
  if ((!id && !name) || !url) {
    return null;
  }

  return {
    aliases: [
      ...stringArrayInput(record.aliases),
      ...stringArrayInput(record.semanticAliases),
    ],
    ...(finiteMsInput(record.durationMs ?? record.audioDurationMs) === undefined ? {} : {
      durationMs: finiteMsInput(record.durationMs ?? record.audioDurationMs),
    }),
    id: id || name,
    name,
    url,
  };
}

function normalizeAudioAssetEntry(
  entry: unknown,
  fallbackId = '',
): AgentCharacterAnimationAudioAsset | null {
  if (typeof entry === 'string') {
    return fallbackId ? { aliases: [], id: fallbackId, name: '', url: entry.trim() } : null;
  }

  return isRecord(entry) ? normalizeAudioAssetRecord(entry, fallbackId) : null;
}

function normalizeAudioLibraryValue(value: unknown): AgentCharacterAnimationAudioAsset[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeAudioAssetEntry(entry))
      .filter((asset): asset is AgentCharacterAnimationAudioAsset => Boolean(asset));
  }

  if (!isRecord(value)) {
    return [];
  }

  const nestedItems = value.items ?? value.assets ?? value.tracks;
  if (Array.isArray(nestedItems)) {
    return normalizeAudioLibraryValue(nestedItems);
  }

  return Object.entries(value)
    .map(([key, entry]) => normalizeAudioAssetEntry(entry, key))
    .filter((asset): asset is AgentCharacterAnimationAudioAsset => Boolean(asset));
}

export function normalizeAgentCharacterAnimationAudioLibrary(
  config: PetConfig,
): AgentCharacterAnimationAudioAsset[] {
  const record = config as unknown as Record<string, unknown>;
  return AUDIO_LIBRARY_KEYS.flatMap((key) => normalizeAudioLibraryValue(record[key]));
}

function normalizeMatchKey(value: string) {
  return value.trim().toLowerCase();
}

function getAudioAssetMatchKeys(asset: AgentCharacterAnimationAudioAsset) {
  return [
    asset.id,
    asset.name,
    ...asset.aliases,
  ].map(normalizeMatchKey).filter(Boolean);
}

function findAudioAssetByRef(
  config: PetConfig,
  sourceRef: string,
): AgentCharacterAnimationAudioAsset | null {
  const normalizedRef = normalizeMatchKey(sourceRef);
  return normalizeAgentCharacterAnimationAudioLibrary(config)
    .find((asset) => getAudioAssetMatchKeys(asset).includes(normalizedRef)) ?? null;
}

function createBaseTriggerAudio(sync: AgentCharacterAnimationTimelineSync) {
  const explicitAudioUrl = trimString(sync.audioUrl);
  return {
    ...(sync.durationMs === undefined ? {} : { durationMs: sync.durationMs }),
    ...(sync.audioOffsetMs === undefined ? {} : { offsetMs: sync.audioOffsetMs }),
    ...(sync.audioStartDelayMs === undefined ? {} : { startDelayMs: sync.audioStartDelayMs }),
    source: explicitAudioUrl ? 'audio' as const : sync.source,
    sourceRef: explicitAudioUrl || sync.sourceRef,
  } satisfies DesktopPetAnimationToolTriggerAudio;
}

function createResolvedAudioObservation(
  sync: AgentCharacterAnimationTimelineSync,
  asset: AgentCharacterAnimationAudioAsset | null,
) {
  if (asset) {
    return [`Timeline audio resolved: ${sync.source}:${sync.sourceRef} -> ${asset.id}`];
  }

  return sync.audioUrl && sync.audioUrl !== sync.sourceRef
    ? [`Timeline audio resolved: ${sync.source}:${sync.sourceRef} -> explicit audioUrl`]
    : [];
}

export function resolveAgentCharacterAnimationTriggerAudio(
  sync: AgentCharacterAnimationTimelineSync | null,
  config: PetConfig,
): AgentCharacterAnimationTriggerAudioResolution {
  if (!sync) {
    return { audio: null, observations: [] };
  }

  const baseAudio = createBaseTriggerAudio(sync);
  const asset = sync.audioUrl ? null : findAudioAssetByRef(config, sync.sourceRef);
  if (!asset) {
    return {
      audio: baseAudio,
      observations: createResolvedAudioObservation(sync, null),
    };
  }

  return {
    audio: {
      ...baseAudio,
      ...(baseAudio.durationMs === undefined && asset.durationMs !== undefined ? { durationMs: asset.durationMs } : {}),
      source: 'audio',
      sourceRef: asset.url,
    },
    observations: createResolvedAudioObservation(sync, asset),
  };
}
