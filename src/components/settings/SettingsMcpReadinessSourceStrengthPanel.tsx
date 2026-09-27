import { AlertTriangle, CheckCircle2, FileSearch, Info } from 'lucide-react';
import { SettingsMcpReadinessSourceStrengthEvidenceExchangePanel } from './SettingsMcpReadinessSourceStrengthEvidenceExchangePanel';
import {
  createSettingsMcpReadinessSourceStrength,
  type SettingsMcpReadinessSourceStrengthStatus,
} from './settingsMcpReadinessSourceStrength';
import type { SettingsMcpSoakReadinessSummaryResult } from './settingsMcpSoakReadiness';

interface SettingsMcpReadinessSourceStrengthPanelProps {
  readinessSummary: SettingsMcpSoakReadinessSummaryResult | null;
}

function getStatusClassName(status: SettingsMcpReadinessSourceStrengthStatus) {
  if (status === 'ready') {
    return 'text-primary';
  }

  return status === 'blocked' ? 'text-destructive' : 'text-amber-600';
}

function getStatusIcon(status: SettingsMcpReadinessSourceStrengthStatus) {
  if (status === 'ready') {
    return CheckCircle2;
  }

  return status === 'blocked' ? AlertTriangle : Info;
}

export function SettingsMcpReadinessSourceStrengthPanel({
  readinessSummary,
}: SettingsMcpReadinessSourceStrengthPanelProps) {
  const strength = createSettingsMcpReadinessSourceStrength(readinessSummary);
  const Icon = getStatusIcon(strength.status);

  return (
    <div className="rounded-sm border border-dashed border-border bg-background/30 px-3 py-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${getStatusClassName(strength.status)}`} />
          <div className="min-w-0">
            <div className="flex items-center gap-1 font-mono text-2xs text-foreground">
              <FileSearch className="h-3 w-3 shrink-0 text-muted-foreground" />
              Readiness source / {strength.status} / {strength.tier}
            </div>
            <div className="text-3xs text-muted-foreground">{strength.detail}</div>
          </div>
        </div>
        <div className="shrink-0 text-right font-mono text-3xs text-muted-foreground">
          <div>{strength.source}</div>
          <div>{strength.configPresent ? 'config present' : 'no saved config'}</div>
          <div>{strength.supportsExternalSoakClosure ? 'closure source ready' : 'preview/held'}</div>
        </div>
      </div>
      <SettingsMcpReadinessSourceStrengthEvidenceExchangePanel strength={strength} />
    </div>
  );
}
