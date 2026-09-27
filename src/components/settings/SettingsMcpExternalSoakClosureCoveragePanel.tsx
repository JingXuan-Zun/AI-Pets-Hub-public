import { ShieldCheck } from 'lucide-react';
import type { SettingsMcpSoakReadinessSummaryResult } from './settingsMcpSoakReadiness';
import type { SettingsMcpSoakSummaryResult } from './settingsMcpSoakSummary';
import { SettingsMcpExternalSoakClosureCoverageEvidenceExchangePanel } from './SettingsMcpExternalSoakClosureCoverageEvidenceExchangePanel';
import { SettingsMcpExternalSoakClosureCoverageMissingCommandsPanel } from './SettingsMcpExternalSoakClosureCoverageMissingCommandsPanel';
import { SettingsMcpExternalSoakClosureCoverageRow } from './SettingsMcpExternalSoakClosureCoverageRow';
import { SettingsMcpExternalSoakClosureDriftPanel } from './SettingsMcpExternalSoakClosureDriftPanel';
import {
  createSettingsMcpExternalSoakClosureCoverage,
  type SettingsMcpExternalSoakClosureCoverageStatus,
} from './settingsMcpExternalSoakClosureCoverage';
import type { SettingsMcpExternalSoakClosureChecklist } from './settingsMcpExternalSoakClosureChecklist';

interface SettingsMcpExternalSoakClosureCoveragePanelProps {
  checklist: SettingsMcpExternalSoakClosureChecklist;
  readinessSummary: SettingsMcpSoakReadinessSummaryResult | null;
  soakSummary: SettingsMcpSoakSummaryResult | null;
}

function getStatusClassName(status: SettingsMcpExternalSoakClosureCoverageStatus) {
  if (status === 'covered') {
    return 'text-primary';
  }

  if (status === 'blocked' || status === 'missing') {
    return 'text-destructive';
  }

  return 'text-amber-600';
}

export function SettingsMcpExternalSoakClosureCoveragePanel({
  checklist,
  readinessSummary,
  soakSummary,
}: SettingsMcpExternalSoakClosureCoveragePanelProps) {
  const coverage = createSettingsMcpExternalSoakClosureCoverage({ readinessSummary, soakSummary });

  return (
    <div className="space-y-2 rounded-sm border border-dashed border-border bg-background/30 px-3 py-2">
      <div className="flex items-start gap-2">
        <ShieldCheck className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${getStatusClassName(coverage.status)}`} />
        <div className="min-w-0">
          <div className="font-mono text-2xs text-foreground">
            Ready-server soak coverage / {coverage.status} / {coverage.coveredCount} of {coverage.totalReadyServers}
          </div>
          <div className="text-3xs text-muted-foreground">{coverage.detail}</div>
        </div>
      </div>
      <SettingsMcpExternalSoakClosureCoverageMissingCommandsPanel coverage={coverage} />
      {coverage.rows.length ? (
        <div className="grid gap-1 sm:grid-cols-2">
          {coverage.rows.map((row) => (
            <SettingsMcpExternalSoakClosureCoverageRow key={row.serverId} row={row} />
          ))}
        </div>
      ) : null}
      <SettingsMcpExternalSoakClosureDriftPanel checklist={checklist} coverage={coverage} />
      <SettingsMcpExternalSoakClosureCoverageEvidenceExchangePanel coverage={coverage} />
    </div>
  );
}
