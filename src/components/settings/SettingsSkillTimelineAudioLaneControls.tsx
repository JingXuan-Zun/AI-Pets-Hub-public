import { Music2 } from 'lucide-react';

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
      <input
        type="checkbox"
        className="h-4 w-4 accent-primary"
        checked={enabled}
        aria-label="Show audio metadata lane"
        onChange={(event) => onEnabledChange(event.target.checked)}
      />
      <Music2 className="h-3.5 w-3.5 text-primary" />
      <span className="truncate">Audio metadata lane</span>
    </label>
  );
}
