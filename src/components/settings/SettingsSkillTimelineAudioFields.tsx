import { Input } from '../../../components/ui/input';
import {
  applySettingsSkillTimelineAudioAssetSelection,
  type SettingsSkillTimelineAudioAssetOption,
  resolveSelectedSkillTimelineAudioAssetId,
} from './settingsSkillTimelineAudioAssetOptions';
import { SettingsSkillTimelineAudioPreviewButton } from './SettingsSkillTimelineAudioPreviewButton';
import { type SettingsSkillTimelineAudioPreviewSource } from './settingsSkillTimelineAudioPreview';
import { type SkillTimelineEditorDraft } from './settingsSkillTimelineEditorModel';

interface SettingsSkillTimelineAudioFieldsProps {
  audioAssetOptions: SettingsSkillTimelineAudioAssetOption[];
  draft: SkillTimelineEditorDraft;
  onApplyDraft: (draft: SkillTimelineEditorDraft) => void;
  previewSource: SettingsSkillTimelineAudioPreviewSource | null;
}

export function SettingsSkillTimelineAudioFields({
  audioAssetOptions,
  draft,
  onApplyDraft,
  previewSource,
}: SettingsSkillTimelineAudioFieldsProps) {
  const selectedAudioAssetId = resolveSelectedSkillTimelineAudioAssetId(draft, audioAssetOptions);

  return (
    <div className="space-y-2">
      <select
        className="h-8 w-full rounded-sm border border-input bg-background px-2 text-2xs"
        disabled={audioAssetOptions.length === 0}
        value={selectedAudioAssetId}
        onChange={(event) => onApplyDraft(applySettingsSkillTimelineAudioAssetSelection(
          draft,
          audioAssetOptions,
          event.target.value,
        ))}
      >
        <option value="">{audioAssetOptions.length === 0 ? 'No saved audio assets' : 'Select audio asset'}</option>
        {audioAssetOptions.map((option) => (
          <option key={option.id} value={option.id}>{option.label}</option>
        ))}
      </select>
      <div className="grid grid-cols-2 gap-2">
        <Input value={draft.songId} placeholder="songId" onChange={(event) => onApplyDraft({ ...draft, songId: event.target.value })} />
        <Input value={draft.audioUrl} placeholder="audioUrl" onChange={(event) => onApplyDraft({ ...draft, audioUrl: event.target.value })} />
        <Input value={draft.durationMs} type="number" min={0} placeholder="duration ms" onChange={(event) => onApplyDraft({ ...draft, durationMs: event.target.value })} />
        <Input value={draft.audioStartDelayMs} type="number" min={0} placeholder="start delay ms" onChange={(event) => onApplyDraft({ ...draft, audioStartDelayMs: event.target.value })} />
      </div>
      <SettingsSkillTimelineAudioPreviewButton previewSource={previewSource} />
    </div>
  );
}
