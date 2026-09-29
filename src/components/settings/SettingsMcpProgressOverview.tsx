import { Activity, CheckCircle2, CircleAlert, Layers3, Route, ServerCog } from 'lucide-react';
import {
  createSettingsMcpConfigPreflight,
  type SettingsMcpConfigPreflightResult,
} from './settingsMcpConfigPreflight';
import {
  createSettingsMcpEvidenceStageSummary,
  type SettingsMcpEvidenceStageSummary,
} from './settingsMcpEvidenceStages';
import { SettingsMcpExternalSoakClosureChecklistPanel } from './SettingsMcpExternalSoakClosureChecklistPanel';
import { SettingsMcpExternalSoakEvidenceGapPanel } from './SettingsMcpExternalSoakEvidenceGapPanel';
import { SettingsMcpEvidenceStagesExchangePanel } from './SettingsMcpEvidenceStagesExchangePanel';
import { SettingsMcpReadinessSourceStrengthPanel } from './SettingsMcpReadinessSourceStrengthPanel';
import type { SettingsMcpServerHealthSummary } from './settingsMcpHealthSummary';
import type { SettingsMcpSoakReadinessSummaryResult } from './settingsMcpSoakReadiness';
import type { SettingsMcpSoakSummaryResult } from './settingsMcpSoakSummary';

interface SettingsMcpProgressOverviewProps {
  configText: string;
  healthSummaries: SettingsMcpServerHealthSummary[];
  readinessSummary: SettingsMcpSoakReadinessSummaryResult | null;
  soakSummary: SettingsMcpSoakSummaryResult | null;
  toolCount: number;
}

function getStatusClassName(status: string) {
  if (status === 'ready' || status === 'healthy' || status === 'ok') {
    return 'text-primary';
  }

  if (status === 'warning' || status === 'degraded' || status === 'empty') {
    return 'text-amber-600';
  }

  return 'text-destructive';
}

function createHealthText(summaries: SettingsMcpServerHealthSummary[]) {
  if (!summaries.length) {
    return '0 configured servers';
  }

  const okCount = summaries.filter((summary) => summary.status === 'ok').length;
  const errorCount = summaries.filter((summary) => summary.status === 'error').length;
  const warningCount = summaries.filter((summary) => summary.status === 'warning').length;
  return `${okCount} ok / ${warningCount} warning / ${errorCount} error`;
}

function createReadinessText(summary: SettingsMcpSoakReadinessSummaryResult | null) {
  if (!summary) {
    return 'No readiness evidence generated or imported.';
  }

  return `${summary.totals.readyServers} ready / ${summary.totals.referenceServers} reference / ${summary.totals.fakeFixtureServers} fixture`;
}

function createSoakText(summary: SettingsMcpSoakSummaryResult | null) {
  if (!summary) {
    return 'No real-server soak report imported.';
  }

  return `${summary.totals.servers} servers / ${summary.totals.rounds} rounds / ${summary.totals.restartEvents} restarts`;
}

function createProgressRows(options: {
  healthSummaries: SettingsMcpServerHealthSummary[];
  evidenceStages: SettingsMcpEvidenceStageSummary;
  preflight: SettingsMcpConfigPreflightResult;
  readinessSummary: SettingsMcpSoakReadinessSummaryResult | null;
  soakSummary: SettingsMcpSoakSummaryResult | null;
  toolCount: number;
}) {
  return [{
    Icon: Layers3,
    detail: options.evidenceStages.stages.map((stage) => `${stage.label}: ${stage.status}`).join(' / '),
    label: 'Evidence stages',
    status: options.evidenceStages.status,
  }, {
    Icon: ServerCog,
    detail: `${options.preflight.statusCounts.blocked} blocked / ${options.preflight.statusCounts.warning} warning / ${options.preflight.statusCounts.ready} ready checks`,
    label: 'Config preflight',
    status: options.preflight.status,
  }, {
    Icon: CheckCircle2,
    detail: createHealthText(options.healthSummaries),
    label: 'Saved server health',
    status: options.healthSummaries.some((summary) => summary.status === 'error') ? 'blocked' : 'ready',
  }, {
    Icon: Route,
    detail: createReadinessText(options.readinessSummary),
    label: 'Real-soak readiness',
    status: options.readinessSummary?.status ?? 'blocked',
  }, {
    Icon: Activity,
    detail: createSoakText(options.soakSummary),
    label: 'Imported soak report',
    status: options.soakSummary?.status ?? 'blocked',
  }, {
    Icon: CircleAlert,
    detail: `${options.toolCount} listed tool(s) available for policy/risk review`,
    label: 'Tool visibility',
    status: options.toolCount > 0 ? 'ready' : 'warning',
  }];
}

export function SettingsMcpProgressOverview({
  configText,
  healthSummaries,
  readinessSummary,
  soakSummary,
  toolCount,
}: SettingsMcpProgressOverviewProps) {
  const preflight = createSettingsMcpConfigPreflight(configText);
  const evidenceStageSummary = createSettingsMcpEvidenceStageSummary({
    preflight,
    readinessSummary,
    soakSummary,
  });
  const rows = createProgressRows({
    evidenceStages: evidenceStageSummary,
    healthSummaries,
    preflight,
    readinessSummary,
    soakSummary,
    toolCount,
  });

  return (
    <div className="space-y-2">
      <div className="grid gap-2 lg:grid-cols-6">
        {rows.map(({ Icon, detail, label, status }) => (
          <div key={label} className="rounded-sm border border-dashed border-border bg-background/30 px-3 py-2">
            <div className="flex items-start gap-2">
              <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${getStatusClassName(status)}`} />
              <div className="min-w-0">
                <div className="font-mono text-3xs text-foreground">{label}</div>
                <div className={`text-3xs ${getStatusClassName(status)}`}>{status}</div>
                <div className="text-3xs text-muted-foreground">{detail}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <SettingsMcpExternalSoakEvidenceGapPanel
        preflight={preflight}
        readinessSummary={readinessSummary}
        soakSummary={soakSummary}
      />
      <SettingsMcpReadinessSourceStrengthPanel readinessSummary={readinessSummary} />
      <SettingsMcpExternalSoakClosureChecklistPanel
        preflight={preflight}
        readinessSummary={readinessSummary}
        soakSummary={soakSummary}
      />
      <SettingsMcpEvidenceStagesExchangePanel summary={evidenceStageSummary} />
    </div>
  );
}
