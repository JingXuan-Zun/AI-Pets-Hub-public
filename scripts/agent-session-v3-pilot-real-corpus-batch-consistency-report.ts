import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  type AgentSessionV3PilotCorpusBatchIndex,
} from './agent-session-v3-pilot-corpus-batch-index-report.ts';
import {
  type AgentSessionV3PilotExternalSampleCorpusManifest,
} from './agent-session-v3-pilot-external-sample-corpus-manifest-loader.ts';

export type AgentSessionV3PilotRealCorpusBatchConsistencyStatus =
  | 'consistent'
  | 'issues'
  | 'missing';

export type AgentSessionV3PilotRealCorpusBatchConsistencyIssueCode =
  | 'baseline-points-to-real-manifest'
  | 'duplicate-manifest-path'
  | 'invalid-json'
  | 'missing-baseline-entry'
  | 'missing-real-manifest-entry'
  | 'missing-required-file';

export type AgentSessionV3PilotRealCorpusBatchConsistencyIssueScope =
  | 'index'
  | 'index-batch'
  | 'manifest';

export interface AgentSessionV3PilotRealCorpusBatchConsistencyIssue {
  code: AgentSessionV3PilotRealCorpusBatchConsistencyIssueCode;
  label: string;
  manifestPath: string | null;
  message: string;
  scope: AgentSessionV3PilotRealCorpusBatchConsistencyIssueScope;
}

export interface AgentSessionV3PilotRealCorpusBatchConsistencySourceKindSummary {
  count: number;
  sourceKind: string;
}

export interface RunAgentSessionV3PilotRealCorpusBatchConsistencyReportOptions {
  includeJsonText?: boolean;
  intakeDir: string;
  prettyJson?: boolean;
}

export interface AgentSessionV3PilotRealCorpusBatchConsistencyReportResult {
  baselineEntryPresent: boolean;
  currentManifestReferenced: boolean;
  indexBatchCount: number;
  intakeDir: string;
  issueCount: number;
  issues: AgentSessionV3PilotRealCorpusBatchConsistencyIssue[];
  jsonText: string | null;
  kind: 'agent-session-v3-pilot-real-corpus-batch-consistency-report';
  manifestSourceCount: number;
  reportText: string;
  sourceKindSummaries: AgentSessionV3PilotRealCorpusBatchConsistencySourceKindSummary[];
  status: AgentSessionV3PilotRealCorpusBatchConsistencyStatus;
  summaryText: string;
  version: 1;
}

interface ReadJsonFileResult<T> {
  errorMessage: string | null;
  value: T | null;
  status: 'invalid-json' | 'missing' | 'present';
}

function parseAgentSessionV3PilotRealCorpusBatchConsistencyReportArgs(
  args: readonly string[],
): RunAgentSessionV3PilotRealCorpusBatchConsistencyReportOptions {
  let includeJsonText = false;
  let intakeDir: string | null = null;
  let prettyJson = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--json') {
      includeJsonText = true;
    } else if (arg === '--pretty') {
      includeJsonText = true;
      prettyJson = true;
    } else if (arg === '--dir') {
      const nextArg = args[index + 1];
      if (!nextArg) {
        throw new Error('Missing intake directory after --dir.');
      }
      intakeDir = nextArg;
      index += 1;
    } else if (!intakeDir) {
      intakeDir = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  if (!intakeDir) {
    throw new Error('Usage: npx tsx scripts/agent-session-v3-pilot-real-corpus-batch-consistency-report.ts --dir intake-dir [--json] [--pretty]');
  }

  return {
    includeJsonText,
    intakeDir,
    prettyJson,
  };
}

function getErrorCode(error: unknown) {
  return error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: unknown }).code)
    : '';
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function readJsonFile<T>(filePath: string): Promise<ReadJsonFileResult<T>> {
  try {
    const text = await readFile(filePath, 'utf8');

    try {
      return {
        errorMessage: null,
        status: 'present',
        value: JSON.parse(text) as T,
      };
    } catch (error: unknown) {
      return {
        errorMessage: getErrorMessage(error),
        status: 'invalid-json',
        value: null,
      };
    }
  } catch (error: unknown) {
    if (getErrorCode(error) === 'ENOENT') {
      return {
        errorMessage: null,
        status: 'missing',
        value: null,
      };
    }

    throw error;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeSourceKind(sourceKind: unknown) {
  return typeof sourceKind === 'string' && sourceKind.trim()
    ? sourceKind.trim()
    : 'unknown';
}

function normalizeLabel(label: unknown, fallback: string) {
  return typeof label === 'string' && label.trim()
    ? label.trim()
    : fallback;
}

function comparablePath(filePath: string) {
  const resolvedPath = path.resolve(filePath);
  return process.platform === 'win32' ? resolvedPath.toLowerCase() : resolvedPath;
}

function createIssue(options: {
  code: AgentSessionV3PilotRealCorpusBatchConsistencyIssueCode;
  label: string;
  manifestPath?: string | null;
  message: string;
  scope: AgentSessionV3PilotRealCorpusBatchConsistencyIssueScope;
}): AgentSessionV3PilotRealCorpusBatchConsistencyIssue {
  return {
    code: options.code,
    label: options.label,
    manifestPath: options.manifestPath ?? null,
    message: options.message,
    scope: options.scope,
  };
}

function createRequiredFileIssues(options: {
  indexRead: ReadJsonFileResult<unknown>;
  manifestRead: ReadJsonFileResult<unknown>;
}) {
  const issues: AgentSessionV3PilotRealCorpusBatchConsistencyIssue[] = [];

  if (options.manifestRead.status === 'missing') {
    issues.push(createIssue({
      code: 'missing-required-file',
      label: 'real-corpus-manifest',
      manifestPath: 'real-corpus-manifest.json',
      message: 'Required real-corpus-manifest.json is missing.',
      scope: 'manifest',
    }));
  } else if (options.manifestRead.status === 'invalid-json') {
    issues.push(createIssue({
      code: 'invalid-json',
      label: 'real-corpus-manifest',
      manifestPath: 'real-corpus-manifest.json',
      message: options.manifestRead.errorMessage ?? 'Manifest JSON could not be parsed.',
      scope: 'manifest',
    }));
  }

  if (options.indexRead.status === 'missing') {
    issues.push(createIssue({
      code: 'missing-required-file',
      label: 'corpus-batch-index',
      manifestPath: 'corpus-batch-index.json',
      message: 'Required corpus-batch-index.json is missing.',
      scope: 'index',
    }));
  } else if (options.indexRead.status === 'invalid-json') {
    issues.push(createIssue({
      code: 'invalid-json',
      label: 'corpus-batch-index',
      manifestPath: 'corpus-batch-index.json',
      message: options.indexRead.errorMessage ?? 'Batch index JSON could not be parsed.',
      scope: 'index',
    }));
  }

  return issues;
}

function createSourceKindSummaries(
  batches: readonly Record<string, unknown>[],
): AgentSessionV3PilotRealCorpusBatchConsistencySourceKindSummary[] {
  const counts = new Map<string, number>();

  for (const batch of batches) {
    const sourceKind = normalizeSourceKind(batch.sourceKind);
    counts.set(sourceKind, (counts.get(sourceKind) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([sourceKind, count]) => ({
      count,
      sourceKind,
    }))
    .sort((left, right) => left.sourceKind.localeCompare(right.sourceKind));
}

function inspectConsistency(options: {
  index: AgentSessionV3PilotCorpusBatchIndex | null;
  intakeDir: string;
  manifest: AgentSessionV3PilotExternalSampleCorpusManifest | null;
}) {
  const issues: AgentSessionV3PilotRealCorpusBatchConsistencyIssue[] = [];
  const manifestSources = Array.isArray(options.manifest?.sources)
    ? options.manifest.sources
    : [];
  const indexBatches = Array.isArray(options.index?.batches)
    ? options.index.batches
    : [];
  const batchRecords = indexBatches.filter(isRecord);
  const currentManifestPath = path.join(options.intakeDir, 'real-corpus-manifest.json');
  const currentManifestKey = comparablePath(currentManifestPath);
  const seenManifestPaths = new Map<string, string>();
  let baselineEntryPresent = false;
  let currentManifestReferenced = false;

  for (const [index, batch] of batchRecords.entries()) {
    const sourceKind = normalizeSourceKind(batch.sourceKind);
    const label = normalizeLabel(batch.label, `index-batch-${index}`);
    const manifestPath = typeof batch.manifestPath === 'string'
      ? batch.manifestPath.trim()
      : '';

    if (sourceKind === 'baseline') {
      baselineEntryPresent = true;
    }

    if (!manifestPath) {
      continue;
    }

    const resolvedManifestPath = path.resolve(options.intakeDir, manifestPath);
    const manifestKey = comparablePath(resolvedManifestPath);

    if (seenManifestPaths.has(manifestKey)) {
      issues.push(createIssue({
        code: 'duplicate-manifest-path',
        label,
        manifestPath,
        message: `Batch index repeats manifest path already used by ${seenManifestPaths.get(manifestKey)}.`,
        scope: 'index-batch',
      }));
    } else {
      seenManifestPaths.set(manifestKey, label);
    }

    if (manifestKey === currentManifestKey) {
      currentManifestReferenced = true;
      if (sourceKind === 'baseline') {
        issues.push(createIssue({
          code: 'baseline-points-to-real-manifest',
          label,
          manifestPath,
          message: 'Baseline entry should not point at the current real-corpus-manifest.json.',
          scope: 'index-batch',
        }));
      }
    }

  }

  if (!baselineEntryPresent) {
    issues.push(createIssue({
      code: 'missing-baseline-entry',
      label: 'corpus-batch-index',
      message: 'Batch index should include a baseline sourceKind entry for comparison.',
      scope: 'index',
    }));
  }

  if (!currentManifestReferenced) {
    issues.push(createIssue({
      code: 'missing-real-manifest-entry',
      label: 'real-corpus-manifest',
      manifestPath: './real-corpus-manifest.json',
      message: 'Batch index should include an entry pointing at the current real-corpus-manifest.json.',
      scope: 'index',
    }));
  }

  return {
    baselineEntryPresent,
    currentManifestReferenced,
    indexBatchCount: indexBatches.length,
    issues,
    manifestSourceCount: manifestSources.length,
    sourceKindSummaries: createSourceKindSummaries(batchRecords),
  };
}

function createStatus(
  issues: readonly AgentSessionV3PilotRealCorpusBatchConsistencyIssue[],
): AgentSessionV3PilotRealCorpusBatchConsistencyStatus {
  if (issues.some((issue) => issue.code === 'missing-required-file')) {
    return 'missing';
  }

  return issues.length > 0 ? 'issues' : 'consistent';
}

function createSummaryText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchConsistencyReportResult,
    'baselineEntryPresent' | 'currentManifestReferenced' | 'indexBatchCount' | 'issueCount' | 'manifestSourceCount' | 'sourceKindSummaries' | 'status'
  >,
) {
  const sourceKinds = result.sourceKindSummaries
    .map((summary) => `${summary.sourceKind}:${summary.count}`)
    .join(',') || 'none';

  return [
    `AgentSessionV3PilotRealCorpusBatchConsistencyReport status=${result.status}`,
    `issues=${result.issueCount}`,
    `manifestSources=${result.manifestSourceCount}`,
    `indexBatches=${result.indexBatchCount}`,
    `baseline=${result.baselineEntryPresent ? 'yes' : 'no'}`,
    `realManifest=${result.currentManifestReferenced ? 'yes' : 'no'}`,
    `sourceKinds=${sourceKinds}`,
  ].join(' ');
}

function createReportText(
  result: Pick<AgentSessionV3PilotRealCorpusBatchConsistencyReportResult, 'issues' | 'sourceKindSummaries' | 'summaryText'>,
) {
  const sourceKindLines = result.sourceKindSummaries.map((summary) => (
    `- sourceKind=${summary.sourceKind} count=${summary.count}`
  ));

  return [
    result.summaryText,
    sourceKindLines.length ? 'consistencySourceKinds:' : 'consistencySourceKinds: none',
    ...sourceKindLines,
    result.issues.length ? 'consistencyIssues:' : 'consistencyIssues: none',
    ...result.issues.map((issue) => [
      `- scope=${issue.scope}`,
      `code=${issue.code}`,
      `label=${issue.label}`,
      `manifestPath=${issue.manifestPath ?? 'none'}`,
      `message=${issue.message}`,
    ].join(' ')),
  ].join('\n');
}

function createJsonText(
  result: AgentSessionV3PilotRealCorpusBatchConsistencyReportResult,
  options: { prettyJson?: boolean } = {},
) {
  return JSON.stringify(result, null, options.prettyJson ? 2 : 0);
}

export async function runAgentSessionV3PilotRealCorpusBatchConsistencyReport(
  options: RunAgentSessionV3PilotRealCorpusBatchConsistencyReportOptions,
): Promise<AgentSessionV3PilotRealCorpusBatchConsistencyReportResult> {
  const intakeDir = path.resolve(options.intakeDir);
  const manifestPath = path.join(intakeDir, 'real-corpus-manifest.json');
  const indexPath = path.join(intakeDir, 'corpus-batch-index.json');
  const manifestRead = await readJsonFile<AgentSessionV3PilotExternalSampleCorpusManifest>(manifestPath);
  const indexRead = await readJsonFile<AgentSessionV3PilotCorpusBatchIndex>(indexPath);
  const requiredFileIssues = createRequiredFileIssues({
    indexRead,
    manifestRead,
  });
  const consistency = requiredFileIssues.length
    ? {
      baselineEntryPresent: false,
      currentManifestReferenced: false,
      indexBatchCount: 0,
      issues: [],
      manifestSourceCount: 0,
      sourceKindSummaries: [],
    }
    : inspectConsistency({
      index: indexRead.value,
      intakeDir,
      manifest: manifestRead.value,
    });
  const issues = [
    ...requiredFileIssues,
    ...consistency.issues,
  ];
  const resultWithoutJson: AgentSessionV3PilotRealCorpusBatchConsistencyReportResult = {
    baselineEntryPresent: consistency.baselineEntryPresent,
    currentManifestReferenced: consistency.currentManifestReferenced,
    indexBatchCount: consistency.indexBatchCount,
    intakeDir,
    issueCount: issues.length,
    issues,
    jsonText: null,
    kind: 'agent-session-v3-pilot-real-corpus-batch-consistency-report',
    manifestSourceCount: consistency.manifestSourceCount,
    reportText: '',
    sourceKindSummaries: consistency.sourceKindSummaries,
    status: createStatus(issues),
    summaryText: '',
    version: 1,
  };
  const summaryText = createSummaryText(resultWithoutJson);
  const resultWithReport = {
    ...resultWithoutJson,
    reportText: createReportText({
      ...resultWithoutJson,
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

async function runAgentSessionV3PilotRealCorpusBatchConsistencyReportCli() {
  const options = parseAgentSessionV3PilotRealCorpusBatchConsistencyReportArgs(process.argv.slice(2));
  const result = await runAgentSessionV3PilotRealCorpusBatchConsistencyReport(options);
  console.log(result.reportText);
  if (result.jsonText) {
    console.log(result.jsonText);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAgentSessionV3PilotRealCorpusBatchConsistencyReportCli().catch((error: unknown) => {
    const errorText = error instanceof Error ? error.message : String(error);
    console.error(errorText);
    process.exitCode = 1;
  });
}
