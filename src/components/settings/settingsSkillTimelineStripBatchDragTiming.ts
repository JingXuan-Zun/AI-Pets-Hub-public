import {
  type SkillTimelineEditorDraft,
  type SkillTimelineEditorStepDraft,
} from './settingsSkillTimelineEditorModel';
import { resolveSkillTimelineEditorStepDelayMs } from './settingsSkillTimelineTrackModel';
import { type SkillTimelineSnapPolicy } from './settingsSkillTimelineSnapPolicy';
import {
  resolveSkillTimelineStripBeat,
  resolveSkillTimelineStripStepStartMs,
  resolveSkillTimelineStripTimeMs,
} from './settingsSkillTimelineStripSnap';

function updateStepTimingFromMs(
  draft: SkillTimelineEditorDraft,
  step: SkillTimelineEditorStepDraft,
  timeMs: number,
) {
  if (step.timingMode === 'atMs') {
    return { ...step, atMs: Math.max(0, Math.round(timeMs)) };
  }

  return { ...step, beat: resolveSkillTimelineStripBeat(draft, timeMs) };
}

export function updateSkillTimelineStepsTimingFromStripBatchDrag(options: {
  draft: SkillTimelineEditorDraft;
  durationMs: number;
  leftPercent: number;
  primaryStepId: string;
  selectedStepIds: string[];
  snapPolicy?: Partial<SkillTimelineSnapPolicy> | null;
}): SkillTimelineEditorDraft {
  const selectedIds = new Set(options.selectedStepIds);
  if (!selectedIds.has(options.primaryStepId)) {
    return options.draft;
  }

  const primaryStep = options.draft.steps.find((step) => step.id === options.primaryStepId);
  if (!primaryStep) {
    return options.draft;
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

  return {
    ...options.draft,
    steps: options.draft.steps.map((step) => {
      if (!selectedIds.has(step.id)) {
        return step;
      }

      const nextTimeMs = Math.max(0, resolveSkillTimelineEditorStepDelayMs(step, options.draft) + deltaMs);
      return updateStepTimingFromMs(options.draft, step, nextTimeMs);
    }),
  };
}
