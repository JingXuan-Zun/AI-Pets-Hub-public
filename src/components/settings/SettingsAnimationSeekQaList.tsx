import { createAnimationTriggerSeekDriftSummary } from './animationTriggerSeekDriftCorrelation';

interface SettingsAnimationSeekQaListProps {
  logs: string[];
}

function formatMs(value: number) {
  return `${Math.round(value)}ms`;
}

function resolveOutcomeClassName(outcome: string) {
  if (outcome === 'applied') {
    return 'text-primary';
  }

  return outcome === 'unavailable' ? 'text-amber-500' : 'text-muted-foreground';
}

function resolveDriftStatusClassName(status: string) {
  if (status === 'warn') {
    return 'text-amber-500';
  }

  return status === 'ok' ? 'text-primary' : 'text-muted-foreground';
}

export function SettingsAnimationSeekQaList({
  logs,
}: SettingsAnimationSeekQaListProps) {
  const summary = createAnimationTriggerSeekDriftSummary(logs);

  return (
    <div className="mt-3 border-t border-border/70 pt-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-3xs font-bold uppercase tracking-widest text-muted-foreground">Seek evidence</div>
        <span className="font-mono text-2xs text-muted-foreground">
          {summary.appliedCount}/{summary.sampleCount}
        </span>
      </div>

      {summary.recentCorrelations.length > 0 ? (
        <div className="space-y-2">
          {summary.recentCorrelations.map((correlation, index) => (
            <div
              key={`${correlation.seek.controlToken}-${correlation.seek.seekPositionMs}-${index}`}
              className="rounded-sm border border-dashed border-border bg-background/30 px-3 py-2"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-2xs text-foreground">
                  seek {formatMs(correlation.seek.seekPositionMs)}
                </span>
                <span className={`font-mono text-2xs ${resolveOutcomeClassName(correlation.seek.outcome)}`}>
                  {correlation.seek.outcome}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-3xs text-muted-foreground">
                <span>token {correlation.seek.replayToken || '-'}</span>
                <span>left {correlation.seek.remainingItemCount}/{correlation.seek.originalItemCount}</span>
                <span>next {formatMs(correlation.seek.firstDelayMs)}</span>
                <span>last {formatMs(correlation.seek.lastDelayMs)}</span>
                <span>{correlation.seek.reason}</span>
              </div>
              <div className={`mt-1 flex flex-wrap gap-x-3 gap-y-1 text-3xs ${resolveDriftStatusClassName(correlation.status)}`}>
                <span>post drift {correlation.status}</span>
                <span>samples {correlation.driftSampleCount}</span>
                <span>avg {formatMs(correlation.averageAbsoluteDriftMs)}</span>
                <span>max {formatMs(correlation.maxAbsoluteDriftMs)}</span>
                <span>warn {correlation.warnCount}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-sm border border-dashed border-border/80 bg-background/20 px-3 py-3 text-center text-2xs text-muted-foreground">
          No seek samples yet.
        </div>
      )}
    </div>
  );
}
