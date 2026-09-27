import { type PetAudioAsset, type PetConfig } from '../../types';
import { type SkillTimelineEditorDraft } from './settingsSkillTimelineEditorModel';

export interface SettingsSkillTimelineAudioAssetOption {
  aliases: string[];
  durationMs?: number;
  id: string;
  label: string;
  url: string;
}

function createAudioAssetLabel(asset: PetAudioAsset) {
  return asset.name && asset.name !== asset.id
    ? `${asset.name} (${asset.id})`
    : asset.id;
}

export function createSettingsSkillTimelineAudioAssetOptions(
  config: PetConfig,
): SettingsSkillTimelineAudioAssetOption[] {
  return (config.musicAssets ?? [])
    .filter((asset) => asset.id.trim() && asset.url.trim())
    .map((asset) => ({
      aliases: asset.aliases ?? [],
      ...(asset.durationMs === undefined ? {} : { durationMs: asset.durationMs }),
      id: asset.id,
      label: createAudioAssetLabel(asset),
      url: asset.url,
    }));
}

export function resolveSelectedSkillTimelineAudioAssetId(
  draft: SkillTimelineEditorDraft,
  options: SettingsSkillTimelineAudioAssetOption[],
) {
  const songId = draft.songId.trim();
  return options.some((option) => option.id === songId) ? songId : '';
}

export function applySettingsSkillTimelineAudioAssetSelection(
  draft: SkillTimelineEditorDraft,
  options: SettingsSkillTimelineAudioAssetOption[],
  selectedId: string,
): SkillTimelineEditorDraft {
  const selected = options.find((option) => option.id === selectedId);
  if (!selected) {
    return { ...draft, songId: selectedId };
  }

  return {
    ...draft,
    audioUrl: selected.url,
    durationMs: selected.durationMs === undefined ? '' : String(selected.durationMs),
    songId: selected.id,
  };
}
