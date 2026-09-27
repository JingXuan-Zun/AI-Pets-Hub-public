import { type AnimationTriggerDriftQaSummary } from './animationTriggerDriftQaSummary';

interface SettingsAnimationDriftTokenChartProps {
  summary: AnimationTriggerDriftQaSummary;
}

function formatMs(value: number) {
  return `${Math.round(value)}ms`;
}

function resolveBarWidth(maxAbsoluteDriftMs: number, chartMaxDriftMs: number) {
  if (chartMaxDriftMs <= 0) {
    return '0%';
  }

  return `${Math.max(6, Math.min(100, Math.round((maxAbsoluteDriftMs / chartMaxDriftMs) * 100)))}%`;
}

function resolveBarClassName(warnCount: number) {
  return warnCount > 0
    ? 'bg-amber-500'
    : 'bg-primary';
}

export function SettingsAnimationDriftTokenChart({
  summary,
}: SettingsAnimationDriftTokenChartProps) {
  if (summary.tokenGroups.length === 0) {
    return null;
  }

  const chartMaxDriftMs = Math.max(...summary.tokenGroups.map((group) => group.maxAbsoluteDriftMs), 1);
  return (
    <div className="space-y-2">
      <div className="text-3xs font-bold uppercase tracking-widest text-muted-foreground">Token drift groups</div>
      <div className="space-y-2">
        {summary.tokenGroups.map((group) => (
          <div key={group.token} className="rounded-sm border border-border/80 bg-background/30 px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <span className="truncate font-mono text-2xs text-foreground">
                token {group.token} / {group.scheduler}
              </span>
              <span className="font-mono text-2xs text-muted-foreground">
                max {formatMs(group.maxAbsoluteDriftMs)}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-sm bg-secondary">
              <div
                className={`h-full rounded-sm ${resolveBarClassName(group.warnCount)}`}
                style={{ width: resolveBarWidth(group.maxAbsoluteDriftMs, chartMaxDriftMs) }}
              />
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-3xs text-muted-foreground">
              <span>avg {formatMs(group.averageAbsoluteDriftMs)}</span>
              <span>samples {group.sampleCount}</span>
              <span>warn {group.warnCount}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
