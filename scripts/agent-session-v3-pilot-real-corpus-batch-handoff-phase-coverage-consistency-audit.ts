import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  createAgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageObservation,
  formatAgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageObservation,
  type AgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageObservation,
} from './agent-session-v3-pilot-real-corpus-batch-handoff-phase-coverage-observation.ts';
import {
  runAgentSessionV3PilotRealCorpusBatchHandoffArtifactIntegrityReport,
} from './agent-session-v3-pilot-real-corpus-batch-handoff-artifact-integrity-report.ts';
import {
  runAgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketSummary,
} from './agent-session-v3-pilot-real-corpus-batch-handoff-reviewer-packet-summary.ts';
import {
  runAgentSessionV3PilotRealCorpusBatchHandoffSourcePreflightRollup,
  type AgentSessionV3PilotRealCorpusBatchHandoffSourcePreflightRollupInput,
} from './agent-session-v3-pilot-real-corpus-batch-handoff-source-preflight-rollup.ts';
import type { AgentSessionV3PilotRealCorpusBatchHandoffBundleSampleSource } from './agent-session-v3-pilot-real-corpus-batch-handoff-bundle.ts';

export type AgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageConsistencyAuditStatus =
  | 'consistent'
  | 'review-needed';

export const AGENT_SESSION_V3_PILOT_REAL_CORPUS_BATCH_HANDOFF_PHASE_COVERAGE_CONSISTENCY_AUDIT_ISSUE_CODES = [
  'artifact-integrity-phase-coverage-mismatch',
  'invalid-artifact-json',
  'invalid-source-preflight-rollup-json',
  'missing-artifact-json',
  'missing-source-preflight-rollup-json',
  'reviewer-packet-phase-coverage-mismatch',
  'source-preflight-rollup-phase-coverage-mismatch',
] as const;

export type AgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageConsistencyAuditIssueCode =
  typeof AGENT_SESSION_V3_PILOT_REAL_CORPUS_BATCH_HANDOFF_PHASE_COVERAGE_CONSISTENCY_AUDIT_ISSUE_CODES[number];

export interface AgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageConsistencyAuditIssue {
  code: AgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageConsistencyAuditIssueCode;
  detail: string;
  severity: 'review';
}

export interface AgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageConsistencyAuditEntry {
  artifactIntegrityPhaseCoverage: AgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageObservation | null;
  bundlePhaseCoverage: AgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageObservation | null;
  label: string;
  reviewerPacketPhaseCoverage: AgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageObservation | null;
  role: 'readiness-rollup-json' | 'review-summary-json';
  sourcePreflightRollupPhaseCoverage: AgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageObservation | null;
  status: AgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageConsistencyAuditStatus;
}

export interface RunAgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageConsistencyAuditOptions {
  bundleDir: string;
  expectedSampleSource?: AgentSessionV3PilotRealCorpusBatchHandoffBundleSampleSource;
  includeJsonText?: boolean;
  prettyJson?: boolean;
  sourcePreflightRollupJsonPath?: string;
  sourcePreflightRollupEntries?: readonly AgentSessionV3PilotRealCorpusBatchHandoffSourcePreflightRollupInput[];
}

export interface AgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageConsistencyAuditResult {
  bundleDir: string;
  entries: AgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageConsistencyAuditEntry[];
  issueCount: number;
  issues: AgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageConsistencyAuditIssue[];
  jsonText: string | null;
  kind: 'agent-session-v3-pilot-real-corpus-batch-handoff-phase-coverage-consistency-audit';
  readyForProductionRuntime: false;
  reportText: string;
  status: AgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageConsistencyAuditStatus;
  summaryText: string;
  version: 1;
}

interface ParsedCase {
  expectedSampleSource?: AgentSessionV3PilotRealCorpusBatchHandoffBundleSampleSource;
  handoffBundleDir?: string;
  intakeDir?: string;
  label: string;
}

interface ReadJsonObjectResult {
  errorMessage: string | null;
  status: 'invalid' | 'missing' | 'ok';
  value: Record<string, unknown> | null;
}

interface PhaseCoverageArtifactJsonSource {
  label: string;
  read: ReadJsonObjectResult;
}

interface SourcePreflightRollupReadResult {
  errorMessage: string | null;
  status: 'invalid' | 'missing' | 'not-provided' | 'ok';
  value: Record<string, unknown> | null;
}

function parseSampleSource(
  value: string,
): AgentSessionV3PilotRealCorpusBatchHandoffBundleSampleSource {
  if (value === 'real-exported' || value === 'rehearsal' || value === 'unknown') {
    return value;
  }

  throw new Error(`Invalid sample source: ${value}. Expected real-exported, rehearsal, or unknown.`);
}

function parseArgs(
  args: readonly string[],
): RunAgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageConsistencyAuditOptions {
  let bundleDir: string | null = null;
  let expectedSampleSource: AgentSessionV3PilotRealCorpusBatchHandoffBundleSampleSource | undefined;
  let includeJsonText = false;
  let prettyJson = false;
  let sourcePreflightRollupJsonPath: string | undefined;
  const sourcePreflightRollupEntries: AgentSessionV3PilotRealCorpusBatchHandoffSourcePreflightRollupInput[] = [];
  let current: ParsedCase | null = null;

  function requireCurrent(arg: string) {
    if (!current) {
      throw new Error(`Expected --source-case before ${arg}.`);
    }

    return current;
  }

  function pushCurrent() {
    if (!current) {
      return;
    }
    if (!current.intakeDir || !current.handoffBundleDir) {
      throw new Error(`Incomplete source case ${current.label}. Expected --source-dir and --source-handoff-dir.`);
    }

    sourcePreflightRollupEntries.push({
      expectedSampleSource: current.expectedSampleSource,
      handoffBundleDir: current.handoffBundleDir,
      intakeDir: current.intakeDir,
      label: current.label,
    });
  }

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
    } else if (arg === '--source-rollup-json') {
      const nextArg = args[index + 1];
      if (!nextArg) {
        throw new Error('Missing source-preflight rollup JSON path after --source-rollup-json.');
      }
      sourcePreflightRollupJsonPath = nextArg;
      index += 1;
    } else if (arg === '--source-case') {
      const nextArg = args[index + 1];
      if (!nextArg) {
        throw new Error('Missing label after --source-case.');
      }
      pushCurrent();
      current = {
        label: nextArg,
      };
      index += 1;
    } else if (arg === '--source-dir') {
      const nextArg = args[index + 1];
      if (!nextArg) {
        throw new Error('Missing intake directory after --source-dir.');
      }
      requireCurrent(arg).intakeDir = nextArg;
      index += 1;
    } else if (arg === '--source-handoff-dir') {
      const nextArg = args[index + 1];
      if (!nextArg) {
        throw new Error('Missing handoff directory after --source-handoff-dir.');
      }
      requireCurrent(arg).handoffBundleDir = nextArg;
      index += 1;
    } else if (arg === '--source-expected-source') {
      const nextArg = args[index + 1];
      if (!nextArg) {
        throw new Error('Missing sample source after --source-expected-source.');
      }
      requireCurrent(arg).expectedSampleSource = parseSampleSource(nextArg);
      index += 1;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  pushCurrent();

  if (!bundleDir) {
    throw new Error('Usage: npx tsx scripts/agent-session-v3-pilot-real-corpus-batch-handoff-phase-coverage-consistency-audit.ts --dir handoff-bundle-dir [--expected-source real-exported|rehearsal|unknown] [--source-case label --source-dir intake-dir --source-handoff-dir handoff-dir ...] [--json] [--pretty]');
  }

  return {
    bundleDir,
    expectedSampleSource,
    includeJsonText,
    prettyJson,
    sourcePreflightRollupJsonPath,
    sourcePreflightRollupEntries,
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

async function readJsonObject(filePath: string): Promise<ReadJsonObjectResult> {
  try {
    const text = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(text) as unknown;

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return {
        errorMessage: null,
        status: 'ok',
        value: parsed as Record<string, unknown>,
      };
    }

    return {
      errorMessage: 'JSON root is not an object.',
      status: 'invalid',
      value: null,
    };
  } catch (error: unknown) {
    if (getErrorCode(error) === 'ENOENT') {
      return {
        errorMessage: null,
        status: 'missing',
        value: null,
      };
    }

    return {
      errorMessage: getErrorMessage(error),
      status: 'invalid',
      value: null,
    };
  }
}

function observationKey(
  observation: AgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageObservation | null,
) {
  return JSON.stringify(observation ?? null);
}

function sameObservation(
  left: AgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageObservation | null,
  right: AgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageObservation | null,
) {
  return observationKey(left) === observationKey(right);
}

async function readSourcePreflightRollup(options: {
  entries?: readonly AgentSessionV3PilotRealCorpusBatchHandoffSourcePreflightRollupInput[];
  jsonPath?: string;
  prettyJson?: boolean;
}): Promise<SourcePreflightRollupReadResult> {
  if (options.jsonPath) {
    const read = await readJsonObject(path.resolve(options.jsonPath));

    return {
      errorMessage: read.errorMessage,
      status: read.status,
      value: read.value,
    };
  }

  if (options.entries?.length) {
    return {
      errorMessage: null,
      status: 'ok',
      value: await runAgentSessionV3PilotRealCorpusBatchHandoffSourcePreflightRollup({
        entries: options.entries,
        prettyJson: options.prettyJson,
      }),
    };
  }

  return {
    errorMessage: null,
    status: 'not-provided',
    value: null,
  };
}

function createSourcePreflightRollupIssue(
  sourcePreflightRollup: SourcePreflightRollupReadResult,
) {
  if (sourcePreflightRollup.status === 'missing') {
    return createIssue({
      code: 'missing-source-preflight-rollup-json',
      detail: 'Source-preflight rollup JSON is missing and could not be read as an optional phase-coverage source.',
    });
  }

  if (sourcePreflightRollup.status === 'invalid') {
    return createIssue({
      code: 'invalid-source-preflight-rollup-json',
      detail: `Source-preflight rollup JSON is present but invalid as an optional phase-coverage source${sourcePreflightRollup.errorMessage ? `: ${sourcePreflightRollup.errorMessage}` : '.'}`,
    });
  }

  return null;
}

function sourcePreflightRollupEntries(value: Record<string, unknown> | null) {
  return value && Array.isArray(value.entries)
    ? value.entries.filter((entry): entry is Record<string, unknown> => (
      Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry)
    ))
    : [];
}

function sourcePreflightRollupPhaseCoverage(
  entry: Record<string, unknown> | undefined,
  key: 'readinessRollupPhaseCoverage' | 'reviewSummaryPhaseCoverage',
) {
  const value = entry?.[key];

  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as AgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageObservation
    : null;
}

function createIssue(options: {
  code: AgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageConsistencyAuditIssueCode;
  detail: string;
}): AgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageConsistencyAuditIssue {
  return {
    code: options.code,
    detail: options.detail,
    severity: 'review',
  };
}

function createEntryStatus(options: {
  artifactIntegrityPhaseCoverage: AgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageObservation | null;
  bundlePhaseCoverage: AgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageObservation | null;
  reviewerPacketPhaseCoverage: AgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageObservation | null;
  sourcePreflightRollupPhaseCoverage: AgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageObservation | null;
}) {
  if (
    !sameObservation(options.bundlePhaseCoverage, options.artifactIntegrityPhaseCoverage)
    || !sameObservation(options.bundlePhaseCoverage, options.reviewerPacketPhaseCoverage)
    || (
      options.sourcePreflightRollupPhaseCoverage !== null
      && !sameObservation(options.bundlePhaseCoverage, options.sourcePreflightRollupPhaseCoverage)
    )
  ) {
    return 'review-needed';
  }

  return 'consistent';
}

function createArtifactJsonSourceIssue(
  source: PhaseCoverageArtifactJsonSource,
) {
  if (source.read.status === 'missing') {
    return createIssue({
      code: 'missing-artifact-json',
      detail: `${source.label} JSON artifact is missing and could not be read as a phase-coverage source.`,
    });
  }

  if (source.read.status === 'invalid') {
    return createIssue({
      code: 'invalid-artifact-json',
      detail: `${source.label} JSON artifact is present but invalid as a phase-coverage source${source.read.errorMessage ? `: ${source.read.errorMessage}` : '.'}`,
    });
  }

  return null;
}

export function createAgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageConsistencyAuditEntryIssues(
  entry: Pick<
    AgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageConsistencyAuditEntry,
    | 'artifactIntegrityPhaseCoverage'
    | 'bundlePhaseCoverage'
    | 'label'
    | 'reviewerPacketPhaseCoverage'
    | 'sourcePreflightRollupPhaseCoverage'
  >,
): AgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageConsistencyAuditIssue[] {
  const issues: AgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageConsistencyAuditIssue[] = [];

  if (!sameObservation(entry.bundlePhaseCoverage, entry.artifactIntegrityPhaseCoverage)) {
    issues.push(createIssue({
      code: 'artifact-integrity-phase-coverage-mismatch',
      detail: `${entry.label} phase coverage differs between bundle JSON and artifact integrity observation.`,
    }));
  }
  if (!sameObservation(entry.bundlePhaseCoverage, entry.reviewerPacketPhaseCoverage)) {
    issues.push(createIssue({
      code: 'reviewer-packet-phase-coverage-mismatch',
      detail: `${entry.label} phase coverage differs between bundle JSON and reviewer packet summary.`,
    }));
  }
  if (
    entry.sourcePreflightRollupPhaseCoverage !== null
    && !sameObservation(entry.bundlePhaseCoverage, entry.sourcePreflightRollupPhaseCoverage)
  ) {
    issues.push(createIssue({
      code: 'source-preflight-rollup-phase-coverage-mismatch',
      detail: `${entry.label} phase coverage differs between bundle JSON and source-preflight rollup.`,
    }));
  }

  return issues;
}

function createSummaryText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageConsistencyAuditResult,
    'entries' | 'issueCount' | 'readyForProductionRuntime' | 'status'
  >,
) {
  return [
    `AgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageConsistencyAudit status=${result.status}`,
    `entries=${result.entries.length}`,
    `issues=${result.issueCount}`,
    `readyForProductionRuntime=${result.readyForProductionRuntime ? 'yes' : 'no'}`,
  ].join(' ');
}

function createReportText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageConsistencyAuditResult,
    'bundleDir' | 'entries' | 'issues' | 'summaryText'
  >,
) {
  return [
    result.summaryText,
    `bundleDir: ${result.bundleDir}`,
    result.entries.length ? 'phaseCoverageConsistencyEntries:' : 'phaseCoverageConsistencyEntries: none',
    ...result.entries.map((entry) => [
      `- role=${entry.role}`,
      `label=${entry.label}`,
      `status=${entry.status}`,
      `bundle=${formatAgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageObservation(entry.bundlePhaseCoverage)}`,
      `artifactIntegrity=${formatAgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageObservation(entry.artifactIntegrityPhaseCoverage)}`,
      `reviewerPacket=${formatAgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageObservation(entry.reviewerPacketPhaseCoverage)}`,
      `sourcePreflightRollup=${formatAgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageObservation(entry.sourcePreflightRollupPhaseCoverage)}`,
    ].join(' ')),
    result.issues.length ? 'phaseCoverageConsistencyIssues:' : 'phaseCoverageConsistencyIssues: none',
    ...result.issues.map((issue) => [
      `- severity=${issue.severity}`,
      `code=${issue.code}`,
      `detail=${issue.detail}`,
    ].join(' ')),
    'guardrail=caller-owned handoff phase-coverage consistency audit only; no sample collection, threshold decision, readiness change, runtime authority, tool selection, permission routing, execution, or recovery.',
  ].join('\n');
}

function createJsonText(
  result: AgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageConsistencyAuditResult,
  options: { prettyJson?: boolean } = {},
) {
  return JSON.stringify(result, null, options.prettyJson ? 2 : 0);
}

export async function runAgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageConsistencyAudit(
  options: RunAgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageConsistencyAuditOptions,
): Promise<AgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageConsistencyAuditResult> {
  const bundleDir = path.resolve(options.bundleDir);
  const artifactIntegrity = await runAgentSessionV3PilotRealCorpusBatchHandoffArtifactIntegrityReport({
    bundleDir,
    prettyJson: options.prettyJson,
  });
  const reviewerPacket = await runAgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketSummary({
    bundleDir,
    expectedSampleSource: options.expectedSampleSource,
    prettyJson: options.prettyJson,
  });
  const sourcePreflightRollup = await readSourcePreflightRollup({
    entries: options.sourcePreflightRollupEntries,
    jsonPath: options.sourcePreflightRollupJsonPath,
    prettyJson: options.prettyJson,
  });
  const reviewSummaryObservation = artifactIntegrity.observations.find((observation) => (
    observation.role === 'review-summary-json'
  ));
  const readinessRollupObservation = artifactIntegrity.observations.find((observation) => (
    observation.role === 'readiness-rollup-json'
  ));
  const reviewSummaryJsonRead = reviewSummaryObservation
    ? await readJsonObject(reviewSummaryObservation.path)
    : {
      errorMessage: null,
      status: 'missing',
      value: null,
    } satisfies ReadJsonObjectResult;
  const readinessRollupJsonRead = readinessRollupObservation
    ? await readJsonObject(readinessRollupObservation.path)
    : {
      errorMessage: null,
      status: 'missing',
      value: null,
    } satisfies ReadJsonObjectResult;
  const sourcePreflightRollupEntry = sourcePreflightRollupEntries(sourcePreflightRollup.value).find((entry) => (
    typeof entry.handoffBundleDir === 'string'
    && path.resolve(entry.handoffBundleDir) === bundleDir
  ));

  const entries: AgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageConsistencyAuditEntry[] = [
    {
      artifactIntegrityPhaseCoverage: reviewSummaryObservation?.phaseCoverage ?? null,
      bundlePhaseCoverage: createAgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageObservation({
        source: 'review-summary-json',
        value: reviewSummaryJsonRead.value,
      }),
      label: 'review-summary',
      reviewerPacketPhaseCoverage: reviewerPacket.reviewSummaryPhaseCoverage,
      role: 'review-summary-json',
      sourcePreflightRollupPhaseCoverage: sourcePreflightRollupPhaseCoverage(
        sourcePreflightRollupEntry,
        'reviewSummaryPhaseCoverage',
      ),
      status: 'consistent',
    },
    {
      artifactIntegrityPhaseCoverage: readinessRollupObservation?.phaseCoverage ?? null,
      bundlePhaseCoverage: createAgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageObservation({
        source: 'readiness-rollup-json',
        value: readinessRollupJsonRead.value,
      }),
      label: 'readiness-rollup',
      reviewerPacketPhaseCoverage: reviewerPacket.readinessRollupPhaseCoverage,
      role: 'readiness-rollup-json',
      sourcePreflightRollupPhaseCoverage: sourcePreflightRollupPhaseCoverage(
        sourcePreflightRollupEntry,
        'readinessRollupPhaseCoverage',
      ),
      status: 'consistent',
    },
  ].map((entry) => {
    const status = createEntryStatus(entry);

    return {
      ...entry,
      status,
    };
  });
  const issues: AgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageConsistencyAuditIssue[] = [];
  const artifactJsonSources: PhaseCoverageArtifactJsonSource[] = [
    {
      label: 'review-summary',
      read: reviewSummaryJsonRead,
    },
    {
      label: 'readiness-rollup',
      read: readinessRollupJsonRead,
    },
  ];

  for (const source of artifactJsonSources) {
    const issue = createArtifactJsonSourceIssue(source);

    if (issue) {
      issues.push(issue);
    }
  }
  const sourcePreflightIssue = createSourcePreflightRollupIssue(sourcePreflightRollup);

  if (sourcePreflightIssue) {
    issues.push(sourcePreflightIssue);
  }

  for (const entry of entries) {
    issues.push(...createAgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageConsistencyAuditEntryIssues(entry));
  }

  const resultWithoutText: AgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageConsistencyAuditResult = {
    bundleDir,
    entries,
    issueCount: issues.length,
    issues,
    jsonText: null,
    kind: 'agent-session-v3-pilot-real-corpus-batch-handoff-phase-coverage-consistency-audit',
    readyForProductionRuntime: false,
    reportText: '',
    status: issues.length ? 'review-needed' : 'consistent',
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

async function runAgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageConsistencyAuditCli() {
  const result = await runAgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageConsistencyAudit(
    parseArgs(process.argv.slice(2)),
  );
  console.log(result.reportText);
  if (result.jsonText) {
    console.log(result.jsonText);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageConsistencyAuditCli().catch((error: unknown) => {
    const errorText = error instanceof Error ? error.message : String(error);
    console.error(errorText);
    process.exitCode = 1;
  });
}
