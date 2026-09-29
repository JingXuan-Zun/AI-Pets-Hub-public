import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  createAgentSessionV3PilotRealCorpusBatchMissingEvidenceRollup,
  type AgentSessionV3PilotRealCorpusBatchMissingEvidenceEntry,
  type AgentSessionV3PilotRealCorpusBatchMissingEvidenceRollupResult,
} from './agent-session-v3-pilot-real-corpus-batch-missing-evidence-rollup.ts';

export type AgentSessionV3PilotRealCorpusBatchFinalGapReportStatus =
  | 'missing-real-evidence'
  | 'no-final-gaps';

export type AgentSessionV3PilotRealCorpusBatchFinalGapPriority =
  AgentSessionV3PilotRealCorpusBatchMissingEvidenceEntry['priority'];

export interface AgentSessionV3PilotRealCorpusBatchFinalGapItem {
  boundary: string;
  gapCount: number;
  gapKind: AgentSessionV3PilotRealCorpusBatchMissingEvidenceEntry['gapKind'];
  manualEvidence: string;
  priority: AgentSessionV3PilotRealCorpusBatchFinalGapPriority;
  sourceReports: string[];
  title: string;
}

export interface AgentSessionV3PilotRealCorpusBatchFinalGapReportResult {
  dashboardGapCount: number;
  finalGapCount: number;
  finalGaps: AgentSessionV3PilotRealCorpusBatchFinalGapItem[];
  guardrail: string;
  jsonText: string | null;
  kind: 'agent-session-v3-pilot-real-corpus-batch-final-gap-report';
  missingEvidenceSummaryText: string;
  priorityCounts: Record<AgentSessionV3PilotRealCorpusBatchFinalGapPriority, number>;
  readyForProductionRuntime: false;
  reportText: string;
  status: AgentSessionV3PilotRealCorpusBatchFinalGapReportStatus;
  summaryText: string;
  version: 1;
}

export interface CreateAgentSessionV3PilotRealCorpusBatchFinalGapReportOptions {
  includeJsonText?: boolean;
  prettyJson?: boolean;
  projectRoot?: string;
}

const PRIORITY_WEIGHT: Record<AgentSessionV3PilotRealCorpusBatchFinalGapPriority, number> = {
  P0: 0,
  P1: 1,
  P2: 2,
  unprioritized: 3,
};

function parseArgs(
  args: readonly string[],
): CreateAgentSessionV3PilotRealCorpusBatchFinalGapReportOptions {
  let includeJsonText = false;
  let prettyJson = false;

  for (const arg of args) {
    if (arg === '--json') {
      includeJsonText = true;
    } else if (arg === '--pretty') {
      includeJsonText = true;
      prettyJson = true;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  return {
    includeJsonText,
    prettyJson,
  };
}

function createPriorityCounts(
  entries: readonly AgentSessionV3PilotRealCorpusBatchMissingEvidenceEntry[],
) {
  const priorityCounts: Record<AgentSessionV3PilotRealCorpusBatchFinalGapPriority, number> = {
    P0: 0,
    P1: 0,
    P2: 0,
    unprioritized: 0,
  };

  for (const entry of entries) {
    priorityCounts[entry.priority] += 1;
  }

  return priorityCounts;
}

function createSourceReports(
  entry: AgentSessionV3PilotRealCorpusBatchMissingEvidenceEntry,
) {
  return [
    'PROJECT_AGENT_V3_PILOT_READINESS_CHECKLIST.md',
    'scripts/agent-session-v3-pilot-real-corpus-batch-status-dashboard-report.ts',
    'scripts/agent-session-v3-pilot-real-corpus-batch-gap-action-checklist.ts',
    'scripts/agent-session-v3-pilot-real-corpus-batch-missing-evidence-rollup.ts',
    ...(entry.priority === 'P0'
      ? ['scripts/agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts']
      : []),
  ];
}

function createFinalGaps(
  missingEvidence: AgentSessionV3PilotRealCorpusBatchMissingEvidenceRollupResult,
): AgentSessionV3PilotRealCorpusBatchFinalGapItem[] {
  return [...missingEvidence.missingEvidenceEntries]
    .sort((left, right) => (
      PRIORITY_WEIGHT[left.priority] - PRIORITY_WEIGHT[right.priority]
        || right.gapCount - left.gapCount
        || left.gapKind.localeCompare(right.gapKind)
    ))
    .map((entry) => ({
      boundary: entry.boundary,
      gapCount: entry.gapCount,
      gapKind: entry.gapKind,
      manualEvidence: entry.manualEvidence,
      priority: entry.priority,
      sourceReports: createSourceReports(entry),
      title: entry.title,
    }));
}

function createStatus(
  finalGapCount: number,
): AgentSessionV3PilotRealCorpusBatchFinalGapReportStatus {
  return finalGapCount > 0 ? 'missing-real-evidence' : 'no-final-gaps';
}

function createSummaryText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchFinalGapReportResult,
    | 'dashboardGapCount'
    | 'finalGapCount'
    | 'priorityCounts'
    | 'readyForProductionRuntime'
    | 'status'
  >,
) {
  return [
    `AgentSessionV3PilotRealCorpusBatchFinalGapReport status=${result.status}`,
    `finalGaps=${result.finalGapCount}`,
    `dashboardGaps=${result.dashboardGapCount}`,
    `P0=${result.priorityCounts.P0}`,
    `P1=${result.priorityCounts.P1}`,
    `P2=${result.priorityCounts.P2}`,
    `unprioritized=${result.priorityCounts.unprioritized}`,
    `readyForProductionRuntime=${result.readyForProductionRuntime ? 'yes' : 'no'}`,
  ].join(' ');
}

function createReportText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchFinalGapReportResult,
    | 'finalGaps'
    | 'guardrail'
    | 'missingEvidenceSummaryText'
    | 'priorityCounts'
    | 'summaryText'
  >,
) {
  return [
    result.summaryText,
    `missingEvidenceSummary=${result.missingEvidenceSummaryText}`,
    'priorityCounts:',
    ...Object.entries(result.priorityCounts).map(([priority, count]) => `- priority=${priority} gaps=${count}`),
    result.finalGaps.length ? 'finalManualGapList:' : 'finalManualGapList: none',
    ...result.finalGaps.map((gap) => [
      `- priority=${gap.priority}`,
      `gapKind=${gap.gapKind}`,
      `gapCount=${gap.gapCount}`,
      `title=${gap.title}`,
      `manualEvidence=${gap.manualEvidence}`,
      `sourceReports=${gap.sourceReports.join(',')}`,
      `boundary=${gap.boundary}`,
    ].join(' ')),
    `guardrail=${result.guardrail}`,
  ].join('\n');
}

function createJsonText(
  result: AgentSessionV3PilotRealCorpusBatchFinalGapReportResult,
  options: { prettyJson?: boolean } = {},
) {
  return JSON.stringify(result, null, options.prettyJson ? 2 : 0);
}

export function createAgentSessionV3PilotRealCorpusBatchFinalGapReport(
  options: CreateAgentSessionV3PilotRealCorpusBatchFinalGapReportOptions = {},
): AgentSessionV3PilotRealCorpusBatchFinalGapReportResult {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const missingEvidence = createAgentSessionV3PilotRealCorpusBatchMissingEvidenceRollup({
    projectRoot,
  });
  const finalGaps = createFinalGaps(missingEvidence);
  const priorityCounts = createPriorityCounts(missingEvidence.missingEvidenceEntries);
  const resultWithoutText: AgentSessionV3PilotRealCorpusBatchFinalGapReportResult = {
    dashboardGapCount: missingEvidence.dashboardGapCount,
    finalGapCount: finalGaps.length,
    finalGaps,
    guardrail: 'caller-owned final gap report only; does not discover directories, collect samples, run smoke tests, create task queues, create handoff bundles, choose thresholds, route permissions, execute tools, decide recovery, define workflows, change readiness, define runtime action order, or grant runtime authority.',
    jsonText: null,
    kind: 'agent-session-v3-pilot-real-corpus-batch-final-gap-report',
    missingEvidenceSummaryText: missingEvidence.summaryText,
    priorityCounts,
    readyForProductionRuntime: false,
    reportText: '',
    status: createStatus(finalGaps.length),
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

function runAgentSessionV3PilotRealCorpusBatchFinalGapReportCli() {
  const options = parseArgs(process.argv.slice(2));
  const result = createAgentSessionV3PilotRealCorpusBatchFinalGapReport(options);
  console.log(result.reportText);
  if (result.jsonText) {
    console.log(result.jsonText);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAgentSessionV3PilotRealCorpusBatchFinalGapReportCli();
}
