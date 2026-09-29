import { AlertTriangle, CheckCircle2, CircleDot, Info, ListChecks } from 'lucide-react';
import {
  createSettingsMcpExternalSoakClosureChecklist,
  type SettingsMcpExternalSoakClosureStatus,
  type SettingsMcpExternalSoakClosureStep,
} from './settingsMcpExternalSoakClosureChecklist';
import { SettingsMcpExternalSoakClosureCoveragePanel } from './SettingsMcpExternalSoakClosureCoveragePanel';
import { SettingsMcpExternalSoakClosureEvidenceExchangePanel } from './SettingsMcpExternalSoakClosureEvidenceExchangePanel';
import { SettingsMcpExternalSoakClosureRunbookPanel } from './SettingsMcpExternalSoakClosureRunbookPanel';
import type { SettingsMcpConfigPreflightResult } from './settingsMcpConfigPreflight';
import type { SettingsMcpSoakReadinessSummaryResult } from './settingsMcpSoakReadiness';
import type { SettingsMcpSoakSummaryResult } from './settingsMcpSoakSummary';

interface SettingsMcpExternalSoakClosureChecklistPanelProps {
  preflight: SettingsMcpConfigPreflightResult;
  readinessSummary: SettingsMcpSoakReadinessSummaryResult | null;
  soakSummary: SettingsMcpSoakSummaryResult | null;
}

function getStatusClassName(status: SettingsMcpExternalSoakClosureStatus) {
  if (status === 'ready') {
    return 'text-primary';
  }

  if (status === 'blocked') {
    return 'text-destructive';
  }

  return 'text-amber-600';
}

function getStatusIcon(status: SettingsMcpExternalSoakClosureStatus) {
  if (status === 'ready') {
    return CheckCircle2;
  }

  if (status === 'blocked') {
    return AlertTriangle;
  }

  return status === 'warning' ? Info : CircleDot;
}

function ChecklistStepRow({ step }: { step: SettingsMcpExternalSoakClosureStep }) {
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

export function SettingsMcpExternalSoakClosureChecklistPanel({
  preflight,
  readinessSummary,
  soakSummary,
}: SettingsMcpExternalSoakClosureChecklistPanelProps) {
  const checklist = createSettingsMcpExternalSoakClosureChecklist({
    preflight,
    readinessSummary,
    soakSummary,
  });

  return (
    <div className="space-y-2 rounded-sm border border-dashed border-border bg-background/30 px-3 py-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <ListChecks className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${getStatusClassName(checklist.status)}`} />
          <div className="min-w-0">
            <div className="font-mono text-2xs text-foreground">
              External MCP soak closure / {checklist.status} / {checklist.readyCount} of {checklist.steps.length}
            </div>
            <div className="text-3xs text-muted-foreground">{checklist.nextAction}</div>
          </div>
        </div>
      </div>
      <div className="grid gap-1 sm:grid-cols-2">
        {checklist.steps.map((step) => (
          <ChecklistStepRow key={step.id} step={step} />
        ))}
      </div>
      <SettingsMcpExternalSoakClosureRunbookPanel readinessSummary={readinessSummary} />
      <SettingsMcpExternalSoakClosureCoveragePanel
        checklist={checklist}
        readinessSummary={readinessSummary}
        soakSummary={soakSummary}
      />
      <SettingsMcpExternalSoakClosureEvidenceExchangePanel checklist={checklist} />
    </div>
  );
}
