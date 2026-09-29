import { Input } from '../../../components/ui/input';
import { type SkillTimelineEditorStepDraft } from './settingsSkillTimelineEditorModel';

interface SettingsSkillTimelineStepDurationFieldProps {
  onChangeStep: (step: SkillTimelineEditorStepDraft) => void;
  step: SkillTimelineEditorStepDraft;
}

export function SettingsSkillTimelineStepDurationField({
  onChangeStep,
  step,
}: SettingsSkillTimelineStepDurationFieldProps) {
  return (
    <div className="grid min-w-0 grid-cols-2 gap-1">
      <Input
        value={step.durationMs}
        type="number"
        min={0}
        placeholder="dur ms"
        onChange={(event) => onChangeStep({ ...step, durationMs: event.target.value })}
      />
      <Input
        value={step.holdBeats}
        type="number"
        min={0}
        placeholder="hold"
        onChange={(event) => onChangeStep({ ...step, holdBeats: event.target.value })}
      />
    </div>
  );
}
