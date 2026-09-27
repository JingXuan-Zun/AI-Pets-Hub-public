import { ArrowDown, ArrowUp, Crosshair, Eye, EyeOff, GitMerge, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { type SkillTimelineEditorDraft } from './settingsSkillTimelineEditorModel';
import {
  deleteSkillTimelineEditorTrackSteps,
  renameSkillTimelineEditorTrack,
} from './settingsSkillTimelineTrackManagement';
import { createSkillTimelineEditorTrackRows } from './settingsSkillTimelineTrackModel';
import {
  createSkillTimelineTrackOptions,
} from './settingsSkillTimelineTrackOperations';
import { normalizeSkillTimelineTrackId } from './settingsSkillTimelineTrackId';
import { moveSkillTimelineEditorTrackOrder } from './settingsSkillTimelineTrackOrder';
import {
  clearSkillTimelineTrackVisibility,
  toggleSkillTimelineTrackHidden,
  toggleSkillTimelineTrackSolo,
  type SkillTimelineTrackVisibilityState,
} from './settingsSkillTimelineTrackVisibility';

interface SettingsSkillTimelineTrackManagerProps {
  draft: SkillTimelineEditorDraft;
  visibility: SkillTimelineTrackVisibilityState;
  onApplyDraft: (draft: SkillTimelineEditorDraft) => void;
  onVisibilityChange: (visibility: SkillTimelineTrackVisibilityState) => void;
}

function resolveInitialTrackId(draft: SkillTimelineEditorDraft) {
  return createSkillTimelineEditorTrackRows(draft)[0]?.id ?? 'motion';
}

export function SettingsSkillTimelineTrackManager({
  draft,
  visibility,
  onApplyDraft,
  onVisibilityChange,
}: SettingsSkillTimelineTrackManagerProps) {
  const trackRows = useMemo(() => createSkillTimelineEditorTrackRows(draft), [draft]);
  const trackOptions = useMemo(() => createSkillTimelineTrackOptions(draft), [draft]);
  const [sourceTrackId, setSourceTrackId] = useState(() => resolveInitialTrackId(draft));
  const [targetTrackInput, setTargetTrackInput] = useState('motion');
  const activeTrack = trackRows.find((track) => track.id === sourceTrackId) ?? trackRows[0];
  const activeTrackId = activeTrack?.id ?? '';
  const activeTrackIndex = trackRows.findIndex((track) => track.id === activeTrackId);
  const targetTrackId = normalizeSkillTimelineTrackId(targetTrackInput, 'custom');
  const canManageTrack = Boolean(activeTrackId);
  const canMergeTrack = canManageTrack && activeTrackId !== targetTrackId;
  const activeTrackHidden = visibility.hiddenTrackIds.includes(activeTrackId);
  const activeTrackSoloed = visibility.soloTrackId === activeTrackId;

  if (trackRows.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-[1fr_1fr_auto_auto_auto_auto_auto_auto_auto] items-center gap-2 rounded-sm border border-border/70 bg-background/20 p-2">
      <select
        className="h-8 min-w-0 rounded-sm border border-input bg-background px-2 text-2xs"
        value={activeTrackId}
        onChange={(event) => setSourceTrackId(event.target.value)}
      >
        {trackRows.map((track) => (
          <option key={track.id} value={track.id}>{track.label} ({track.stepCount})</option>
        ))}
      </select>
      <div className="min-w-0">
        <Input
          className="h-8 text-2xs"
          list="skill-timeline-track-manager-options"
          placeholder="target track"
          value={targetTrackInput}
          onChange={(event) => setTargetTrackInput(event.target.value)}
        />
        <datalist id="skill-timeline-track-manager-options">
          {trackOptions.map((track) => <option key={track.id} value={track.id}>{track.label}</option>)}
        </datalist>
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        title="Move track up"
        disabled={activeTrackIndex <= 0}
        onClick={() => onApplyDraft(moveSkillTimelineEditorTrackOrder(draft, activeTrackId, -1))}
      >
        <ArrowUp />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        title="Move track down"
        disabled={activeTrackIndex < 0 || activeTrackIndex >= trackRows.length - 1}
        onClick={() => onApplyDraft(moveSkillTimelineEditorTrackOrder(draft, activeTrackId, 1))}
      >
        <ArrowDown />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        title={activeTrackHidden ? 'Show track' : 'Hide track'}
        disabled={!canManageTrack}
        onClick={() => onVisibilityChange(toggleSkillTimelineTrackHidden(visibility, activeTrackId))}
      >
        {activeTrackHidden ? <EyeOff /> : <Eye />}
      </Button>
      <Button
        type="button"
        variant={activeTrackSoloed ? 'secondary' : 'outline'}
        size="icon-sm"
        title="Focus only this track"
        disabled={!canManageTrack}
        onClick={() => onVisibilityChange(toggleSkillTimelineTrackSolo(visibility, activeTrackId))}
      >
        <Crosshair />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        title="Clear track visibility filters"
        disabled={!visibility.soloTrackId && visibility.hiddenTrackIds.length === 0}
        onClick={() => onVisibilityChange(clearSkillTimelineTrackVisibility())}
      >
        <X />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        title="Rename or merge this track"
        disabled={!canMergeTrack}
        onClick={() => onApplyDraft(renameSkillTimelineEditorTrack(draft, activeTrackId, targetTrackId))}
      >
        <GitMerge />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        title="Delete all steps on this track"
        disabled={!canManageTrack}
        onClick={() => onApplyDraft(deleteSkillTimelineEditorTrackSteps(draft, activeTrackId))}
      >
        <Trash2 />
      </Button>
    </div>
  );
}
