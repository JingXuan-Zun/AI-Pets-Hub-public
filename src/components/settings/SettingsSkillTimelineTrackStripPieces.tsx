import { Plus } from 'lucide-react';
import { type KeyboardEvent, type PointerEvent } from 'react';
import { Button } from '../../../components/ui/button';
import { type SkillTimelineStripBatchDragPreview } from './settingsSkillTimelineStripBatchDragPreview';
import { type SkillTimelineStripDragTimingPreview } from './settingsSkillTimelineStripDragTiming';
import { type SkillTimelineStripResizePreview } from './settingsSkillTimelineStripResizeDuration';
import { SettingsSkillTimelineResizePreview } from './SettingsSkillTimelineResizePreview';
import {
  type SkillTimelineEditorStripItem,
  type SkillTimelineEditorStripRow,
  type SkillTimelineEditorStripTick,
} from './settingsSkillTimelineStripModel';

export interface TimelineStripItemProps {
  collisionStepIds: string[];
  item: SkillTimelineEditorStripItem;
  onClick: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLButtonElement>) => void;
  onResizePointerCancel: (event: PointerEvent<HTMLSpanElement>) => void;
  onResizePointerDown: (event: PointerEvent<HTMLSpanElement>) => void;
  onResizePointerMove: (event: PointerEvent<HTMLSpanElement>) => void;
  onResizePointerUp: (event: PointerEvent<HTMLSpanElement>) => void;
  selectedStepId: string;
  selectedStepIds: string[];
}

export interface TimelineStripRowProps {
  batchDragPreviews: SkillTimelineStripBatchDragPreview[];
  collisionStepIds: string[];
  dragPreview: SkillTimelineStripDragTimingPreview | null;
  endDrag: (event: PointerEvent<HTMLButtonElement>) => void;
  endResize: (event: PointerEvent<HTMLSpanElement>) => void;
  hoverTrackId: string;
  moveDrag: (event: PointerEvent<HTMLButtonElement>) => void;
  moveResize: (event: PointerEvent<HTMLSpanElement>) => void;
  nudgeStepFromKeyboard: (event: KeyboardEvent<HTMLButtonElement>, stepId: string) => void;
  onAddStepOnTrack?: (trackId: string) => void;
  onSelectStep?: (stepId: string) => void;
  registerTrackElement: (trackId: string, element: HTMLDivElement | null) => void;
  resizePreview: SkillTimelineStripResizePreview | null;
  row: SkillTimelineEditorStripRow;
  rowCollisionCount: number;
  selectedStepId: string;
  selectedStepIds: string[];
  startDrag: (event: PointerEvent<HTMLButtonElement>, stepId: string) => void;
  startResize: (event: PointerEvent<HTMLSpanElement>, stepId: string) => void;
  ticks: SkillTimelineEditorStripTick[];
}

export function TimelineTickLabels({ ticks }: { ticks: SkillTimelineEditorStripTick[] }) {
  return (
    <div className="relative h-4">
      {ticks.map((tick) => (
        <span key={`${tick.label}-${tick.timeMs}`} className="absolute top-0 -translate-x-1/2 font-mono text-3xs text-muted-foreground" style={{ left: `${tick.leftPercent}%` }}>
          {tick.label}
        </span>
      ))}
    </div>
  );
}

function TimelineTickLayer({ ticks }: { ticks: SkillTimelineEditorStripTick[] }) {
  return (
    <>
      {ticks.map((tick) => (
        <div key={`${tick.label}-${tick.timeMs}`} className="pointer-events-none absolute inset-y-0 border-l border-border/60" style={{ left: `${tick.leftPercent}%` }} />
      ))}
    </>
  );
}

function createPreviewLabelClass(leftPercent: number) {
  if (leftPercent < 10) {
    return 'translate-x-0';
  }
  if (leftPercent > 90) {
    return '-translate-x-full';
  }
  return '-translate-x-1/2';
}

function TimelineDragPreview({ preview }: { preview: SkillTimelineStripDragTimingPreview }) {
  return (
    <div className="pointer-events-none absolute inset-y-0 z-10" style={{ left: `${preview.leftPercent}%` }}>
      <div className="absolute inset-y-0 border-l border-primary" />
      <div className={`absolute -top-5 rounded-sm bg-primary px-1 py-0.5 font-mono text-3xs text-primary-foreground shadow-sm ${createPreviewLabelClass(preview.leftPercent)}`}>
        {preview.label}
      </div>
    </div>
  );
}

function TimelineBatchDragPreview({ preview }: { preview: SkillTimelineStripBatchDragPreview }) {
  return (
    <div className="pointer-events-none absolute inset-y-1 z-10 rounded-sm border border-primary/60 bg-primary/15" style={{ left: `${preview.leftPercent}%`, width: '8%' }}>
      <div className={`absolute -top-4 rounded-sm bg-primary/80 px-1 py-0.5 font-mono text-3xs text-primary-foreground shadow-sm ${createPreviewLabelClass(preview.leftPercent)}`}>
        {preview.label}
      </div>
    </div>
  );
}

function createItemClass(
  item: SkillTimelineEditorStripItem,
  selectedStepId: string,
  selectedStepIds: string[],
  collisionStepIds: string[],
) {
  const isPrimarySelected = item.id === selectedStepId;
  const isBatchSelected = selectedStepIds.includes(item.id);
  const hasCollision = collisionStepIds.includes(item.id);
  const collisionClass = hasCollision ? ' outline outline-1 outline-amber-500/70' : '';
  if (isPrimarySelected) {
    return `border-primary bg-primary/25 text-primary shadow-sm shadow-primary/20${collisionClass}`;
  }
  if (isBatchSelected) {
    return `border-primary/70 bg-primary/20 text-primary ring-1 ring-primary/30${collisionClass}`;
  }
  if (hasCollision) {
    return 'border-amber-500/80 bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30';
  }
  return 'border-primary/30 bg-primary/15 text-primary hover:bg-primary/20';
}

export function TimelineStripItem({
  collisionStepIds,
  item,
  onClick,
  onKeyDown,
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onResizePointerCancel,
  onResizePointerDown,
  onResizePointerMove,
  onResizePointerUp,
  selectedStepId,
  selectedStepIds,
}: TimelineStripItemProps) {
  return (
    <button
      type="button"
      className={`absolute top-1 h-7 overflow-hidden rounded-sm border px-1 text-left text-3xs leading-7 transition-colors ${createItemClass(item, selectedStepId, selectedStepIds, collisionStepIds)}`}
      style={{ left: `${item.leftPercent}%`, width: `${item.widthPercent}%` }}
      aria-label={`Timeline step ${item.label} at ${item.delayMs}ms`}
      title={`${item.label} @ ${item.delayMs}ms${collisionStepIds.includes(item.id) ? ' overlap' : ''}`}
      onClick={onClick}
      onKeyDown={onKeyDown}
      onPointerCancel={onPointerCancel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <span className="block truncate">{item.label}</span>
      <span className="absolute inset-y-1 right-0 w-2 cursor-ew-resize rounded-sm bg-primary/40 opacity-70 hover:opacity-100" aria-hidden="true" onPointerCancel={onResizePointerCancel} onPointerDown={onResizePointerDown} onPointerMove={onResizePointerMove} onPointerUp={onResizePointerUp} />
    </button>
  );
}

export function TimelineStripRow({
  batchDragPreviews,
  collisionStepIds,
  dragPreview,
  endDrag,
  endResize,
  hoverTrackId,
  moveDrag,
  moveResize,
  nudgeStepFromKeyboard,
  onAddStepOnTrack,
  onSelectStep,
  registerTrackElement,
  resizePreview,
  row,
  rowCollisionCount,
  selectedStepId,
  selectedStepIds,
  startDrag,
  startResize,
  ticks,
}: TimelineStripRowProps) {
  const previewInRow = dragPreview && row.items.some((item) => item.id === dragPreview.stepId);
  const resizePreviewInRow = resizePreview && row.items.some((item) => item.id === resizePreview.stepId);
  const batchPreviewsInRow = batchDragPreviews.filter((preview) => (
    row.items.some((item) => item.id === preview.stepId)
  ));

  return (
    <div className="grid grid-cols-[72px_1fr] items-center gap-2">
      <div className="flex min-w-0 items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          title={`Add step on ${row.label}`}
          onClick={() => onAddStepOnTrack?.(row.id)}
        >
          <Plus />
        </Button>
        <div className="min-w-0 truncate text-2xs text-muted-foreground">
          {row.label}
          {rowCollisionCount > 0 ? (
            <span className="ml-1 font-mono text-amber-400" title={`${rowCollisionCount} overlapping steps`}>
              {rowCollisionCount}
            </span>
          ) : null}
        </div>
      </div>
      <div
        ref={(element) => registerTrackElement(row.id, element)}
        data-skill-timeline-track="true"
        className={`relative h-9 rounded-sm border bg-background/40 transition-colors ${hoverTrackId === row.id ? 'border-primary/70 ring-1 ring-primary/40' : 'border-border/70'}`}
      >
        <TimelineTickLayer ticks={ticks} />
        {previewInRow ? <TimelineDragPreview preview={dragPreview} /> : null}
        {batchPreviewsInRow.map((preview) => (
          <TimelineBatchDragPreview key={preview.stepId} preview={preview} />
        ))}
        {resizePreviewInRow ? <SettingsSkillTimelineResizePreview preview={resizePreview} /> : null}
        {row.items.map((item) => (
          <TimelineStripItem
            key={item.id}
            collisionStepIds={collisionStepIds}
            item={item}
            selectedStepId={selectedStepId}
            selectedStepIds={selectedStepIds}
            onClick={() => onSelectStep?.(item.id)}
            onKeyDown={(event) => nudgeStepFromKeyboard(event, item.id)}
            onPointerCancel={endDrag}
            onPointerDown={(event) => startDrag(event, item.id)}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onResizePointerCancel={endResize}
            onResizePointerDown={(event) => startResize(event, item.id)}
            onResizePointerMove={moveResize}
            onResizePointerUp={endResize}
          />
        ))}
      </div>
    </div>
  );
}
