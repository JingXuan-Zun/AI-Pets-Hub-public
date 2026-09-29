export interface SkillTimelineSnapPolicy {
  beatStep: number;
  holdBeatStep: number;
  msStep: number;
}

export const DEFAULT_SKILL_TIMELINE_SNAP_POLICY: SkillTimelineSnapPolicy = {
  beatStep: 1,
  holdBeatStep: 0.25,
  msStep: 100,
};

function normalizeSnapStep(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, parsed));
}

export function normalizeSkillTimelineSnapPolicy(
  policy?: Partial<SkillTimelineSnapPolicy> | null,
): SkillTimelineSnapPolicy {
  return {
    beatStep: normalizeSnapStep(policy?.beatStep, DEFAULT_SKILL_TIMELINE_SNAP_POLICY.beatStep, 0.25, 4),
    holdBeatStep: normalizeSnapStep(policy?.holdBeatStep, DEFAULT_SKILL_TIMELINE_SNAP_POLICY.holdBeatStep, 0.25, 4),
    msStep: normalizeSnapStep(policy?.msStep, DEFAULT_SKILL_TIMELINE_SNAP_POLICY.msStep, 25, 5000),
  };
}
