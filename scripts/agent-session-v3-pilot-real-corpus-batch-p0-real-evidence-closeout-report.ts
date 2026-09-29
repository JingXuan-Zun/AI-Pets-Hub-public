import { pathToFileURL } from 'node:url';
import {
  createAgentSessionV3PilotRealCorpusBatchNextEvidenceTargetReport,
} from './agent-session-v3-pilot-real-corpus-batch-next-evidence-target-report.ts';
import {
  createAgentSessionV3PilotRealCorpusBatchPackageHealthRollup,
} from './agent-session-v3-pilot-real-corpus-batch-package-health-rollup.ts';
import {
  runAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport,
  type AgentSessionV3PilotRealCorpusBatchP0IntakeTargetSignal,
  type AgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatus,
} from './agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts';
import {
  runAgentSessionV3PilotRealCorpusBatchReadinessRollupReport,
  type AgentSessionV3PilotRealCorpusBatchReadinessRollupStatus,
  type AgentSessionV3PilotRealCorpusBatchReadinessRollupStatusCounts,
} from './agent-session-v3-pilot-real-corpus-batch-readiness-rollup-report.ts';

export type AgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutStatus =
  | 'blocked'
  | 'no-intake-dirs'
  | 'package-attention-needed'
  | 'ready-for-manual-review'
  | 'review-needed';

export type AgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReadinessStatus =
  | AgentSessionV3PilotRealCorpusBatchReadinessRollupStatus
  | 'not-run';

export interface RunAgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReportOptions {
  includeJsonText?: boolean;
  intakeDirs?: readonly string[];
  prettyJson?: boolean;
  projectRoot?: string;
}

export interface AgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReportResult {
  closeoutReasons: string[];
  guardrail: string;
  intakeCount: number;
  jsonText: string | null;
  kind: 'agent-session-v3-pilot-real-corpus-batch-p0-real-evidence-closeout-report';
  nextEvidenceTargetStatus: string;
  nextEvidenceTargetSummaryText: string;
  nextPriority: string | null;
  p0BlockedCount: number;
  p0IntakeTargetStatus: AgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatus;
  p0IntakeTargetStatusSummaryText: string;
  p0ReadyForManualReviewCount: number;
  p0ReviewNeededCount: number;
  p0TargetCount: number;
  p0TargetSignals: AgentSessionV3PilotRealCorpusBatchP0IntakeTargetSignal[];
  packageHealthStatus: string;
  packageHealthSummaryText: string;
  readinessRollupStatus: AgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReadinessStatus;
  readinessStatusCounts: AgentSessionV3PilotRealCorpusBatchReadinessRollupStatusCounts | null;
  readinessSummaryText: string | null;
  readinessTotalBlockerItems: number;
  readinessTotalReviewItems: number;
  readyForProductionRuntime: false;
  reportText: string;
  status: AgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutStatus;
  summaryText: string;
  version: 1;
}

function parseArgs(
  args: readonly string[],
): RunAgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReportOptions {
  const intakeDirs: string[] = [];
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
        throw new Error('Missing intake directory after --dir.');
      }
      intakeDirs.push(nextArg);
      index += 1;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  return {
    includeJsonText,
    intakeDirs,
    prettyJson,
  };
}

function createStatus(options: {
  intakeCount: number;
  p0Status: AgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatus;
  packageHealthStatus: string;
  readinessStatus: AgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReadinessStatus;
}): AgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutStatus {
  if (
    options.packageHealthStatus === 'missing-package-entry'
    || options.packageHealthStatus === 'package-attention-needed'
  ) {
    return 'package-attention-needed';
  }
  if (options.intakeCount === 0) {
    return 'no-intake-dirs';
  }
  if (options.p0Status === 'blocked' || options.readinessStatus === 'blocked') {
    return 'blocked';
  }
  if (options.p0Status === 'review-needed' || options.readinessStatus === 'review-needed') {
    return 'review-needed';
  }

  return 'ready-for-manual-review';
}

function createCloseoutReasons(options: {
  p0TargetSignals: readonly AgentSessionV3PilotRealCorpusBatchP0IntakeTargetSignal[];
  packageHealthStatus: string;
  readinessStatus: AgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReadinessStatus;
  readinessTotalBlockerItems: number;
  readinessTotalReviewItems: number;
  status: AgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutStatus;
}) {
  const reasons: string[] = [];

  if (options.status === 'package-attention-needed') {
    reasons.push(`package health is ${options.packageHealthStatus}; fix package/index linkage before interpreting P0 intake evidence`);
  }
  if (options.status === 'no-intake-dirs') {
    reasons.push('no explicit intake directories were supplied');
  }
  for (const signal of options.p0TargetSignals) {
    if (signal.status !== 'ready-for-manual-review') {
      reasons.push(`P0 target ${signal.gapKind} is ${signal.status}`);
    }
  }
  if (options.readinessStatus === 'blocked') {
    reasons.push(`readiness rollup is blocked with ${options.readinessTotalBlockerItems} blocker item(s)`);
  } else if (options.readinessStatus === 'review-needed') {
    reasons.push(`readiness rollup needs review with ${options.readinessTotalReviewItems} review item(s)`);
  } else if (options.status === 'ready-for-manual-review') {
    reasons.push('explicit P0 intake status and readiness rollup are ready for manual review');
  }

  return reasons;
}

function createSummaryText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReportResult,
    | 'intakeCount'
    | 'nextPriority'
    | 'p0BlockedCount'
    | 'p0IntakeTargetStatus'
    | 'p0ReadyForManualReviewCount'
    | 'p0ReviewNeededCount'
    | 'p0TargetCount'
    | 'packageHealthStatus'
    | 'readinessRollupStatus'
    | 'readyForProductionRuntime'
    | 'status'
  >,
) {
  return [
    `AgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReport status=${result.status}`,
    `packageHealth=${result.packageHealthStatus}`,
    `nextPriority=${result.nextPriority ?? 'none'}`,
    `intakes=${result.intakeCount}`,
    `p0Status=${result.p0IntakeTargetStatus}`,
    `p0Targets=${result.p0TargetCount}`,
    `p0Blocked=${result.p0BlockedCount}`,
    `p0ReviewNeeded=${result.p0ReviewNeededCount}`,
    `p0ReadyForManualReview=${result.p0ReadyForManualReviewCount}`,
    `readinessRollup=${result.readinessRollupStatus}`,
    `readyForProductionRuntime=${result.readyForProductionRuntime ? 'yes' : 'no'}`,
  ].join(' ');
}

function createReportText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReportResult,
    | 'closeoutReasons'
    | 'guardrail'
    | 'nextEvidenceTargetSummaryText'
    | 'p0IntakeTargetStatusSummaryText'
    | 'p0TargetSignals'
    | 'packageHealthSummaryText'
    | 'readinessSummaryText'
    | 'summaryText'
  >,
) {
  return [
    result.summaryText,
    `packageHealthSummary=${result.packageHealthSummaryText}`,
    `nextEvidenceTargetSummary=${result.nextEvidenceTargetSummaryText}`,
    `p0IntakeTargetStatusSummary=${result.p0IntakeTargetStatusSummaryText}`,
    `readinessRollupSummary=${result.readinessSummaryText ?? 'not-run'}`,
    result.p0TargetSignals.length ? 'p0TargetSignals:' : 'p0TargetSignals: none',
    ...result.p0TargetSignals.map((signal) => [
      `- gapKind=${signal.gapKind}`,
      `status=${signal.status}`,
      `intakes=${signal.intakeCount}`,
      `blocked=${signal.blockedIntakeCount}`,
      `reviewNeeded=${signal.reviewNeededIntakeCount}`,
      `readyForManualReview=${signal.readyForManualReviewIntakeCount}`,
      `missingReason=${signal.missingReason ?? 'none'}`,
    ].join(' ')),
    result.closeoutReasons.length ? 'closeoutReasons:' : 'closeoutReasons: none',
    ...result.closeoutReasons.map((reason) => `- ${reason}`),
    `guardrail=${result.guardrail}`,
  ].join('\n');
}

function createJsonText(
  result: AgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReportResult,
  options: { prettyJson?: boolean } = {},
) {
  return JSON.stringify(result, null, options.prettyJson ? 2 : 0);
}

export async function runAgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReport(
  options: RunAgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReportOptions = {},
): Promise<AgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReportResult> {
  const packageHealth = createAgentSessionV3PilotRealCorpusBatchPackageHealthRollup({
    projectRoot: options.projectRoot,
  });
  const nextEvidenceTarget = createAgentSessionV3PilotRealCorpusBatchNextEvidenceTargetReport({
    projectRoot: options.projectRoot,
  });
  const p0IntakeTargetStatus = await runAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport({
    intakeDirs: options.intakeDirs ?? [],
    prettyJson: options.prettyJson,
    projectRoot: options.projectRoot,
  });
  const readinessRollup = (options.intakeDirs?.length ?? 0) > 0
    ? await runAgentSessionV3PilotRealCorpusBatchReadinessRollupReport({
      intakeDirs: options.intakeDirs ?? [],
      prettyJson: options.prettyJson,
    })
    : null;
  const readinessRollupStatus = readinessRollup?.status ?? 'not-run';
  const status = createStatus({
    intakeCount: p0IntakeTargetStatus.intakeCount,
    p0Status: p0IntakeTargetStatus.status,
    packageHealthStatus: packageHealth.status,
    readinessStatus: readinessRollupStatus,
  });
  const resultWithoutText: AgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReportResult = {
    closeoutReasons: createCloseoutReasons({
      p0TargetSignals: p0IntakeTargetStatus.p0TargetSignals,
      packageHealthStatus: packageHealth.status,
      readinessStatus: readinessRollupStatus,
      readinessTotalBlockerItems: readinessRollup?.totalBlockerItems ?? 0,
      readinessTotalReviewItems: readinessRollup?.totalReviewItems ?? 0,
      status,
    }),
    guardrail: 'caller-owned P0 real evidence closeout report only; does not discover directories, collect samples, run smoke tests, create task queues, create handoff bundles, choose thresholds, route permissions, execute tools, decide recovery, define workflows, change readiness, define runtime action order, or grant runtime authority.',
    intakeCount: p0IntakeTargetStatus.intakeCount,
    jsonText: null,
    kind: 'agent-session-v3-pilot-real-corpus-batch-p0-real-evidence-closeout-report',
    nextEvidenceTargetStatus: nextEvidenceTarget.status,
    nextEvidenceTargetSummaryText: nextEvidenceTarget.summaryText,
    nextPriority: nextEvidenceTarget.nextPriority,
    p0BlockedCount: p0IntakeTargetStatus.blockedCount,
    p0IntakeTargetStatus: p0IntakeTargetStatus.status,
    p0IntakeTargetStatusSummaryText: p0IntakeTargetStatus.summaryText,
    p0ReadyForManualReviewCount: p0IntakeTargetStatus.readyForManualReviewCount,
    p0ReviewNeededCount: p0IntakeTargetStatus.reviewNeededCount,
    p0TargetCount: p0IntakeTargetStatus.p0TargetCount,
    p0TargetSignals: p0IntakeTargetStatus.p0TargetSignals,
    packageHealthStatus: packageHealth.status,
    packageHealthSummaryText: packageHealth.summaryText,
    readinessRollupStatus,
    readinessStatusCounts: readinessRollup?.statusCounts ?? null,
    readinessSummaryText: readinessRollup?.summaryText ?? null,
    readinessTotalBlockerItems: readinessRollup?.totalBlockerItems ?? 0,
    readinessTotalReviewItems: readinessRollup?.totalReviewItems ?? 0,
    readyForProductionRuntime: false,
    reportText: '',
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

async function runAgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReportCli() {
  const options = parseArgs(process.argv.slice(2));
  const result = await runAgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReport(options);
  console.log(result.reportText);
  if (result.jsonText) {
    console.log(result.jsonText);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReportCli().catch((error: unknown) => {
    const errorText = error instanceof Error ? error.message : String(error);
    console.error(errorText);
    process.exitCode = 1;
  });
}
