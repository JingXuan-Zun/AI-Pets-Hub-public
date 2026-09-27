import {
  type SkillTimelineEditorDraft,
  type SkillTimelineEditorStepDraft,
} from './settingsSkillTimelineEditorModel';
import { normalizeSkillTimelineTrackId } from './settingsSkillTimelineTrackId';

export interface SkillTimelineTrackOrderRow {
  id: string;
}

function createUniqueTrackIds(trackIds: unknown[]) {
  const seen = new Set<string>();
  return trackIds
    .map((trackId) => normalizeSkillTimelineTrackId(trackId))
    .filter((trackId) => {
      if (!trackId || seen.has(trackId)) {
        return false;
      }

      seen.add(trackId);
      return true;
    });
}

function resolveStepTrackId(step: SkillTimelineEditorStepDraft) {
  return normalizeSkillTimelineTrackId(step.track, 'motion');
}

function moveTrackId(trackIds: string[], trackId: string, direction: -1 | 1) {
  const fromIndex = trackIds.indexOf(trackId);
  const toIndex = fromIndex + direction;
  if (fromIndex < 0 || toIndex < 0 || toIndex >= trackIds.length) {
    return trackIds;
  }

  const nextTrackIds = [...trackIds];
  const [item] = nextTrackIds.splice(fromIndex, 1);
  if (item) {
    nextTrackIds.splice(toIndex, 0, item);
  }
  return nextTrackIds;
}

function areTrackOrdersEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((trackId, index) => trackId === right[index]);
}

export function normalizeSkillTimelineTrackOrder(value: unknown) {
  return Array.isArray(value) ? createUniqueTrackIds(value) : [];
}

export function createSkillTimelineTrackOrderForDraft(draft: SkillTimelineEditorDraft) {
  const stepTrackIds = createUniqueTrackIds(draft.steps.map(resolveStepTrackId));
  const knownStepTrackIds = new Set(stepTrackIds);
  return [
    ...draft.trackOrder.filter((trackId) => knownStepTrackIds.has(trackId)),
    ...stepTrackIds.filter((trackId) => !draft.trackOrder.includes(trackId)),
  ];
}

export function moveSkillTimelineEditorTrackOrder(
  draft: SkillTimelineEditorDraft,
  trackId: string,
  direction: -1 | 1,
) {
  const normalizedTrackId = normalizeSkillTimelineTrackId(trackId);
  const currentTrackOrder = createSkillTimelineTrackOrderForDraft(draft);
  const trackOrder = moveTrackId(currentTrackOrder, normalizedTrackId, direction);
  return areTrackOrdersEqual(trackOrder, currentTrackOrder) ? draft : { ...draft, trackOrder };
}

export function renameSkillTimelineTrackOrder(trackOrder: string[], sourceTrackId: string, targetTrackId: string) {
  const sourceId = normalizeSkillTimelineTrackId(sourceTrackId);
  const targetId = normalizeSkillTimelineTrackId(targetTrackId, 'custom');
  return createUniqueTrackIds(trackOrder.map((trackId) => (trackId === sourceId ? targetId : trackId)));
}

export function removeSkillTimelineTrackFromOrder(trackOrder: string[], trackId: string) {
  const normalizedTrackId = normalizeSkillTimelineTrackId(trackId);
  return trackOrder.filter((item) => item !== normalizedTrackId);
}

export function appendSkillTimelineTrackToOrder(trackOrder: string[], trackId: string) {
  return createUniqueTrackIds([...trackOrder, trackId]);
}

export function sortSkillTimelineTrackRowsByOrder<T extends SkillTimelineTrackOrderRow>(
  rows: T[],
  trackOrder: string[],
) {
  const orderIndexById = new Map(trackOrder.map((trackId, index) => [trackId, index] as const));
  return rows
    .map((row, index) => ({ index, orderIndex: orderIndexById.get(row.id), row }))
    .sort((a, b) => {
      if (a.orderIndex === undefined && b.orderIndex === undefined) {
        return a.index - b.index;
      }
      if (a.orderIndex === undefined) {
        return 1;
      }
      if (b.orderIndex === undefined) {
        return -1;
      }
      return a.orderIndex - b.orderIndex || a.index - b.index;
    })
    .map((item) => item.row);
}
