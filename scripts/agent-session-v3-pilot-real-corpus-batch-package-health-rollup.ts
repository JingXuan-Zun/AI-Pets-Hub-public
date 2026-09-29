import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  createAgentSessionV3PilotRealCorpusBatchEvidencePackageIndex,
  type AgentSessionV3PilotRealCorpusBatchEvidencePackageIndexResult,
} from './agent-session-v3-pilot-real-corpus-batch-evidence-package-index.ts';
import { createAgentSessionV3PilotRealCorpusBatchMissingEvidenceRollup } from './agent-session-v3-pilot-real-corpus-batch-missing-evidence-rollup.ts';

export type AgentSessionV3PilotRealCorpusBatchPackageHealthRollupStatus =
  | 'indexed'
  | 'package-attention-needed'
  | 'missing-package-entry'
  | 'missing-real-evidence';

export interface AgentSessionV3PilotRealCorpusBatchPackageHealthRollupResult {
  closeoutStatus: string;
  evidencePackageSummaryText: string;
  gapKindEntryCount: number;
  guardrail: string;
  jsonText: string | null;
  kind: 'agent-session-v3-pilot-real-corpus-batch-package-health-rollup';
  markerStatus: string;
  missingEvidenceSummaryText: string;
  missingPackageEntryCount: number;
  missingPackageEntryPaths: string[];
  packageEntryCount: number;
  p0IntakeTargetStatusLinkMissingSignalCount: number;
  p0IntakeTargetStatusLinkStatus: string;
  priorityCounts: Record<string, number>;
  readyForProductionRuntime: false;
  realSampleGapCount: number;
  reportText: string;
  status: AgentSessionV3PilotRealCorpusBatchPackageHealthRollupStatus;
  summaryText: string;
  unprioritizedGapCount: number;
  version: 1;
}

export interface CreateAgentSessionV3PilotRealCorpusBatchPackageHealthRollupOptions {
  includeJsonText?: boolean;
  prettyJson?: boolean;
  projectRoot?: string;
}

function createStatus(
  packageIndex: AgentSessionV3PilotRealCorpusBatchEvidencePackageIndexResult,
): AgentSessionV3PilotRealCorpusBatchPackageHealthRollupStatus {
  if (packageIndex.missingPackageEntryCount > 0) {
    return 'missing-package-entry';
  }

  if (packageIndex.p0IntakeTargetStatusLink.status !== 'linked') {
    return 'package-attention-needed';
  }

  return packageIndex.realSampleGapCount > 0 ? 'missing-real-evidence' : 'indexed';
}

function createSummaryText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchPackageHealthRollupResult,
    | 'closeoutStatus'
    | 'gapKindEntryCount'
    | 'markerStatus'
    | 'missingPackageEntryCount'
    | 'packageEntryCount'
    | 'p0IntakeTargetStatusLinkMissingSignalCount'
    | 'p0IntakeTargetStatusLinkStatus'
    | 'priorityCounts'
    | 'readyForProductionRuntime'
    | 'realSampleGapCount'
    | 'status'
    | 'unprioritizedGapCount'
  >,
) {
  return [
    `AgentSessionV3PilotRealCorpusBatchPackageHealthRollup status=${result.status}`,
    `packageEntries=${result.packageEntryCount}`,
    `missingPackageEntries=${result.missingPackageEntryCount}`,
    `realSampleGaps=${result.realSampleGapCount}`,
    `gapKinds=${result.gapKindEntryCount}`,
    `P0=${result.priorityCounts.P0 ?? 0}`,
    `P1=${result.priorityCounts.P1 ?? 0}`,
    `P2=${result.priorityCounts.P2 ?? 0}`,
    `unprioritized=${result.unprioritizedGapCount}`,
    `markerStatus=${result.markerStatus}`,
    `closeout=${result.closeoutStatus}`,
    `p0IntakeTargetStatusLink=${result.p0IntakeTargetStatusLinkStatus}`,
    `p0IntakeTargetStatusLinkMissingSignals=${result.p0IntakeTargetStatusLinkMissingSignalCount}`,
    `readyForProductionRuntime=${result.readyForProductionRuntime ? 'yes' : 'no'}`,
  ].join(' ');
}

function createReportText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchPackageHealthRollupResult,
    | 'evidencePackageSummaryText'
    | 'guardrail'
    | 'missingEvidenceSummaryText'
    | 'missingPackageEntryPaths'
    | 'p0IntakeTargetStatusLinkMissingSignalCount'
    | 'p0IntakeTargetStatusLinkStatus'
    | 'priorityCounts'
    | 'summaryText'
  >,
) {
  return [
    result.summaryText,
    `evidencePackageSummary=${result.evidencePackageSummaryText}`,
    `missingEvidenceSummary=${result.missingEvidenceSummaryText}`,
    'priorityCounts:',
    ...Object.entries(result.priorityCounts).map(([priority, count]) => `- priority=${priority} actions=${count}`),
    `p0IntakeTargetStatusLink status=${result.p0IntakeTargetStatusLinkStatus} missingSignals=${result.p0IntakeTargetStatusLinkMissingSignalCount}`,
    result.missingPackageEntryPaths.length ? 'missingPackageEntries:' : 'missingPackageEntries: none',
    ...result.missingPackageEntryPaths.map((entryPath) => `- ${entryPath}`),
    `guardrail=${result.guardrail}`,
  ].join('\n');
}

function createJsonText(
  result: AgentSessionV3PilotRealCorpusBatchPackageHealthRollupResult,
  options: { prettyJson?: boolean } = {},
) {
  return JSON.stringify(result, null, options.prettyJson ? 2 : 0);
}

export function createAgentSessionV3PilotRealCorpusBatchPackageHealthRollup(
  options: CreateAgentSessionV3PilotRealCorpusBatchPackageHealthRollupOptions = {},
): AgentSessionV3PilotRealCorpusBatchPackageHealthRollupResult {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const packageIndex = createAgentSessionV3PilotRealCorpusBatchEvidencePackageIndex({
    projectRoot,
  });
  const missingEvidence = createAgentSessionV3PilotRealCorpusBatchMissingEvidenceRollup({
    projectRoot,
  });
  const resultWithoutText: AgentSessionV3PilotRealCorpusBatchPackageHealthRollupResult = {
    closeoutStatus: packageIndex.closeoutStatus,
    evidencePackageSummaryText: packageIndex.summaryText,
    gapKindEntryCount: missingEvidence.gapKindEntryCount,
    guardrail: 'caller-owned package health rollup only; does not run smoke tests, collect samples, create handoff bundles, choose thresholds, route permissions, execute tools, decide recovery, define workflows, change readiness, define runtime action order, or grant runtime authority.',
    jsonText: null,
    kind: 'agent-session-v3-pilot-real-corpus-batch-package-health-rollup',
    markerStatus: missingEvidence.markerStatus,
    missingEvidenceSummaryText: missingEvidence.summaryText,
    missingPackageEntryCount: packageIndex.missingPackageEntryCount,
    missingPackageEntryPaths: packageIndex.missingPackageEntryPaths,
    packageEntryCount: packageIndex.packageEntryCount,
    p0IntakeTargetStatusLinkMissingSignalCount: packageIndex.p0IntakeTargetStatusLink.missingSignals.length,
    p0IntakeTargetStatusLinkStatus: packageIndex.p0IntakeTargetStatusLink.status,
    priorityCounts: missingEvidence.priorityCounts,
    readyForProductionRuntime: false,
    realSampleGapCount: packageIndex.realSampleGapCount,
    reportText: '',
    status: createStatus(packageIndex),
    summaryText: '',
    unprioritizedGapCount: missingEvidence.unprioritizedGapKinds.length,
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

function runAgentSessionV3PilotRealCorpusBatchPackageHealthRollupCli() {
  const args = process.argv.slice(2);
  const includeJsonText = args.includes('--json') || args.includes('--pretty');
  const prettyJson = args.includes('--pretty');
  const result = createAgentSessionV3PilotRealCorpusBatchPackageHealthRollup({
    includeJsonText,
    prettyJson,
  });
  console.log(result.reportText);
  if (result.jsonText) {
    console.log(result.jsonText);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAgentSessionV3PilotRealCorpusBatchPackageHealthRollupCli();
}
