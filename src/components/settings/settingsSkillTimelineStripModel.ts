import { type SkillTimelineEditorDraft } from './settingsSkillTimelineEditorModel';
import {
  createSkillTimelineEditorTrackRows,
  resolveSkillTimelineEditorStepDelayMs,
} from './settingsSkillTimelineTrackModel';

export interface SkillTimelineEditorStripItem {
  delayMs: number;
  durationMs: number;
  endMs: number;
  id: string;
  label: string;
  leftPercent: number;
  widthPercent: number;
}

export interface SkillTimelineEditorStripRow {
  id: string;
  items: SkillTimelineEditorStripItem[];
  label: string;
}

export interface SkillTimelineEditorStripTick {
  label: string;
  leftPercent: number;
  timeMs: number;
}

export interface SkillTimelineEditorStripModel {
  durationMs: number;
  rows: SkillTimelineEditorStripRow[];
  ticks: SkillTimelineEditorStripTick[];
}

const MIN_STRIP_ITEM_WIDTH_PERCENT = 8;
const MAX_STRIP_TICKS = 12;

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value * 100) / 100));
}

function resolveTimelineDurationMs(draft: SkillTimelineEditorDraft) {
  const explicitDuration = draft.durationMs.trim() ? Number(draft.durationMs) : NaN;
  const maxStepDelayMs = draft.steps.reduce((maxDelay, step) => (
    Math.max(maxDelay, resolveSkillTimelineEditorStepDelayMs(step, draft))
  ), 0);

  return Math.max(1000, Number.isFinite(explicitDuration) ? explicitDuration : 0, maxStepDelayMs);
}

function createTick(timeMs: number, durationMs: number, label: string): SkillTimelineEditorStripTick {
  return {
    label,
    leftPercent: clampPercent((timeMs / durationMs) * 100),
    timeMs: Math.round(timeMs),
  };
}

function createBeatTicks(draft: SkillTimelineEditorDraft, durationMs: number) {
  const beatDurationMs = 60_000 / Math.max(1, draft.bpm);
  const beatCount = Math.max(1, Math.ceil((durationMs - draft.offsetMs) / beatDurationMs) + 1);
  const beatStep = Math.max(1, Math.ceil(beatCount / MAX_STRIP_TICKS));
  const ticks: SkillTimelineEditorStripTick[] = [];

  for (let beat = 1; beat <= beatCount; beat += beatStep) {
    const timeMs = draft.offsetMs + ((beat - 1) * beatDurationMs);
    if (timeMs >= 0 && timeMs <= durationMs) {
      ticks.push(createTick(timeMs, durationMs, `b${beat}`));
    }
  }
  return ticks;
}

function createDurationTicks(durationMs: number) {
  const stepMs = Math.max(1000, Math.ceil(durationMs / MAX_STRIP_TICKS / 1000) * 1000);
  const ticks: SkillTimelineEditorStripTick[] = [];
  for (let timeMs = 0; timeMs <= durationMs; timeMs += stepMs) {
    ticks.push(createTick(timeMs, durationMs, `${Math.round(timeMs / 1000)}s`));
  }
  return ticks;
}

function createStripTicks(draft: SkillTimelineEditorDraft, durationMs: number) {
  return draft.bpm > 0
    ? createBeatTicks(draft, durationMs)
    : createDurationTicks(durationMs);
}

function optionalPositiveNumber(value: string) {
  const parsed = value.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function resolveStepDurationMs(draft: SkillTimelineEditorDraft, stepIndex: number) {
  const step = draft.steps[stepIndex];
  if (!step) {
    return 0;
  }

  const explicitDurationMs = optionalPositiveNumber(step.durationMs);
  if (explicitDurationMs > 0) {
    return explicitDurationMs;
  }

  const holdBeats = optionalPositiveNumber(step.holdBeats);
  const beatDurationMs = 60_000 / Math.max(1, draft.bpm);
  return Math.max(0, holdBeats * beatDurationMs);
}

function resolveStripItemWidthPercent(
  draft: SkillTimelineEditorDraft,
  durationMs: number,
  stepIndex: number,
) {
  const stepDurationMs = resolveStepDurationMs(draft, stepIndex);
  const durationWidth = clampPercent((stepDurationMs / Math.max(1, durationMs)) * 100);
  return Math.min(100, Math.max(MIN_STRIP_ITEM_WIDTH_PERCENT, durationWidth));
}

function createStripItem(
  draft: SkillTimelineEditorDraft,
  durationMs: number,
  stepIndex: number,
) {
  const step = draft.steps[stepIndex];
  if (!step) {
    return null;
  }

  const delayMs = resolveSkillTimelineEditorStepDelayMs(step, draft);
  const rawLeftPercent = clampPercent((delayMs / durationMs) * 100);
  const stepDurationMs = resolveStepDurationMs(draft, stepIndex);
  const widthPercent = resolveStripItemWidthPercent(draft, durationMs, stepIndex);
  const leftPercent = Math.min(rawLeftPercent, 100 - widthPercent);
  return {
    delayMs,
    durationMs: stepDurationMs,
    endMs: delayMs + stepDurationMs,
    id: step.id,
    label: step.label || `Step ${stepIndex + 1}`,
    leftPercent,
    widthPercent,
  } satisfies SkillTimelineEditorStripItem;
}

export function createSkillTimelineEditorStripModel(
  draft: SkillTimelineEditorDraft,
): SkillTimelineEditorStripModel {
  const durationMs = resolveTimelineDurationMs(draft);
  const trackRows = createSkillTimelineEditorTrackRows(draft);

  return {
    durationMs,
    rows: trackRows.map((track) => ({
      id: track.id,
      items: track.steps
        .map((step) => createStripItem(draft, durationMs, draft.steps.indexOf(step)))
        .filter((item): item is SkillTimelineEditorStripItem => Boolean(item)),
      label: track.label,
    })),
    ticks: createStripTicks(draft, durationMs),
  };
}
