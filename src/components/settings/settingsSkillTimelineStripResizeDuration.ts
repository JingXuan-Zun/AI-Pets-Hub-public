import {
  type SkillTimelineEditorDraft,
  type SkillTimelineEditorStepDraft,
} from './settingsSkillTimelineEditorModel';
import { resolveSkillTimelineEditorStepDelayMs } from './settingsSkillTimelineTrackModel';
import { type SkillTimelineSnapPolicy } from './settingsSkillTimelineSnapPolicy';
import {
  clampSkillTimelineStripPercent,
  resolveSkillTimelineStripTimeMs,
  snapSkillTimelineStripHoldBeats,
  snapSkillTimelineStripMsDuration,
} from './settingsSkillTimelineStripSnap';

export interface SkillTimelineStripResizePreview {
  durationMs: number;
  isAtMinimum: boolean;
  label: string;
  leftPercent: number;
  rightPercent: number;
  stepId: string;
  widthPercent: number;
}

function resolveResizeTimeMs(durationMs: number, rightPercent: number) {
  return resolveSkillTimelineStripTimeMs(durationMs, rightPercent);
}

function resolveStepDurationMs(options: {
  draft: SkillTimelineEditorDraft;
  resizeTimeMs: number;
  step: SkillTimelineEditorStepDraft;
}) {
  const startMs = resolveSkillTimelineEditorStepDelayMs(options.step, options.draft);
  return Math.max(0, options.resizeTimeMs - startMs);
}

function formatNumberInput(value: number) {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/u, '');
}

function resolveHoldBeats(
  draft: SkillTimelineEditorDraft,
  durationMs: number,
  snapPolicy?: Partial<SkillTimelineSnapPolicy> | null,
) {
  const beatDurationMs = 60_000 / Math.max(1, draft.bpm);
  return snapSkillTimelineStripHoldBeats(durationMs / beatDurationMs, snapPolicy);
}

function shouldResizeWriteHoldBeats(step: SkillTimelineEditorStepDraft) {
  return step.timingMode === 'beat' && !(step.durationMs ?? '').trim();
}

function createResizeDurationLabel(
  draft: SkillTimelineEditorDraft,
  step: SkillTimelineEditorStepDraft,
  durationMs: number,
  snapPolicy?: Partial<SkillTimelineSnapPolicy> | null,
) {
  return shouldResizeWriteHoldBeats(step)
    ? `${formatNumberInput(resolveHoldBeats(draft, durationMs, snapPolicy))} beats`
    : `${durationMs}ms`;
}

function snapStepDurationMs(
  draft: SkillTimelineEditorDraft,
  step: SkillTimelineEditorStepDraft,
  durationMs: number,
  snapPolicy?: Partial<SkillTimelineSnapPolicy> | null,
) {
  if (!shouldResizeWriteHoldBeats(step)) {
    return snapSkillTimelineStripMsDuration(durationMs, snapPolicy);
  }

  const beatDurationMs = 60_000 / Math.max(1, draft.bpm);
  return Math.round(resolveHoldBeats(draft, durationMs, snapPolicy) * beatDurationMs);
}

function resolveRightPercent(durationMs: number, rightTimeMs: number) {
  return clampSkillTimelineStripPercent((rightTimeMs / Math.max(1, durationMs)) * 100);
}

function createResizePreviewRange(options: {
  durationMs: number;
  startMs: number;
  stepDurationMs: number;
}) {
  const leftPercent = resolveRightPercent(options.durationMs, options.startMs);
  const rightPercent = resolveRightPercent(options.durationMs, options.startMs + options.stepDurationMs);
  return {
    leftPercent,
    rightPercent,
    widthPercent: Math.max(0, Math.round((rightPercent - leftPercent) * 100) / 100),
  };
}

export function createSkillTimelineStripResizePreview(options: {
  draft: SkillTimelineEditorDraft;
  durationMs: number;
  rightPercent: number;
  snapPolicy?: Partial<SkillTimelineSnapPolicy> | null;
  step: SkillTimelineEditorStepDraft;
}): SkillTimelineStripResizePreview {
  const resizeTimeMs = resolveResizeTimeMs(options.durationMs, options.rightPercent);
  const durationMs = resolveStepDurationMs({
    draft: options.draft,
    resizeTimeMs,
    step: options.step,
  });
  const snappedDurationMs = snapStepDurationMs(
    options.draft,
    options.step,
    durationMs,
    options.snapPolicy,
  );
  const startMs = resolveSkillTimelineEditorStepDelayMs(options.step, options.draft);
  const range = createResizePreviewRange({
    durationMs: options.durationMs,
    startMs,
    stepDurationMs: snappedDurationMs,
  });

  return {
    durationMs: snappedDurationMs,
    isAtMinimum: snappedDurationMs <= 0,
    label: createResizeDurationLabel(options.draft, options.step, snappedDurationMs, options.snapPolicy),
    ...range,
    stepId: options.step.id,
  };
}

export function updateSkillTimelineStepDurationFromStripResize(options: {
  draft: SkillTimelineEditorDraft;
  durationMs: number;
  rightPercent: number;
  snapPolicy?: Partial<SkillTimelineSnapPolicy> | null;
  step: SkillTimelineEditorStepDraft;
}): SkillTimelineEditorStepDraft {
  const resizeTimeMs = resolveResizeTimeMs(options.durationMs, options.rightPercent);
  const durationMs = resolveStepDurationMs({
    draft: options.draft,
    resizeTimeMs,
    step: options.step,
  });
  const snappedDurationMs = snapStepDurationMs(
    options.draft,
    options.step,
    durationMs,
    options.snapPolicy,
  );
  if (shouldResizeWriteHoldBeats(options.step)) {
    return {
      ...options.step,
      holdBeats: formatNumberInput(resolveHoldBeats(
        options.draft,
        snappedDurationMs,
        options.snapPolicy,
      )),
    };
  }

  return {
    ...options.step,
    durationMs: String(snappedDurationMs),
  };
}
