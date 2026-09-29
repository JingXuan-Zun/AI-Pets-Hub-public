import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  runAgentSessionV3PilotRealCorpusBatchHandoffArtifactIntegrityReport,
  type AgentSessionV3PilotRealCorpusBatchHandoffArtifactIntegrityReportResult,
} from './agent-session-v3-pilot-real-corpus-batch-handoff-artifact-integrity-report.ts';
import {
  runAgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyReport,
  type AgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyReportResult,
} from './agent-session-v3-pilot-real-corpus-batch-handoff-sample-source-consistency-report.ts';
import type { AgentSessionV3PilotRealCorpusBatchHandoffBundleSampleSource } from './agent-session-v3-pilot-real-corpus-batch-handoff-bundle.ts';
import {
  createAgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageObservation,
  formatAgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageObservation,
  type AgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageObservation,
} from './agent-session-v3-pilot-real-corpus-batch-handoff-phase-coverage-observation.ts';

export type AgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketStatus =
  | 'blocked'
  | 'ready-for-reviewer'
  | 'review-needed';

export type AgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketIssueSeverity =
  | 'blocker'
  | 'review';

export type AgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketIssueCode =
  | 'artifact-integrity-blocked'
  | 'invalid-readiness-rollup-json'
  | 'invalid-review-summary-json'
  | 'missing-handoff-index'
  | 'missing-readiness-rollup-json'
  | 'missing-review-summary-json'
  | 'readiness-rollup-blocked'
  | 'readiness-rollup-review-needed'
  | 'review-summary-blocked'
  | 'review-summary-review-needed'
  | 'sample-source-blocked'
  | 'sample-source-review-needed';

export interface AgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketIssue {
  code: AgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketIssueCode;
  detail: string;
  severity: AgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketIssueSeverity;
}

export interface RunAgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketSummaryOptions {
  bundleDir: string;
  expectedSampleSource?: AgentSessionV3PilotRealCorpusBatchHandoffBundleSampleSource;
  includeJsonText?: boolean;
  prettyJson?: boolean;
}

export interface AgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketSummaryResult {
  artifactIntegrity: AgentSessionV3PilotRealCorpusBatchHandoffArtifactIntegrityReportResult;
  blockerCount: number;
  bundleDir: string;
  expectedSampleSource: AgentSessionV3PilotRealCorpusBatchHandoffBundleSampleSource | null;
  issueCount: number;
  issues: AgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketIssue[];
  jsonText: string | null;
  kind: 'agent-session-v3-pilot-real-corpus-batch-handoff-reviewer-packet-summary';
  optionalEvidenceReportCount: number;
  optionalEvidenceReportPaths: string[];
  readinessRollupStatus: string | null;
  readinessRollupPhaseCoverage: AgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageObservation | null;
  reportText: string;
  reviewCount: number;
  reviewSummaryStatus: string | null;
  reviewSummaryPhaseCoverage: AgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageObservation | null;
  sampleSourceConsistency: AgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyReportResult;
  sampleSourceStatus: string | null;
  status: AgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketStatus;
  statusCounts: Record<string, number> | null;
  summaryText: string;
  version: 1;
}

interface ReadJsonResult {
  errorMessage: string | null;
  present: boolean;
  value: Record<string, unknown> | null;
}

function parseAgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketSummaryArgs(
  args: readonly string[],
): RunAgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketSummaryOptions {
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
    throw new Error('Usage: npx tsx scripts/agent-session-v3-pilot-real-corpus-batch-handoff-reviewer-packet-summary.ts --dir handoff-bundle-dir [--expected-source real-exported|rehearsal|unknown] [--json] [--pretty]');
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

function parseSampleSource(
  value: string,
): AgentSessionV3PilotRealCorpusBatchHandoffBundleSampleSource {
  if (value === 'real-exported' || value === 'rehearsal' || value === 'unknown') {
    return value;
  }

  throw new Error(`Invalid sample source: ${value}. Expected real-exported, rehearsal, or unknown.`);
}

async function readJsonFile(filePath: string): Promise<ReadJsonResult> {
  try {
    const text = await readFile(filePath, 'utf8');

    try {
      const parsed = JSON.parse(text) as unknown;

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
  } catch (error: unknown) {
    if (getErrorCode(error) === 'ENOENT') {
      return {
        errorMessage: null,
        present: false,
        value: null,
      };
    }

    throw error;
  }
}

function stringValue(record: Record<string, unknown> | null, key: string) {
  return typeof record?.[key] === 'string' ? record[key] : null;
}

function numberRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const output: Record<string, number> = {};
  for (const [key, entry] of Object.entries(record)) {
    if (typeof entry === 'number') {
      output[key] = entry;
    }
  }

  return output;
}

function optionalEvidenceReportPaths(value: Record<string, unknown> | null) {
  if (!value || !Array.isArray(value.optionalEvidenceReports)) {
    return [];
  }

  return value.optionalEvidenceReports
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry))
    .map((entry) => entry.path)
    .filter((entry): entry is string => typeof entry === 'string');
}

function createIssue(options: {
  code: AgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketIssueCode;
  detail: string;
  severity: AgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketIssueSeverity;
}): AgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketIssue {
  return {
    code: options.code,
    detail: options.detail,
    severity: options.severity,
  };
}

function collectIssues(options: {
  artifactIntegrity: AgentSessionV3PilotRealCorpusBatchHandoffArtifactIntegrityReportResult;
  readinessRollupRead: ReadJsonResult;
  reviewSummaryRead: ReadJsonResult;
  sampleSourceConsistency: AgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyReportResult;
}) {
  const issues: AgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketIssue[] = [];

  if (options.artifactIntegrity.status === 'blocked') {
    issues.push(createIssue({
      code: 'artifact-integrity-blocked',
      detail: `Handoff artifact integrity is blocked with ${options.artifactIntegrity.issueCount} issue(s).`,
      severity: 'blocker',
    }));
  }

  if (options.sampleSourceConsistency.status === 'blocked') {
    issues.push(createIssue({
      code: 'sample-source-blocked',
      detail: `Handoff sample-source consistency is blocked with ${options.sampleSourceConsistency.issueCount} issue(s).`,
      severity: 'blocker',
    }));
  } else if (options.sampleSourceConsistency.status === 'review-needed') {
    issues.push(createIssue({
      code: 'sample-source-review-needed',
      detail: 'Handoff sample-source declaration still needs reviewer attention.',
      severity: 'review',
    }));
  }

  if (!options.reviewSummaryRead.present) {
    issues.push(createIssue({
      code: 'missing-review-summary-json',
      detail: 'review-summary-report.json is missing from the handoff bundle.',
      severity: 'blocker',
    }));
  } else if (!options.reviewSummaryRead.value) {
    issues.push(createIssue({
      code: 'invalid-review-summary-json',
      detail: options.reviewSummaryRead.errorMessage ?? 'review-summary-report.json is not a JSON object.',
      severity: 'blocker',
    }));
  } else if (options.reviewSummaryRead.value.status === 'blocked') {
    issues.push(createIssue({
      code: 'review-summary-blocked',
      detail: 'Review summary status is blocked.',
      severity: 'review',
    }));
  } else if (options.reviewSummaryRead.value.status === 'review-needed') {
    issues.push(createIssue({
      code: 'review-summary-review-needed',
      detail: 'Review summary status needs manual review.',
      severity: 'review',
    }));
  }

  if (!options.readinessRollupRead.present) {
    issues.push(createIssue({
      code: 'missing-readiness-rollup-json',
      detail: 'readiness-rollup-report.json is missing from the handoff bundle.',
      severity: 'blocker',
    }));
  } else if (!options.readinessRollupRead.value) {
    issues.push(createIssue({
      code: 'invalid-readiness-rollup-json',
      detail: options.readinessRollupRead.errorMessage ?? 'readiness-rollup-report.json is not a JSON object.',
      severity: 'blocker',
    }));
  } else if (options.readinessRollupRead.value.status === 'blocked') {
    issues.push(createIssue({
      code: 'readiness-rollup-blocked',
      detail: 'Readiness rollup status is blocked.',
      severity: 'review',
    }));
  } else if (options.readinessRollupRead.value.status === 'review-needed') {
    issues.push(createIssue({
      code: 'readiness-rollup-review-needed',
      detail: 'Readiness rollup status needs manual review.',
      severity: 'review',
    }));
  }

  return issues;
}

function createStatus(options: {
  blockerCount: number;
  reviewCount: number;
}): AgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketStatus {
  if (options.blockerCount > 0) {
    return 'blocked';
  }

  return options.reviewCount > 0 ? 'review-needed' : 'ready-for-reviewer';
}

function createSummaryText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketSummaryResult,
    | 'blockerCount'
    | 'artifactIntegrity'
    | 'issueCount'
    | 'optionalEvidenceReportCount'
    | 'readinessRollupPhaseCoverage'
    | 'readinessRollupStatus'
    | 'reviewCount'
    | 'reviewSummaryPhaseCoverage'
    | 'reviewSummaryStatus'
    | 'sampleSourceStatus'
    | 'status'
  >,
) {
  return [
    `AgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketSummary status=${result.status}`,
    `issues=${result.issueCount}`,
    `blockers=${result.blockerCount}`,
    `review=${result.reviewCount}`,
    `optionalEvidenceReports=${result.optionalEvidenceReportCount}`,
    `artifactIntegrity=${result.artifactIntegrity.status}`,
    `sampleSource=${result.sampleSourceStatus ?? 'missing'}`,
    `reviewSummary=${result.reviewSummaryStatus ?? 'missing'}`,
    `readinessRollup=${result.readinessRollupStatus ?? 'missing'}`,
    `reviewSummaryPhaseCoverage=${formatAgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageObservation(result.reviewSummaryPhaseCoverage)}`,
    `readinessRollupPhaseCoverage=${formatAgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageObservation(result.readinessRollupPhaseCoverage)}`,
  ].join(' ');
}

function createReportText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketSummaryResult,
    | 'artifactIntegrity'
    | 'bundleDir'
    | 'expectedSampleSource'
    | 'issues'
    | 'optionalEvidenceReportPaths'
    | 'readinessRollupPhaseCoverage'
    | 'readinessRollupStatus'
    | 'reviewSummaryPhaseCoverage'
    | 'reviewSummaryStatus'
    | 'sampleSourceConsistency'
    | 'statusCounts'
    | 'summaryText'
  >,
) {
  return [
    result.summaryText,
    `bundleDir: ${result.bundleDir}`,
    `expectedSampleSource: ${result.expectedSampleSource ?? 'none'}`,
    `artifactIntegrityStatus: ${result.artifactIntegrity.status}`,
    `artifactIntegrityIssues: ${result.artifactIntegrity.issueCount}`,
    `sampleSourceConsistencyStatus: ${result.sampleSourceConsistency.status}`,
    `sampleSourceConsistencyIssues: ${result.sampleSourceConsistency.issueCount}`,
    `reviewSummaryStatus: ${result.reviewSummaryStatus ?? 'missing'}`,
    `readinessRollupStatus: ${result.readinessRollupStatus ?? 'missing'}`,
    `reviewSummaryPhaseCoverage: ${formatAgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageObservation(result.reviewSummaryPhaseCoverage)}`,
    `readinessRollupPhaseCoverage: ${formatAgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageObservation(result.readinessRollupPhaseCoverage)}`,
    `optionalEvidenceReports: ${result.optionalEvidenceReportPaths.length ? result.optionalEvidenceReportPaths.join(',') : 'none'}`,
    `statusCounts: ${result.statusCounts ? JSON.stringify(result.statusCounts) : 'missing'}`,
    result.issues.length ? 'reviewerPacketIssues:' : 'reviewerPacketIssues: none',
    ...result.issues.map((issue) => [
      `- severity=${issue.severity}`,
      `code=${issue.code}`,
      `detail=${issue.detail}`,
    ].join(' ')),
    'guardrail=caller-owned handoff reviewer packet summary only; no sample collection, threshold decision, readiness change, runtime authority, tool selection, permission routing, execution, or recovery.',
  ].join('\n');
}

function createJsonText(
  result: AgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketSummaryResult,
  options: { prettyJson?: boolean } = {},
) {
  return JSON.stringify(result, null, options.prettyJson ? 2 : 0);
}

export async function runAgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketSummary(
  options: RunAgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketSummaryOptions,
): Promise<AgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketSummaryResult> {
  const bundleDir = path.resolve(options.bundleDir);
  const artifactIntegrity = await runAgentSessionV3PilotRealCorpusBatchHandoffArtifactIntegrityReport({
    bundleDir,
    prettyJson: options.prettyJson,
  });
  const sampleSourceConsistency = await runAgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyReport({
    bundleDir,
    expectedSampleSource: options.expectedSampleSource,
    prettyJson: options.prettyJson,
  });
  const reviewSummaryJsonPath = artifactIntegrity.observations.find((observation) => (
    observation.role === 'review-summary-json'
  ))?.path ?? path.join(bundleDir, 'review-summary-report.json');
  const readinessRollupJsonPath = artifactIntegrity.observations.find((observation) => (
    observation.role === 'readiness-rollup-json'
  ))?.path ?? path.join(bundleDir, 'readiness-rollup-report.json');
  const [reviewSummaryRead, readinessRollupRead] = await Promise.all([
    readJsonFile(reviewSummaryJsonPath),
    readJsonFile(readinessRollupJsonPath),
  ]);
  const issues = collectIssues({
    artifactIntegrity,
    readinessRollupRead,
    reviewSummaryRead,
    sampleSourceConsistency,
  });
  const optionalReportPaths = optionalEvidenceReportPaths(reviewSummaryRead.value);
  const reviewSummaryPhaseCoverage = createAgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageObservation({
    source: 'review-summary-json',
    value: reviewSummaryRead.value,
  });
  const readinessRollupPhaseCoverage = createAgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageObservation({
    source: 'readiness-rollup-json',
    value: readinessRollupRead.value,
  });
  const blockerCount = issues.filter((issue) => issue.severity === 'blocker').length;
  const reviewCount = issues.filter((issue) => issue.severity === 'review').length;
  const resultWithoutText: AgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketSummaryResult = {
    artifactIntegrity,
    blockerCount,
    bundleDir,
    expectedSampleSource: options.expectedSampleSource ?? null,
    issueCount: issues.length,
    issues,
    jsonText: null,
    kind: 'agent-session-v3-pilot-real-corpus-batch-handoff-reviewer-packet-summary',
    optionalEvidenceReportCount: optionalReportPaths.length,
    optionalEvidenceReportPaths: optionalReportPaths,
    readinessRollupPhaseCoverage,
    readinessRollupStatus: stringValue(readinessRollupRead.value, 'status'),
    reportText: '',
    reviewCount,
    reviewSummaryPhaseCoverage,
    reviewSummaryStatus: stringValue(reviewSummaryRead.value, 'status'),
    sampleSourceConsistency,
    sampleSourceStatus: sampleSourceConsistency.sampleSourceStatus,
    status: createStatus({
      blockerCount,
      reviewCount,
    }),
    statusCounts: numberRecord(reviewSummaryRead.value?.statusCounts ?? null),
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

async function runAgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketSummaryCli() {
  const options = parseAgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketSummaryArgs(process.argv.slice(2));
  const result = await runAgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketSummary(options);
  console.log(result.reportText);
  if (result.jsonText) {
    console.log(result.jsonText);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketSummaryCli().catch((error: unknown) => {
    const errorText = error instanceof Error ? error.message : String(error);
    console.error(errorText);
    process.exitCode = 1;
  });
}
