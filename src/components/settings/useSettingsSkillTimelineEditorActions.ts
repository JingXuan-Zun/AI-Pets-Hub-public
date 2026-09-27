import { type SkillTimelineEditorDraft } from './settingsSkillTimelineEditorModel';
import { type SkillTimelineSnapPolicy } from './settingsSkillTimelineSnapPolicy';
import { replaceSkillTimelineEditorStep } from './settingsSkillTimelineEditorStepOperations';
import { updateSkillTimelineStepTrackFromStripDrop } from './settingsSkillTimelineStripDropTrack';
import { nudgeSkillTimelineStepTiming } from './settingsSkillTimelineStepTimingNudge';
import { updateSkillTimelineStepsTimingFromStripBatchDrag } from './settingsSkillTimelineStripBatchDragTiming';
import { updateSkillTimelineStepTimingFromStripDrag } from './settingsSkillTimelineStripDragTiming';
import { updateSkillTimelineStepDurationFromStripResize } from './settingsSkillTimelineStripResizeDuration';

interface UseSettingsSkillTimelineEditorActionsOptions {
  applyDraft: (draft: SkillTimelineEditorDraft) => void;
  draft: SkillTimelineEditorDraft;
  selectedStepIds?: string[];
  snapPolicy?: Partial<SkillTimelineSnapPolicy> | null;
}

export function useSettingsSkillTimelineEditorActions({
  applyDraft,
  draft,
  selectedStepIds = [],
  snapPolicy,
}: UseSettingsSkillTimelineEditorActionsOptions) {
  const dragSelectedStepsTiming = (stepId: string, leftPercent: number, durationMs: number) => {
    applyDraft(updateSkillTimelineStepsTimingFromStripBatchDrag({
      draft,
      durationMs,
      leftPercent,
      primaryStepId: stepId,
      selectedStepIds,
      snapPolicy,
    }));
  };
  const dragStepTiming = (stepId: string, leftPercent: number, durationMs: number) => {
    if (selectedStepIds.length > 1 && selectedStepIds.includes(stepId)) {
      dragSelectedStepsTiming(stepId, leftPercent, durationMs);
      return;
    }

    applyDraft(replaceSkillTimelineEditorStep(draft, stepId, (step) => (
      updateSkillTimelineStepTimingFromStripDrag({ draft, durationMs, leftPercent, snapPolicy, step })
    )));
  };
  const dropStepTrack = (stepId: string, trackId: string) => {
    applyDraft(replaceSkillTimelineEditorStep(draft, stepId, (step) => (
      updateSkillTimelineStepTrackFromStripDrop(step, trackId)
    )));
  };
  const nudgeStepTiming = (stepId: string, direction: -1 | 1) => {
    applyDraft(replaceSkillTimelineEditorStep(draft, stepId, (step) => (
      nudgeSkillTimelineStepTiming(step, direction)
    )));
  };
  const resizeStepDuration = (stepId: string, rightPercent: number, durationMs: number) => {
    applyDraft(replaceSkillTimelineEditorStep(draft, stepId, (step) => (
      updateSkillTimelineStepDurationFromStripResize({ draft, durationMs, rightPercent, snapPolicy, step })
    )));
  };

  return { dragStepTiming, dropStepTrack, nudgeStepTiming, resizeStepDuration };
}
