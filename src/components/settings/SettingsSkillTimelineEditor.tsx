import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { type PetConfig } from '../../types';
import { SettingsSkillTimelineAudioFields } from './SettingsSkillTimelineAudioFields';
import { SettingsSkillTimelineAudioLaneControls } from './SettingsSkillTimelineAudioLaneControls';
import { SettingsSkillTimelineSnapControls } from './SettingsSkillTimelineSnapControls';
import { SettingsSkillTimelineStepDurationField } from './SettingsSkillTimelineStepDurationField';
import { SettingsSkillTimelineStepTimingField } from './SettingsSkillTimelineStepTimingField';
import { SettingsSkillTimelineTrackControls } from './SettingsSkillTimelineTrackControls';
import { SettingsSkillTimelineTrackManager } from './SettingsSkillTimelineTrackManager';
import { SettingsSkillTimelineTrackOverview } from './SettingsSkillTimelineTrackOverview';
import { SettingsSkillTimelineTrackStrip } from './SettingsSkillTimelineTrackStrip';
import { SettingsSkillTimelineZoomControls } from './SettingsSkillTimelineZoomControls';
import { createSettingsSkillTimelineAudioAssetOptions } from './settingsSkillTimelineAudioAssetOptions';
import { resolveSettingsSkillTimelineAudioPreviewSource } from './settingsSkillTimelineAudioPreview';
import { createSettingsSkillTimelineBindingOptions } from './settingsSkillTimelineBindingOptions';
import {
  appendSkillTimelineEditorStep,
  deleteSkillTimelineEditorStep,
  duplicateSkillTimelineEditorStep,
  moveSkillTimelineEditorStep,
  replaceSkillTimelineEditorStep,
} from './settingsSkillTimelineEditorStepOperations';
import {
  type SkillTimelineEditorDraft,
  type SkillTimelineEditorStepDraft,
} from './settingsSkillTimelineEditorModel';
import { DEFAULT_SKILL_TIMELINE_SNAP_POLICY } from './settingsSkillTimelineSnapPolicy';
import { appendSkillTimelineEditorStepOnTrack } from './settingsSkillTimelineTrackOperations';
import {
  createDefaultSkillTimelineTrackVisibility,
} from './settingsSkillTimelineTrackVisibility';
import { DEFAULT_SKILL_TIMELINE_ZOOM_POLICY } from './settingsSkillTimelineZoomPolicy';
import { useSettingsSkillTimelineEditorActions } from './useSettingsSkillTimelineEditorActions';
import { useSettingsSkillTimelineEditorState } from './useSettingsSkillTimelineEditorState';

interface SettingsSkillTimelineEditorProps {
  inputJson: string;
  localConfig: PetConfig;
  selectedPetSlotId: string;
  onChangeInputJson: (inputJson: string) => void;
}

function toNumberInput(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function TimelineEditorMetaFields({ draft, onApplyDraft }: {
  draft: SkillTimelineEditorDraft;
  onApplyDraft: (draft: SkillTimelineEditorDraft) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <Input value={draft.bpm} type="number" min={1} onChange={(event) => onApplyDraft({ ...draft, bpm: toNumberInput(event.target.value, draft.bpm) })} />
      <Input value={draft.beatCount} type="number" min={1} onChange={(event) => onApplyDraft({ ...draft, beatCount: toNumberInput(event.target.value, draft.beatCount) })} />
      <Input value={draft.offsetMs} type="number" min={0} onChange={(event) => onApplyDraft({ ...draft, offsetMs: toNumberInput(event.target.value, draft.offsetMs) })} />
    </div>
  );
}

function TimelineEditorStepRow({ draft, index, isSelected, step, stepRef, onApplyDraft, onToggleSelected }: {
  draft: SkillTimelineEditorDraft;
  index: number;
  isSelected: boolean;
  step: SkillTimelineEditorStepDraft;
  stepRef: (element: HTMLDivElement | null) => void;
  onApplyDraft: (draft: SkillTimelineEditorDraft) => void;
  onToggleSelected: () => void;
}) {
  const changeStep = (nextStep: SkillTimelineEditorStepDraft) => {
    onApplyDraft(replaceSkillTimelineEditorStep(draft, step.id, () => nextStep));
  };

  return (
    <div
      ref={stepRef}
      className={[
        'grid grid-cols-[24px_1fr_1fr_126px_78px_90px_118px] gap-2 rounded-sm border p-2 transition-colors',
        isSelected
          ? 'border-primary/60 bg-primary/10'
          : 'border-border/70 bg-background/25',
      ].join(' ')}
    >
      <input
        type="checkbox"
        className="mt-2 h-4 w-4 accent-primary"
        checked={isSelected}
        aria-label={`Select ${step.label || `step ${index + 1}`}`}
        onChange={onToggleSelected}
      />
      <Input value={step.animationId} list="skill-timeline-motion-options" placeholder="motion" onChange={(event) => onApplyDraft(replaceSkillTimelineEditorStep(draft, step.id, (item) => ({ ...item, animationId: event.target.value })))} />
      <Input value={step.expressionId} list="skill-timeline-expression-options" placeholder="expression" onChange={(event) => onApplyDraft(replaceSkillTimelineEditorStep(draft, step.id, (item) => ({ ...item, expressionId: event.target.value })))} />
      <SettingsSkillTimelineStepTimingField step={step} onChangeStep={changeStep} />
      <SettingsSkillTimelineStepDurationField step={step} onChangeStep={changeStep} />
      <select className="h-8 min-w-0 rounded-sm border border-input bg-background px-1 text-2xs" value={step.track} onChange={(event) => onApplyDraft(replaceSkillTimelineEditorStep(draft, step.id, (item) => ({ ...item, track: event.target.value })))}>
        <option value="motion">motion</option>
        <option value="expression">face</option>
        <option value="audio">audio</option>
        <option value="custom">custom</option>
      </select>
      <div className="flex items-center gap-1">
        <select className="h-8 min-w-0 flex-1 rounded-sm border border-input bg-background px-1 text-2xs" value={step.timingMode} onChange={(event) => onApplyDraft(replaceSkillTimelineEditorStep(draft, step.id, (item) => ({ ...item, timingMode: event.target.value === 'atMs' ? 'atMs' : 'beat' })))}>
          <option value="beat">beat</option>
          <option value="atMs">ms</option>
        </select>
        <Button type="button" variant="ghost" size="icon-xs" title="Duplicate step" onClick={() => onApplyDraft(duplicateSkillTimelineEditorStep(draft, step.id))}><Copy /></Button>
        <Button type="button" variant="ghost" size="icon-xs" onClick={() => onApplyDraft(moveSkillTimelineEditorStep(draft, step.id, -1))} disabled={index === 0}><ArrowUp /></Button>
        <Button type="button" variant="ghost" size="icon-xs" onClick={() => onApplyDraft(moveSkillTimelineEditorStep(draft, step.id, 1))} disabled={index === draft.steps.length - 1}><ArrowDown /></Button>
        <Button type="button" variant="ghost" size="icon-xs" onClick={() => onApplyDraft(deleteSkillTimelineEditorStep(draft, step.id))}><Trash2 /></Button>
      </div>
    </div>
  );
}

export function SettingsSkillTimelineEditor({
  inputJson,
  localConfig,
  selectedPetSlotId,
  onChangeInputJson,
}: SettingsSkillTimelineEditorProps) {
  const editorState = useSettingsSkillTimelineEditorState({ inputJson, onChangeInputJson });
  const [snapPolicy, setSnapPolicy] = useState(DEFAULT_SKILL_TIMELINE_SNAP_POLICY);
  const [trackVisibility, setTrackVisibility] = useState(createDefaultSkillTimelineTrackVisibility);
  const [zoomPolicy, setZoomPolicy] = useState(DEFAULT_SKILL_TIMELINE_ZOOM_POLICY);
  const [showAudioMetadataLane, setShowAudioMetadataLane] = useState(true);
  const {
    applyDraft,
    clearStepSelection,
    draft,
    focusStep,
    parseError,
    selectedStepId,
    selectedStepIds,
    selectStep,
    setStepElement,
    toggleStepSelection,
  } = editorState;
  const editorActions = useSettingsSkillTimelineEditorActions({
    applyDraft,
    draft,
    selectedStepIds,
    snapPolicy,
  });
  const motionOptions = useMemo(() => createSettingsSkillTimelineBindingOptions({ config: localConfig, kind: 'motion', targetPetId: selectedPetSlotId }), [localConfig, selectedPetSlotId]);
  const expressionOptions = useMemo(() => createSettingsSkillTimelineBindingOptions({ config: localConfig, kind: 'expression', targetPetId: selectedPetSlotId }), [localConfig, selectedPetSlotId]);
  const audioAssetOptions = useMemo(() => (
    createSettingsSkillTimelineAudioAssetOptions(localConfig)
  ), [localConfig]);
  const audioPreviewSource = useMemo(() => (
    resolveSettingsSkillTimelineAudioPreviewSource(draft, audioAssetOptions)
  ), [audioAssetOptions, draft]);

  return (
    <div className="space-y-3 rounded-sm border border-border/80 bg-background/25 p-3">
      <TimelineEditorMetaFields draft={draft} onApplyDraft={applyDraft} />
      <SettingsSkillTimelineAudioFields
        audioAssetOptions={audioAssetOptions}
        draft={draft}
        previewSource={audioPreviewSource}
        onApplyDraft={applyDraft}
      />
      <SettingsSkillTimelineAudioLaneControls
        enabled={showAudioMetadataLane}
        onEnabledChange={setShowAudioMetadataLane}
      />
      <SettingsSkillTimelineSnapControls policy={snapPolicy} onPolicyChange={setSnapPolicy} />
      <SettingsSkillTimelineZoomControls policy={zoomPolicy} onPolicyChange={setZoomPolicy} />
      <SettingsSkillTimelineTrackOverview draft={draft} visibility={trackVisibility} />
      <SettingsSkillTimelineTrackManager
        draft={draft}
        visibility={trackVisibility}
        onApplyDraft={applyDraft}
        onVisibilityChange={setTrackVisibility}
      />
      <SettingsSkillTimelineTrackControls
        draft={draft}
        selectedStepIds={selectedStepIds}
        selectedStepId={selectedStepId}
        onClearSelection={clearStepSelection}
        onApplyDraft={applyDraft}
      />
      <SettingsSkillTimelineTrackStrip
        audioPreviewSource={audioPreviewSource}
        draft={draft}
        selectedStepId={selectedStepId}
        selectedStepIds={selectedStepIds}
        onDragStepTiming={editorActions.dragStepTiming}
        onDropStepTrack={editorActions.dropStepTrack}
        onFocusStep={focusStep}
        onAddStepOnTrack={(trackId) => applyDraft(appendSkillTimelineEditorStepOnTrack(draft, trackId))}
        onNudgeStepTiming={editorActions.nudgeStepTiming}
        onResizeStepDuration={editorActions.resizeStepDuration}
        onSelectStep={selectStep}
        snapPolicy={snapPolicy}
        showAudioMetadataLane={showAudioMetadataLane}
        visibility={trackVisibility}
        zoomPolicy={zoomPolicy}
      />
      {parseError ? <div className="text-2xs text-amber-500">{parseError}</div> : null}
      <datalist id="skill-timeline-motion-options">{motionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</datalist>
      <datalist id="skill-timeline-expression-options">{expressionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</datalist>
      <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
        {draft.steps.map((step, index) => (
          <TimelineEditorStepRow
            key={step.id}
            draft={draft}
            index={index}
            isSelected={selectedStepIds.includes(step.id)}
            step={step}
            stepRef={(element) => setStepElement(step.id, element)}
            onApplyDraft={applyDraft}
            onToggleSelected={() => toggleStepSelection(step.id)}
          />
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => applyDraft(appendSkillTimelineEditorStep(draft))}>
        <Plus className="h-3.5 w-3.5" />
        Add step
      </Button>
    </div>
  );
}
