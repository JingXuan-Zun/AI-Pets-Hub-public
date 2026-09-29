import { Input } from '../../../components/ui/input';
import {
  normalizeSkillTimelineSnapPolicy,
  type SkillTimelineSnapPolicy,
} from './settingsSkillTimelineSnapPolicy';

interface SettingsSkillTimelineSnapControlsProps {
  policy: SkillTimelineSnapPolicy;
  onPolicyChange: (policy: SkillTimelineSnapPolicy) => void;
}

function updateSnapPolicy(
  policy: SkillTimelineSnapPolicy,
  updates: Partial<SkillTimelineSnapPolicy>,
) {
  return normalizeSkillTimelineSnapPolicy({ ...policy, ...updates });
}

export function SettingsSkillTimelineSnapControls({
  policy,
  onPolicyChange,
}: SettingsSkillTimelineSnapControlsProps) {
  return (
    <div className="grid grid-cols-3 gap-2 rounded-sm border border-border/70 bg-background/20 p-2">
      <Input
        aria-label="Timeline ms snap"
        min={25}
        step={25}
        type="number"
        value={policy.msStep}
        onChange={(event) => onPolicyChange(updateSnapPolicy(policy, { msStep: Number(event.target.value) }))}
      />
      <Input
        aria-label="Timeline beat snap"
        min={0.25}
        step={0.25}
        type="number"
        value={policy.beatStep}
        onChange={(event) => onPolicyChange(updateSnapPolicy(policy, { beatStep: Number(event.target.value) }))}
      />
      <Input
        aria-label="Timeline hold beat snap"
        min={0.25}
        step={0.25}
        type="number"
        value={policy.holdBeatStep}
        onChange={(event) => onPolicyChange(updateSnapPolicy(policy, { holdBeatStep: Number(event.target.value) }))}
      />
    </div>
  );
}
