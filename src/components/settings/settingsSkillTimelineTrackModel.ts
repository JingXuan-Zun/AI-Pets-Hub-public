import {
  type SkillTimelineEditorDraft,
  type SkillTimelineEditorStepDraft,
} from './settingsSkillTimelineEditorModel';
import {
  sortSkillTimelineTrackRowsByOrder,
} from './settingsSkillTimelineTrackOrder';

export interface SkillTimelineEditorTrackRow {
  durationLabel: string;
  endMs: number;
  id: string;
  label: string;
  startMs: number;
  stepCount: number;
  steps: SkillTimelineEditorStepDraft[];
}

const TRACK_LABELS: Record<string, string> = {
  audio: 'Audio',
  custom: 'Custom',
  expression: 'Expression',
  motion: 'Motion',
};

export function resolveSkillTimelineEditorStepDelayMs(
  step: SkillTimelineEditorStepDraft,
  draft: SkillTimelineEditorDraft,
) {
  if (step.timingMode === 'atMs') {
    return Math.max(0, Math.round(step.atMs));
  }

  const beatDurationMs = 60_000 / Math.max(1, draft.bpm);
  return Math.max(0, Math.round(draft.offsetMs + ((Math.max(1, step.beat) - 1) * beatDurationMs)));
}

function formatRange(startMs: number, endMs: number) {
  return startMs === endMs ? `${startMs}ms` : `${startMs}-${endMs}ms`;
}

function createTrackRow(
  draft: SkillTimelineEditorDraft,
  trackId: string,
  steps: SkillTimelineEditorStepDraft[],
): SkillTimelineEditorTrackRow {
  const delays = steps.map((step) => resolveSkillTimelineEditorStepDelayMs(step, draft));
  const startMs = delays.length > 0 ? Math.min(...delays) : 0;
  const endMs = delays.length > 0 ? Math.max(...delays) : 0;
  return {
    durationLabel: formatRange(startMs, endMs),
    endMs,
    id: trackId,
    label: TRACK_LABELS[trackId] ?? trackId,
    startMs,
    stepCount: steps.length,
    steps,
  };
}

export function createSkillTimelineEditorTrackRows(
  draft: SkillTimelineEditorDraft,
): SkillTimelineEditorTrackRow[] {
  const groupedSteps = new Map<string, SkillTimelineEditorStepDraft[]>();
  draft.steps.forEach((step) => {
    const trackId = step.track.trim() || 'motion';
    groupedSteps.set(trackId, [...(groupedSteps.get(trackId) ?? []), step]);
  });

  const rows = Array.from(groupedSteps.entries())
    .map(([trackId, steps]) => createTrackRow(draft, trackId, steps))
    .sort((a, b) => a.startMs - b.startMs || a.label.localeCompare(b.label));
  return draft.trackOrder.length > 0
    ? sortSkillTimelineTrackRowsByOrder(rows, draft.trackOrder)
    : rows;
}
