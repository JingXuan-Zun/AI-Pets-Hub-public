import { SkipBack, SkipForward } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import {
  nudgeSkillTimelineStepTiming,
  SKILL_TIMELINE_AT_MS_NUDGE_STEP,
  SKILL_TIMELINE_BEAT_NUDGE_STEP,
} from './settingsSkillTimelineStepTimingNudge';
import { type SkillTimelineEditorStepDraft } from './settingsSkillTimelineEditorModel';

interface SettingsSkillTimelineStepTimingFieldProps {
  onChangeStep: (step: SkillTimelineEditorStepDraft) => void;
  step: SkillTimelineEditorStepDraft;
}

function toNumberInput(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function createNudgeTitle(step: SkillTimelineEditorStepDraft, direction: -1 | 1) {
  const unit = step.timingMode === 'atMs'
    ? `${SKILL_TIMELINE_AT_MS_NUDGE_STEP}ms`
    : `${SKILL_TIMELINE_BEAT_NUDGE_STEP} beat`;
  return direction < 0 ? `Move earlier by ${unit}` : `Move later by ${unit}`;
}

export function SettingsSkillTimelineStepTimingField({
  onChangeStep,
  step,
}: SettingsSkillTimelineStepTimingFieldProps) {
  const value = step.timingMode === 'atMs' ? step.atMs : step.beat;
  const min = step.timingMode === 'atMs' ? 0 : 1;
  const updateValue = (nextValue: string) => {
    const parsedValue = toNumberInput(nextValue, value);
    onChangeStep(step.timingMode === 'atMs'
      ? { ...step, atMs: parsedValue }
      : { ...step, beat: parsedValue });
  };

  return (
    <div className="flex min-w-0 items-center gap-1">
      <Button type="button" variant="ghost" size="icon-xs" title={createNudgeTitle(step, -1)} onClick={() => onChangeStep(nudgeSkillTimelineStepTiming(step, -1))}>
        <SkipBack />
      </Button>
      <Input value={value} type="number" min={min} onChange={(event) => updateValue(event.target.value)} />
      <Button type="button" variant="ghost" size="icon-xs" title={createNudgeTitle(step, 1)} onClick={() => onChangeStep(nudgeSkillTimelineStepTiming(step, 1))}>
        <SkipForward />
      </Button>
    </div>
  );
}
