import { normalizeSkillTimelineTrackId } from './settingsSkillTimelineTrackId';
import { normalizeSkillTimelineTrackOrder } from './settingsSkillTimelineTrackOrder';

export type SkillTimelineEditorTimingMode = 'atMs' | 'beat';

export interface SkillTimelineEditorStepDraft {
  animationId: string;
  atMs: number;
  beat: number;
  durationMs: string;
  expressionId: string;
  holdBeats: string;
  id: string;
  label: string;
  timingMode: SkillTimelineEditorTimingMode;
  track: string;
}

export interface SkillTimelineEditorDraft {
  audioStartDelayMs: string;
  audioUrl: string;
  beatCount: number;
  bpm: number;
  durationMs: string;
  offsetMs: number;
  rootExtras: Record<string, unknown>;
  songId: string;
  steps: SkillTimelineEditorStepDraft[];
  trackOrder: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringField(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function numberField(value: unknown, fallback: number) {
  const parsed = typeof value === 'number' ? value : stringField(value) ? Number(value) : NaN;
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : fallback;
}

function optionalNumberStringField(value: unknown) {
  const parsed = typeof value === 'number' ? value : stringField(value) ? Number(value) : NaN;
  return Number.isFinite(parsed) ? String(Math.max(0, Math.round(parsed))) : '';
}

function optionalPositiveNumberStringField(value: unknown) {
  const parsed = typeof value === 'number' ? value : stringField(value) ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? String(parsed) : '';
}

function stepNumberStringField(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function serializeOptionalNumberField(value: unknown, integerOnly: boolean) {
  const text = stepNumberStringField(value);
  if (!text) {
    return undefined;
  }

  const parsed = Number(text);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return integerOnly ? Math.max(0, Math.round(parsed)) : Math.max(0, parsed);
}

function createStepId(index: number) {
  return `step-${index + 1}`;
}

function createRootExtras(input: Record<string, unknown>) {
  const {
    audioDurationMs: _audioDurationMs,
    audioOffsetMs: _audioOffsetMs,
    audioStartDelayMs: _audioStartDelayMs,
    audioUrl: _audioUrl,
    beatCount: _beatCount,
    bpm: _bpm,
    durationMs: _durationMs,
    offsetMs: _offsetMs,
    song: _song,
    songId: _songId,
    startDelayMs: _startDelayMs,
    steps: _steps,
    timeline: _timeline,
    trackOrder: _trackOrder,
    ...rootExtras
  } = input;

  return rootExtras;
}

export function createEmptySkillTimelineEditorStep(index: number): SkillTimelineEditorStepDraft {
  return {
    animationId: '',
    atMs: index * 1000,
    beat: (index * 2) + 1,
    durationMs: '',
    expressionId: '',
    holdBeats: '',
    id: createStepId(index),
    label: `Step ${index + 1}`,
    timingMode: 'beat',
    track: 'motion',
  };
}

function parseTimelineStep(value: unknown, index: number): SkillTimelineEditorStepDraft {
  if (!isRecord(value)) {
    return {
      ...createEmptySkillTimelineEditorStep(index),
      animationId: stringField(value),
    };
  }

  const atMs = numberField(value.atMs ?? value.startMs, index * 1000);
  const animationId = stringField(value.animationId ?? value.motionId);
  const expressionId = stringField(value.expressionId ?? value.expression ?? value.expressionName);
  return {
    animationId,
    atMs,
    beat: numberField(value.beat ?? value.beatIndex, (index * 2) + 1),
    durationMs: optionalNumberStringField(value.durationMs),
    expressionId,
    holdBeats: optionalPositiveNumberStringField(value.holdBeats ?? value.beats),
    id: createStepId(index),
    label: stringField(value.label ?? value.title) || `Step ${index + 1}`,
    timingMode: value.atMs !== undefined || value.startMs !== undefined ? 'atMs' : 'beat',
    track: normalizeSkillTimelineTrackId(value.track ?? value.lane, !animationId && expressionId ? 'expression' : 'motion'),
  };
}

export function createSkillTimelineEditorDraft(inputJson: string): SkillTimelineEditorDraft {
  const parsed = JSON.parse(inputJson) as unknown;
  const input = isRecord(parsed) ? parsed : {};
  const timeline = Array.isArray(input.timeline)
    ? input.timeline
    : Array.isArray(input.steps)
      ? input.steps
      : [];

  return {
    audioStartDelayMs: optionalNumberStringField(input.audioStartDelayMs ?? input.startDelayMs),
    audioUrl: stringField(input.audioUrl),
    beatCount: numberField(input.beatCount, 8),
    bpm: numberField(input.bpm, 120),
    durationMs: optionalNumberStringField(input.durationMs ?? input.audioDurationMs),
    offsetMs: numberField(input.offsetMs ?? input.audioOffsetMs, 0),
    rootExtras: createRootExtras(input),
    songId: stringField(input.songId ?? input.song),
    steps: timeline.map(parseTimelineStep),
    trackOrder: normalizeSkillTimelineTrackOrder(input.trackOrder),
  };
}

function serializeStep(step: SkillTimelineEditorStepDraft) {
  const durationMs = serializeOptionalNumberField(step.durationMs, true);
  const holdBeats = serializeOptionalNumberField(step.holdBeats, false);
  return {
    ...(step.label.trim() ? { label: step.label.trim() } : {}),
    ...(step.animationId.trim() ? { animationId: step.animationId.trim() } : {}),
    ...(step.expressionId.trim() ? { expressionId: step.expressionId.trim() } : {}),
    ...(step.track.trim() ? { track: step.track.trim() } : {}),
    ...(durationMs === undefined ? {} : { durationMs }),
    ...(holdBeats === undefined ? {} : { holdBeats }),
    ...(step.timingMode === 'atMs'
      ? { atMs: Math.max(0, Math.round(step.atMs)) }
      : { beat: Math.max(1, Math.round(step.beat)) }),
  };
}

export function serializeSkillTimelineEditorDraft(draft: SkillTimelineEditorDraft) {
  return JSON.stringify({
    ...draft.rootExtras,
    ...(draft.songId.trim() ? { songId: draft.songId.trim() } : {}),
    ...(draft.audioUrl.trim() ? { audioUrl: draft.audioUrl.trim() } : {}),
    ...(draft.durationMs.trim() ? { durationMs: Math.max(0, Math.round(Number(draft.durationMs))) } : {}),
    ...(draft.audioStartDelayMs.trim()
      ? { audioStartDelayMs: Math.max(0, Math.round(Number(draft.audioStartDelayMs))) }
      : {}),
    beatCount: Math.max(1, Math.round(draft.beatCount)),
    bpm: Math.max(1, Math.round(draft.bpm)),
    offsetMs: Math.max(0, Math.round(draft.offsetMs)),
    ...(draft.trackOrder.length > 0 ? { trackOrder: draft.trackOrder } : {}),
    timeline: draft.steps.map(serializeStep),
  }, null, 2);
}
