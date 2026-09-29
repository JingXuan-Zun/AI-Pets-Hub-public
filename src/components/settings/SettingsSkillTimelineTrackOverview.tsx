import { useMemo } from 'react';
import { Layers3 } from 'lucide-react';
import { type SkillTimelineEditorDraft } from './settingsSkillTimelineEditorModel';
import { createSkillTimelineEditorTrackRows } from './settingsSkillTimelineTrackModel';
import {
  createSkillTimelineTrackVisibilitySummary,
  filterSkillTimelineRowsByVisibility,
  type SkillTimelineTrackVisibilityState,
} from './settingsSkillTimelineTrackVisibility';

interface SettingsSkillTimelineTrackOverviewProps {
  draft: SkillTimelineEditorDraft;
  visibility: SkillTimelineTrackVisibilityState;
}

export function SettingsSkillTimelineTrackOverview({
  draft,
  visibility,
}: SettingsSkillTimelineTrackOverviewProps) {
  const trackRows = useMemo(() => createSkillTimelineEditorTrackRows(draft), [draft]);
  const visibleTrackRows = useMemo(() => (
    filterSkillTimelineRowsByVisibility(trackRows, visibility)
  ), [trackRows, visibility]);
  const visibilitySummary = useMemo(() => createSkillTimelineTrackVisibilitySummary(
    visibility,
    trackRows.map((track) => track.id),
  ), [trackRows, visibility]);
  if (trackRows.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 rounded-sm border border-border/70 bg-background/20 p-2">
      <div className="flex items-center gap-2 text-2xs uppercase tracking-widest text-muted-foreground">
        <Layers3 className="h-3.5 w-3.5 text-primary" />
        Tracks
        {visibilitySummary.isFiltered ? (
          <span className="font-mono text-3xs text-primary">{visibilitySummary.visibleTrackIds.length}/{trackRows.length}</span>
        ) : null}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {visibleTrackRows.map((track) => (
          <div key={track.id} className="rounded-sm border border-border/70 bg-background/35 px-2 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-2xs font-medium text-foreground">{track.label}</span>
              <span className="font-mono text-3xs text-primary">{track.durationLabel}</span>
            </div>
            <div className="mt-1 truncate text-3xs text-muted-foreground">
              {track.stepCount} step{track.stepCount === 1 ? '' : 's'}
            </div>
          </div>
        ))}
        {visibleTrackRows.length === 0 ? (
          <div className="rounded-sm border border-dashed border-border/70 px-2 py-2 text-2xs text-muted-foreground">
            No visible tracks
          </div>
        ) : null}
      </div>
    </div>
  );
}
