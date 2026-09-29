import { Music2 } from 'lucide-react';
import { type SkillTimelineAudioMetadataLane } from './settingsSkillTimelineAudioMetadataLane';

interface SettingsSkillTimelineAudioMetadataLaneViewProps {
  lane: SkillTimelineAudioMetadataLane | null;
  peaks?: number[];
}

function clampPeak(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

function SettingsSkillTimelineWaveformBars({ peaks }: { peaks: number[] }) {
  if (peaks.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-x-1 inset-y-1 flex items-center gap-px overflow-hidden">
      {peaks.map((peak, index) => {
        const heightPercent = Math.max(8, Math.round(clampPeak(peak) * 100));
        return (
          <span
            key={`${index}-${heightPercent}`}
            className="min-w-[2px] flex-1 rounded-[1px] bg-primary/55"
            style={{ height: `${heightPercent}%` }}
          />
        );
      })}
    </div>
  );
}

export function SettingsSkillTimelineAudioMetadataLaneView({
  lane,
  peaks = [],
}: SettingsSkillTimelineAudioMetadataLaneViewProps) {
  if (!lane) {
    return null;
  }

  const widthPercent = Math.max(0, lane.endPercent - lane.startPercent);
  return (
    <div className="grid grid-cols-[72px_1fr] items-center gap-2">
      <div className="flex min-w-0 items-center gap-1 text-2xs text-muted-foreground">
        <Music2 className="h-3 w-3 text-primary" />
        <span className="truncate">audio</span>
      </div>
      <div className="relative h-8 rounded-sm border border-border/70 bg-background/40">
        <div
          className="absolute inset-y-1 rounded-sm border border-primary/40 bg-primary/15"
          style={{ left: `${lane.startPercent}%`, width: `${widthPercent}%` }}
          title={lane.label}
        >
          <SettingsSkillTimelineWaveformBars peaks={peaks} />
        </div>
        <div className="absolute inset-y-0 border-l border-primary/40" style={{ left: `${lane.offsetPercent}%` }} />
        {lane.beatMarkers.map((marker) => (
          <div
            key={`${marker.label}-${marker.timeMs}`}
            className="absolute inset-y-2 border-l border-primary/35"
            style={{ left: `${marker.leftPercent}%` }}
            title={`${marker.label} @ ${marker.timeMs}ms`}
          />
        ))}
        <div className="absolute inset-x-2 top-1 truncate text-3xs text-primary">
          {lane.label}
        </div>
      </div>
    </div>
  );
}
