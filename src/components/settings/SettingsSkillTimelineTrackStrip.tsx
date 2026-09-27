import { useMemo } from 'react';
import { type SkillTimelineEditorDraft } from './settingsSkillTimelineEditorModel';
import { type SkillTimelineSnapPolicy } from './settingsSkillTimelineSnapPolicy';
import { createSkillTimelineStripCollisionSummary } from './settingsSkillTimelineStripCollision';
import {
  createSkillTimelineEditorStripModel,
  type SkillTimelineEditorStripItem,
} from './settingsSkillTimelineStripModel';
import {
  createSkillTimelineStripPreviewCollisionSummary,
  type SkillTimelineStripItemRangePreview,
} from './settingsSkillTimelineStripPreviewCollision';
import {
  TimelineStripRow,
  TimelineTickLabels,
} from './SettingsSkillTimelineTrackStripPieces';
import { SettingsSkillTimelineAudioMetadataLaneView } from './SettingsSkillTimelineAudioMetadataLaneView';
import { createSkillTimelineAudioMetadataLane } from './settingsSkillTimelineAudioMetadataLane';
import { type SettingsSkillTimelineAudioPreviewSource } from './settingsSkillTimelineAudioPreview';
import {
  filterSkillTimelineRowsByVisibility,
  type SkillTimelineTrackVisibilityState,
} from './settingsSkillTimelineTrackVisibility';
import {
  createSkillTimelineZoomStyle,
  labelSkillTimelineZoom,
  type SkillTimelineZoomPolicy,
} from './settingsSkillTimelineZoomPolicy';
import { useSettingsSkillTimelineTrackStripInteractions } from './useSettingsSkillTimelineTrackStripInteractions';
import { useSettingsSkillTimelineWaveformPeaks } from './useSettingsSkillTimelineWaveformPeaks';

interface SettingsSkillTimelineTrackStripProps {
  audioPreviewSource: SettingsSkillTimelineAudioPreviewSource | null;
  draft: SkillTimelineEditorDraft;
  onDragStepTiming?: (stepId: string, leftPercent: number, durationMs: number) => void;
  onDropStepTrack?: (stepId: string, trackId: string) => void;
  onFocusStep?: (stepId: string) => void;
  onAddStepOnTrack?: (trackId: string) => void;
  onNudgeStepTiming?: (stepId: string, direction: -1 | 1) => void;
  onResizeStepDuration?: (stepId: string, rightPercent: number, durationMs: number) => void;
  onSelectStep?: (stepId: string) => void;
  selectedStepId?: string;
  selectedStepIds?: string[];
  showAudioMetadataLane: boolean;
  snapPolicy?: Partial<SkillTimelineSnapPolicy> | null;
  visibility: SkillTimelineTrackVisibilityState;
  zoomPolicy: SkillTimelineZoomPolicy;
}

function formatDuration(durationMs: number) {
  return `${Math.round(durationMs)}ms`;
}

function createRangePreviewFromInteractions(
  stripInteractions: ReturnType<typeof useSettingsSkillTimelineTrackStripInteractions>,
  itemsByStepId: Map<string, SkillTimelineEditorStripItem>,
): SkillTimelineStripItemRangePreview | null {
  if (stripInteractions.resizePreview) {
    const item = itemsByStepId.get(stripInteractions.resizePreview.stepId);
    return {
      durationMs: stripInteractions.resizePreview.durationMs,
      leftPercent: item?.leftPercent ?? 0,
      stepId: stripInteractions.resizePreview.stepId,
    };
  }

  if (!stripInteractions.dragPreview) {
    return null;
  }

  const item = itemsByStepId.get(stripInteractions.dragPreview.stepId);
  return item
    ? {
        durationMs: item.durationMs,
        leftPercent: stripInteractions.dragPreview.leftPercent,
        stepId: stripInteractions.dragPreview.stepId,
      }
    : {
        durationMs: 0,
        leftPercent: stripInteractions.dragPreview.leftPercent,
        stepId: stripInteractions.dragPreview.stepId,
      };
}

function createItemsByStepId(rows: ReturnType<typeof createSkillTimelineEditorStripModel>['rows']) {
  return new Map(rows.flatMap((row) => row.items.map((item) => [item.id, item] as const)));
}

const AUDIO_WAVEFORM_BUCKET_COUNT = 64;

export function SettingsSkillTimelineTrackStrip({
  audioPreviewSource,
  draft,
  onDragStepTiming,
  onDropStepTrack,
  onFocusStep,
  onAddStepOnTrack,
  onNudgeStepTiming,
  onResizeStepDuration,
  onSelectStep,
  selectedStepId = '',
  selectedStepIds = [],
  showAudioMetadataLane,
  snapPolicy,
  visibility,
  zoomPolicy,
}: SettingsSkillTimelineTrackStripProps) {
  const stripModel = useMemo(() => createSkillTimelineEditorStripModel(draft), [draft]);
  const visibleRows = useMemo(() => (
    filterSkillTimelineRowsByVisibility(stripModel.rows, visibility)
  ), [stripModel.rows, visibility]);
  const collisionSummary = useMemo(
    () => createSkillTimelineStripCollisionSummary(visibleRows),
    [visibleRows],
  );
  const stripInteractions = useSettingsSkillTimelineTrackStripInteractions({
    draft,
    durationMs: stripModel.durationMs,
    onDragStepTiming,
    onDropStepTrack,
    onFocusStep,
    onNudgeStepTiming,
    onResizeStepDuration,
    onSelectStep,
    selectedStepIds,
    snapPolicy,
  });
  const itemsByStepId = useMemo(() => createItemsByStepId(visibleRows), [visibleRows]);
  const rangePreview = useMemo(() => (
    createRangePreviewFromInteractions(stripInteractions, itemsByStepId)
  ), [itemsByStepId, stripInteractions.dragPreview, stripInteractions.resizePreview]);
  const previewCollisionSummary = useMemo(() => createSkillTimelineStripPreviewCollisionSummary({
    baseSummary: collisionSummary,
    preview: rangePreview,
    rows: visibleRows,
    stripDurationMs: stripModel.durationMs,
  }), [collisionSummary, rangePreview, stripModel.durationMs, visibleRows]);
  const zoomStyle = useMemo(() => createSkillTimelineZoomStyle(zoomPolicy), [zoomPolicy]);
  const zoomLabel = useMemo(() => labelSkillTimelineZoom(zoomPolicy), [zoomPolicy]);
  const audioMetadataLane = useMemo(() => (
    showAudioMetadataLane ? createSkillTimelineAudioMetadataLane(draft, stripModel.durationMs) : null
  ), [draft, showAudioMetadataLane, stripModel.durationMs]);
  const waveformState = useSettingsSkillTimelineWaveformPeaks(
    showAudioMetadataLane && audioMetadataLane ? audioPreviewSource?.playbackUrl : null,
    AUDIO_WAVEFORM_BUCKET_COUNT,
  );

  if (stripModel.rows.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 rounded-sm border border-border/70 bg-background/20 p-2">
      <div className="flex items-center justify-between gap-3 text-2xs uppercase tracking-widest text-muted-foreground">
        <span>Timeline</span>
        <span className="font-mono text-primary">{formatDuration(stripModel.durationMs)} / {zoomLabel}</span>
      </div>
      <div className="overflow-x-auto pb-1">
        <div className="space-y-2" style={zoomStyle}>
          <div className="grid grid-cols-[72px_1fr] items-center gap-2">
            <div />
            <TimelineTickLabels ticks={stripModel.ticks} />
          </div>
          <SettingsSkillTimelineAudioMetadataLaneView
            lane={audioMetadataLane}
            peaks={waveformState.peaks}
          />
          <div className="space-y-2">
            {visibleRows.map((row) => (
              <TimelineStripRow
                key={row.id}
                row={row}
                collisionStepIds={previewCollisionSummary.collisionStepIds}
                rowCollisionCount={previewCollisionSummary.rowCollisionCounts[row.id] ?? 0}
                selectedStepId={selectedStepId}
                selectedStepIds={selectedStepIds}
                ticks={stripModel.ticks}
                onAddStepOnTrack={onAddStepOnTrack}
                onSelectStep={onSelectStep}
                {...stripInteractions}
              />
            ))}
            {visibleRows.length === 0 ? (
              <div className="rounded-sm border border-dashed border-border/70 px-3 py-4 text-center text-2xs text-muted-foreground">
                No visible tracks
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
