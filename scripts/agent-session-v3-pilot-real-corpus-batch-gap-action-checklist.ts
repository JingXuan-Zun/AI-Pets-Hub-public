import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  createAgentSessionV3PilotRealCorpusBatchStatusDashboardReport,
  type AgentSessionV3PilotRealCorpusBatchStatusDashboardGapKind,
  type AgentSessionV3PilotRealCorpusBatchStatusDashboardReportResult,
} from './agent-session-v3-pilot-real-corpus-batch-status-dashboard-report.ts';

export type AgentSessionV3PilotRealCorpusBatchGapActionPriority =
  | 'P0'
  | 'P1'
  | 'P2';

export interface AgentSessionV3PilotRealCorpusBatchGapAction {
  boundary: string;
  gapCount: number;
  gapKind: AgentSessionV3PilotRealCorpusBatchStatusDashboardGapKind;
  manualAction: string;
  priority: AgentSessionV3PilotRealCorpusBatchGapActionPriority;
  rationale: string;
  title: string;
}

export interface AgentSessionV3PilotRealCorpusBatchGapActionChecklistResult {
  actionCount: number;
  actions: AgentSessionV3PilotRealCorpusBatchGapAction[];
  dashboardGapCount: number;
  dashboardGapCounts: Record<AgentSessionV3PilotRealCorpusBatchStatusDashboardGapKind, number>;
  dashboardSmokeIndexEntryCount: number;
  dashboardSmokeIndexMissingCount: number;
  dashboardSmokeIndexUnindexedCount: number;
  dashboardSummaryText: string;
  guardrail: string;
  jsonText: string | null;
  kind: 'agent-session-v3-pilot-real-corpus-batch-gap-action-checklist';
  priorityCounts: Record<AgentSessionV3PilotRealCorpusBatchGapActionPriority, number>;
  readyForProductionRuntime: false;
  reportText: string;
  summaryText: string;
  version: 1;
}

export interface CreateAgentSessionV3PilotRealCorpusBatchGapActionChecklistOptions {
  includeJsonText?: boolean;
  prettyJson?: boolean;
  projectRoot?: string;
}

const GAP_ACTION_ORDER: AgentSessionV3PilotRealCorpusBatchStatusDashboardGapKind[] = [
  'real-production-like-sample',
  'real-exported-corpus',
  'broader-real-corpus',
  'manifest-distribution',
  'real-exported-fixture',
  'real-threshold-profile',
];

const GAP_ACTION_SPECS: Record<
  AgentSessionV3PilotRealCorpusBatchStatusDashboardGapKind,
  Omit<AgentSessionV3PilotRealCorpusBatchGapAction, 'gapCount' | 'gapKind'>
> = {
  'broader-real-corpus': {
    boundary: 'manual corpus coverage gap only; does not define a required scenario sequence.',
    manualAction: 'Expand caller-owned real corpus batches across more task families, terminal states, and failure shapes before treating the evidence as representative.',
    priority: 'P1',
    rationale: 'Broader coverage reduces the chance that the v3 mirror only matches a narrow local rehearsal set.',
    title: 'Broaden real corpus coverage',
  },
  'manifest-distribution': {
    boundary: 'manual manifest coverage gap only; does not choose thresholds or readiness.',
    manualAction: 'Add labelled manifest distributions so calibration reports can show whether readiness gaps cluster by source kind, scenario family, or profile.',
    priority: 'P1',
    rationale: 'Manifest variety is needed before threshold and readiness conversations have enough context.',
    title: 'Add manifest distribution evidence',
  },
  'real-exported-corpus': {
    boundary: 'manual exported-corpus gap only; does not collect samples or run the runtime.',
    manualAction: 'Fill caller-owned intake directories with already exported real debug corpus files and record sample-note provenance for manual review.',
    priority: 'P0',
    rationale: 'Most remaining dashboard gaps depend on real exported corpus evidence rather than more synthetic rehearsal coverage.',
    title: 'Fill real exported corpus intakes',
  },
  'real-exported-fixture': {
    boundary: 'manual fixture coverage gap only; does not convert files or run loader checks.',
    manualAction: 'After real corpus evidence is reviewed, select representative exported corpus files for fixture batches so repeatable loader checks cover real samples.',
    priority: 'P2',
    rationale: 'Fixture coverage is useful for repeatability, but it should follow credible real corpus intake evidence.',
    title: 'Prepare real exported fixture coverage',
  },
  'real-production-like-sample': {
    boundary: 'manual production-like sample gap only; does not sample desktop activity.',
    manualAction: 'Add caller-owned exported samples from production-like desktop tasks before any production-adjacent v3 runtime experiment is considered.',
    priority: 'P0',
    rationale: 'Production-like samples are the strongest missing evidence before v3 can move closer to runtime authority.',
    title: 'Add production-like sample evidence',
  },
  'real-threshold-profile': {
    boundary: 'manual threshold-profile gap only; does not adopt or recommend a threshold.',
    manualAction: 'Compare caller-defined threshold profiles over the same reviewed real sample batch after source and manifest evidence are credible.',
    priority: 'P2',
    rationale: 'Threshold comparison is meaningful only after the underlying sample set is real enough and well labelled.',
    title: 'Compare real threshold profiles',
  },
};

function createActions(
  dashboard: AgentSessionV3PilotRealCorpusBatchStatusDashboardReportResult,
): AgentSessionV3PilotRealCorpusBatchGapAction[] {
  return GAP_ACTION_ORDER
    .map((gapKind) => {
      const gapCount = dashboard.gapCounts[gapKind];

      if (gapCount === 0) {
        return null;
      }

      return {
        ...GAP_ACTION_SPECS[gapKind],
        gapCount,
        gapKind,
      };
    })
    .filter((action): action is AgentSessionV3PilotRealCorpusBatchGapAction => action !== null);
}

function createPriorityCounts(actions: readonly AgentSessionV3PilotRealCorpusBatchGapAction[]) {
  const priorityCounts: Record<AgentSessionV3PilotRealCorpusBatchGapActionPriority, number> = {
    P0: 0,
    P1: 0,
    P2: 0,
  };

  for (const action of actions) {
    priorityCounts[action.priority] += 1;
  }

  return priorityCounts;
}

function createSummaryText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchGapActionChecklistResult,
    'actionCount' | 'dashboardGapCount' | 'priorityCounts' | 'readyForProductionRuntime'
  >,
) {
  return [
    'AgentSessionV3PilotRealCorpusBatchGapActionChecklist',
    `actions=${result.actionCount}`,
    `dashboardGaps=${result.dashboardGapCount}`,
    `P0=${result.priorityCounts.P0}`,
    `P1=${result.priorityCounts.P1}`,
    `P2=${result.priorityCounts.P2}`,
    `readyForProductionRuntime=${result.readyForProductionRuntime ? 'yes' : 'no'}`,
  ].join(' ');
}

function createReportText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchGapActionChecklistResult,
    | 'actions'
    | 'dashboardGapCounts'
    | 'dashboardSmokeIndexEntryCount'
    | 'dashboardSmokeIndexMissingCount'
    | 'dashboardSmokeIndexUnindexedCount'
    | 'dashboardSummaryText'
    | 'guardrail'
    | 'priorityCounts'
    | 'summaryText'
  >,
) {
  return [
    result.summaryText,
    `dashboardSummary=${result.dashboardSummaryText}`,
    `dashboardSmokeIndex entries=${result.dashboardSmokeIndexEntryCount} missing=${result.dashboardSmokeIndexMissingCount} unindexed=${result.dashboardSmokeIndexUnindexedCount}`,
    'priorityCounts:',
    ...Object.entries(result.priorityCounts).map(([priority, count]) => `- priority=${priority} actions=${count}`),
    'dashboardGapCounts:',
    ...Object.entries(result.dashboardGapCounts).map(([kind, count]) => `- kind=${kind} count=${count}`),
    result.actions.length ? 'manualActionChecklist:' : 'manualActionChecklist: none',
    ...result.actions.map((action) => [
      `- priority=${action.priority}`,
      `gapKind=${action.gapKind}`,
      `gapCount=${action.gapCount}`,
      `title=${action.title}`,
      `rationale=${action.rationale}`,
      `manualAction=${action.manualAction}`,
      `boundary=${action.boundary}`,
    ].join(' ')),
    `guardrail=${result.guardrail}`,
  ].join('\n');
}

function createJsonText(
  result: AgentSessionV3PilotRealCorpusBatchGapActionChecklistResult,
  options: { prettyJson?: boolean } = {},
) {
  return JSON.stringify(result, null, options.prettyJson ? 2 : 0);
}

export function createAgentSessionV3PilotRealCorpusBatchGapActionChecklist(
  options: CreateAgentSessionV3PilotRealCorpusBatchGapActionChecklistOptions = {},
): AgentSessionV3PilotRealCorpusBatchGapActionChecklistResult {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const dashboard = createAgentSessionV3PilotRealCorpusBatchStatusDashboardReport({
    projectRoot,
  });
  const actions = createActions(dashboard);
  const priorityCounts = createPriorityCounts(actions);
  const resultWithoutText: AgentSessionV3PilotRealCorpusBatchGapActionChecklistResult = {
    actionCount: actions.length,
    actions,
    dashboardGapCount: dashboard.gapCount,
    dashboardGapCounts: dashboard.gapCounts,
    dashboardSmokeIndexEntryCount: dashboard.smokeIndexEntryCount,
    dashboardSmokeIndexMissingCount: dashboard.smokeIndexMissingCount,
    dashboardSmokeIndexUnindexedCount: dashboard.smokeIndexUnindexedCount,
    dashboardSummaryText: dashboard.summaryText,
    guardrail: 'caller-owned gap action checklist only; does not collect samples, run smoke tests, choose thresholds, route permissions, execute tools, decide recovery, define workflows, change readiness, or grant runtime authority. It prioritizes manual review gaps only, not runtime action order.',
    jsonText: null,
    kind: 'agent-session-v3-pilot-real-corpus-batch-gap-action-checklist',
    priorityCounts,
    readyForProductionRuntime: false,
    reportText: '',
    summaryText: '',
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

function runAgentSessionV3PilotRealCorpusBatchGapActionChecklistCli() {
  const args = process.argv.slice(2);
  const includeJsonText = args.includes('--json') || args.includes('--pretty');
  const prettyJson = args.includes('--pretty');
  const result = createAgentSessionV3PilotRealCorpusBatchGapActionChecklist({
    includeJsonText,
    prettyJson,
  });
  console.log(result.reportText);
  if (result.jsonText) {
    console.log(result.jsonText);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAgentSessionV3PilotRealCorpusBatchGapActionChecklistCli();
}
