import { useEffect, useRef, useState } from 'react';
import {
  createSkillTimelineEditorDraft,
  serializeSkillTimelineEditorDraft,
  type SkillTimelineEditorDraft,
} from './settingsSkillTimelineEditorModel';

interface UseSettingsSkillTimelineEditorStateOptions {
  inputJson: string;
  onChangeInputJson: (inputJson: string) => void;
}

export function useSettingsSkillTimelineEditorState({
  inputJson,
  onChangeInputJson,
}: UseSettingsSkillTimelineEditorStateOptions) {
  const [draft, setDraft] = useState<SkillTimelineEditorDraft>(() => createSkillTimelineEditorDraft(inputJson));
  const [parseError, setParseError] = useState('');
  const [selectedStepId, setSelectedStepId] = useState('');
  const [selectedStepIds, setSelectedStepIds] = useState<string[]>([]);
  const stepElementsRef = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    try {
      setDraft(createSkillTimelineEditorDraft(inputJson));
      setParseError('');
    } catch {
      setParseError('Editor paused until JSON is valid.');
    }
  }, [inputJson]);

  useEffect(() => {
    if (selectedStepId && !draft.steps.some((step) => step.id === selectedStepId)) {
      setSelectedStepId('');
    }
    setSelectedStepIds((currentIds) => currentIds.filter((stepId) => draft.steps.some((step) => step.id === stepId)));
  }, [draft.steps, selectedStepId]);

  const applyDraft = (nextDraft: SkillTimelineEditorDraft) => {
    setDraft(nextDraft);
    onChangeInputJson(serializeSkillTimelineEditorDraft(nextDraft));
  };
  const setStepElement = (stepId: string, element: HTMLDivElement | null) => {
    if (element) {
      stepElementsRef.current.set(stepId, element);
    } else {
      stepElementsRef.current.delete(stepId);
    }
  };
  const selectStep = (stepId: string) => {
    setSelectedStepId(stepId);
    setSelectedStepIds([stepId]);
    if (typeof window === 'undefined') {
      return;
    }

    window.requestAnimationFrame(() => {
      stepElementsRef.current.get(stepId)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  };
  const focusStep = (stepId: string) => {
    setSelectedStepId(stepId);
  };
  const toggleStepSelection = (stepId: string) => {
    setSelectedStepIds((currentIds) => {
      if (currentIds.includes(stepId)) {
        const nextIds = currentIds.filter((id) => id !== stepId);
        setSelectedStepId(nextIds.at(-1) ?? '');
        return nextIds;
      }

      setSelectedStepId(stepId);
      return [...currentIds, stepId];
    });
  };
  const clearStepSelection = () => {
    setSelectedStepId('');
    setSelectedStepIds([]);
  };

  return {
    applyDraft,
    clearStepSelection,
    draft,
    parseError,
    focusStep,
    selectedStepId,
    selectedStepIds,
    selectStep,
    setStepElement,
    toggleStepSelection,
  };
}
