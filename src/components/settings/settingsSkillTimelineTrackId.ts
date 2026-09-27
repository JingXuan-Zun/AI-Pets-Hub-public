export function normalizeSkillTimelineTrackId(value: unknown, fallback = '') {
  const text = typeof value === 'string' ? value.trim() : '';
  return text.toLowerCase().replace(/[^a-z0-9_-]/giu, '').slice(0, 32) || fallback;
}
