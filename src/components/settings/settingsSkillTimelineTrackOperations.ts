import {
  createEmptySkillTimelineEditorStep,
  type SkillTimelineEditorDraft,
} from './settingsSkillTimelineEditorModel';
import { nudgeSkillTimelineStepTiming } from './settingsSkillTimelineStepTimingNudge';
import { normalizeSkillTimelineTrackId } from './settingsSkillTimelineTrackId';
import { appendSkillTimelineTrackToOrder } from './settingsSkillTimelineTrackOrder';

export interface SkillTimelineTrackOption {
  id: string;
  label: string;
}

const BUILT_IN_TRACKS: SkillTimelineTrackOption[] = [
  { id: 'motion', label: 'Motion' },
  { id: 'expression', label: 'Expression' },
  { id: 'audio', label: 'Audio' },
  { id: 'custom', label: 'Custom' },
];

function labelTrackId(trackId: string) {
  return BUILT_IN_TRACKS.find((track) => track.id === trackId)?.label ?? trackId;
}

function createUniqueTrackOptions(trackIds: string[]) {
  const seen = new Set<string>();
  return trackIds
    .map((trackId) => normalizeSkillTimelineTrackId(trackId))
    .filter((trackId) => {
      if (!trackId || seen.has(trackId)) {
        return false;
      }

      seen.add(trackId);
      return true;
    })
    .map((trackId) => ({ id: trackId, label: labelTrackId(trackId) }));
}

export function createSkillTimelineTrackOptions(draft: SkillTimelineEditorDraft) {
  return createUniqueTrackOptions([
    ...BUILT_IN_TRACKS.map((track) => track.id),
    ...draft.steps.map((step) => step.track),
  ]);
}

export function assignSelectedSkillTimelineStepTrack(
  draft: SkillTimelineEditorDraft,
  stepId: string,
  trackId: string,
) {
  return assignSkillTimelineStepsTrack(draft, [stepId], trackId);
}

export function assignSkillTimelineStepsTrack(
  draft: SkillTimelineEditorDraft,
  stepIds: string[],
  trackId: string,
) {
  const nextTrackId = normalizeSkillTimelineTrackId(trackId, 'custom');
  const selectedIds = new Set(stepIds);
  return {
    ...draft,
    steps: draft.steps.map((step) => (selectedIds.has(step.id) ? { ...step, track: nextTrackId } : step)),
  };
}

export function appendSkillTimelineEditorStepOnTrack(
  draft: SkillTimelineEditorDraft,
  trackId: string,
) {
  const nextTrackId = normalizeSkillTimelineTrackId(trackId, 'custom');
  const step = {
    ...createEmptySkillTimelineEditorStep(draft.steps.length),
    track: nextTrackId,
  };
  return {
    ...draft,
    steps: [...draft.steps, step],
    trackOrder: appendSkillTimelineTrackToOrder(draft.trackOrder, nextTrackId),
  };
}

export function nudgeSkillTimelineStepsTiming(
  draft: SkillTimelineEditorDraft,
  stepIds: string[],
  direction: -1 | 1,
) {
  const selectedIds = new Set(stepIds);
  return {
    ...draft,
    steps: draft.steps.map((step) => (
      selectedIds.has(step.id) ? nudgeSkillTimelineStepTiming(step, direction) : step
    )),
  };
}
