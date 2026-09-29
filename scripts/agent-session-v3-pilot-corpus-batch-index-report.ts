import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  runAgentSessionV3PilotMultiCorpusManifestReport,
  type AgentSessionV3PilotMultiCorpusManifestReportEntry,
  type AgentSessionV3PilotMultiCorpusManifestReportPhaseCoverageReadinessSummary,
  type AgentSessionV3PilotMultiCorpusManifestReportResult,
  type AgentSessionV3PilotMultiCorpusManifestReportStatusCounts,
} from './agent-session-v3-pilot-multi-corpus-manifest-report.ts';
import { type AgentSessionV3PilotPhaseCoverageReadinessCheckKey } from '../src/agent/legacy/index.ts';

export type AgentSessionV3PilotCorpusBatchIndexSourceKind =
  | 'baseline'
  | 'manual'
  | 'production-like'
  | 'synthetic'
  | 'unknown';

export interface AgentSessionV3PilotCorpusBatchIndexEntry {
  generatedAt?: string | null;
  label?: string | null;
  manifestPath: string;
  notes?: string | null;
  sourceKind?: AgentSessionV3PilotCorpusBatchIndexSourceKind | string | null;
}

export interface AgentSessionV3PilotCorpusBatchIndex {
  batches?: readonly AgentSessionV3PilotCorpusBatchIndexEntry[] | null;
  version?: 1;
}

export interface RunAgentSessionV3PilotCorpusBatchIndexReportOptions {
  includeJsonText?: boolean;
  indexPath: string;
  prettyJson?: boolean;
}

export interface AgentSessionV3PilotCorpusBatchIndexReportEntry {
  diagnosticsStatus: AgentSessionV3PilotMultiCorpusManifestReportEntry['diagnosticsStatus'];
  generatedAt: string | null;
  label: string;
  manifestPath: string;
  notes: string | null;
  phaseCoverageReadinessFailedCheckCount: number;
  phaseCoverageReadinessFailedCheckKeys: AgentSessionV3PilotPhaseCoverageReadinessCheckKey[];
  phaseCoverageReadinessStatus: AgentSessionV3PilotMultiCorpusManifestReportEntry['phaseCoverageReadinessStatus'];
  sourceCount: number;
  sourceKind: string;
  status: AgentSessionV3PilotMultiCorpusManifestReportEntry['status'];
}

export interface AgentSessionV3PilotCorpusBatchIndexPhaseCoverageReadinessStatusCounts {
  clean: number;
  needsReview: number;
}

export interface AgentSessionV3PilotCorpusBatchIndexSourceKindSummary {
  manifestCount: number;
  phaseCoverageFailedCheckCount: number;
  phaseCoverageFailedCheckKeys: AgentSessionV3PilotPhaseCoverageReadinessCheckKey[];
  phaseCoverageManifestLabels: string[];
  phaseCoverageReadinessCounts: AgentSessionV3PilotCorpusBatchIndexPhaseCoverageReadinessStatusCounts;
  sourceKind: string;
  statusCounts: AgentSessionV3PilotMultiCorpusManifestReportStatusCounts;
}

export interface AgentSessionV3PilotCorpusBatchIndexReportResult {
  entries: AgentSessionV3PilotCorpusBatchIndexReportEntry[];
  indexPath: string;
  jsonText: string | null;
  kind: 'agent-session-v3-pilot-corpus-batch-index-report';
  manifestCount: number;
  multiReport: AgentSessionV3PilotMultiCorpusManifestReportResult;
  phaseCoverageCalibration: AgentSessionV3PilotMultiCorpusManifestReportPhaseCoverageReadinessSummary;
  reportText: string;
  sourceKindSummaries: AgentSessionV3PilotCorpusBatchIndexSourceKindSummary[];
  summaryText: string;
  version: 1;
}

function parseAgentSessionV3PilotCorpusBatchIndexReportArgs(
  args: readonly string[],
): RunAgentSessionV3PilotCorpusBatchIndexReportOptions {
  let includeJsonText = false;
  let indexPath: string | null = null;
  let prettyJson = false;

  for (const arg of args) {
    if (arg === '--json') {
      includeJsonText = true;
    } else if (arg === '--pretty') {
      includeJsonText = true;
      prettyJson = true;
    } else if (!indexPath) {
      indexPath = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  if (!indexPath) {
    throw new Error('Usage: npx tsx scripts/agent-session-v3-pilot-corpus-batch-index-report.ts <corpus-batch-index.json> [--json] [--pretty]');
  }

  return {
    includeJsonText,
    indexPath,
    prettyJson,
  };
}

function createStatusCounts(): AgentSessionV3PilotMultiCorpusManifestReportStatusCounts {
  return {
    empty: 0,
    mixed: 0,
    notReady: 0,
    ready: 0,
  };
}

function incrementStatusCount(
  counts: AgentSessionV3PilotMultiCorpusManifestReportStatusCounts,
  status: AgentSessionV3PilotMultiCorpusManifestReportEntry['status'],
) {
  if (status === 'ready') {
    counts.ready += 1;
  } else if (status === 'mixed') {
    counts.mixed += 1;
  } else if (status === 'not-ready') {
    counts.notReady += 1;
  } else {
    counts.empty += 1;
  }
}

function createPhaseCoverageReadinessStatusCounts(): AgentSessionV3PilotCorpusBatchIndexPhaseCoverageReadinessStatusCounts {
  return {
    clean: 0,
    needsReview: 0,
  };
}

function incrementPhaseCoverageReadinessStatusCount(
  counts: AgentSessionV3PilotCorpusBatchIndexPhaseCoverageReadinessStatusCounts,
  status: AgentSessionV3PilotCorpusBatchIndexReportEntry['phaseCoverageReadinessStatus'],
) {
  if (status === 'needs-review') {
    counts.needsReview += 1;
    return;
  }

  counts.clean += 1;
}

function normalizeSourceKind(sourceKind: AgentSessionV3PilotCorpusBatchIndexEntry['sourceKind']) {
  return typeof sourceKind === 'string' && sourceKind.trim()
    ? sourceKind.trim()
    : 'unknown';
}

function normalizeLabel(entry: AgentSessionV3PilotCorpusBatchIndexEntry, manifestPath: string) {
  return typeof entry.label === 'string' && entry.label.trim()
    ? entry.label.trim()
    : path.basename(manifestPath);
}

async function readAgentSessionV3PilotCorpusBatchIndex(
  indexPath: string,
): Promise<AgentSessionV3PilotCorpusBatchIndex> {
  return JSON.parse(await readFile(indexPath, 'utf8')) as AgentSessionV3PilotCorpusBatchIndex;
}

function createAgentSessionV3PilotCorpusBatchIndexSourceKindSummaries(
  entries: readonly AgentSessionV3PilotCorpusBatchIndexReportEntry[],
): AgentSessionV3PilotCorpusBatchIndexSourceKindSummary[] {
  const summaries = new Map<string, AgentSessionV3PilotCorpusBatchIndexSourceKindSummary>();

  for (const entry of entries) {
    const existing = summaries.get(entry.sourceKind);
    if (existing) {
      existing.manifestCount += 1;
      incrementStatusCount(existing.statusCounts, entry.status);
      incrementPhaseCoverageReadinessStatusCount(
        existing.phaseCoverageReadinessCounts,
        entry.phaseCoverageReadinessStatus,
      );
      existing.phaseCoverageFailedCheckCount += entry.phaseCoverageReadinessFailedCheckCount;
      for (const key of entry.phaseCoverageReadinessFailedCheckKeys) {
        if (!existing.phaseCoverageFailedCheckKeys.includes(key)) {
          existing.phaseCoverageFailedCheckKeys.push(key);
        }
      }
      if (
        entry.phaseCoverageReadinessStatus === 'needs-review'
        && !existing.phaseCoverageManifestLabels.includes(entry.label)
      ) {
        existing.phaseCoverageManifestLabels.push(entry.label);
      }
      continue;
    }

    const statusCounts = createStatusCounts();
    const phaseCoverageReadinessCounts = createPhaseCoverageReadinessStatusCounts();
    incrementStatusCount(statusCounts, entry.status);
    incrementPhaseCoverageReadinessStatusCount(
      phaseCoverageReadinessCounts,
      entry.phaseCoverageReadinessStatus,
    );
    summaries.set(entry.sourceKind, {
      manifestCount: 1,
      phaseCoverageFailedCheckCount: entry.phaseCoverageReadinessFailedCheckCount,
      phaseCoverageFailedCheckKeys: [...entry.phaseCoverageReadinessFailedCheckKeys],
      phaseCoverageManifestLabels: entry.phaseCoverageReadinessStatus === 'needs-review'
        ? [entry.label]
        : [],
      phaseCoverageReadinessCounts,
      sourceKind: entry.sourceKind,
      statusCounts,
    });
  }

  return [...summaries.values()].sort((left, right) => left.sourceKind.localeCompare(right.sourceKind));
}

function createAgentSessionV3PilotCorpusBatchIndexReportSummaryText(options: {
  manifestCount: number;
  multiReport: AgentSessionV3PilotMultiCorpusManifestReportResult;
  phaseCoverageCalibration: AgentSessionV3PilotMultiCorpusManifestReportPhaseCoverageReadinessSummary;
  sourceKindSummaries: readonly AgentSessionV3PilotCorpusBatchIndexSourceKindSummary[];
}) {
  return [
    'AgentSessionV3PilotCorpusBatchIndexReport',
    `manifests=${options.manifestCount}`,
    `sourceKinds=${options.sourceKindSummaries.length}`,
    `ready=${options.multiReport.statusCounts.ready}`,
    `mixed=${options.multiReport.statusCounts.mixed}`,
    `notReady=${options.multiReport.statusCounts.notReady}`,
    `empty=${options.multiReport.statusCounts.empty}`,
    `phaseCoverage=${options.phaseCoverageCalibration.status}`,
    `phaseCoverageFailedManifests=${options.phaseCoverageCalibration.failedManifestCount}`,
  ].join(' ');
}

function createAgentSessionV3PilotCorpusBatchIndexReportText(options: {
  multiReport: AgentSessionV3PilotMultiCorpusManifestReportResult;
  phaseCoverageCalibration: AgentSessionV3PilotMultiCorpusManifestReportPhaseCoverageReadinessSummary;
  sourceKindSummaries: readonly AgentSessionV3PilotCorpusBatchIndexSourceKindSummary[];
  summaryText: string;
}) {
  const sourceKindLines = options.sourceKindSummaries.map((summary) => [
    `- sourceKind=${summary.sourceKind}`,
    `manifests=${summary.manifestCount}`,
    `ready=${summary.statusCounts.ready}`,
    `mixed=${summary.statusCounts.mixed}`,
    `notReady=${summary.statusCounts.notReady}`,
    `empty=${summary.statusCounts.empty}`,
    `phaseCoverageClean=${summary.phaseCoverageReadinessCounts.clean}`,
    `phaseCoverageNeedsReview=${summary.phaseCoverageReadinessCounts.needsReview}`,
    `phaseCoverageFailedChecks=${summary.phaseCoverageFailedCheckCount}`,
    `phaseCoverageChecks=${summary.phaseCoverageFailedCheckKeys.join(',') || 'none'}`,
  ].join(' '));

  return [
    options.summaryText,
    options.phaseCoverageCalibration.summaryText,
    sourceKindLines.length ? 'sourceKinds:' : 'sourceKinds: none',
    ...sourceKindLines,
    options.multiReport.reportText,
  ].join('\n');
}

function createAgentSessionV3PilotCorpusBatchIndexReportJsonText(
  result: AgentSessionV3PilotCorpusBatchIndexReportResult,
  options: { prettyJson?: boolean } = {},
) {
  return JSON.stringify(result, null, options.prettyJson ? 2 : 0);
}

export async function runAgentSessionV3PilotCorpusBatchIndexReport(
  options: RunAgentSessionV3PilotCorpusBatchIndexReportOptions,
): Promise<AgentSessionV3PilotCorpusBatchIndexReportResult> {
  const index = await readAgentSessionV3PilotCorpusBatchIndex(options.indexPath);
  const indexDir = path.dirname(options.indexPath);
  const indexEntries = index.batches ?? [];
  const resolvedEntries = indexEntries.map((entry) => ({
    ...entry,
    manifestPath: path.resolve(indexDir, entry.manifestPath),
  }));
  const multiReport = await runAgentSessionV3PilotMultiCorpusManifestReport({
    manifestPaths: resolvedEntries.map((entry) => entry.manifestPath),
    prettyJson: options.prettyJson,
  });
  const entries = resolvedEntries.map((entry, indexEntry) => {
    const reportEntry = multiReport.entries[indexEntry];
    if (!reportEntry) {
      throw new Error(`Missing multi-manifest report entry for index entry ${indexEntry}.`);
    }

    return {
      diagnosticsStatus: reportEntry.diagnosticsStatus,
      generatedAt: entry.generatedAt ?? null,
      label: normalizeLabel(entry, reportEntry.manifestPath),
      manifestPath: reportEntry.manifestPath,
      notes: entry.notes ?? null,
      phaseCoverageReadinessFailedCheckCount: reportEntry.phaseCoverageReadinessFailedCheckCount,
      phaseCoverageReadinessFailedCheckKeys: reportEntry.phaseCoverageReadinessFailedCheckKeys,
      phaseCoverageReadinessStatus: reportEntry.phaseCoverageReadinessStatus,
      sourceCount: reportEntry.sourceCount,
      sourceKind: normalizeSourceKind(entry.sourceKind),
      status: reportEntry.status,
    };
  });
  const sourceKindSummaries = createAgentSessionV3PilotCorpusBatchIndexSourceKindSummaries(entries);
  const resultWithoutJson: AgentSessionV3PilotCorpusBatchIndexReportResult = {
    entries,
    indexPath: options.indexPath,
    jsonText: null,
    kind: 'agent-session-v3-pilot-corpus-batch-index-report',
    manifestCount: entries.length,
    multiReport,
    phaseCoverageCalibration: multiReport.phaseCoverageReadiness,
    reportText: '',
    sourceKindSummaries,
    summaryText: '',
    version: 1,
  };
  const summaryText = createAgentSessionV3PilotCorpusBatchIndexReportSummaryText({
    manifestCount: entries.length,
    multiReport,
    phaseCoverageCalibration: multiReport.phaseCoverageReadiness,
    sourceKindSummaries,
  });
  const resultWithReport = {
    ...resultWithoutJson,
    reportText: createAgentSessionV3PilotCorpusBatchIndexReportText({
      multiReport,
      phaseCoverageCalibration: multiReport.phaseCoverageReadiness,
      sourceKindSummaries,
      summaryText,
    }),
    summaryText,
  };

  return {
    ...resultWithReport,
    jsonText: options.includeJsonText
      ? createAgentSessionV3PilotCorpusBatchIndexReportJsonText(resultWithReport, {
        prettyJson: options.prettyJson,
      })
      : null,
  };
}

async function runAgentSessionV3PilotCorpusBatchIndexReportCli() {
  const options = parseAgentSessionV3PilotCorpusBatchIndexReportArgs(process.argv.slice(2));
  const result = await runAgentSessionV3PilotCorpusBatchIndexReport(options);
  console.log(result.reportText);
  if (result.jsonText) {
    console.log(result.jsonText);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAgentSessionV3PilotCorpusBatchIndexReportCli().catch((error: unknown) => {
    const errorText = error instanceof Error ? error.message : String(error);
    console.error(errorText);
    process.exitCode = 1;
  });
}
