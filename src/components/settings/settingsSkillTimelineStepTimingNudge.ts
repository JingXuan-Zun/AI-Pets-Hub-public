import { type SkillTimelineEditorStepDraft } from './settingsSkillTimelineEditorModel';

export const SKILL_TIMELINE_AT_MS_NUDGE_STEP = 100;
export const SKILL_TIMELINE_BEAT_NUDGE_STEP = 1;

export function nudgeSkillTimelineStepTiming(
  step: SkillTimelineEditorStepDraft,
  direction: -1 | 1,
): SkillTimelineEditorStepDraft {
  if (step.timingMode === 'atMs') {
    return {
      ...step,
      atMs: Math.max(0, Math.round(step.atMs + (direction * SKILL_TIMELINE_AT_MS_NUDGE_STEP))),
    };
  }

  return {
    ...step,
    beat: Math.max(1, Math.round(step.beat + (direction * SKILL_TIMELINE_BEAT_NUDGE_STEP))),
  };
}
