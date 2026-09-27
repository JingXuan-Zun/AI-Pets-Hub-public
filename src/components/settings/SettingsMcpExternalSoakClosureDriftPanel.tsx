import { AlertTriangle, CheckCircle2, GitCompareArrows, Info } from 'lucide-react';
import {
  createSettingsMcpExternalSoakClosureDrift,
  type SettingsMcpExternalSoakClosureDriftStatus,
} from './settingsMcpExternalSoakClosureDrift';
import { SettingsMcpExternalSoakClosureReviewEvidenceExchangePanel } from './SettingsMcpExternalSoakClosureReviewEvidenceExchangePanel';
import type { SettingsMcpExternalSoakClosureChecklist } from './settingsMcpExternalSoakClosureChecklist';
import type { SettingsMcpExternalSoakClosureCoverage } from './settingsMcpExternalSoakClosureCoverage';

interface SettingsMcpExternalSoakClosureDriftPanelProps {
  checklist: SettingsMcpExternalSoakClosureChecklist;
  coverage: SettingsMcpExternalSoakClosureCoverage;
}

function getStatusClassName(status: SettingsMcpExternalSoakClosureDriftStatus) {
  if (status === 'aligned') {
    return 'text-primary';
  }

  if (status === 'drift') {
    return 'text-destructive';
  }

  return 'text-amber-600';
}

function getComparisonIcon(aligned: boolean) {
  return aligned ? CheckCircle2 : AlertTriangle;
}

export function SettingsMcpExternalSoakClosureDriftPanel({
  checklist,
  coverage,
}: SettingsMcpExternalSoakClosureDriftPanelProps) {
  const drift = createSettingsMcpExternalSoakClosureDrift({ checklist, coverage });
  const HeaderIcon = drift.status === 'drift' ? AlertTriangle : drift.status === 'aligned' ? GitCompareArrows : Info;
  const snapshot = { checklist, coverage, drift };

  return (
    <div className="space-y-2 rounded-sm border border-dashed border-border bg-background/30 px-3 py-2">
      <div className="flex items-start gap-2">
        <HeaderIcon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${getStatusClassName(drift.status)}`} />
        <div className="min-w-0">
          <div className="font-mono text-2xs text-foreground">
            Closure evidence drift / {drift.status} / {drift.alignedCount} of {drift.totalCount}
          </div>
          <div className="text-3xs text-muted-foreground">{drift.detail}</div>
        </div>
      </div>
      <div className="grid gap-1 sm:grid-cols-3">
        {drift.comparisons.map((comparison) => {
          const Icon = getComparisonIcon(comparison.aligned);
          return (
            <div key={comparison.id} className="flex items-start gap-2 text-3xs">
              <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${comparison.aligned ? 'text-primary' : 'text-destructive'}`} />
              <div className="min-w-0">
                <div className="font-mono text-foreground">{comparison.label}</div>
                <div className="text-muted-foreground">
                  checklist={comparison.checklistStatus} / coverage={comparison.coverageStatus}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <SettingsMcpExternalSoakClosureReviewEvidenceExchangePanel snapshot={snapshot} />
    </div>
  );
}
