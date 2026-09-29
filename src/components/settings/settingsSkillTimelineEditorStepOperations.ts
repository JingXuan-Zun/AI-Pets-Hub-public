import {
  createEmptySkillTimelineEditorStep,
  type SkillTimelineEditorDraft,
  type SkillTimelineEditorStepDraft,
} from './settingsSkillTimelineEditorModel';

export function replaceSkillTimelineEditorStep(
  draft: SkillTimelineEditorDraft,
  stepId: string,
  updater: (step: SkillTimelineEditorStepDraft) => SkillTimelineEditorStepDraft,
) {
  return {
    ...draft,
    steps: draft.steps.map((step) => (step.id === stepId ? updater(step) : step)),
  };
}

export function moveSkillTimelineEditorStep(
  draft: SkillTimelineEditorDraft,
  stepId: string,
  direction: -1 | 1,
) {
  const fromIndex = draft.steps.findIndex((step) => step.id === stepId);
  const toIndex = fromIndex + direction;
  if (fromIndex < 0 || toIndex < 0 || toIndex >= draft.steps.length) {
    return draft;
  }

  const steps = [...draft.steps];
  const [step] = steps.splice(fromIndex, 1);
  if (step) {
    steps.splice(toIndex, 0, step);
  }
  return { ...draft, steps };
}

function createUniqueStepId(draft: SkillTimelineEditorDraft, usedIds = new Set(draft.steps.map((step) => step.id))) {
  for (let index = draft.steps.length; index < draft.steps.length + 1000; index += 1) {
    const stepId = `step-${index + 1}`;
    if (!usedIds.has(stepId)) {
      usedIds.add(stepId);
      return stepId;
    }
  }
  const fallbackId = `step-${Date.now()}-${usedIds.size}`;
  usedIds.add(fallbackId);
  return fallbackId;
}

function createDuplicateLabel(step: SkillTimelineEditorStepDraft) {
  const label = step.label.trim();
  return label ? `${label} copy` : 'Step copy';
}

export function appendSkillTimelineEditorStep(draft: SkillTimelineEditorDraft) {
  return {
    ...draft,
    steps: [...draft.steps, createEmptySkillTimelineEditorStep(draft.steps.length)],
  };
}

export function deleteSkillTimelineEditorStep(draft: SkillTimelineEditorDraft, stepId: string) {
  return deleteSkillTimelineEditorSteps(draft, [stepId]);
}

export function deleteSkillTimelineEditorSteps(draft: SkillTimelineEditorDraft, stepIds: string[]) {
  const selectedIds = new Set(stepIds);
  return {
    ...draft,
    steps: draft.steps.filter((step) => !selectedIds.has(step.id)),
  };
}

export function duplicateSkillTimelineEditorStep(draft: SkillTimelineEditorDraft, stepId: string) {
  const sourceIndex = draft.steps.findIndex((step) => step.id === stepId);
  const sourceStep = draft.steps[sourceIndex];
  if (!sourceStep) {
    return draft;
  }

  const duplicatedStep = {
    ...sourceStep,
    id: createUniqueStepId(draft),
    label: createDuplicateLabel(sourceStep),
  };
  const steps = [...draft.steps];
  steps.splice(sourceIndex + 1, 0, duplicatedStep);
  return { ...draft, steps };
}

export function duplicateSkillTimelineEditorSteps(draft: SkillTimelineEditorDraft, stepIds: string[]) {
  const selectedIds = new Set(stepIds);
  const usedIds = new Set(draft.steps.map((step) => step.id));
  const steps = draft.steps.flatMap((step) => {
    if (!selectedIds.has(step.id)) {
      return [step];
    }

    return [
      step,
      {
        ...step,
        id: createUniqueStepId(draft, usedIds),
        label: createDuplicateLabel(step),
      },
    ];
  });
  return { ...draft, steps };
}
