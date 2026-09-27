import {
  type SkillTimelineEditorDraft,
  type SkillTimelineEditorStepDraft,
} from './settingsSkillTimelineEditorModel';
import { type SkillTimelineSnapPolicy } from './settingsSkillTimelineSnapPolicy';
import {
  clampSkillTimelineStripPercent,
  resolveSkillTimelineStripBeat,
  resolveSkillTimelineStripStepStartMs,
  resolveSkillTimelineStripStepStartPercent,
  resolveSkillTimelineStripTimeMs,
} from './settingsSkillTimelineStripSnap';

export interface SkillTimelineStripDragTimingPreview {
  label: string;
  leftPercent: number;
  stepId: string;
}

function createDragPreviewLabel(
  draft: SkillTimelineEditorDraft,
  timeMs: number,
  step: SkillTimelineEditorStepDraft,
) {
  return step.timingMode === 'atMs'
    ? `${timeMs}ms`
    : `b${resolveSkillTimelineStripBeat(draft, timeMs)}`;
}

export function createSkillTimelineStripDragTimingPreview(options: {
  draft: SkillTimelineEditorDraft;
  durationMs: number;
  leftPercent: number;
  snapPolicy?: Partial<SkillTimelineSnapPolicy> | null;
  step: SkillTimelineEditorStepDraft;
}): SkillTimelineStripDragTimingPreview {
  const rawTimeMs = resolveSkillTimelineStripTimeMs(options.durationMs, options.leftPercent);
  const timeMs = resolveSkillTimelineStripStepStartMs(
    options.draft,
    options.step,
    rawTimeMs,
    options.snapPolicy,
  );
  const leftPercent = resolveSkillTimelineStripStepStartPercent(
    options.draft,
    options.durationMs,
    options.step,
    options.leftPercent,
    options.snapPolicy,
  );
  return {
    label: createDragPreviewLabel(options.draft, timeMs, options.step),
    leftPercent: clampSkillTimelineStripPercent(leftPercent),
    stepId: options.step.id,
  };
}

export function updateSkillTimelineStepTimingFromStripDrag(options: {
  draft: SkillTimelineEditorDraft;
  durationMs: number;
  leftPercent: number;
  snapPolicy?: Partial<SkillTimelineSnapPolicy> | null;
  step: SkillTimelineEditorStepDraft;
}): SkillTimelineEditorStepDraft {
  const rawTimeMs = resolveSkillTimelineStripTimeMs(options.durationMs, options.leftPercent);
  const timeMs = resolveSkillTimelineStripStepStartMs(
    options.draft,
    options.step,
    rawTimeMs,
    options.snapPolicy,
  );
  if (options.step.timingMode === 'atMs') {
    return {
      ...options.step,
      atMs: timeMs,
    };
  }

  return {
    ...options.step,
    beat: resolveSkillTimelineStripBeat(options.draft, timeMs),
  };
}
