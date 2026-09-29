import { createPetAudioAssetFromDraft } from '../../petAudioAssets';
import { type PetAudioAsset, type PetConfig } from '../../types';
import { createAudioAssetDraftFromFileLike } from './settingsAudioAssetImportUtils';

export interface SettingsAudioAssetDraft {
  aliasesText: string;
  durationMs: string;
  id: string;
  name: string;
  url: string;
}

export const EMPTY_AUDIO_ASSET_DRAFT: SettingsAudioAssetDraft = {
  aliasesText: '',
  durationMs: '',
  id: '',
  name: '',
  url: '',
};

function createGeneratedAudioAssetId() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `audio-${Date.now()}-${Math.round(Math.random() * 1000)}`;
}

export function createAudioAssetDraftFromFile(file: File): SettingsAudioAssetDraft | null {
  return createAudioAssetDraftFromFileLike(file);
}

export function createSettingsAudioAssetFromDraft(
  draft: SettingsAudioAssetDraft,
): PetAudioAsset | null {
  return createPetAudioAssetFromDraft({
    ...draft,
    id: draft.id || createGeneratedAudioAssetId(),
    name: draft.name || draft.id,
  });
}

export function upsertSettingsAudioAsset(
  config: PetConfig,
  asset: PetAudioAsset,
) {
  const musicAssets = config.musicAssets ?? [];
  const exists = musicAssets.some((item) => item.id === asset.id);
  return {
    ...config,
    musicAssets: exists
      ? musicAssets.map((item) => (item.id === asset.id ? asset : item))
      : [...musicAssets, asset],
  };
}

export function upsertSettingsAudioAssets(
  config: PetConfig,
  assets: PetAudioAsset[],
) {
  return assets.reduce(upsertSettingsAudioAsset, config);
}

export function removeSettingsAudioAsset(
  config: PetConfig,
  assetId: string,
) {
  const musicAssets = config.musicAssets ?? [];
  return {
    ...config,
    musicAssets: musicAssets.filter((asset) => asset.id !== assetId),
  };
}
