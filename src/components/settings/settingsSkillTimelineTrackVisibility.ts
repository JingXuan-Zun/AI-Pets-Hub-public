import { normalizeSkillTimelineTrackId } from './settingsSkillTimelineTrackId';

export interface SkillTimelineTrackVisibilityState {
  hiddenTrackIds: string[];
  soloTrackId: string;
}

export interface SkillTimelineTrackVisibilityRow {
  id: string;
}

function uniqueTrackIds(trackIds: string[]) {
  return Array.from(new Set(trackIds.map((trackId) => normalizeSkillTimelineTrackId(trackId)).filter(Boolean)));
}

export function createDefaultSkillTimelineTrackVisibility(): SkillTimelineTrackVisibilityState {
  return {
    hiddenTrackIds: [],
    soloTrackId: '',
  };
}

export function toggleSkillTimelineTrackHidden(
  state: SkillTimelineTrackVisibilityState,
  trackId: string,
) {
  const normalizedTrackId = normalizeSkillTimelineTrackId(trackId);
  const hiddenTrackIds = state.hiddenTrackIds.includes(normalizedTrackId)
    ? state.hiddenTrackIds.filter((item) => item !== normalizedTrackId)
    : [...state.hiddenTrackIds, normalizedTrackId];
  return {
    hiddenTrackIds: uniqueTrackIds(hiddenTrackIds),
    soloTrackId: state.soloTrackId === normalizedTrackId ? '' : state.soloTrackId,
  };
}

export function toggleSkillTimelineTrackSolo(
  state: SkillTimelineTrackVisibilityState,
  trackId: string,
) {
  const normalizedTrackId = normalizeSkillTimelineTrackId(trackId);
  return {
    hiddenTrackIds: state.hiddenTrackIds,
    soloTrackId: state.soloTrackId === normalizedTrackId ? '' : normalizedTrackId,
  };
}

export function clearSkillTimelineTrackVisibility(): SkillTimelineTrackVisibilityState {
  return createDefaultSkillTimelineTrackVisibility();
}

export function isSkillTimelineTrackVisible(
  state: SkillTimelineTrackVisibilityState,
  trackId: string,
) {
  const normalizedTrackId = normalizeSkillTimelineTrackId(trackId);
  return state.soloTrackId
    ? state.soloTrackId === normalizedTrackId
    : !state.hiddenTrackIds.includes(normalizedTrackId);
}

export function filterSkillTimelineRowsByVisibility<T extends SkillTimelineTrackVisibilityRow>(
  rows: T[],
  state: SkillTimelineTrackVisibilityState,
) {
  return rows.filter((row) => isSkillTimelineTrackVisible(state, row.id));
}

export function createSkillTimelineTrackVisibilitySummary(
  state: SkillTimelineTrackVisibilityState,
  trackIds: string[],
) {
  const visibleTrackIds = trackIds.filter((trackId) => isSkillTimelineTrackVisible(state, trackId));
  return {
    hiddenCount: trackIds.length - visibleTrackIds.length,
    isFiltered: visibleTrackIds.length < trackIds.length,
    visibleTrackIds,
  };
}
