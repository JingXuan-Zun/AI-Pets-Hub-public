import { AlertTriangle, CheckCircle2, Info, TrendingUp } from 'lucide-react';
import {
  createSettingsMcpExternalSoakEvidenceGap,
  type SettingsMcpExternalSoakEvidenceGapStatus,
} from './settingsMcpExternalSoakEvidenceGap';
import type { SettingsMcpConfigPreflightResult } from './settingsMcpConfigPreflight';
import type { SettingsMcpSoakReadinessSummaryResult } from './settingsMcpSoakReadiness';
import type { SettingsMcpSoakSummaryResult } from './settingsMcpSoakSummary';

interface SettingsMcpExternalSoakEvidenceGapPanelProps {
  preflight: SettingsMcpConfigPreflightResult;
  readinessSummary: SettingsMcpSoakReadinessSummaryResult | null;
  soakSummary: SettingsMcpSoakSummaryResult | null;
}

function getStatusClassName(status: SettingsMcpExternalSoakEvidenceGapStatus) {
  if (status === 'ready') {
    return 'text-primary';
  }

  return status === 'blocked' ? 'text-destructive' : 'text-amber-600';
}

function getStatusIcon(status: SettingsMcpExternalSoakEvidenceGapStatus) {
  if (status === 'ready') {
    return CheckCircle2;
  }

  return status === 'blocked' ? AlertTriangle : Info;
}

export function SettingsMcpExternalSoakEvidenceGapPanel({
  preflight,
  readinessSummary,
  soakSummary,
}: SettingsMcpExternalSoakEvidenceGapPanelProps) {
  const gap = createSettingsMcpExternalSoakEvidenceGap({ preflight, readinessSummary, soakSummary });
  const Icon = getStatusIcon(gap.status);

  return (
    <div className="rounded-sm border border-dashed border-border bg-background/30 px-3 py-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${getStatusClassName(gap.status)}`} />
          <div className="min-w-0">
            <div className="flex items-center gap-1 font-mono text-2xs text-foreground">
              <TrendingUp className="h-3 w-3 shrink-0 text-muted-foreground" />
              External MCP soak evidence / {gap.status}
            </div>
            <div className="text-3xs text-muted-foreground">{gap.nextAction}</div>
          </div>
        </div>
        <div className="shrink-0 text-right font-mono text-3xs text-muted-foreground">
          <div>{gap.readyServerCount} ready server(s)</div>
          <div>{gap.soakRoundCount} soak round(s)</div>
          <div>{gap.eligibleForMcpFoundationIncrease ? 'estimate review ready' : 'estimate held'}</div>
        </div>
      </div>
      {gap.blockers.length || gap.warnings.length ? (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-3xs text-muted-foreground">
          {[...gap.blockers, ...gap.warnings].map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
