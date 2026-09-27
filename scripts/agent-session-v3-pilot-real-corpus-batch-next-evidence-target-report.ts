import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  createAgentSessionV3PilotRealCorpusBatchMissingEvidenceRollup,
  type AgentSessionV3PilotRealCorpusBatchMissingEvidenceEntry,
} from './agent-session-v3-pilot-real-corpus-batch-missing-evidence-rollup.ts';
import { createAgentSessionV3PilotRealCorpusBatchPackageHealthRollup } from './agent-session-v3-pilot-real-corpus-batch-package-health-rollup.ts';

export type AgentSessionV3PilotRealCorpusBatchNextEvidenceTargetReportStatus =
  | 'no-target-needed'
  | 'package-attention-needed'
  | 'target-needed';

export interface AgentSessionV3PilotRealCorpusBatchNextEvidenceTargetReportResult {
  gapKindEntryCount: number;
  guardrail: string;
  jsonText: string | null;
  kind: 'agent-session-v3-pilot-real-corpus-batch-next-evidence-target-report';
  missingEvidenceStatus: string;
  missingEvidenceSummaryText: string;
  missingPackageEntryCount: number;
  missingPackageEntryPaths: string[];
  nextPriority: AgentSessionV3PilotRealCorpusBatchMissingEvidenceEntry['priority'] | null;
  packageEntryCount: number;
  packageHealthStatus: string;
  packageHealthSummaryText: string;
  priorityCounts: Record<string, number>;
  readyForProductionRuntime: false;
  realSampleGapCount: number;
  reportText: string;
  status: AgentSessionV3PilotRealCorpusBatchNextEvidenceTargetReportStatus;
  summaryText: string;
  targetCount: number;
  targets: AgentSessionV3PilotRealCorpusBatchMissingEvidenceEntry[];
  version: 1;
}

export interface CreateAgentSessionV3PilotRealCorpusBatchNextEvidenceTargetReportOptions {
  includeJsonText?: boolean;
  prettyJson?: boolean;
  projectRoot?: string;
}

const PRIORITY_WEIGHT: Record<AgentSessionV3PilotRealCorpusBatchMissingEvidenceEntry['priority'], number> = {
  P0: 0,
  P1: 1,
  P2: 2,
  unprioritized: 3,
};

function createTargets(
  entries: readonly AgentSessionV3PilotRealCorpusBatchMissingEvidenceEntry[],
) {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => {
      const priorityDelta = PRIORITY_WEIGHT[left.entry.priority] - PRIORITY_WEIGHT[right.entry.priority];

      return priorityDelta === 0 ? left.index - right.index : priorityDelta;
    })
    .map(({ entry }) => entry);
}

function createStatus(options: {
  missingPackageEntryCount: number;
  targetCount: number;
}): AgentSessionV3PilotRealCorpusBatchNextEvidenceTargetReportStatus {
  if (options.missingPackageEntryCount > 0) {
    return 'package-attention-needed';
  }

  return options.targetCount > 0 ? 'target-needed' : 'no-target-needed';
}

function createSummaryText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchNextEvidenceTargetReportResult,
    | 'missingPackageEntryCount'
    | 'nextPriority'
    | 'packageHealthStatus'
    | 'priorityCounts'
    | 'readyForProductionRuntime'
    | 'realSampleGapCount'
    | 'status'
    | 'targetCount'
  >,
) {
  return [
    `AgentSessionV3PilotRealCorpusBatchNextEvidenceTargetReport status=${result.status}`,
    `packageHealth=${result.packageHealthStatus}`,
    `targets=${result.targetCount}`,
    `nextPriority=${result.nextPriority ?? 'none'}`,
    `missingPackageEntries=${result.missingPackageEntryCount}`,
    `realSampleGaps=${result.realSampleGapCount}`,
    `P0=${result.priorityCounts.P0 ?? 0}`,
    `P1=${result.priorityCounts.P1 ?? 0}`,
    `P2=${result.priorityCounts.P2 ?? 0}`,
    `readyForProductionRuntime=${result.readyForProductionRuntime ? 'yes' : 'no'}`,
  ].join(' ');
}

function createReportText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchNextEvidenceTargetReportResult,
    | 'guardrail'
    | 'missingEvidenceSummaryText'
    | 'missingPackageEntryPaths'
    | 'packageHealthSummaryText'
    | 'priorityCounts'
    | 'summaryText'
    | 'targets'
  >,
) {
  return [
    result.summaryText,
    `packageHealthSummary=${result.packageHealthSummaryText}`,
    `missingEvidenceSummary=${result.missingEvidenceSummaryText}`,
    'priorityCounts:',
    ...Object.entries(result.priorityCounts).map(([priority, count]) => `- priority=${priority} targets=${count}`),
    result.missingPackageEntryPaths.length ? 'missingPackageEntries:' : 'missingPackageEntries: none',
    ...result.missingPackageEntryPaths.map((entryPath) => `- ${entryPath}`),
    result.targets.length ? 'nextEvidenceTargets:' : 'nextEvidenceTargets: none',
    ...result.targets.map((target) => [
      `- priority=${target.priority}`,
      `gapKind=${target.gapKind}`,
      `gapCount=${target.gapCount}`,
      `explicitMarkerGaps=${target.markerSourceCounts['explicit-marker']}`,
      `legacyWordingGaps=${target.markerSourceCounts['legacy-wording']}`,
      `title=${target.title}`,
      `manualEvidence=${target.manualEvidence}`,
      `boundary=${target.boundary}`,
    ].join(' ')),
    `guardrail=${result.guardrail}`,
  ].join('\n');
}

function createJsonText(
  result: AgentSessionV3PilotRealCorpusBatchNextEvidenceTargetReportResult,
  options: { prettyJson?: boolean } = {},
) {
  return JSON.stringify(result, null, options.prettyJson ? 2 : 0);
}

export function createAgentSessionV3PilotRealCorpusBatchNextEvidenceTargetReport(
  options: CreateAgentSessionV3PilotRealCorpusBatchNextEvidenceTargetReportOptions = {},
): AgentSessionV3PilotRealCorpusBatchNextEvidenceTargetReportResult {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const packageHealth = createAgentSessionV3PilotRealCorpusBatchPackageHealthRollup({
    projectRoot,
  });
  const missingEvidence = createAgentSessionV3PilotRealCorpusBatchMissingEvidenceRollup({
    projectRoot,
  });
  const targets = createTargets(missingEvidence.missingEvidenceEntries);
  const resultWithoutText: AgentSessionV3PilotRealCorpusBatchNextEvidenceTargetReportResult = {
    gapKindEntryCount: missingEvidence.gapKindEntryCount,
    guardrail: 'caller-owned next evidence target report only; does not collect samples, run smoke tests, create task queues, create handoff bundles, choose thresholds, route permissions, execute tools, decide recovery, define workflows, change readiness, define runtime action order, or grant runtime authority.',
    jsonText: null,
    kind: 'agent-session-v3-pilot-real-corpus-batch-next-evidence-target-report',
    missingEvidenceStatus: missingEvidence.missingEvidenceStatus,
    missingEvidenceSummaryText: missingEvidence.summaryText,
    missingPackageEntryCount: packageHealth.missingPackageEntryCount,
    missingPackageEntryPaths: packageHealth.missingPackageEntryPaths,
    nextPriority: targets[0]?.priority ?? null,
    packageEntryCount: packageHealth.packageEntryCount,
    packageHealthStatus: packageHealth.status,
    packageHealthSummaryText: packageHealth.summaryText,
    priorityCounts: missingEvidence.priorityCounts,
    readyForProductionRuntime: false,
    realSampleGapCount: packageHealth.realSampleGapCount,
    reportText: '',
    status: createStatus({
      missingPackageEntryCount: packageHealth.missingPackageEntryCount,
      targetCount: targets.length,
    }),
    summaryText: '',
    targetCount: targets.length,
    targets,
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

function runAgentSessionV3PilotRealCorpusBatchNextEvidenceTargetReportCli() {
  const args = process.argv.slice(2);
  const includeJsonText = args.includes('--json') || args.includes('--pretty');
  const prettyJson = args.includes('--pretty');
  const result = createAgentSessionV3PilotRealCorpusBatchNextEvidenceTargetReport({
    includeJsonText,
    prettyJson,
  });
  console.log(result.reportText);
  if (result.jsonText) {
    console.log(result.jsonText);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAgentSessionV3PilotRealCorpusBatchNextEvidenceTargetReportCli();
}
