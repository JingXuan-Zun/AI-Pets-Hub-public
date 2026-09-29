import { type SkillTimelineEditorStepDraft } from './settingsSkillTimelineEditorModel';
import { normalizeSkillTimelineTrackId } from './settingsSkillTimelineTrackId';

export interface SkillTimelineStripTrackBounds {
  bottom: number;
  id: string;
  top: number;
}

export function resolveSkillTimelineStripDropTrackId(
  trackBounds: SkillTimelineStripTrackBounds[],
  clientY: number,
) {
  return trackBounds.find((track) => clientY >= track.top && clientY <= track.bottom)?.id ?? '';
}

export function updateSkillTimelineStepTrackFromStripDrop(
  step: SkillTimelineEditorStepDraft,
  trackId: string,
): SkillTimelineEditorStepDraft {
  const nextTrackId = normalizeSkillTimelineTrackId(trackId);
  return nextTrackId ? { ...step, track: nextTrackId } : step;
}
