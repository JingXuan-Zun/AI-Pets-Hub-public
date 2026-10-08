import { Music2 } from 'lucide-react';
import { SettingsToggleSwitch } from './SettingsToggleSwitch';

interface SettingsSkillTimelineAudioLaneControlsProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
}

export function SettingsSkillTimelineAudioLaneControls({
  enabled,
  onEnabledChange,
}: SettingsSkillTimelineAudioLaneControlsProps) {
  return (
    <label className="flex items-center gap-2 rounded-sm border border-border/70 bg-background/20 p-2 text-2xs text-muted-foreground">
      <Music2 className="h-3.5 w-3.5 text-primary" />
      <span className="min-w-0 flex-1 truncate">Audio metadata lane</span>
      <SettingsToggleSwitch checked={enabled} hideLabel label="Show audio metadata lane" onChange={onEnabledChange} />
    </label>
  );
}
