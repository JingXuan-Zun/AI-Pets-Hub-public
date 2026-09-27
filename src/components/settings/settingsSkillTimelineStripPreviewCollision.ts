import {
  createSkillTimelineStripCollisionSummary,
  type SkillTimelineStripCollisionSummary,
} from './settingsSkillTimelineStripCollision';
import {
  type SkillTimelineEditorStripItem,
  type SkillTimelineEditorStripRow,
} from './settingsSkillTimelineStripModel';

export interface SkillTimelineStripItemRangePreview {
  durationMs: number;
  leftPercent: number;
  stepId: string;
}

function createPreviewItem(
  item: SkillTimelineEditorStripItem,
  preview: SkillTimelineStripItemRangePreview,
  stripDurationMs: number,
): SkillTimelineEditorStripItem {
  const delayMs = Math.round((preview.leftPercent / 100) * Math.max(1, stripDurationMs));
  return {
    ...item,
    delayMs,
    durationMs: preview.durationMs,
    endMs: delayMs + preview.durationMs,
    leftPercent: preview.leftPercent,
  };
}

function applyPreviewToRows(
  rows: SkillTimelineEditorStripRow[],
  preview: SkillTimelineStripItemRangePreview | null,
  stripDurationMs: number,
) {
  if (!preview) {
    return rows;
  }

  return rows.map((row) => ({
    ...row,
    items: row.items.map((item) => (
      item.id === preview.stepId ? createPreviewItem(item, preview, stripDurationMs) : item
    )),
  }));
}

export function createSkillTimelineStripPreviewCollisionSummary(options: {
  baseSummary: SkillTimelineStripCollisionSummary;
  preview: SkillTimelineStripItemRangePreview | null;
  rows: SkillTimelineEditorStripRow[];
  stripDurationMs: number;
}): SkillTimelineStripCollisionSummary {
  if (!options.preview) {
    return options.baseSummary;
  }

  return createSkillTimelineStripCollisionSummary(
    applyPreviewToRows(options.rows, options.preview, options.stripDurationMs),
  );
}
