import { Copy, ListPlus, MoveRight, SkipBack, SkipForward, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { type SkillTimelineEditorDraft } from './settingsSkillTimelineEditorModel';
import {
  deleteSkillTimelineEditorSteps,
  duplicateSkillTimelineEditorSteps,
} from './settingsSkillTimelineEditorStepOperations';
import {
  appendSkillTimelineEditorStepOnTrack,
  assignSkillTimelineStepsTrack,
  createSkillTimelineTrackOptions,
  nudgeSkillTimelineStepsTiming,
} from './settingsSkillTimelineTrackOperations';
import { normalizeSkillTimelineTrackId } from './settingsSkillTimelineTrackId';

interface SettingsSkillTimelineTrackControlsProps {
  draft: SkillTimelineEditorDraft;
  selectedStepIds: string[];
  selectedStepId: string;
  onClearSelection: () => void;
  onApplyDraft: (draft: SkillTimelineEditorDraft) => void;
}

export function SettingsSkillTimelineTrackControls({
  draft,
  selectedStepIds,
  selectedStepId,
  onClearSelection,
  onApplyDraft,
}: SettingsSkillTimelineTrackControlsProps) {
  const trackOptions = useMemo(() => createSkillTimelineTrackOptions(draft), [draft]);
  const [trackInput, setTrackInput] = useState('custom');
  const normalizedTrackId = normalizeSkillTimelineTrackId(trackInput, 'custom');
  const activeStepIds = selectedStepIds.length > 0 ? selectedStepIds : selectedStepId ? [selectedStepId] : [];

  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto_auto] items-center gap-2 rounded-sm border border-border/70 bg-background/20 p-2">
      <div className="min-w-0">
        <Input
          className="h-8 text-2xs"
          list="skill-timeline-track-options"
          placeholder="track id"
          value={trackInput}
          onChange={(event) => setTrackInput(event.target.value)}
        />
        <datalist id="skill-timeline-track-options">
          {trackOptions.map((track) => <option key={track.id} value={track.id}>{track.label}</option>)}
        </datalist>
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        title="Move selected steps to track"
        disabled={activeStepIds.length === 0}
        onClick={() => onApplyDraft(assignSkillTimelineStepsTrack(draft, activeStepIds, normalizedTrackId))}
      >
        <MoveRight />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        title="Move selected steps earlier"
        disabled={activeStepIds.length === 0}
        onClick={() => onApplyDraft(nudgeSkillTimelineStepsTiming(draft, activeStepIds, -1))}
      >
        <SkipBack />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        title="Move selected steps later"
        disabled={activeStepIds.length === 0}
        onClick={() => onApplyDraft(nudgeSkillTimelineStepsTiming(draft, activeStepIds, 1))}
      >
        <SkipForward />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        title="Duplicate selected steps"
        disabled={activeStepIds.length === 0}
        onClick={() => onApplyDraft(duplicateSkillTimelineEditorSteps(draft, activeStepIds))}
      >
        <Copy />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        title="Delete selected steps"
        disabled={activeStepIds.length === 0}
        onClick={() => {
          onApplyDraft(deleteSkillTimelineEditorSteps(draft, activeStepIds));
          onClearSelection();
        }}
      >
        <Trash2 />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        title="Clear selected steps"
        disabled={activeStepIds.length === 0}
        onClick={onClearSelection}
      >
        <X />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        title="Add step on track"
        onClick={() => onApplyDraft(appendSkillTimelineEditorStepOnTrack(draft, normalizedTrackId))}
      >
        <ListPlus />
      </Button>
    </div>
  );
}
