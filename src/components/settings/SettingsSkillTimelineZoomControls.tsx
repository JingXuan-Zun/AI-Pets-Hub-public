import { ZoomIn } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import {
  labelSkillTimelineZoom,
  normalizeSkillTimelineZoomPolicy,
  SKILL_TIMELINE_ZOOM_OPTIONS,
  type SkillTimelineZoomPolicy,
} from './settingsSkillTimelineZoomPolicy';

interface SettingsSkillTimelineZoomControlsProps {
  policy: SkillTimelineZoomPolicy;
  onPolicyChange: (policy: SkillTimelineZoomPolicy) => void;
}

export function SettingsSkillTimelineZoomControls({
  policy,
  onPolicyChange,
}: SettingsSkillTimelineZoomControlsProps) {
  const activeLabel = labelSkillTimelineZoom(policy);
  return (
    <div className="flex items-center gap-2 rounded-sm border border-border/70 bg-background/20 p-2">
      <ZoomIn className="h-3.5 w-3.5 text-primary" />
      <div className="flex min-w-0 flex-1 items-center gap-1">
        {SKILL_TIMELINE_ZOOM_OPTIONS.map((option) => (
          <Button
            key={option.scale}
            type="button"
            variant={activeLabel === option.label ? 'secondary' : 'outline'}
            size="xs"
            title={`Timeline zoom ${option.label}`}
            onClick={() => onPolicyChange(normalizeSkillTimelineZoomPolicy({ scale: option.scale }))}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
