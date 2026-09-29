import {
  type SkillTimelineEditorDraft,
  type SkillTimelineEditorStepDraft,
} from './settingsSkillTimelineEditorModel';
import {
  DEFAULT_SKILL_TIMELINE_SNAP_POLICY,
  normalizeSkillTimelineSnapPolicy,
  type SkillTimelineSnapPolicy,
} from './settingsSkillTimelineSnapPolicy';

export const SKILL_TIMELINE_STRIP_MS_SNAP = DEFAULT_SKILL_TIMELINE_SNAP_POLICY.msStep;
export const SKILL_TIMELINE_STRIP_HOLD_BEAT_SNAP = DEFAULT_SKILL_TIMELINE_SNAP_POLICY.holdBeatStep;

export function clampSkillTimelineStripPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value * 100) / 100));
}

export function resolveSkillTimelineStripTimeMs(durationMs: number, percent: number) {
  const rawTimeMs = (clampSkillTimelineStripPercent(percent) / 100) * Math.max(1, durationMs);
  return Math.max(0, Math.round(rawTimeMs));
}

export function resolveSkillTimelineStripBeat(draft: SkillTimelineEditorDraft, timeMs: number) {
  const beatDurationMs = 60_000 / Math.max(1, draft.bpm);
  const beat = Math.round(((timeMs - draft.offsetMs) / beatDurationMs) + 1);
  return Math.max(1, beat);
}

export function resolveSkillTimelineStripSnappedBeat(
  draft: SkillTimelineEditorDraft,
  timeMs: number,
  policy?: Partial<SkillTimelineSnapPolicy> | null,
) {
  const snapPolicy = normalizeSkillTimelineSnapPolicy(policy);
  const beatDurationMs = 60_000 / Math.max(1, draft.bpm);
  const rawBeat = ((timeMs - draft.offsetMs) / beatDurationMs) + 1;
  return Math.max(1, Math.round(rawBeat / snapPolicy.beatStep) * snapPolicy.beatStep);
}

export function resolveSkillTimelineStripStepStartMs(
  draft: SkillTimelineEditorDraft,
  step: SkillTimelineEditorStepDraft,
  timeMs: number,
  policy?: Partial<SkillTimelineSnapPolicy> | null,
) {
  const snapPolicy = normalizeSkillTimelineSnapPolicy(policy);
  if (step.timingMode === 'atMs') {
    return Math.round(timeMs / snapPolicy.msStep) * snapPolicy.msStep;
  }

  const beat = resolveSkillTimelineStripSnappedBeat(draft, timeMs, snapPolicy);
  const beatDurationMs = 60_000 / Math.max(1, draft.bpm);
  return Math.round(draft.offsetMs + ((beat - 1) * beatDurationMs));
}

export function resolveSkillTimelineStripStepStartPercent(
  draft: SkillTimelineEditorDraft,
  durationMs: number,
  step: SkillTimelineEditorStepDraft,
  leftPercent: number,
  policy?: Partial<SkillTimelineSnapPolicy> | null,
) {
  const timeMs = resolveSkillTimelineStripTimeMs(durationMs, leftPercent);
  const snappedTimeMs = resolveSkillTimelineStripStepStartMs(draft, step, timeMs, policy);
  return clampSkillTimelineStripPercent((snappedTimeMs / Math.max(1, durationMs)) * 100);
}

export function snapSkillTimelineStripMsDuration(
  durationMs: number,
  policy?: Partial<SkillTimelineSnapPolicy> | null,
) {
  const snapPolicy = normalizeSkillTimelineSnapPolicy(policy);
  return Math.max(0, Math.round(durationMs / snapPolicy.msStep) * snapPolicy.msStep);
}

export function snapSkillTimelineStripHoldBeats(
  holdBeats: number,
  policy?: Partial<SkillTimelineSnapPolicy> | null,
) {
  const snapPolicy = normalizeSkillTimelineSnapPolicy(policy);
  return Math.max(0, Math.round(holdBeats / snapPolicy.holdBeatStep) * snapPolicy.holdBeatStep);
}
