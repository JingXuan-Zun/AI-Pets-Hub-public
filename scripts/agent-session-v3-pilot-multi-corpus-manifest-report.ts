import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  runAgentSessionV3PilotExternalSampleCorpusManifestLoader,
  type AgentSessionV3PilotExternalSampleCorpusManifestLoaderResult,
} from './agent-session-v3-pilot-external-sample-corpus-manifest-loader.ts';
import { type AgentSessionV3PilotPhaseCoverageReadinessCheckKey } from '../src/agent/legacy/index.ts';

type ManifestStatus = AgentSessionV3PilotExternalSampleCorpusManifestLoaderResult['status'];

export interface RunAgentSessionV3PilotMultiCorpusManifestReportOptions {
  includeJsonText?: boolean;
  manifestPaths: readonly string[];
  prettyJson?: boolean;
}

export interface AgentSessionV3PilotMultiCorpusManifestReportStatusCounts {
  empty: number;
  mixed: number;
  notReady: number;
  ready: number;
}

export interface AgentSessionV3PilotMultiCorpusManifestReportEntry {
  diagnosticsStatus: AgentSessionV3PilotExternalSampleCorpusManifestLoaderResult['diagnostics']['status'];
  manifestPath: string;
  phaseCoverageReadinessFailedCheckCount: number;
  phaseCoverageReadinessFailedCheckKeys: AgentSessionV3PilotPhaseCoverageReadinessCheckKey[];
  phaseCoverageReadinessStatus: AgentSessionV3PilotExternalSampleCorpusManifestLoaderResult['phaseCoverageReadiness']['status'];
  profileStatuses: string[];
  reportText: string | null;
  sourceCount: number;
  status: ManifestStatus;
  summaryText: string;
}

export interface AgentSessionV3PilotMultiCorpusManifestReportFailedCheckSummary {
  failedCount: number;
  key: string;
  manifestLabels: string[];
  maxActual: number;
  maxRequired: number | null;
}

export interface AgentSessionV3PilotMultiCorpusManifestReportProfileSummary {
  label: string;
  statusCounts: AgentSessionV3PilotMultiCorpusManifestReportStatusCounts;
}

export interface AgentSessionV3PilotMultiCorpusManifestReportPhaseCoverageReadinessSummary {
  failedCheckCount: number;
  failedCheckKeys: AgentSessionV3PilotPhaseCoverageReadinessCheckKey[];
  failedManifestCount: number;
  manifestLabels: string[];
  status: 'clean' | 'needs-review';
  summaryText: string;
}

export interface AgentSessionV3PilotMultiCorpusManifestReportResult {
  entries: AgentSessionV3PilotMultiCorpusManifestReportEntry[];
  failedCheckSummaries: AgentSessionV3PilotMultiCorpusManifestReportFailedCheckSummary[];
  jsonText: string | null;
  kind: 'agent-session-v3-pilot-multi-corpus-manifest-report';
  manifestCount: number;
  phaseCoverageReadiness: AgentSessionV3PilotMultiCorpusManifestReportPhaseCoverageReadinessSummary;
  profileSummaries: AgentSessionV3PilotMultiCorpusManifestReportProfileSummary[];
  reportText: string;
  statusCounts: AgentSessionV3PilotMultiCorpusManifestReportStatusCounts;
  summaryText: string;
  version: 1;
}

function parseAgentSessionV3PilotMultiCorpusManifestReportArgs(
  args: readonly string[],
): RunAgentSessionV3PilotMultiCorpusManifestReportOptions {
  let includeJsonText = false;
  const manifestPaths: string[] = [];
  let prettyJson = false;

  for (const arg of args) {
    if (arg === '--json') {
      includeJsonText = true;
    } else if (arg === '--pretty') {
      includeJsonText = true;
      prettyJson = true;
    } else {
      manifestPaths.push(arg);
    }
  }

  if (!manifestPaths.length) {
    throw new Error('Usage: npx tsx scripts/agent-session-v3-pilot-multi-corpus-manifest-report.ts <manifest.json> [...manifest.json] [--json] [--pretty]');
  }

  return {
    includeJsonText,
    manifestPaths,
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
  status: ManifestStatus,
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

function createAgentSessionV3PilotMultiCorpusManifestReportFailedCheckSummaries(
  loaders: readonly AgentSessionV3PilotExternalSampleCorpusManifestLoaderResult[],
): AgentSessionV3PilotMultiCorpusManifestReportFailedCheckSummary[] {
  const summaries = new Map<string, AgentSessionV3PilotMultiCorpusManifestReportFailedCheckSummary>();

  for (const loaded of loaders) {
    const manifestLabel = path.basename(loaded.manifestPath);
    for (const check of loaded.diagnostics.checkSummaries) {
      const existing = summaries.get(check.key);
      if (existing) {
        existing.failedCount += check.failedCount;
        existing.maxActual = Math.max(existing.maxActual, check.maxActual);
        existing.maxRequired = check.maxRequired === null
          ? existing.maxRequired
          : Math.max(existing.maxRequired ?? check.maxRequired, check.maxRequired);
        if (!existing.manifestLabels.includes(manifestLabel)) {
          existing.manifestLabels.push(manifestLabel);
        }
        continue;
      }

      summaries.set(check.key, {
        failedCount: check.failedCount,
        key: check.key,
        manifestLabels: [manifestLabel],
        maxActual: check.maxActual,
        maxRequired: check.maxRequired,
      });
    }
  }

  return [...summaries.values()].sort((left, right) => (
    right.failedCount - left.failedCount
      || left.key.localeCompare(right.key)
  ));
}

function createAgentSessionV3PilotMultiCorpusManifestReportProfileSummaries(
  loaders: readonly AgentSessionV3PilotExternalSampleCorpusManifestLoaderResult[],
): AgentSessionV3PilotMultiCorpusManifestReportProfileSummary[] {
  const summaries = new Map<string, AgentSessionV3PilotMultiCorpusManifestReportProfileSummary>();

  for (const loaded of loaders) {
    for (const profile of loaded.profileComparison.entries) {
      const existing = summaries.get(profile.label);
      if (existing) {
        incrementStatusCount(existing.statusCounts, profile.status);
        continue;
      }

      const statusCounts = createStatusCounts();
      incrementStatusCount(statusCounts, profile.status);
      summaries.set(profile.label, {
        label: profile.label,
        statusCounts,
      });
    }
  }

  return [...summaries.values()].sort((left, right) => left.label.localeCompare(right.label));
}

function createAgentSessionV3PilotMultiCorpusManifestReportPhaseCoverageReadinessSummary(
  loaders: readonly AgentSessionV3PilotExternalSampleCorpusManifestLoaderResult[],
): AgentSessionV3PilotMultiCorpusManifestReportPhaseCoverageReadinessSummary {
  let failedCheckCount = 0;
  const failedCheckKeys: AgentSessionV3PilotPhaseCoverageReadinessCheckKey[] = [];
  const manifestLabels: string[] = [];

  for (const loaded of loaders) {
    const phaseCoverageReadiness = loaded.phaseCoverageReadiness;
    if (phaseCoverageReadiness.status === 'clean') {
      continue;
    }

    const manifestLabel = path.basename(loaded.manifestPath);
    if (!manifestLabels.includes(manifestLabel)) {
      manifestLabels.push(manifestLabel);
    }

    failedCheckCount += phaseCoverageReadiness.failedCheckCount;
    for (const check of phaseCoverageReadiness.checkSummaries) {
      if (!failedCheckKeys.includes(check.key)) {
        failedCheckKeys.push(check.key);
      }
    }
  }

  const status = manifestLabels.length ? 'needs-review' : 'clean';
  return {
    failedCheckCount,
    failedCheckKeys,
    failedManifestCount: manifestLabels.length,
    manifestLabels,
    status,
    summaryText: [
      `phaseCoverageReadiness status=${status}`,
      `failedManifests=${manifestLabels.length}`,
      `failedChecks=${failedCheckCount}`,
      `checks=${failedCheckKeys.join(',') || 'none'}`,
      `manifests=${manifestLabels.join(',') || 'none'}`,
    ].join(' '),
  };
}

function createAgentSessionV3PilotMultiCorpusManifestReportSummaryText(options: {
  manifestCount: number;
  statusCounts: AgentSessionV3PilotMultiCorpusManifestReportStatusCounts;
}) {
  return [
    'AgentSessionV3PilotMultiCorpusManifestReport',
    `manifests=${options.manifestCount}`,
    `ready=${options.statusCounts.ready}`,
    `mixed=${options.statusCounts.mixed}`,
    `notReady=${options.statusCounts.notReady}`,
    `empty=${options.statusCounts.empty}`,
  ].join(' ');
}

function createAgentSessionV3PilotMultiCorpusManifestReportText(options: {
  failedCheckSummaries: readonly AgentSessionV3PilotMultiCorpusManifestReportFailedCheckSummary[];
  phaseCoverageReadiness: AgentSessionV3PilotMultiCorpusManifestReportPhaseCoverageReadinessSummary;
  profileSummaries: readonly AgentSessionV3PilotMultiCorpusManifestReportProfileSummary[];
  summaryText: string;
}) {
  const lines = [options.summaryText];

  lines.push(options.phaseCoverageReadiness.summaryText);

  lines.push(
    options.failedCheckSummaries.length ? 'failedChecks:' : 'failedChecks: none',
    ...options.failedCheckSummaries.map((check) => [
      `- failedCheck=${check.key}`,
      `count=${check.failedCount}`,
      `maxActual=${check.maxActual}`,
      `maxRequired=${check.maxRequired ?? 'none'}`,
      `manifests=${check.manifestLabels.join(',')}`,
    ].join(' ')),
  );

  lines.push(
    options.profileSummaries.length ? 'profiles:' : 'profiles: none',
    ...options.profileSummaries.map((profile) => [
      `- profile=${profile.label}`,
      `ready=${profile.statusCounts.ready}`,
      `mixed=${profile.statusCounts.mixed}`,
      `notReady=${profile.statusCounts.notReady}`,
      `empty=${profile.statusCounts.empty}`,
    ].join(' ')),
  );

  return lines.join('\n');
}

function createAgentSessionV3PilotMultiCorpusManifestReportJsonText(
  result: AgentSessionV3PilotMultiCorpusManifestReportResult,
  options: { prettyJson?: boolean } = {},
) {
  return JSON.stringify(result, null, options.prettyJson ? 2 : 0);
}

export async function runAgentSessionV3PilotMultiCorpusManifestReport(
  options: RunAgentSessionV3PilotMultiCorpusManifestReportOptions,
): Promise<AgentSessionV3PilotMultiCorpusManifestReportResult> {
  const loaders = await Promise.all(options.manifestPaths.map((manifestPath) => (
    runAgentSessionV3PilotExternalSampleCorpusManifestLoader({
      includeReportText: true,
      manifestPath,
      prettyJson: options.prettyJson,
    })
  )));
  const statusCounts = createStatusCounts();
  for (const loaded of loaders) {
    incrementStatusCount(statusCounts, loaded.status);
  }

  const failedCheckSummaries = createAgentSessionV3PilotMultiCorpusManifestReportFailedCheckSummaries(loaders);
  const phaseCoverageReadiness = createAgentSessionV3PilotMultiCorpusManifestReportPhaseCoverageReadinessSummary(
    loaders,
  );
  const profileSummaries = createAgentSessionV3PilotMultiCorpusManifestReportProfileSummaries(loaders);
  const summaryText = createAgentSessionV3PilotMultiCorpusManifestReportSummaryText({
    manifestCount: loaders.length,
    statusCounts,
  });
  const reportText = createAgentSessionV3PilotMultiCorpusManifestReportText({
    failedCheckSummaries,
    phaseCoverageReadiness,
    profileSummaries,
    summaryText,
  });
  const resultWithoutJson: AgentSessionV3PilotMultiCorpusManifestReportResult = {
    entries: loaders.map((loaded) => ({
      diagnosticsStatus: loaded.diagnostics.status,
      manifestPath: loaded.manifestPath,
      phaseCoverageReadinessFailedCheckCount: loaded.phaseCoverageReadiness.failedCheckCount,
      phaseCoverageReadinessFailedCheckKeys: loaded.phaseCoverageReadiness.checkSummaries.map((check) => check.key),
      phaseCoverageReadinessStatus: loaded.phaseCoverageReadiness.status,
      profileStatuses: loaded.profileComparison.entries.map((entry) => `${entry.label}:${entry.status}`),
      reportText: loaded.reportText,
      sourceCount: loaded.sourceCount,
      status: loaded.status,
      summaryText: loaded.summaryText,
    })),
    failedCheckSummaries,
    jsonText: null,
    kind: 'agent-session-v3-pilot-multi-corpus-manifest-report',
    manifestCount: loaders.length,
    phaseCoverageReadiness,
    profileSummaries,
    reportText,
    statusCounts,
    summaryText,
    version: 1,
  };

  return {
    ...resultWithoutJson,
    jsonText: options.includeJsonText
      ? createAgentSessionV3PilotMultiCorpusManifestReportJsonText(resultWithoutJson, {
        prettyJson: options.prettyJson,
      })
      : null,
  };
}

async function runAgentSessionV3PilotMultiCorpusManifestReportCli() {
  const options = parseAgentSessionV3PilotMultiCorpusManifestReportArgs(process.argv.slice(2));
  const result = await runAgentSessionV3PilotMultiCorpusManifestReport(options);
  console.log(result.reportText);
  if (result.jsonText) {
    console.log(result.jsonText);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAgentSessionV3PilotMultiCorpusManifestReportCli().catch((error: unknown) => {
    const errorText = error instanceof Error ? error.message : String(error);
    console.error(errorText);
    process.exitCode = 1;
  });
}
