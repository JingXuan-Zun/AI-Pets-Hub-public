import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type {
  AgentSessionV3PilotRealCorpusBatchHandoffBundleSampleSource,
  AgentSessionV3PilotRealCorpusBatchHandoffBundleSampleSourceStatus,
} from './agent-session-v3-pilot-real-corpus-batch-handoff-bundle.ts';

export type AgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyStatus =
  | 'blocked'
  | 'consistent'
  | 'review-needed';

export type AgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyIssueSeverity =
  | 'blocker'
  | 'review';

export type AgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyIssueCode =
  | 'derived-status-mismatch'
  | 'expected-source-mismatch'
  | 'invalid-index-json'
  | 'invalid-sample-source'
  | 'invalid-sample-source-status'
  | 'missing-handoff-index'
  | 'missing-handoff-manifest'
  | 'missing-readme'
  | 'missing-sample-source'
  | 'missing-sample-source-status'
  | 'sample-source-mismatch'
  | 'sample-source-status-mismatch'
  | 'unknown-sample-source';

export interface AgentSessionV3PilotRealCorpusBatchHandoffSampleSourceObservation {
  label: 'handoff-index' | 'handoff-manifest' | 'readme';
  path: string;
  present: boolean;
  sampleSource: string | null;
  sampleSourceStatus: string | null;
}

export interface AgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyIssue {
  code: AgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyIssueCode;
  detail: string;
  path: string;
  severity: AgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyIssueSeverity;
  source: AgentSessionV3PilotRealCorpusBatchHandoffSampleSourceObservation['label'];
}

export interface RunAgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyReportOptions {
  bundleDir: string;
  expectedSampleSource?: AgentSessionV3PilotRealCorpusBatchHandoffBundleSampleSource;
  includeJsonText?: boolean;
  prettyJson?: boolean;
}

export interface AgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyReportResult {
  blockerCount: number;
  bundleDir: string;
  expectedSampleSource: AgentSessionV3PilotRealCorpusBatchHandoffBundleSampleSource | null;
  handoffIndexPath: string;
  handoffManifestPath: string;
  issueCount: number;
  issues: AgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyIssue[];
  jsonText: string | null;
  kind: 'agent-session-v3-pilot-real-corpus-batch-handoff-sample-source-consistency-report';
  observations: AgentSessionV3PilotRealCorpusBatchHandoffSampleSourceObservation[];
  readmePath: string;
  reportText: string;
  reviewCount: number;
  sampleSource: string | null;
  sampleSourceStatus: string | null;
  status: AgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyStatus;
  summaryText: string;
  version: 1;
}

interface ReadTextResult {
  errorMessage: string | null;
  present: boolean;
  text: string | null;
}

interface ReadJsonResult {
  errorMessage: string | null;
  present: boolean;
  value: Record<string, unknown> | null;
}

function parseAgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyReportArgs(
  args: readonly string[],
): RunAgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyReportOptions {
  let bundleDir: string | null = null;
  let expectedSampleSource: AgentSessionV3PilotRealCorpusBatchHandoffBundleSampleSource | undefined;
  let includeJsonText = false;
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
        throw new Error('Missing handoff bundle directory after --dir.');
      }
      bundleDir = nextArg;
      index += 1;
    } else if (arg === '--expected-source') {
      const nextArg = args[index + 1];
      if (!nextArg) {
        throw new Error('Missing sample source after --expected-source.');
      }
      expectedSampleSource = parseSampleSource(nextArg);
      index += 1;
    } else if (!bundleDir) {
      bundleDir = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  if (!bundleDir) {
    throw new Error('Usage: npx tsx scripts/agent-session-v3-pilot-real-corpus-batch-handoff-sample-source-consistency-report.ts --dir handoff-bundle-dir [--expected-source real-exported|rehearsal|unknown] [--json] [--pretty]');
  }

  return {
    bundleDir,
    expectedSampleSource,
    includeJsonText,
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

async function readTextFile(filePath: string): Promise<ReadTextResult> {
  try {
    return {
      errorMessage: null,
      present: true,
      text: await readFile(filePath, 'utf8'),
    };
  } catch (error: unknown) {
    if (getErrorCode(error) === 'ENOENT') {
      return {
        errorMessage: null,
        present: false,
        text: null,
      };
    }

    throw error;
  }
}

async function readJsonFile(filePath: string): Promise<ReadJsonResult> {
  const textResult = await readTextFile(filePath);

  if (!textResult.present || textResult.text === null) {
    return {
      errorMessage: null,
      present: false,
      value: null,
    };
  }

  try {
    const parsed = JSON.parse(textResult.text) as unknown;

    return {
      errorMessage: null,
      present: true,
      value: parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : null,
    };
  } catch (error: unknown) {
    return {
      errorMessage: getErrorMessage(error),
      present: true,
      value: null,
    };
  }
}

function parseSampleSource(
  value: string,
): AgentSessionV3PilotRealCorpusBatchHandoffBundleSampleSource {
  if (isSampleSource(value)) {
    return value;
  }

  throw new Error(`Invalid sample source: ${value}. Expected real-exported, rehearsal, or unknown.`);
}

function isSampleSource(
  value: unknown,
): value is AgentSessionV3PilotRealCorpusBatchHandoffBundleSampleSource {
  return value === 'real-exported' || value === 'rehearsal' || value === 'unknown';
}

function isSampleSourceStatus(
  value: unknown,
): value is AgentSessionV3PilotRealCorpusBatchHandoffBundleSampleSourceStatus {
  return value === 'real-exported-evidence'
    || value === 'synthetic-rehearsal'
    || value === 'missing-real-sample-declaration';
}

function expectedStatusForSampleSource(
  sampleSource: AgentSessionV3PilotRealCorpusBatchHandoffBundleSampleSource,
): AgentSessionV3PilotRealCorpusBatchHandoffBundleSampleSourceStatus {
  if (sampleSource === 'real-exported') {
    return 'real-exported-evidence';
  }
  if (sampleSource === 'rehearsal') {
    return 'synthetic-rehearsal';
  }

  return 'missing-real-sample-declaration';
}

function extractLineValue(text: string | null, pattern: RegExp) {
  if (!text) {
    return null;
  }

  return pattern.exec(text)?.[1]?.trim() ?? null;
}

function createIssue(options: {
  code: AgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyIssueCode;
  detail: string;
  path: string;
  severity: AgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyIssueSeverity;
  source: AgentSessionV3PilotRealCorpusBatchHandoffSampleSourceObservation['label'];
}): AgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyIssue {
  return {
    code: options.code,
    detail: options.detail,
    path: options.path,
    severity: options.severity,
    source: options.source,
  };
}

function createObservationIssue(
  observation: AgentSessionV3PilotRealCorpusBatchHandoffSampleSourceObservation,
  options: {
    code: AgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyIssueCode;
    detail: string;
    severity?: AgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyIssueSeverity;
  },
) {
  return createIssue({
    code: options.code,
    detail: options.detail,
    path: observation.path,
    severity: options.severity ?? 'blocker',
    source: observation.label,
  });
}

function collectObservationIssues(
  observations: readonly AgentSessionV3PilotRealCorpusBatchHandoffSampleSourceObservation[],
) {
  const issues: AgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyIssue[] = [];

  for (const observation of observations) {
    if (!observation.present) {
      issues.push(createObservationIssue(observation, {
        code: observation.label === 'readme'
          ? 'missing-readme'
          : observation.label === 'handoff-manifest'
            ? 'missing-handoff-manifest'
            : 'missing-handoff-index',
        detail: `${observation.label} is missing from the handoff bundle.`,
      }));
      continue;
    }

    if (!observation.sampleSource) {
      issues.push(createObservationIssue(observation, {
        code: 'missing-sample-source',
        detail: `${observation.label} does not declare sampleSource.`,
      }));
    } else if (!isSampleSource(observation.sampleSource)) {
      issues.push(createObservationIssue(observation, {
        code: 'invalid-sample-source',
        detail: `${observation.label} declares invalid sampleSource=${observation.sampleSource}.`,
      }));
    }

    if (!observation.sampleSourceStatus) {
      issues.push(createObservationIssue(observation, {
        code: 'missing-sample-source-status',
        detail: `${observation.label} does not declare sampleSourceStatus.`,
      }));
    } else if (!isSampleSourceStatus(observation.sampleSourceStatus)) {
      issues.push(createObservationIssue(observation, {
        code: 'invalid-sample-source-status',
        detail: `${observation.label} declares invalid sampleSourceStatus=${observation.sampleSourceStatus}.`,
      }));
    }

    if (isSampleSource(observation.sampleSource) && isSampleSourceStatus(observation.sampleSourceStatus)) {
      const expectedStatus = expectedStatusForSampleSource(observation.sampleSource);
      if (observation.sampleSourceStatus !== expectedStatus) {
        issues.push(createObservationIssue(observation, {
          code: 'derived-status-mismatch',
          detail: `${observation.label} sampleSource=${observation.sampleSource} should map to sampleSourceStatus=${expectedStatus}, got ${observation.sampleSourceStatus}.`,
        }));
      }
    }
  }

  return issues;
}

function firstValidSource(
  observations: readonly AgentSessionV3PilotRealCorpusBatchHandoffSampleSourceObservation[],
) {
  return observations.find((observation) => isSampleSource(observation.sampleSource))?.sampleSource ?? null;
}

function firstValidSourceStatus(
  observations: readonly AgentSessionV3PilotRealCorpusBatchHandoffSampleSourceObservation[],
) {
  return observations.find((observation) => isSampleSourceStatus(observation.sampleSourceStatus))?.sampleSourceStatus ?? null;
}

function collectCrossSourceIssues(options: {
  expectedSampleSource: AgentSessionV3PilotRealCorpusBatchHandoffBundleSampleSource | null;
  observations: readonly AgentSessionV3PilotRealCorpusBatchHandoffSampleSourceObservation[];
}) {
  const issues: AgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyIssue[] = [];
  const validSources = options.observations
    .filter((observation) => isSampleSource(observation.sampleSource))
    .map((observation) => ({
      label: observation.label,
      path: observation.path,
      value: observation.sampleSource as AgentSessionV3PilotRealCorpusBatchHandoffBundleSampleSource,
    }));
  const validStatuses = options.observations
    .filter((observation) => isSampleSourceStatus(observation.sampleSourceStatus))
    .map((observation) => ({
      label: observation.label,
      path: observation.path,
      value: observation.sampleSourceStatus as AgentSessionV3PilotRealCorpusBatchHandoffBundleSampleSourceStatus,
    }));
  const canonicalSource = validSources[0]?.value ?? null;
  const canonicalStatus = validStatuses[0]?.value ?? null;

  for (const source of validSources) {
    if (canonicalSource && source.value !== canonicalSource) {
      issues.push(createIssue({
        code: 'sample-source-mismatch',
        detail: `${source.label} sampleSource=${source.value} does not match ${canonicalSource}.`,
        path: source.path,
        severity: 'blocker',
        source: source.label,
      }));
    }
  }

  for (const status of validStatuses) {
    if (canonicalStatus && status.value !== canonicalStatus) {
      issues.push(createIssue({
        code: 'sample-source-status-mismatch',
        detail: `${status.label} sampleSourceStatus=${status.value} does not match ${canonicalStatus}.`,
        path: status.path,
        severity: 'blocker',
        source: status.label,
      }));
    }
  }

  if (canonicalSource && options.expectedSampleSource && canonicalSource !== options.expectedSampleSource) {
    issues.push(createIssue({
      code: 'expected-source-mismatch',
      detail: `Expected sampleSource=${options.expectedSampleSource}, got ${canonicalSource}.`,
      path: validSources[0]?.path ?? '',
      severity: 'blocker',
      source: validSources[0]?.label ?? 'handoff-index',
    }));
  }

  if (canonicalSource === 'unknown') {
    issues.push(createIssue({
      code: 'unknown-sample-source',
      detail: 'sampleSource=unknown leaves the real sample declaration unresolved.',
      path: validSources[0]?.path ?? '',
      severity: 'review',
      source: validSources[0]?.label ?? 'handoff-index',
    }));
  }

  return issues;
}

function createStatus(options: {
  blockerCount: number;
  reviewCount: number;
}): AgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyStatus {
  if (options.blockerCount > 0) {
    return 'blocked';
  }

  return options.reviewCount > 0 ? 'review-needed' : 'consistent';
}

function createSummaryText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyReportResult,
    'blockerCount' | 'expectedSampleSource' | 'issueCount' | 'reviewCount' | 'sampleSource' | 'sampleSourceStatus' | 'status'
  >,
) {
  return [
    `AgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyReport status=${result.status}`,
    `issues=${result.issueCount}`,
    `blockers=${result.blockerCount}`,
    `review=${result.reviewCount}`,
    `sampleSource=${result.sampleSource ?? 'missing'}`,
    `sampleSourceStatus=${result.sampleSourceStatus ?? 'missing'}`,
    `expectedSampleSource=${result.expectedSampleSource ?? 'none'}`,
  ].join(' ');
}

function createReportText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyReportResult,
    'bundleDir' | 'expectedSampleSource' | 'issues' | 'observations' | 'summaryText'
  >,
) {
  return [
    result.summaryText,
    `bundleDir: ${result.bundleDir}`,
    `expectedSampleSource: ${result.expectedSampleSource ?? 'none'}`,
    'observedSampleSourceDeclarations:',
    ...result.observations.map((observation) => [
      `- source=${observation.label}`,
      `present=${observation.present ? 'yes' : 'no'}`,
      `sampleSource=${observation.sampleSource ?? 'missing'}`,
      `sampleSourceStatus=${observation.sampleSourceStatus ?? 'missing'}`,
      `path=${observation.path}`,
    ].join(' ')),
    result.issues.length ? 'sampleSourceConsistencyIssues:' : 'sampleSourceConsistencyIssues: none',
    ...result.issues.map((issue) => [
      `- severity=${issue.severity}`,
      `source=${issue.source}`,
      `code=${issue.code}`,
      `path=${issue.path}`,
      `detail=${issue.detail}`,
    ].join(' ')),
    'guardrail=caller-owned evidence consistency report only; no sample collection, threshold decision, runtime authority, tool selection, permission routing, execution, or recovery.',
  ].join('\n');
}

function createJsonText(
  result: AgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyReportResult,
  options: { prettyJson?: boolean } = {},
) {
  return JSON.stringify(result, null, options.prettyJson ? 2 : 0);
}

export async function runAgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyReport(
  options: RunAgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyReportOptions,
): Promise<AgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyReportResult> {
  const bundleDir = path.resolve(options.bundleDir);
  const handoffIndexPath = path.join(bundleDir, 'handoff-index.json');
  const handoffManifestPath = path.join(bundleDir, 'handoff-manifest.txt');
  const readmePath = path.join(bundleDir, 'README.md');
  const [indexRead, manifestRead, readmeRead] = await Promise.all([
    readJsonFile(handoffIndexPath),
    readTextFile(handoffManifestPath),
    readTextFile(readmePath),
  ]);
  const observations: AgentSessionV3PilotRealCorpusBatchHandoffSampleSourceObservation[] = [
    {
      label: 'handoff-index',
      path: handoffIndexPath,
      present: indexRead.present && Boolean(indexRead.value),
      sampleSource: typeof indexRead.value?.sampleSource === 'string'
        ? indexRead.value.sampleSource
        : null,
      sampleSourceStatus: typeof indexRead.value?.sampleSourceStatus === 'string'
        ? indexRead.value.sampleSourceStatus
        : null,
    },
    {
      label: 'handoff-manifest',
      path: handoffManifestPath,
      present: manifestRead.present,
      sampleSource: extractLineValue(manifestRead.text, /^sampleSource=(.+)$/mu),
      sampleSourceStatus: extractLineValue(manifestRead.text, /^sampleSourceStatus=(.+)$/mu),
    },
    {
      label: 'readme',
      path: readmePath,
      present: readmeRead.present,
      sampleSource: extractLineValue(readmeRead.text, /^- Declared sample source:\s*(.+)$/mu),
      sampleSourceStatus: extractLineValue(readmeRead.text, /^- Sample source status:\s*(.+)$/mu),
    },
  ];
  const invalidIndexIssue = indexRead.present && indexRead.value === null
    ? [createIssue({
      code: 'invalid-index-json',
      detail: indexRead.errorMessage ?? 'handoff-index.json is not a JSON object.',
      path: handoffIndexPath,
      severity: 'blocker',
      source: 'handoff-index',
    })]
    : [];
  const issues = [
    ...invalidIndexIssue,
    ...collectObservationIssues(observations),
    ...collectCrossSourceIssues({
      expectedSampleSource: options.expectedSampleSource ?? null,
      observations,
    }),
  ];
  const blockerCount = issues.filter((issue) => issue.severity === 'blocker').length;
  const reviewCount = issues.filter((issue) => issue.severity === 'review').length;
  const status = createStatus({
    blockerCount,
    reviewCount,
  });
  const resultWithoutText: AgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyReportResult = {
    blockerCount,
    bundleDir,
    expectedSampleSource: options.expectedSampleSource ?? null,
    handoffIndexPath,
    handoffManifestPath,
    issueCount: issues.length,
    issues,
    jsonText: null,
    kind: 'agent-session-v3-pilot-real-corpus-batch-handoff-sample-source-consistency-report',
    observations,
    readmePath,
    reportText: '',
    reviewCount,
    sampleSource: firstValidSource(observations),
    sampleSourceStatus: firstValidSourceStatus(observations),
    status,
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

async function runAgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyReportCli() {
  const options = parseAgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyReportArgs(process.argv.slice(2));
  const result = await runAgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyReport(options);
  console.log(result.reportText);
  if (result.jsonText) {
    console.log(result.jsonText);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyReportCli().catch((error: unknown) => {
    const errorText = error instanceof Error ? error.message : String(error);
    console.error(errorText);
    process.exitCode = 1;
  });
}
