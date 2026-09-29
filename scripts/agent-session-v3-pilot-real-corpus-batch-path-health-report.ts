import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  type AgentSessionV3PilotCorpusBatchIndex,
} from './agent-session-v3-pilot-corpus-batch-index-report.ts';
import {
  type AgentSessionV3PilotExternalSampleCorpusManifest,
} from './agent-session-v3-pilot-external-sample-corpus-manifest-loader.ts';

export type AgentSessionV3PilotRealCorpusBatchPathHealthStatus =
  | 'healthy'
  | 'issues'
  | 'missing';

export type AgentSessionV3PilotRealCorpusBatchPathHealthEntryScope =
  | 'index-manifest'
  | 'manifest-source'
  | 'required';

export type AgentSessionV3PilotRealCorpusBatchPathHealthEntryStatus =
  | 'invalid-json'
  | 'invalid-path'
  | 'missing'
  | 'present';

export interface AgentSessionV3PilotRealCorpusBatchPathHealthEntry {
  declaredPath: string;
  errorMessage: string | null;
  label: string;
  resolvedPath: string;
  scope: AgentSessionV3PilotRealCorpusBatchPathHealthEntryScope;
  status: AgentSessionV3PilotRealCorpusBatchPathHealthEntryStatus;
}

export interface RunAgentSessionV3PilotRealCorpusBatchPathHealthReportOptions {
  includeJsonText?: boolean;
  intakeDir: string;
  prettyJson?: boolean;
}

export interface AgentSessionV3PilotRealCorpusBatchPathHealthReportResult {
  entries: AgentSessionV3PilotRealCorpusBatchPathHealthEntry[];
  indexManifestCount: number;
  intakeDir: string;
  issueCount: number;
  issues: AgentSessionV3PilotRealCorpusBatchPathHealthEntry[];
  jsonText: string | null;
  kind: 'agent-session-v3-pilot-real-corpus-batch-path-health-report';
  manifestSourceCount: number;
  reportText: string;
  status: AgentSessionV3PilotRealCorpusBatchPathHealthStatus;
  summaryText: string;
  version: 1;
}

interface ReadJsonFileResult<T> {
  errorMessage: string | null;
  value: T | null;
  status: Extract<AgentSessionV3PilotRealCorpusBatchPathHealthEntryStatus, 'invalid-json' | 'missing' | 'present'>;
}

function parseAgentSessionV3PilotRealCorpusBatchPathHealthReportArgs(
  args: readonly string[],
): RunAgentSessionV3PilotRealCorpusBatchPathHealthReportOptions {
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
    throw new Error('Usage: npx tsx scripts/agent-session-v3-pilot-real-corpus-batch-path-health-report.ts --dir intake-dir [--json] [--pretty]');
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

function createEntry(options: {
  declaredPath: string;
  errorMessage?: string | null;
  label: string;
  resolvedPath: string;
  scope: AgentSessionV3PilotRealCorpusBatchPathHealthEntryScope;
  status: AgentSessionV3PilotRealCorpusBatchPathHealthEntryStatus;
}): AgentSessionV3PilotRealCorpusBatchPathHealthEntry {
  return {
    declaredPath: options.declaredPath,
    errorMessage: options.errorMessage ?? null,
    label: options.label,
    resolvedPath: options.resolvedPath,
    scope: options.scope,
    status: options.status,
  };
}

function isUsablePath(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

async function createReferenceEntry(options: {
  baseDir: string;
  declaredPath: unknown;
  fallbackLabel: string;
  label: string | null | undefined;
  scope: Exclude<AgentSessionV3PilotRealCorpusBatchPathHealthEntryScope, 'required'>;
}): Promise<AgentSessionV3PilotRealCorpusBatchPathHealthEntry> {
  if (!isUsablePath(options.declaredPath)) {
    return createEntry({
      declaredPath: String(options.declaredPath ?? ''),
      errorMessage: 'Path is missing or empty.',
      label: options.label?.trim() || options.fallbackLabel,
      resolvedPath: '',
      scope: options.scope,
      status: 'invalid-path',
    });
  }

  const declaredPath = options.declaredPath.trim();
  const resolvedPath = path.resolve(options.baseDir, declaredPath);
  const readResult = await readJsonFile<unknown>(resolvedPath);

  return createEntry({
    declaredPath,
    errorMessage: readResult.errorMessage,
    label: options.label?.trim() || path.basename(declaredPath) || options.fallbackLabel,
    resolvedPath,
    scope: options.scope,
    status: readResult.status,
  });
}

function createRequiredEntry(options: {
  declaredPath: string;
  label: string;
  readResult: ReadJsonFileResult<unknown>;
  resolvedPath: string;
}): AgentSessionV3PilotRealCorpusBatchPathHealthEntry {
  return createEntry({
    declaredPath: options.declaredPath,
    errorMessage: options.readResult.errorMessage,
    label: options.label,
    resolvedPath: options.resolvedPath,
    scope: 'required',
    status: options.readResult.status,
  });
}

function createSummaryText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchPathHealthReportResult,
    'indexManifestCount' | 'issueCount' | 'manifestSourceCount' | 'status'
  >,
) {
  return [
    `AgentSessionV3PilotRealCorpusBatchPathHealthReport status=${result.status}`,
    `issues=${result.issueCount}`,
    `manifestSources=${result.manifestSourceCount}`,
    `indexManifests=${result.indexManifestCount}`,
  ].join(' ');
}

function createReportText(
  result: Pick<AgentSessionV3PilotRealCorpusBatchPathHealthReportResult, 'issues' | 'summaryText'>,
) {
  return [
    result.summaryText,
    result.issues.length ? 'pathHealthIssues:' : 'pathHealthIssues: none',
    ...result.issues.map((issue) => [
      `- scope=${issue.scope}`,
      `status=${issue.status}`,
      `label=${issue.label}`,
      `path=${issue.declaredPath || 'none'}`,
      `resolved=${issue.resolvedPath || 'none'}`,
      `error=${issue.errorMessage ?? 'none'}`,
    ].join(' ')),
  ].join('\n');
}

function createJsonText(
  result: AgentSessionV3PilotRealCorpusBatchPathHealthReportResult,
  options: { prettyJson?: boolean } = {},
) {
  return JSON.stringify(result, null, options.prettyJson ? 2 : 0);
}

function createStatus(
  issues: readonly AgentSessionV3PilotRealCorpusBatchPathHealthEntry[],
): AgentSessionV3PilotRealCorpusBatchPathHealthStatus {
  if (issues.some((issue) => issue.scope === 'required' && issue.status === 'missing')) {
    return 'missing';
  }

  return issues.length > 0 ? 'issues' : 'healthy';
}

export async function runAgentSessionV3PilotRealCorpusBatchPathHealthReport(
  options: RunAgentSessionV3PilotRealCorpusBatchPathHealthReportOptions,
): Promise<AgentSessionV3PilotRealCorpusBatchPathHealthReportResult> {
  const intakeDir = path.resolve(options.intakeDir);
  const manifestPath = path.join(intakeDir, 'real-corpus-manifest.json');
  const indexPath = path.join(intakeDir, 'corpus-batch-index.json');
  const manifestRead = await readJsonFile<AgentSessionV3PilotExternalSampleCorpusManifest>(manifestPath);
  const indexRead = await readJsonFile<AgentSessionV3PilotCorpusBatchIndex>(indexPath);
  const entries: AgentSessionV3PilotRealCorpusBatchPathHealthEntry[] = [
    createRequiredEntry({
      declaredPath: 'real-corpus-manifest.json',
      label: 'real-corpus-manifest',
      readResult: manifestRead,
      resolvedPath: manifestPath,
    }),
    createRequiredEntry({
      declaredPath: 'corpus-batch-index.json',
      label: 'corpus-batch-index',
      readResult: indexRead,
      resolvedPath: indexPath,
    }),
  ];
  const manifestSources = Array.isArray(manifestRead.value?.sources)
    ? manifestRead.value.sources
    : [];
  const indexBatches = Array.isArray(indexRead.value?.batches)
    ? indexRead.value.batches
    : [];

  entries.push(...await Promise.all(manifestSources.map((source, index) => (
    createReferenceEntry({
      baseDir: intakeDir,
      declaredPath: source.path,
      fallbackLabel: `manifest-source-${index}`,
      label: source.label,
      scope: 'manifest-source',
    })
  ))));
  entries.push(...await Promise.all(indexBatches.map((batch, index) => (
    createReferenceEntry({
      baseDir: intakeDir,
      declaredPath: batch.manifestPath,
      fallbackLabel: `index-manifest-${index}`,
      label: batch.label,
      scope: 'index-manifest',
    })
  ))));

  const issues = entries.filter((entry) => entry.status !== 'present');
  const resultWithoutJson: AgentSessionV3PilotRealCorpusBatchPathHealthReportResult = {
    entries,
    indexManifestCount: indexBatches.length,
    intakeDir,
    issueCount: issues.length,
    issues,
    jsonText: null,
    kind: 'agent-session-v3-pilot-real-corpus-batch-path-health-report',
    manifestSourceCount: manifestSources.length,
    reportText: '',
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

async function runAgentSessionV3PilotRealCorpusBatchPathHealthReportCli() {
  const options = parseAgentSessionV3PilotRealCorpusBatchPathHealthReportArgs(process.argv.slice(2));
  const result = await runAgentSessionV3PilotRealCorpusBatchPathHealthReport(options);
  console.log(result.reportText);
  if (result.jsonText) {
    console.log(result.jsonText);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAgentSessionV3PilotRealCorpusBatchPathHealthReportCli().catch((error: unknown) => {
    const errorText = error instanceof Error ? error.message : String(error);
    console.error(errorText);
    process.exitCode = 1;
  });
}
