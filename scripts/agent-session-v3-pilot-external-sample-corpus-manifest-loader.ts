import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  createAgentSessionV3PilotExternalSampleFixtureBatch,
  createAgentSessionV3PilotExternalSampleFixtureSetExport,
  createAgentSessionV3PilotPhaseCoverageReadinessSummary,
  createAgentSessionV3PilotReadinessFailureDiagnostics,
  createAgentSessionV3PilotReadinessThresholdProfileComparison,
  stringifyAgentSessionV3PilotExternalSampleFixtureSet,
  type AgentSessionV3PilotCorpusReadinessThresholds,
  type AgentSessionV3PilotDebugSampleCorpusExport,
  type AgentSessionV3PilotDebugSampleCorpusExportOptions,
  type AgentSessionV3PilotExternalSampleFixtureBatchResult,
  type AgentSessionV3PilotExternalSampleFixtureSetExportResult,
  type AgentSessionV3PilotPhaseCoverageReadinessSummary,
  type AgentSessionV3PilotReadinessFailureDiagnosticsResult,
  type AgentSessionV3PilotReadinessThresholdProfile,
  type AgentSessionV3PilotReadinessThresholdProfileComparisonResult,
} from '../src/agent/legacy/index.ts';

export interface AgentSessionV3PilotExternalSampleCorpusManifestSource {
  label?: string | null;
  path: string;
  thresholds?: AgentSessionV3PilotCorpusReadinessThresholds;
}

export interface AgentSessionV3PilotExternalSampleCorpusManifest {
  corpusOptions?: AgentSessionV3PilotDebugSampleCorpusExportOptions;
  sources?: readonly AgentSessionV3PilotExternalSampleCorpusManifestSource[] | null;
  thresholdProfiles?: readonly AgentSessionV3PilotReadinessThresholdProfile[] | null;
  thresholds?: AgentSessionV3PilotCorpusReadinessThresholds;
  useBatchThresholdOverrides?: boolean;
}

export interface RunAgentSessionV3PilotExternalSampleCorpusManifestLoaderOptions {
  fixtureOutPath?: string | null;
  includeJsonText?: boolean;
  includeReportText?: boolean;
  manifestPath: string;
  prettyJson?: boolean;
}

export interface AgentSessionV3PilotExternalSampleCorpusManifestLoaderResult {
  diagnostics: AgentSessionV3PilotReadinessFailureDiagnosticsResult;
  fixtureBatch: AgentSessionV3PilotExternalSampleFixtureBatchResult;
  fixtureExport: AgentSessionV3PilotExternalSampleFixtureSetExportResult;
  fixturePath: string | null;
  jsonText: string | null;
  kind: 'agent-session-v3-pilot-external-sample-corpus-manifest-loader';
  manifestPath: string;
  phaseCoverageReadiness: AgentSessionV3PilotPhaseCoverageReadinessSummary;
  profileComparison: AgentSessionV3PilotReadinessThresholdProfileComparisonResult;
  reportText: string | null;
  sourceCount: number;
  status: AgentSessionV3PilotExternalSampleFixtureBatchResult['status'];
  summaryText: string;
  version: 1;
}

function parseAgentSessionV3PilotExternalSampleCorpusManifestLoaderArgs(
  args: readonly string[],
): RunAgentSessionV3PilotExternalSampleCorpusManifestLoaderOptions {
  let fixtureOutPath: string | null = null;
  let includeJsonText = false;
  let includeReportText = false;
  let manifestPath: string | null = null;
  let prettyJson = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--json') {
      includeJsonText = true;
    } else if (arg === '--pretty') {
      includeJsonText = true;
      prettyJson = true;
    } else if (arg === '--report') {
      includeReportText = true;
    } else if (arg === '--out-fixture') {
      const nextArg = args[index + 1];
      if (!nextArg) {
        throw new Error('Missing fixture output path after --out-fixture.');
      }
      fixtureOutPath = nextArg;
      index += 1;
    } else if (!manifestPath) {
      manifestPath = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  if (!manifestPath) {
    throw new Error('Usage: npx tsx scripts/agent-session-v3-pilot-external-sample-corpus-manifest-loader.ts <manifest.json> [--out-fixture fixture.json] [--report] [--json] [--pretty]');
  }

  return {
    fixtureOutPath,
    includeJsonText,
    includeReportText,
    manifestPath,
    prettyJson,
  };
}

function createAgentSessionV3PilotExternalSampleCorpusManifestLoaderSummaryText(options: {
  fixtureBatch: AgentSessionV3PilotExternalSampleFixtureBatchResult;
  fixtureExport: AgentSessionV3PilotExternalSampleFixtureSetExportResult;
  profileComparison: AgentSessionV3PilotReadinessThresholdProfileComparisonResult;
  sourceCount: number;
}) {
  return [
    `AgentSessionV3PilotExternalSampleCorpusManifestLoader status=${options.fixtureBatch.status}`,
    `sources=${options.sourceCount}`,
    `batches=${options.fixtureExport.batchCount}`,
    `exportIssues=${options.fixtureExport.issueCount}`,
    `intakeIssues=${options.fixtureBatch.issueCount}`,
    `ready=${options.fixtureBatch.calibration.counts.ready}`,
    `mixed=${options.fixtureBatch.calibration.counts.mixed}`,
    `notReady=${options.fixtureBatch.calibration.counts.notReady}`,
    `empty=${options.fixtureBatch.calibration.counts.empty}`,
    `profiles=${options.profileComparison.profileCount}`,
  ].join(' ');
}

function createAgentSessionV3PilotExternalSampleCorpusManifestLoaderReportText(options: {
  diagnostics: AgentSessionV3PilotReadinessFailureDiagnosticsResult;
  fixtureBatch: AgentSessionV3PilotExternalSampleFixtureBatchResult;
  fixtureExport: AgentSessionV3PilotExternalSampleFixtureSetExportResult;
  phaseCoverageReadiness: AgentSessionV3PilotPhaseCoverageReadinessSummary;
  profileComparison: AgentSessionV3PilotReadinessThresholdProfileComparisonResult;
  sourceCount: number;
}) {
  const lines = [
    'AgentSessionV3PilotExternalSampleCorpusManifestReport',
    `status=${options.fixtureBatch.status}`,
    `sources=${options.sourceCount}`,
    `batches=${options.fixtureExport.batchCount}`,
    `exportIssues=${options.fixtureExport.issueCount}`,
    `intakeIssues=${options.fixtureBatch.issueCount}`,
    [
      'calibration',
      `ready=${options.fixtureBatch.calibration.counts.ready}`,
      `mixed=${options.fixtureBatch.calibration.counts.mixed}`,
      `notReady=${options.fixtureBatch.calibration.counts.notReady}`,
      `empty=${options.fixtureBatch.calibration.counts.empty}`,
    ].join(' '),
    [
      'diagnostics',
      `status=${options.diagnostics.status}`,
      `failedEntries=${options.diagnostics.failedEntryCount}`,
      `failedChecks=${options.diagnostics.failedCheckCount}`,
    ].join(' '),
    [
      'phaseCoverageReadiness',
      `status=${options.phaseCoverageReadiness.status}`,
      `failedChecks=${options.phaseCoverageReadiness.failedCheckCount}`,
      `checks=${options.phaseCoverageReadiness.checkSummaries.map((check) => check.key).join(',') || 'none'}`,
      `affectedSamples=${options.phaseCoverageReadiness.affectedSampleLabels.map((label) => label ?? 'unknown').join(',') || 'none'}`,
    ].join(' '),
  ];

  const checkLines = options.diagnostics.checkSummaries.map((check) => [
    `failedCheck=${check.key}`,
    `count=${check.failedCount}`,
    `maxActual=${check.maxActual}`,
    `maxRequired=${check.maxRequired ?? 'none'}`,
    `labels=${check.sampleLabels.map((label) => label ?? 'unknown').join(',') || 'none'}`,
  ].join(' '));

  lines.push(
    checkLines.length ? 'failedChecks:' : 'failedChecks: none',
    ...checkLines.map((line) => `- ${line}`),
  );

  const profileLines = options.profileComparison.entries.map((entry) => {
    const topCheck = entry.diagnostics.checkSummaries[0];
    const phaseCoverageReadiness = createAgentSessionV3PilotPhaseCoverageReadinessSummary({
      diagnostics: entry.diagnostics,
    });
    return [
      `profile=${entry.label}`,
      `status=${entry.status}`,
      `failedEntries=${entry.diagnostics.failedEntryCount}`,
      `top=${topCheck ? `${topCheck.key}:${topCheck.failedCount}` : 'none'}`,
      `phaseCoverage=${phaseCoverageReadiness.status}`,
    ].join(' ');
  });

  lines.push(
    profileLines.length ? 'profiles:' : 'profiles: none',
    ...profileLines.map((line) => `- ${line}`),
  );

  return lines.join('\n');
}

async function readAgentSessionV3PilotExternalSampleCorpusManifest(
  manifestPath: string,
): Promise<AgentSessionV3PilotExternalSampleCorpusManifest> {
  return JSON.parse(
    await readFile(manifestPath, 'utf8'),
  ) as AgentSessionV3PilotExternalSampleCorpusManifest;
}

async function readAgentSessionV3PilotExternalSampleCorpusManifestSource(options: {
  manifestDir: string;
  source: AgentSessionV3PilotExternalSampleCorpusManifestSource;
}) {
  const corpusPath = path.resolve(options.manifestDir, options.source.path);
  const corpusText = await readFile(corpusPath, 'utf8');
  return {
    corpus: JSON.parse(corpusText) as AgentSessionV3PilotDebugSampleCorpusExport,
    label: options.source.label ?? path.basename(options.source.path),
    thresholds: options.source.thresholds,
  };
}

function createAgentSessionV3PilotExternalSampleCorpusManifestLoaderJsonText(
  result: AgentSessionV3PilotExternalSampleCorpusManifestLoaderResult,
  options: { prettyJson?: boolean } = {},
) {
  return JSON.stringify(result, null, options.prettyJson ? 2 : 0);
}

export async function runAgentSessionV3PilotExternalSampleCorpusManifestLoader(
  options: RunAgentSessionV3PilotExternalSampleCorpusManifestLoaderOptions,
): Promise<AgentSessionV3PilotExternalSampleCorpusManifestLoaderResult> {
  const manifest = await readAgentSessionV3PilotExternalSampleCorpusManifest(options.manifestPath);
  const manifestDir = path.dirname(options.manifestPath);
  const sources = await Promise.all((manifest.sources ?? []).map((source) => (
    readAgentSessionV3PilotExternalSampleCorpusManifestSource({
      manifestDir,
      source,
    })
  )));
  const fixtureExport = createAgentSessionV3PilotExternalSampleFixtureSetExport({
    corpusOptions: manifest.corpusOptions,
    sources,
    thresholds: manifest.thresholds,
  });
  const fixtureBatch = createAgentSessionV3PilotExternalSampleFixtureBatch(fixtureExport.fixtureSet);
  const diagnostics = createAgentSessionV3PilotReadinessFailureDiagnostics({
    calibration: fixtureBatch.calibration,
  });
  const phaseCoverageReadiness = createAgentSessionV3PilotPhaseCoverageReadinessSummary({
    diagnostics,
  });
  const profileComparison = createAgentSessionV3PilotReadinessThresholdProfileComparison({
    fixtureBatch,
    profiles: manifest.thresholdProfiles,
    useBatchThresholdOverrides: manifest.useBatchThresholdOverrides,
  });
  const summaryText = createAgentSessionV3PilotExternalSampleCorpusManifestLoaderSummaryText({
    fixtureBatch,
    fixtureExport,
    profileComparison,
    sourceCount: manifest.sources?.length ?? 0,
  });
  const reportText = options.includeReportText
    ? createAgentSessionV3PilotExternalSampleCorpusManifestLoaderReportText({
      diagnostics,
      fixtureBatch,
      fixtureExport,
      phaseCoverageReadiness,
      profileComparison,
      sourceCount: manifest.sources?.length ?? 0,
    })
    : null;
  const resultWithoutJson: AgentSessionV3PilotExternalSampleCorpusManifestLoaderResult = {
    diagnostics,
    fixtureBatch,
    fixtureExport,
    fixturePath: options.fixtureOutPath ?? null,
    jsonText: null,
    kind: 'agent-session-v3-pilot-external-sample-corpus-manifest-loader',
    manifestPath: options.manifestPath,
    phaseCoverageReadiness,
    profileComparison,
    reportText,
    sourceCount: manifest.sources?.length ?? 0,
    status: fixtureBatch.status,
    summaryText,
    version: 1,
  };
  const jsonText = options.includeJsonText
    ? createAgentSessionV3PilotExternalSampleCorpusManifestLoaderJsonText(resultWithoutJson, {
      prettyJson: options.prettyJson,
    })
    : null;

  if (options.fixtureOutPath) {
    await writeFile(
      options.fixtureOutPath,
      stringifyAgentSessionV3PilotExternalSampleFixtureSet(fixtureExport.fixtureSet, {
        pretty: options.prettyJson,
      }),
      'utf8',
    );
  }

  return {
    ...resultWithoutJson,
    jsonText,
  };
}

async function runAgentSessionV3PilotExternalSampleCorpusManifestLoaderCli() {
  const options = parseAgentSessionV3PilotExternalSampleCorpusManifestLoaderArgs(process.argv.slice(2));
  const loaded = await runAgentSessionV3PilotExternalSampleCorpusManifestLoader(options);
  console.log(loaded.summaryText);
  if (loaded.fixturePath) {
    console.log(`fixturePath=${loaded.fixturePath}`);
  }
  if (loaded.reportText) {
    console.log(loaded.reportText);
  }
  if (loaded.jsonText) {
    console.log(loaded.jsonText);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAgentSessionV3PilotExternalSampleCorpusManifestLoaderCli().catch((error: unknown) => {
    const errorText = error instanceof Error ? error.message : String(error);
    console.error(errorText);
    process.exitCode = 1;
  });
}
