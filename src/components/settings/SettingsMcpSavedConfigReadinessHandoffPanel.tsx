import { AlertTriangle, CheckCircle2, CircleDot, Info, Route } from 'lucide-react';
import {
  createSettingsMcpSavedConfigReadinessHandoff,
  type SettingsMcpSavedConfigReadinessHandoffStatus,
  type SettingsMcpSavedConfigReadinessHandoffStep,
} from './settingsMcpSavedConfigReadinessHandoff';
import type { SettingsMcpSoakReadinessSummaryResult } from './settingsMcpSoakReadiness';

interface SettingsMcpSavedConfigReadinessHandoffPanelProps {
  configText: string;
  readinessSummary: SettingsMcpSoakReadinessSummaryResult | null;
  savedAt: number | null;
}

function getStatusClassName(status: SettingsMcpSavedConfigReadinessHandoffStatus) {
  if (status === 'ready') {
    return 'text-primary';
  }

  if (status === 'blocked') {
    return 'text-destructive';
  }

  return 'text-amber-600';
}

function getStatusIcon(status: SettingsMcpSavedConfigReadinessHandoffStatus) {
  if (status === 'ready') {
    return CheckCircle2;
  }

  if (status === 'blocked') {
    return AlertTriangle;
  }

  return status === 'warning' ? Info : CircleDot;
}

function HandoffStepRow({ step }: { step: SettingsMcpSavedConfigReadinessHandoffStep }) {
  const Icon = getStatusIcon(step.status);
  return (
    <div className="flex items-start gap-2 text-3xs">
      <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${getStatusClassName(step.status)}`} />
      <div className="min-w-0">
        <div className="font-mono text-foreground">{step.status} / {step.label}</div>
        <div className="text-muted-foreground">{step.detail}</div>
      </div>
    </div>
  );
}

export function SettingsMcpSavedConfigReadinessHandoffPanel({
  configText,
  readinessSummary,
  savedAt,
}: SettingsMcpSavedConfigReadinessHandoffPanelProps) {
  const handoff = createSettingsMcpSavedConfigReadinessHandoff({
    configText,
    readinessSummary,
    savedAt,
  });

  return (
    <div className="space-y-2 rounded-sm border border-dashed border-border bg-background/30 px-3 py-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <Route className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${getStatusClassName(handoff.status)}`} />
          <div className="min-w-0">
            <div className="font-mono text-2xs text-foreground">
              Saved-config readiness handoff / {handoff.status}
            </div>
            <div className="text-3xs text-muted-foreground">{handoff.nextAction}</div>
          </div>
        </div>
        <div className="shrink-0 text-right font-mono text-3xs text-muted-foreground">
          <div>{handoff.candidateCount} candidate(s)</div>
          <div>{handoff.savedAt ? 'saved this session' : 'not saved this session'}</div>
          <div>{handoff.readyForCommandReview ? 'command review ready' : 'handoff held'}</div>
        </div>
      </div>
      <div className="grid gap-1 sm:grid-cols-2">
        {handoff.steps.map((step) => (
          <HandoffStepRow key={step.id} step={step} />
        ))}
      </div>
    </div>
  );
}
