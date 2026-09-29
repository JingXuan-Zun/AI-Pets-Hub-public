import {
  type SkillTimelineEditorDraft,
  type SkillTimelineEditorStepDraft,
} from './settingsSkillTimelineEditorModel';
import { normalizeSkillTimelineTrackId } from './settingsSkillTimelineTrackId';
import {
  removeSkillTimelineTrackFromOrder,
  renameSkillTimelineTrackOrder,
} from './settingsSkillTimelineTrackOrder';

function resolveStepTrackId(step: SkillTimelineEditorStepDraft) {
  return normalizeSkillTimelineTrackId(step.track, 'motion');
}

function resolveSourceTrackId(trackId: string) {
  return normalizeSkillTimelineTrackId(trackId);
}

export function renameSkillTimelineEditorTrack(
  draft: SkillTimelineEditorDraft,
  sourceTrackId: string,
  targetTrackId: string,
) {
  const sourceId = resolveSourceTrackId(sourceTrackId);
  const targetId = normalizeSkillTimelineTrackId(targetTrackId, 'custom');
  if (!sourceId || sourceId === targetId) {
    return draft;
  }

  let changed = false;
  const steps = draft.steps.map((step) => {
    if (resolveStepTrackId(step) !== sourceId) {
      return step;
    }

    changed = true;
    return { ...step, track: targetId };
  });

  return changed
    ? { ...draft, steps, trackOrder: renameSkillTimelineTrackOrder(draft.trackOrder, sourceId, targetId) }
    : draft;
}

export function deleteSkillTimelineEditorTrackSteps(
  draft: SkillTimelineEditorDraft,
  trackId: string,
) {
  const sourceId = resolveSourceTrackId(trackId);
  if (!sourceId) {
    return draft;
  }

  const steps = draft.steps.filter((step) => resolveStepTrackId(step) !== sourceId);
  return steps.length === draft.steps.length
    ? draft
    : { ...draft, steps, trackOrder: removeSkillTimelineTrackFromOrder(draft.trackOrder, sourceId) };
}
