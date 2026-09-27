import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { AgentSessionV3PilotRealCorpusBatchHandoffBundleSampleSource } from './agent-session-v3-pilot-real-corpus-batch-handoff-bundle.ts';
import {
  formatAgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageObservation,
  type AgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageObservation,
} from './agent-session-v3-pilot-real-corpus-batch-handoff-phase-coverage-observation.ts';
import { runAgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketSummary } from './agent-session-v3-pilot-real-corpus-batch-handoff-reviewer-packet-summary.ts';
import { runAgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflight } from './agent-session-v3-pilot-real-corpus-batch-source-declaration-preflight.ts';

export type AgentSessionV3PilotRealCorpusBatchHandoffSourcePreflightRollupStatus =
  | 'blocked'
  | 'consistent'
  | 'review-needed';

export interface AgentSessionV3PilotRealCorpusBatchHandoffSourcePreflightRollupInput {
  expectedSampleSource?: AgentSessionV3PilotRealCorpusBatchHandoffBundleSampleSource;
  handoffBundleDir: string;
  intakeDir: string;
  label: string;
}

export interface AgentSessionV3PilotRealCorpusBatchHandoffSourcePreflightRollupEntry {
  blockerCount: number;
  expectedSampleSource: AgentSessionV3PilotRealCorpusBatchHandoffBundleSampleSource | null;
  handoffBundleDir: string;
  handoffSampleSource: string | null;
  handoffSampleSourceStatus: string | null;
  intakeDir: string;
  issueCount: number;
  label: string;
  readinessRollupPhaseCoverage: AgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageObservation | null;
  reviewerPacketIssueCodes: string[];
  reviewerPacketStatus: string;
  reviewSummaryPhaseCoverage: AgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageObservation | null;
  reviewCount: number;
  sampleSource: string | null;
  sampleSourceConsistencyIssueCodes: string[];
  sampleSourceConsistencyStatus: string;
  sampleSourceStatus: string | null;
  sourcePreflightIssueCodes: string[];
  sourcePreflightStatus: string;
  status: AgentSessionV3PilotRealCorpusBatchHandoffSourcePreflightRollupStatus;
  summaryText: string;
}

export interface RunAgentSessionV3PilotRealCorpusBatchHandoffSourcePreflightRollupOptions {
  entries: readonly AgentSessionV3PilotRealCorpusBatchHandoffSourcePreflightRollupInput[];
  includeJsonText?: boolean;
  prettyJson?: boolean;
}

export interface AgentSessionV3PilotRealCorpusBatchHandoffSourcePreflightRollupResult {
  blockerCount: number;
  entries: AgentSessionV3PilotRealCorpusBatchHandoffSourcePreflightRollupEntry[];
  entryCount: number;
  guardrail: string;
  issueCount: number;
  jsonText: string | null;
  kind: 'agent-session-v3-pilot-real-corpus-batch-handoff-source-preflight-rollup';
  readyForProductionRuntime: false;
  reportText: string;
  reviewCount: number;
  status: AgentSessionV3PilotRealCorpusBatchHandoffSourcePreflightRollupStatus;
  statusCounts: Record<AgentSessionV3PilotRealCorpusBatchHandoffSourcePreflightRollupStatus, number>;
  summaryText: string;
  version: 1;
}

interface ParsedCase {
  expectedSampleSource?: AgentSessionV3PilotRealCorpusBatchHandoffBundleSampleSource;
  handoffBundleDir?: string;
  intakeDir?: string;
  label: string;
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
): RunAgentSessionV3PilotRealCorpusBatchHandoffSourcePreflightRollupOptions {
  let includeJsonText = false;
  let prettyJson = false;
  const entries: AgentSessionV3PilotRealCorpusBatchHandoffSourcePreflightRollupInput[] = [];
  let current: ParsedCase | null = null;

  function requireCurrent(arg: string) {
    if (!current) {
      throw new Error(`Expected --case before ${arg}.`);
    }

    return current;
  }

  function pushCurrent() {
    if (!current) {
      return;
    }
    if (!current.intakeDir || !current.handoffBundleDir) {
      throw new Error(`Incomplete case ${current.label}. Expected --dir and --handoff-dir.`);
    }

    entries.push({
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
    } else if (arg === '--case') {
      const nextArg = args[index + 1];
      if (!nextArg) {
        throw new Error('Missing label after --case.');
      }
      pushCurrent();
      current = {
        label: nextArg,
      };
      index += 1;
    } else if (arg === '--dir') {
      const nextArg = args[index + 1];
      if (!nextArg) {
        throw new Error('Missing intake directory after --dir.');
      }
      requireCurrent(arg).intakeDir = nextArg;
      index += 1;
    } else if (arg === '--handoff-dir') {
      const nextArg = args[index + 1];
      if (!nextArg) {
        throw new Error('Missing handoff directory after --handoff-dir.');
      }
      requireCurrent(arg).handoffBundleDir = nextArg;
      index += 1;
    } else if (arg === '--expected-source') {
      const nextArg = args[index + 1];
      if (!nextArg) {
        throw new Error('Missing sample source after --expected-source.');
      }
      requireCurrent(arg).expectedSampleSource = parseSampleSource(nextArg);
      index += 1;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  pushCurrent();

  if (entries.length === 0) {
    throw new Error('Usage: npx tsx scripts/agent-session-v3-pilot-real-corpus-batch-handoff-source-preflight-rollup.ts --case label --dir intake-dir --handoff-dir handoff-dir [--expected-source real-exported|rehearsal|unknown] [...cases] [--json] [--pretty]');
  }

  return {
    entries,
    includeJsonText,
    prettyJson,
  };
}

function createStatus(options: {
  blockerCount: number;
  reviewCount: number;
}): AgentSessionV3PilotRealCorpusBatchHandoffSourcePreflightRollupStatus {
  if (options.blockerCount > 0) {
    return 'blocked';
  }

  return options.reviewCount > 0 ? 'review-needed' : 'consistent';
}

function createStatusCounts(
  entries: readonly AgentSessionV3PilotRealCorpusBatchHandoffSourcePreflightRollupEntry[],
) {
  const statusCounts: Record<AgentSessionV3PilotRealCorpusBatchHandoffSourcePreflightRollupStatus, number> = {
    blocked: 0,
    consistent: 0,
    'review-needed': 0,
  };

  for (const entry of entries) {
    statusCounts[entry.status] += 1;
  }

  return statusCounts;
}

function createEntrySummaryText(
  entry: Pick<
    AgentSessionV3PilotRealCorpusBatchHandoffSourcePreflightRollupEntry,
    | 'blockerCount'
    | 'issueCount'
    | 'label'
    | 'reviewerPacketStatus'
    | 'reviewSummaryPhaseCoverage'
    | 'reviewCount'
    | 'readinessRollupPhaseCoverage'
    | 'sampleSourceConsistencyStatus'
    | 'sourcePreflightStatus'
    | 'status'
  >,
) {
  return [
    `label=${entry.label}`,
    `status=${entry.status}`,
    `sourcePreflight=${entry.sourcePreflightStatus}`,
    `sampleSourceConsistency=${entry.sampleSourceConsistencyStatus}`,
    `reviewerPacket=${entry.reviewerPacketStatus}`,
    `reviewSummaryPhaseCoverage=${formatAgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageObservation(entry.reviewSummaryPhaseCoverage)}`,
    `readinessRollupPhaseCoverage=${formatAgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageObservation(entry.readinessRollupPhaseCoverage)}`,
    `issues=${entry.issueCount}`,
    `blockers=${entry.blockerCount}`,
    `review=${entry.reviewCount}`,
  ].join(' ');
}

async function createEntry(
  input: AgentSessionV3PilotRealCorpusBatchHandoffSourcePreflightRollupInput,
  options: { prettyJson?: boolean } = {},
): Promise<AgentSessionV3PilotRealCorpusBatchHandoffSourcePreflightRollupEntry> {
  const intakeDir = path.resolve(input.intakeDir);
  const handoffBundleDir = path.resolve(input.handoffBundleDir);
  const sourcePreflight = await runAgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflight({
    expectedSampleSource: input.expectedSampleSource,
    handoffBundleDir,
    intakeDir,
    prettyJson: options.prettyJson,
  });
  const sampleSourceConsistency = sourcePreflight.handoffConsistencyReport;

  if (!sampleSourceConsistency) {
    throw new Error(`Expected handoff sample-source consistency report for case ${input.label}.`);
  }

  const reviewerPacket = await runAgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketSummary({
    bundleDir: handoffBundleDir,
    expectedSampleSource: input.expectedSampleSource,
    prettyJson: options.prettyJson,
  });
  const blockerCount = sourcePreflight.blockerCount
    + sampleSourceConsistency.blockerCount
    + reviewerPacket.blockerCount;
  const reviewCount = sourcePreflight.reviewCount
    + sampleSourceConsistency.reviewCount
    + reviewerPacket.reviewCount;
  const issueCount = sourcePreflight.issueCount
    + sampleSourceConsistency.issueCount
    + reviewerPacket.issueCount;
  const status = createStatus({
    blockerCount,
    reviewCount,
  });
  const entryWithoutSummary: AgentSessionV3PilotRealCorpusBatchHandoffSourcePreflightRollupEntry = {
    blockerCount,
    expectedSampleSource: input.expectedSampleSource ?? null,
    handoffBundleDir,
    handoffSampleSource: sampleSourceConsistency.sampleSource,
    handoffSampleSourceStatus: sampleSourceConsistency.sampleSourceStatus,
    intakeDir,
    issueCount,
    label: input.label,
    readinessRollupPhaseCoverage: reviewerPacket.readinessRollupPhaseCoverage,
    reviewerPacketIssueCodes: reviewerPacket.issues.map((issue) => issue.code),
    reviewerPacketStatus: reviewerPacket.status,
    reviewSummaryPhaseCoverage: reviewerPacket.reviewSummaryPhaseCoverage,
    reviewCount,
    sampleSource: sourcePreflight.sampleSource,
    sampleSourceConsistencyIssueCodes: sampleSourceConsistency.issues.map((issue) => issue.code),
    sampleSourceConsistencyStatus: sampleSourceConsistency.status,
    sampleSourceStatus: sourcePreflight.sampleSourceStatus,
    sourcePreflightIssueCodes: sourcePreflight.issues.map((issue) => issue.code),
    sourcePreflightStatus: sourcePreflight.status,
    status,
    summaryText: '',
  };

  return {
    ...entryWithoutSummary,
    summaryText: createEntrySummaryText(entryWithoutSummary),
  };
}

function createSummaryText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchHandoffSourcePreflightRollupResult,
    | 'blockerCount'
    | 'entryCount'
    | 'issueCount'
    | 'readyForProductionRuntime'
    | 'reviewCount'
    | 'status'
    | 'statusCounts'
  >,
) {
  return [
    `AgentSessionV3PilotRealCorpusBatchHandoffSourcePreflightRollup status=${result.status}`,
    `entries=${result.entryCount}`,
    `consistent=${result.statusCounts.consistent}`,
    `reviewNeeded=${result.statusCounts['review-needed']}`,
    `blocked=${result.statusCounts.blocked}`,
    `issues=${result.issueCount}`,
    `blockers=${result.blockerCount}`,
    `review=${result.reviewCount}`,
    `readyForProductionRuntime=${result.readyForProductionRuntime ? 'yes' : 'no'}`,
  ].join(' ');
}

function createReportText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchHandoffSourcePreflightRollupResult,
    'entries' | 'guardrail' | 'statusCounts' | 'summaryText'
  >,
) {
  return [
    result.summaryText,
    'statusCounts:',
    ...Object.entries(result.statusCounts).map(([status, count]) => `- status=${status} entries=${count}`),
    result.entries.length ? 'handoffSourcePreflightEntries:' : 'handoffSourcePreflightEntries: none',
    ...result.entries.map((entry) => [
      `- ${entry.summaryText}`,
      `sampleSource=${entry.sampleSource ?? 'missing'}`,
      `sampleSourceStatus=${entry.sampleSourceStatus ?? 'missing'}`,
      `handoffSampleSource=${entry.handoffSampleSource ?? 'missing'}`,
      `handoffSampleSourceStatus=${entry.handoffSampleSourceStatus ?? 'missing'}`,
      `expectedSampleSource=${entry.expectedSampleSource ?? 'none'}`,
      `reviewSummaryPhaseCoverage=${formatAgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageObservation(entry.reviewSummaryPhaseCoverage)}`,
      `readinessRollupPhaseCoverage=${formatAgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageObservation(entry.readinessRollupPhaseCoverage)}`,
      `sourcePreflightIssues=${entry.sourcePreflightIssueCodes.length ? entry.sourcePreflightIssueCodes.join(',') : 'none'}`,
      `sampleSourceConsistencyIssues=${entry.sampleSourceConsistencyIssueCodes.length ? entry.sampleSourceConsistencyIssueCodes.join(',') : 'none'}`,
      `reviewerPacketIssues=${entry.reviewerPacketIssueCodes.length ? entry.reviewerPacketIssueCodes.join(',') : 'none'}`,
      `intakeDir=${entry.intakeDir}`,
      `handoffBundleDir=${entry.handoffBundleDir}`,
    ].join(' ')),
    `guardrail=${result.guardrail}`,
  ].join('\n');
}

function createJsonText(
  result: AgentSessionV3PilotRealCorpusBatchHandoffSourcePreflightRollupResult,
  options: { prettyJson?: boolean } = {},
) {
  return JSON.stringify(result, null, options.prettyJson ? 2 : 0);
}

export async function runAgentSessionV3PilotRealCorpusBatchHandoffSourcePreflightRollup(
  options: RunAgentSessionV3PilotRealCorpusBatchHandoffSourcePreflightRollupOptions,
): Promise<AgentSessionV3PilotRealCorpusBatchHandoffSourcePreflightRollupResult> {
  const entries = await Promise.all(options.entries.map((entry) => createEntry(entry, {
    prettyJson: options.prettyJson,
  })));
  const blockerCount = entries.reduce((sum, entry) => sum + entry.blockerCount, 0);
  const reviewCount = entries.reduce((sum, entry) => sum + entry.reviewCount, 0);
  const issueCount = entries.reduce((sum, entry) => sum + entry.issueCount, 0);
  const statusCounts = createStatusCounts(entries);
  const resultWithoutText: AgentSessionV3PilotRealCorpusBatchHandoffSourcePreflightRollupResult = {
    blockerCount,
    entries,
    entryCount: entries.length,
    guardrail: 'caller-owned handoff source preflight rollup only; does not collect samples, choose thresholds, change readiness, make handoff bundles authoritative, route permissions, execute tools, decide recovery, define workflows, define runtime action order, or grant runtime authority.',
    issueCount,
    jsonText: null,
    kind: 'agent-session-v3-pilot-real-corpus-batch-handoff-source-preflight-rollup',
    readyForProductionRuntime: false,
    reportText: '',
    reviewCount,
    status: createStatus({
      blockerCount,
      reviewCount,
    }),
    statusCounts,
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

async function runAgentSessionV3PilotRealCorpusBatchHandoffSourcePreflightRollupCli() {
  const result = await runAgentSessionV3PilotRealCorpusBatchHandoffSourcePreflightRollup(
    parseArgs(process.argv.slice(2)),
  );
  console.log(result.reportText);
  if (result.jsonText) {
    console.log(result.jsonText);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAgentSessionV3PilotRealCorpusBatchHandoffSourcePreflightRollupCli().catch((error: unknown) => {
    const errorText = error instanceof Error ? error.message : String(error);
    console.error(errorText);
    process.exitCode = 1;
  });
}
