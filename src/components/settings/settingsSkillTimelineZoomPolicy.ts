export interface SkillTimelineZoomPolicy {
  scale: number;
}

export const DEFAULT_SKILL_TIMELINE_ZOOM_POLICY: SkillTimelineZoomPolicy = {
  scale: 1,
};

export const SKILL_TIMELINE_ZOOM_OPTIONS = [
  { label: '1x', scale: 1 },
  { label: '1.5x', scale: 1.5 },
  { label: '2x', scale: 2 },
  { label: '3x', scale: 3 },
] as const;

function nearestZoomScale(value: number) {
  return SKILL_TIMELINE_ZOOM_OPTIONS.reduce((nearest, option) => (
    Math.abs(option.scale - value) < Math.abs(nearest - value) ? option.scale : nearest
  ), DEFAULT_SKILL_TIMELINE_ZOOM_POLICY.scale);
}

export function normalizeSkillTimelineZoomPolicy(value: Partial<SkillTimelineZoomPolicy> | null | undefined) {
  const scale = typeof value?.scale === 'number' && Number.isFinite(value.scale)
    ? nearestZoomScale(value.scale)
    : DEFAULT_SKILL_TIMELINE_ZOOM_POLICY.scale;
  return { scale };
}

export function createSkillTimelineZoomStyle(policy: Partial<SkillTimelineZoomPolicy> | null | undefined) {
  const normalizedPolicy = normalizeSkillTimelineZoomPolicy(policy);
  return {
    minWidth: `${Math.round(normalizedPolicy.scale * 100)}%`,
  };
}

export function labelSkillTimelineZoom(policy: Partial<SkillTimelineZoomPolicy> | null | undefined) {
  const normalizedPolicy = normalizeSkillTimelineZoomPolicy(policy);
  return SKILL_TIMELINE_ZOOM_OPTIONS.find((option) => option.scale === normalizedPolicy.scale)?.label ?? '1x';
}
