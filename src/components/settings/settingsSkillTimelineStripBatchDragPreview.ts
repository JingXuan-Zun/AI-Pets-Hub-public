import {
  type SkillTimelineEditorDraft,
  type SkillTimelineEditorStepDraft,
} from './settingsSkillTimelineEditorModel';
import { resolveSkillTimelineEditorStepDelayMs } from './settingsSkillTimelineTrackModel';
import { type SkillTimelineSnapPolicy } from './settingsSkillTimelineSnapPolicy';
import {
  createSkillTimelineStripDragTimingPreview,
} from './settingsSkillTimelineStripDragTiming';
import {
  resolveSkillTimelineStripStepStartMs,
  resolveSkillTimelineStripTimeMs,
} from './settingsSkillTimelineStripSnap';

export interface SkillTimelineStripBatchDragPreview {
  label: string;
  leftPercent: number;
  stepId: string;
}

function createShiftedPreview(
  draft: SkillTimelineEditorDraft,
  durationMs: number,
  step: SkillTimelineEditorStepDraft,
  deltaMs: number,
  snapPolicy?: Partial<SkillTimelineSnapPolicy> | null,
): SkillTimelineStripBatchDragPreview {
  const nextTimeMs = Math.max(0, resolveSkillTimelineEditorStepDelayMs(step, draft) + deltaMs);
  const leftPercent = (nextTimeMs / Math.max(1, durationMs)) * 100;
  const preview = createSkillTimelineStripDragTimingPreview({
    draft,
    durationMs,
    leftPercent,
    snapPolicy,
    step,
  });
  return {
    label: preview.label,
    leftPercent: preview.leftPercent,
    stepId: step.id,
  };
}

export function createSkillTimelineStripBatchDragPreviews(options: {
  draft: SkillTimelineEditorDraft;
  durationMs: number;
  leftPercent: number;
  primaryStepId: string;
  selectedStepIds: string[];
  snapPolicy?: Partial<SkillTimelineSnapPolicy> | null;
}): SkillTimelineStripBatchDragPreview[] {
  const selectedIds = new Set(options.selectedStepIds);
  const primaryStep = options.draft.steps.find((step) => step.id === options.primaryStepId);
  if (!primaryStep || !selectedIds.has(primaryStep.id) || selectedIds.size < 2) {
    return [];
  }

  const rawTimeMs = resolveSkillTimelineStripTimeMs(options.durationMs, options.leftPercent);
  const nextPrimaryMs = resolveSkillTimelineStripStepStartMs(
    options.draft,
    primaryStep,
    rawTimeMs,
    options.snapPolicy,
  );
  const previousPrimaryMs = resolveSkillTimelineEditorStepDelayMs(primaryStep, options.draft);
  const deltaMs = nextPrimaryMs - previousPrimaryMs;

  return options.draft.steps
    .filter((step) => selectedIds.has(step.id) && step.id !== primaryStep.id)
    .map((step) => createShiftedPreview(
      options.draft,
      options.durationMs,
      step,
      deltaMs,
      options.snapPolicy,
    ));
}
