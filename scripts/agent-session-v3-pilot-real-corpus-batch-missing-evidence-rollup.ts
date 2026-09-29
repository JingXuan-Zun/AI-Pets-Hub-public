import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  createAgentSessionV3PilotRealCorpusBatchGapActionChecklist,
  type AgentSessionV3PilotRealCorpusBatchGapAction,
  type AgentSessionV3PilotRealCorpusBatchGapActionChecklistResult,
  type AgentSessionV3PilotRealCorpusBatchGapActionPriority,
} from './agent-session-v3-pilot-real-corpus-batch-gap-action-checklist.ts';
import {
  createAgentSessionV3PilotRealCorpusBatchStatusDashboardReport,
  type AgentSessionV3PilotRealCorpusBatchStatusDashboardGapKind,
  type AgentSessionV3PilotRealCorpusBatchStatusDashboardGapSource,
  type AgentSessionV3PilotRealCorpusBatchStatusDashboardReportResult,
} from './agent-session-v3-pilot-real-corpus-batch-status-dashboard-report.ts';

export type AgentSessionV3PilotRealCorpusBatchMissingEvidenceStatus =
  | 'missing-real-evidence'
  | 'no-dashboard-gaps';

export type AgentSessionV3PilotRealCorpusBatchMissingEvidenceMarkerStatus =
  | 'explicit-marker-covered'
  | 'legacy-wording-present';

export interface AgentSessionV3PilotRealCorpusBatchMissingEvidenceEntry {
  boundary: string;
  gapCount: number;
  gapKind: AgentSessionV3PilotRealCorpusBatchStatusDashboardGapKind;
  manualEvidence: string;
  markerSourceCounts: Record<AgentSessionV3PilotRealCorpusBatchStatusDashboardGapSource, number>;
  priority: AgentSessionV3PilotRealCorpusBatchGapActionPriority | 'unprioritized';
  title: string;
}

export interface AgentSessionV3PilotRealCorpusBatchMissingEvidenceRollupResult {
  actionCount: number;
  dashboardGapCount: number;
  dashboardGapCounts: Record<AgentSessionV3PilotRealCorpusBatchStatusDashboardGapKind, number>;
  dashboardGapSourceCounts: Record<AgentSessionV3PilotRealCorpusBatchStatusDashboardGapSource, number>;
  dashboardSmokeIndexEntryCount: number;
  dashboardSmokeIndexMissingCount: number;
  dashboardSmokeIndexUnindexedCount: number;
  dashboardSummaryText: string;
  gapActionSummaryText: string;
  gapKindEntryCount: number;
  guardrail: string;
  jsonText: string | null;
  kind: 'agent-session-v3-pilot-real-corpus-batch-missing-evidence-rollup';
  markerStatus: AgentSessionV3PilotRealCorpusBatchMissingEvidenceMarkerStatus;
  missingEvidenceEntries: AgentSessionV3PilotRealCorpusBatchMissingEvidenceEntry[];
  missingEvidenceStatus: AgentSessionV3PilotRealCorpusBatchMissingEvidenceStatus;
  priorityCounts: Record<AgentSessionV3PilotRealCorpusBatchGapActionPriority, number>;
  readyForProductionRuntime: false;
  reportText: string;
  summaryText: string;
  unprioritizedGapKinds: AgentSessionV3PilotRealCorpusBatchStatusDashboardGapKind[];
  version: 1;
}

export interface CreateAgentSessionV3PilotRealCorpusBatchMissingEvidenceRollupOptions {
  includeJsonText?: boolean;
  prettyJson?: boolean;
  projectRoot?: string;
}

const GAP_KIND_ORDER: AgentSessionV3PilotRealCorpusBatchStatusDashboardGapKind[] = [
  'real-production-like-sample',
  'real-exported-corpus',
  'broader-real-corpus',
  'manifest-distribution',
  'real-exported-fixture',
  'real-threshold-profile',
];

function createZeroSourceCounts() {
  return {
    'explicit-marker': 0,
    'legacy-wording': 0,
  } satisfies Record<AgentSessionV3PilotRealCorpusBatchStatusDashboardGapSource, number>;
}

function createGapKindSourceCounts(
  dashboard: AgentSessionV3PilotRealCorpusBatchStatusDashboardReportResult,
) {
  const sourceCountsByKind = Object.fromEntries(
    GAP_KIND_ORDER.map((kind) => [kind, createZeroSourceCounts()]),
  ) as Record<
    AgentSessionV3PilotRealCorpusBatchStatusDashboardGapKind,
    Record<AgentSessionV3PilotRealCorpusBatchStatusDashboardGapSource, number>
  >;

  for (const gap of dashboard.gaps) {
    sourceCountsByKind[gap.kind][gap.source] += 1;
  }

  return sourceCountsByKind;
}

function createActionByKind(
  checklist: AgentSessionV3PilotRealCorpusBatchGapActionChecklistResult,
) {
  return new Map<AgentSessionV3PilotRealCorpusBatchStatusDashboardGapKind, AgentSessionV3PilotRealCorpusBatchGapAction>(
    checklist.actions.map((action) => [action.gapKind, action]),
  );
}

function createMissingEvidenceEntries(
  dashboard: AgentSessionV3PilotRealCorpusBatchStatusDashboardReportResult,
  checklist: AgentSessionV3PilotRealCorpusBatchGapActionChecklistResult,
): AgentSessionV3PilotRealCorpusBatchMissingEvidenceEntry[] {
  const actionByKind = createActionByKind(checklist);
  const sourceCountsByKind = createGapKindSourceCounts(dashboard);

  return GAP_KIND_ORDER
    .map((gapKind) => {
      const gapCount = dashboard.gapCounts[gapKind];
      if (gapCount === 0) {
        return null;
      }

      const action = actionByKind.get(gapKind);

      return {
        boundary: action?.boundary ?? 'manual evidence gap only; no runtime action order.',
        gapCount,
        gapKind,
        manualEvidence: action?.manualAction ?? 'Add caller-owned evidence for this dashboard gap before considering production runtime authority.',
        markerSourceCounts: sourceCountsByKind[gapKind],
        priority: action?.priority ?? 'unprioritized',
        title: action?.title ?? gapKind,
      };
    })
    .filter((entry): entry is AgentSessionV3PilotRealCorpusBatchMissingEvidenceEntry => entry !== null);
}

function createUnprioritizedGapKinds(entries: readonly AgentSessionV3PilotRealCorpusBatchMissingEvidenceEntry[]) {
  return entries
    .filter((entry) => entry.priority === 'unprioritized')
    .map((entry) => entry.gapKind);
}

function createMissingEvidenceStatus(dashboardGapCount: number): AgentSessionV3PilotRealCorpusBatchMissingEvidenceStatus {
  return dashboardGapCount > 0 ? 'missing-real-evidence' : 'no-dashboard-gaps';
}

function createMarkerStatus(
  dashboard: AgentSessionV3PilotRealCorpusBatchStatusDashboardReportResult,
): AgentSessionV3PilotRealCorpusBatchMissingEvidenceMarkerStatus {
  return dashboard.gapSourceCounts['legacy-wording'] > 0
    ? 'legacy-wording-present'
    : 'explicit-marker-covered';
}

function createSummaryText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchMissingEvidenceRollupResult,
    | 'dashboardGapCount'
    | 'dashboardGapSourceCounts'
    | 'gapKindEntryCount'
    | 'markerStatus'
    | 'missingEvidenceStatus'
    | 'priorityCounts'
    | 'readyForProductionRuntime'
    | 'unprioritizedGapKinds'
  >,
) {
  return [
    `AgentSessionV3PilotRealCorpusBatchMissingEvidenceRollup status=${result.missingEvidenceStatus}`,
    `gapKinds=${result.gapKindEntryCount}`,
    `dashboardGaps=${result.dashboardGapCount}`,
    `explicitMarkerGaps=${result.dashboardGapSourceCounts['explicit-marker']}`,
    `legacyWordingGaps=${result.dashboardGapSourceCounts['legacy-wording']}`,
    `markerStatus=${result.markerStatus}`,
    `P0=${result.priorityCounts.P0}`,
    `P1=${result.priorityCounts.P1}`,
    `P2=${result.priorityCounts.P2}`,
    `unprioritized=${result.unprioritizedGapKinds.length}`,
    `readyForProductionRuntime=${result.readyForProductionRuntime ? 'yes' : 'no'}`,
  ].join(' ');
}

function createReportText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchMissingEvidenceRollupResult,
    | 'dashboardGapCounts'
    | 'dashboardGapSourceCounts'
    | 'dashboardSmokeIndexEntryCount'
    | 'dashboardSmokeIndexMissingCount'
    | 'dashboardSmokeIndexUnindexedCount'
    | 'dashboardSummaryText'
    | 'gapActionSummaryText'
    | 'guardrail'
    | 'markerStatus'
    | 'missingEvidenceEntries'
    | 'priorityCounts'
    | 'summaryText'
    | 'unprioritizedGapKinds'
  >,
) {
  return [
    result.summaryText,
    `dashboardSummary=${result.dashboardSummaryText}`,
    `gapActionSummary=${result.gapActionSummaryText}`,
    `dashboardSmokeIndex entries=${result.dashboardSmokeIndexEntryCount} missing=${result.dashboardSmokeIndexMissingCount} unindexed=${result.dashboardSmokeIndexUnindexedCount}`,
    `markerStatus=${result.markerStatus}`,
    'priorityCounts:',
    ...Object.entries(result.priorityCounts).map(([priority, count]) => `- priority=${priority} actions=${count}`),
    'dashboardGapCounts:',
    ...Object.entries(result.dashboardGapCounts).map(([kind, count]) => `- kind=${kind} count=${count}`),
    'dashboardGapSources:',
    ...Object.entries(result.dashboardGapSourceCounts).map(([source, count]) => `- source=${source} count=${count}`),
    result.unprioritizedGapKinds.length ? 'unprioritizedGapKinds:' : 'unprioritizedGapKinds: none',
    ...result.unprioritizedGapKinds.map((kind) => `- kind=${kind}`),
    result.missingEvidenceEntries.length ? 'missingEvidenceByKind:' : 'missingEvidenceByKind: none',
    ...result.missingEvidenceEntries.map((entry) => [
      `- priority=${entry.priority}`,
      `gapKind=${entry.gapKind}`,
      `gapCount=${entry.gapCount}`,
      `explicitMarkerGaps=${entry.markerSourceCounts['explicit-marker']}`,
      `legacyWordingGaps=${entry.markerSourceCounts['legacy-wording']}`,
      `title=${entry.title}`,
      `manualEvidence=${entry.manualEvidence}`,
      `boundary=${entry.boundary}`,
    ].join(' ')),
    `guardrail=${result.guardrail}`,
  ].join('\n');
}

function createJsonText(
  result: AgentSessionV3PilotRealCorpusBatchMissingEvidenceRollupResult,
  options: { prettyJson?: boolean } = {},
) {
  return JSON.stringify(result, null, options.prettyJson ? 2 : 0);
}

export function createAgentSessionV3PilotRealCorpusBatchMissingEvidenceRollup(
  options: CreateAgentSessionV3PilotRealCorpusBatchMissingEvidenceRollupOptions = {},
): AgentSessionV3PilotRealCorpusBatchMissingEvidenceRollupResult {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const dashboard = createAgentSessionV3PilotRealCorpusBatchStatusDashboardReport({
    projectRoot,
  });
  const checklist = createAgentSessionV3PilotRealCorpusBatchGapActionChecklist({
    projectRoot,
  });
  const missingEvidenceEntries = createMissingEvidenceEntries(dashboard, checklist);
  const unprioritizedGapKinds = createUnprioritizedGapKinds(missingEvidenceEntries);
  const resultWithoutText: AgentSessionV3PilotRealCorpusBatchMissingEvidenceRollupResult = {
    actionCount: checklist.actionCount,
    dashboardGapCount: dashboard.gapCount,
    dashboardGapCounts: dashboard.gapCounts,
    dashboardGapSourceCounts: dashboard.gapSourceCounts,
    dashboardSmokeIndexEntryCount: dashboard.smokeIndexEntryCount,
    dashboardSmokeIndexMissingCount: dashboard.smokeIndexMissingCount,
    dashboardSmokeIndexUnindexedCount: dashboard.smokeIndexUnindexedCount,
    dashboardSummaryText: dashboard.summaryText,
    gapActionSummaryText: checklist.summaryText,
    gapKindEntryCount: missingEvidenceEntries.length,
    guardrail: 'caller-owned missing evidence rollup only; does not collect samples, run smoke tests, choose thresholds, route permissions, execute tools, decide recovery, define workflows, change readiness, define runtime action order, or grant runtime authority.',
    jsonText: null,
    kind: 'agent-session-v3-pilot-real-corpus-batch-missing-evidence-rollup',
    markerStatus: createMarkerStatus(dashboard),
    missingEvidenceEntries,
    missingEvidenceStatus: createMissingEvidenceStatus(dashboard.gapCount),
    priorityCounts: checklist.priorityCounts,
    readyForProductionRuntime: false,
    reportText: '',
    summaryText: '',
    unprioritizedGapKinds,
    version: 1,
  };
  const summaryText = createSummaryText(resultWithoutText);
  const resultWithReport = {
    ...resultWithoutText,
    reportText: createReportText({
      ...resultWithoutText,
      summaryText,
    }),
    summaryText,
  };

  return {
    ...resultWithReport,
    jsonText: options.includeJsonText
      ? createJsonText(resultWithReport, {
        prettyJson: options.prettyJson,
      })
      : null,
  };
}

function runAgentSessionV3PilotRealCorpusBatchMissingEvidenceRollupCli() {
  const args = process.argv.slice(2);
  const includeJsonText = args.includes('--json') || args.includes('--pretty');
  const prettyJson = args.includes('--pretty');
  const result = createAgentSessionV3PilotRealCorpusBatchMissingEvidenceRollup({
    includeJsonText,
    prettyJson,
  });
  console.log(result.reportText);
  if (result.jsonText) {
    console.log(result.jsonText);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAgentSessionV3PilotRealCorpusBatchMissingEvidenceRollupCli();
}
