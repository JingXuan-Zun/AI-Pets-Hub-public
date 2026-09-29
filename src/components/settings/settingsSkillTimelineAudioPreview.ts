import { type DesktopPetAnimationToolTriggerAudio } from '../../chatState';
import { normalizeAnimationToolTriggerAudio } from '../pet/animationToolTriggerAudio';
import { type SettingsSkillTimelineAudioAssetOption } from './settingsSkillTimelineAudioAssetOptions';
import { type SkillTimelineEditorDraft } from './settingsSkillTimelineEditorModel';

export interface SettingsSkillTimelineAudioPreviewSource {
  label: string;
  playbackUrl: string;
  sourceAudio: DesktopPetAnimationToolTriggerAudio;
}

function createPreviewAudioFromDraft(
  draft: SkillTimelineEditorDraft,
  audioAssetOptions: SettingsSkillTimelineAudioAssetOption[],
): DesktopPetAnimationToolTriggerAudio | null {
  const explicitAudioUrl = draft.audioUrl.trim();
  if (explicitAudioUrl) {
    return {
      source: 'audio',
      sourceRef: explicitAudioUrl,
    };
  }

  const selectedAsset = audioAssetOptions.find((option) => option.id === draft.songId.trim());
  if (!selectedAsset) {
    return null;
  }

  return {
    source: 'audio',
    sourceRef: selectedAsset.url,
  };
}

function createPreviewLabel(
  sourceAudio: DesktopPetAnimationToolTriggerAudio,
  audioAssetOptions: SettingsSkillTimelineAudioAssetOption[],
) {
  const selectedAsset = audioAssetOptions.find((option) => option.url === sourceAudio.sourceRef);
  return selectedAsset?.label ?? sourceAudio.sourceRef;
}

export function resolveSettingsSkillTimelineAudioPreviewSource(
  draft: SkillTimelineEditorDraft,
  audioAssetOptions: SettingsSkillTimelineAudioAssetOption[],
): SettingsSkillTimelineAudioPreviewSource | null {
  const sourceAudio = createPreviewAudioFromDraft(draft, audioAssetOptions);
  const normalizedAudio = normalizeAnimationToolTriggerAudio(sourceAudio);
  if (!sourceAudio || !normalizedAudio?.playbackUrl) {
    return null;
  }

  return {
    label: createPreviewLabel(sourceAudio, audioAssetOptions),
    playbackUrl: normalizedAudio.playbackUrl,
    sourceAudio,
  };
}
