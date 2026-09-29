import { Activity, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { createAnimationTriggerDriftQaSummary } from './animationTriggerDriftQaSummary';
import { SettingsAnimationSeekQaList } from './SettingsAnimationSeekQaList';
import { SettingsAnimationDriftTokenChart } from './SettingsAnimationDriftTokenChart';

interface SettingsAnimationDriftQaPanelProps {
  logs: string[];
}

function formatMs(value: number) {
  return `${Math.round(value)}ms`;
}

function resolveStatus(summary: ReturnType<typeof createAnimationTriggerDriftQaSummary>) {
  if (summary.sampleCount === 0) {
    return {
      Icon: Activity,
      className: 'text-muted-foreground',
      label: 'No samples',
    };
  }

  if (summary.warnCount > 0) {
    return {
      Icon: AlertTriangle,
      className: 'text-amber-500',
      label: 'Needs review',
    };
  }

  return {
    Icon: CheckCircle2,
    className: 'text-primary',
    label: summary.noticeCount > 0 ? 'Minor drift' : 'On time',
  };
}

export function SettingsAnimationDriftQaPanel({
  logs,
}: SettingsAnimationDriftQaPanelProps) {
  const summary = createAnimationTriggerDriftQaSummary(logs);
  const status = resolveStatus(summary);
  const StatusIcon = status.Icon;

  return (
    <div className="rounded-sm border border-border bg-secondary/15 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-2xs font-bold uppercase tracking-widest text-muted-foreground">
          <StatusIcon className={`h-3.5 w-3.5 ${status.className}`} />
          Skill timing QA
        </div>
        <span className={`font-mono text-2xs ${status.className}`}>{status.label}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-sm border border-border/80 bg-background/35 px-2 py-2">
          <div className="text-3xs uppercase tracking-widest text-muted-foreground">Samples</div>
          <div className="mt-1 font-mono text-[12px] text-foreground">{summary.sampleCount}</div>
        </div>
        <div className="rounded-sm border border-border/80 bg-background/35 px-2 py-2">
          <div className="text-3xs uppercase tracking-widest text-muted-foreground">Avg drift</div>
          <div className="mt-1 font-mono text-[12px] text-foreground">{formatMs(summary.averageAbsoluteDriftMs)}</div>
        </div>
        <div className="rounded-sm border border-border/80 bg-background/35 px-2 py-2">
          <div className="text-3xs uppercase tracking-widest text-muted-foreground">Max drift</div>
          <div className="mt-1 font-mono text-[12px] text-foreground">{formatMs(summary.maxAbsoluteDriftMs)}</div>
        </div>
        <div className="rounded-sm border border-border/80 bg-background/35 px-2 py-2">
          <div className="text-3xs uppercase tracking-widest text-muted-foreground">Warn</div>
          <div className="mt-1 font-mono text-[12px] text-foreground">{summary.warnCount}</div>
        </div>
      </div>

      <div className="mt-3">
        <SettingsAnimationDriftTokenChart summary={summary} />
      </div>

      <div className="mt-3 max-h-40 space-y-2 overflow-y-auto pr-1">
        {summary.recentSamples.length > 0 ? summary.recentSamples.map((sample, index) => (
          <div
            key={`${sample.token}-${sample.plannedDelayMs}-${index}`}
            className="rounded-sm border border-dashed border-border bg-background/30 px-3 py-2"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-2xs text-foreground">
                token {sample.token || '-'} / {sample.scheduler}
              </span>
              <span className="font-mono text-2xs text-muted-foreground">{sample.severity}</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-3xs text-muted-foreground">
              <span>drift {formatMs(sample.driftMs)}</span>
              <span>abs {formatMs(sample.absoluteDriftMs)}</span>
              <span>plan {formatMs(sample.plannedDelayMs)}</span>
              <span>batch {sample.batchSize}</span>
            </div>
          </div>
        )) : (
          <div className="rounded-sm border border-dashed border-border/80 bg-background/20 px-3 py-5 text-center text-2xs text-muted-foreground">
            No drift samples yet.
          </div>
        )}
      </div>

      <SettingsAnimationSeekQaList logs={logs} />
    </div>
  );
}
