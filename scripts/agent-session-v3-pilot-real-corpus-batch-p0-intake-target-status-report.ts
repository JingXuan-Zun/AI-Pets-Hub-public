import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  runAgentSessionV3PilotRealCorpusBatchIntakeValidator,
  type AgentSessionV3PilotRealCorpusBatchIntakeValidationStatus,
} from './agent-session-v3-pilot-real-corpus-batch-intake-validator.ts';
import { createAgentSessionV3PilotRealCorpusBatchNextEvidenceTargetReport } from './agent-session-v3-pilot-real-corpus-batch-next-evidence-target-report.ts';
import {
  runAgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflight,
  type AgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflightStatus,
} from './agent-session-v3-pilot-real-corpus-batch-source-declaration-preflight.ts';

export type AgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatus =
  | 'blocked'
  | 'no-intake-dirs'
  | 'ready-for-manual-review'
  | 'review-needed';

export interface AgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusEntry {
  blockerReasons: string[];
  hasProductionLikeSourceKind: boolean;
  indexManifestCount: number;
  intakeDir: string;
  manifestSourceCount: number;
  noteOpenItemCount: number;
  noteStatus: string;
  reviewReasons: string[];
  sourceDeclarationStatus: AgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflightStatus;
  sourceSampleSource: string | null;
  sourceSampleSourceStatus: string | null;
  status: Exclude<AgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatus, 'no-intake-dirs'>;
  validatorStatus: AgentSessionV3PilotRealCorpusBatchIntakeValidationStatus;
}

export type AgentSessionV3PilotRealCorpusBatchP0IntakeTargetSignalStatus =
  | 'blocked'
  | 'missing'
  | 'ready-for-manual-review'
  | 'review-needed';

export interface AgentSessionV3PilotRealCorpusBatchP0IntakeTargetSignal {
  blockedIntakeCount: number;
  evidenceReasons: string[];
  gapKind: string;
  intakeCount: number;
  missingReason: string | null;
  readyForManualReviewIntakeCount: number;
  reviewNeededIntakeCount: number;
  status: AgentSessionV3PilotRealCorpusBatchP0IntakeTargetSignalStatus;
}

export interface AgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReportResult {
  blockedCount: number;
  entries: AgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusEntry[];
  guardrail: string;
  intakeCount: number;
  jsonText: string | null;
  kind: 'agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report';
  nextEvidenceTargetSummaryText: string;
  nextPriority: string | null;
  p0TargetCount: number;
  p0TargetGapKinds: string[];
  p0TargetSignals: AgentSessionV3PilotRealCorpusBatchP0IntakeTargetSignal[];
  readyForManualReviewCount: number;
  readyForProductionRuntime: false;
  reportText: string;
  reviewNeededCount: number;
  status: AgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatus;
  summaryText: string;
  version: 1;
}

export interface RunAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReportOptions {
  includeJsonText?: boolean;
  intakeDirs?: readonly string[];
  prettyJson?: boolean;
  projectRoot?: string;
}

function parseArgs(
  args: readonly string[],
): RunAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReportOptions {
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

function hasProductionLikeSourceKind(
  sourceKindSummaries: readonly { manifestCount: number; sourceKind: string }[] | undefined,
) {
  return (sourceKindSummaries ?? []).some((summary) => (
    summary.sourceKind === 'production-like'
    && summary.manifestCount > 0
  ));
}

function createEntryStatus(options: {
  blockerReasons: readonly string[];
  reviewReasons: readonly string[];
}): AgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusEntry['status'] {
  if (options.blockerReasons.length > 0) {
    return 'blocked';
  }

  return options.reviewReasons.length > 0 ? 'review-needed' : 'ready-for-manual-review';
}

function createBlockerReasons(options: {
  hasProductionLikeSourceKind: boolean;
  manifestSourceCount: number;
  sourceDeclarationStatus: AgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflightStatus;
  validatorStatus: AgentSessionV3PilotRealCorpusBatchIntakeValidationStatus;
}) {
  const reasons: string[] = [];

  if (options.validatorStatus === 'missing') {
    reasons.push('intake validator reports missing required files');
  }
  if (options.validatorStatus === 'empty') {
    reasons.push('intake validator reports empty evidence');
  }
  if (options.validatorStatus === 'not-ready') {
    reasons.push('intake validator reports not-ready evidence');
  }
  if (options.sourceDeclarationStatus === 'blocked') {
    reasons.push('source declaration preflight is blocked');
  }
  if (options.manifestSourceCount === 0) {
    reasons.push('real corpus manifest has no source entries');
  }
  if (!options.hasProductionLikeSourceKind) {
    reasons.push('corpus batch index has no production-like source kind');
  }

  return reasons;
}

function createReviewReasons(options: {
  noteOpenItemCount: number;
  sourceDeclarationStatus: AgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflightStatus;
  validatorStatus: AgentSessionV3PilotRealCorpusBatchIntakeValidationStatus;
}) {
  const reasons: string[] = [];

  if (options.validatorStatus === 'mixed') {
    reasons.push('intake validator reports mixed evidence');
  }
  if (options.sourceDeclarationStatus === 'review-needed') {
    reasons.push('source declaration preflight needs review');
  }
  if (options.noteOpenItemCount > 0) {
    reasons.push('sample note still has open items');
  }

  return reasons;
}

function createAggregateStatus(options: {
  blockedCount: number;
  intakeCount: number;
  reviewNeededCount: number;
}): AgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatus {
  if (options.intakeCount === 0) {
    return 'no-intake-dirs';
  }
  if (options.blockedCount > 0) {
    return 'blocked';
  }

  return options.reviewNeededCount > 0 ? 'review-needed' : 'ready-for-manual-review';
}

function entrySupportsP0GapKind(
  entry: AgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusEntry,
  gapKind: string,
) {
  if (gapKind === 'real-production-like-sample') {
    return entry.hasProductionLikeSourceKind;
  }
  if (gapKind === 'real-exported-corpus') {
    return (
      entry.sourceSampleSource === 'real-exported'
      && entry.sourceSampleSourceStatus === 'real-exported-evidence'
    );
  }

  return false;
}

function createP0TargetEvidenceReasons(
  entry: AgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusEntry,
  gapKind: string,
) {
  const reasons: string[] = [];

  if (gapKind === 'real-production-like-sample') {
    reasons.push(entry.hasProductionLikeSourceKind
      ? 'production-like source kind present'
      : 'production-like source kind missing');
  } else if (gapKind === 'real-exported-corpus') {
    reasons.push(
      entry.sourceSampleSource === 'real-exported'
      && entry.sourceSampleSourceStatus === 'real-exported-evidence'
        ? 'real-exported sample source declaration present'
        : 'real-exported sample source declaration missing or unresolved',
    );
  } else {
    reasons.push('target gap kind has no P0 signal mapper');
  }

  if (entry.status === 'blocked') {
    reasons.push(`blocked: ${entry.blockerReasons.join('; ') || 'intake entry is blocked'}`);
  } else if (entry.status === 'review-needed') {
    reasons.push(`review-needed: ${entry.reviewReasons.join('; ') || 'intake entry needs review'}`);
  } else {
    reasons.push('ready-for-manual-review intake entry present');
  }

  return reasons;
}

function createP0TargetMissingReason(options: {
  entries: readonly AgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusEntry[];
  gapKind: string;
}) {
  if (options.entries.length === 0) {
    return 'no explicit intake directories supplied';
  }

  if (options.gapKind === 'real-production-like-sample') {
    return 'no supplied intake has production-like source kind evidence';
  }
  if (options.gapKind === 'real-exported-corpus') {
    return 'no supplied intake has real-exported sample source evidence';
  }

  return 'no supplied intake maps to this P0 target gap kind';
}

function createP0TargetSignalStatus(options: {
  blockedIntakeCount: number;
  readyForManualReviewIntakeCount: number;
  reviewNeededIntakeCount: number;
}): AgentSessionV3PilotRealCorpusBatchP0IntakeTargetSignalStatus {
  if (options.blockedIntakeCount > 0) {
    return 'blocked';
  }
  if (options.reviewNeededIntakeCount > 0) {
    return 'review-needed';
  }
  if (options.readyForManualReviewIntakeCount > 0) {
    return 'ready-for-manual-review';
  }

  return 'missing';
}

function createP0TargetSignals(options: {
  entries: readonly AgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusEntry[];
  p0TargetGapKinds: readonly string[];
}): AgentSessionV3PilotRealCorpusBatchP0IntakeTargetSignal[] {
  return options.p0TargetGapKinds.map((gapKind) => {
    const supportingEntries = options.entries.filter((entry) => entrySupportsP0GapKind(entry, gapKind));
    const blockedIntakeCount = supportingEntries.filter((entry) => entry.status === 'blocked').length;
    const reviewNeededIntakeCount = supportingEntries.filter((entry) => entry.status === 'review-needed').length;
    const readyForManualReviewIntakeCount = supportingEntries.filter((entry) => entry.status === 'ready-for-manual-review').length;
    const status = createP0TargetSignalStatus({
      blockedIntakeCount,
      readyForManualReviewIntakeCount,
      reviewNeededIntakeCount,
    });
    const evidenceReasons = options.entries.flatMap((entry) => createP0TargetEvidenceReasons(entry, gapKind));

    return {
      blockedIntakeCount,
      evidenceReasons,
      gapKind,
      intakeCount: options.entries.length,
      missingReason: status === 'missing'
        ? createP0TargetMissingReason({
          entries: options.entries,
          gapKind,
        })
        : null,
      readyForManualReviewIntakeCount,
      reviewNeededIntakeCount,
      status,
    };
  });
}

function createSummaryText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReportResult,
    | 'blockedCount'
    | 'intakeCount'
    | 'nextPriority'
    | 'p0TargetCount'
    | 'readyForManualReviewCount'
    | 'readyForProductionRuntime'
    | 'reviewNeededCount'
    | 'status'
  >,
) {
  return [
    `AgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport status=${result.status}`,
    `intakes=${result.intakeCount}`,
    `blocked=${result.blockedCount}`,
    `reviewNeeded=${result.reviewNeededCount}`,
    `readyForManualReview=${result.readyForManualReviewCount}`,
    `p0Targets=${result.p0TargetCount}`,
    `nextPriority=${result.nextPriority ?? 'none'}`,
    `readyForProductionRuntime=${result.readyForProductionRuntime ? 'yes' : 'no'}`,
  ].join(' ');
}

function createReportText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReportResult,
    | 'entries'
    | 'guardrail'
    | 'nextEvidenceTargetSummaryText'
    | 'p0TargetGapKinds'
    | 'p0TargetSignals'
    | 'summaryText'
  >,
) {
  return [
    result.summaryText,
    `nextEvidenceTargetSummary=${result.nextEvidenceTargetSummaryText}`,
    result.p0TargetGapKinds.length ? 'p0TargetGapKinds:' : 'p0TargetGapKinds: none',
    ...result.p0TargetGapKinds.map((gapKind) => `- ${gapKind}`),
    result.p0TargetSignals.length ? 'p0TargetSignals:' : 'p0TargetSignals: none',
    ...result.p0TargetSignals.map((signal) => [
      `- gapKind=${signal.gapKind}`,
      `status=${signal.status}`,
      `intakes=${signal.intakeCount}`,
      `blocked=${signal.blockedIntakeCount}`,
      `reviewNeeded=${signal.reviewNeededIntakeCount}`,
      `readyForManualReview=${signal.readyForManualReviewIntakeCount}`,
      `missingReason=${signal.missingReason ?? 'none'}`,
      `evidence=${signal.evidenceReasons.length ? signal.evidenceReasons.join('; ') : 'none'}`,
    ].join(' ')),
    result.entries.length ? 'p0IntakeTargets:' : 'p0IntakeTargets: none',
    ...result.entries.map((entry) => [
      `- status=${entry.status}`,
      `intakeDir=${entry.intakeDir}`,
      `validator=${entry.validatorStatus}`,
      `sourceDeclaration=${entry.sourceDeclarationStatus}`,
      `sampleSource=${entry.sourceSampleSource ?? 'missing'}`,
      `sampleSourceStatus=${entry.sourceSampleSourceStatus ?? 'missing'}`,
      `manifestSources=${entry.manifestSourceCount}`,
      `indexManifests=${entry.indexManifestCount}`,
      `productionLike=${entry.hasProductionLikeSourceKind ? 'yes' : 'no'}`,
      `noteStatus=${entry.noteStatus}`,
      `noteOpenItems=${entry.noteOpenItemCount}`,
      `blockers=${entry.blockerReasons.length ? entry.blockerReasons.join('; ') : 'none'}`,
      `review=${entry.reviewReasons.length ? entry.reviewReasons.join('; ') : 'none'}`,
    ].join(' ')),
    `guardrail=${result.guardrail}`,
  ].join('\n');
}

function createJsonText(
  result: AgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReportResult,
  options: { prettyJson?: boolean } = {},
) {
  return JSON.stringify(result, null, options.prettyJson ? 2 : 0);
}

async function createEntry(
  intakeDir: string,
  options: { prettyJson?: boolean },
): Promise<AgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusEntry> {
  const resolvedIntakeDir = path.resolve(intakeDir);
  const validator = await runAgentSessionV3PilotRealCorpusBatchIntakeValidator({
    intakeDir: resolvedIntakeDir,
    prettyJson: options.prettyJson,
  });
  const sourceDeclaration = await runAgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflight({
    expectedSampleSource: 'real-exported',
    intakeDir: resolvedIntakeDir,
    prettyJson: options.prettyJson,
  });
  const manifestSourceCount = validator.manifestReport?.sourceCount ?? 0;
  const indexManifestCount = validator.indexReport?.manifestCount ?? 0;
  const hasProductionLike = hasProductionLikeSourceKind(validator.indexReport?.sourceKindSummaries);
  const blockerReasons = createBlockerReasons({
    hasProductionLikeSourceKind: hasProductionLike,
    manifestSourceCount,
    sourceDeclarationStatus: sourceDeclaration.status,
    validatorStatus: validator.status,
  });
  const reviewReasons = createReviewReasons({
    noteOpenItemCount: validator.noteOpenItemCount,
    sourceDeclarationStatus: sourceDeclaration.status,
    validatorStatus: validator.status,
  });

  return {
    blockerReasons,
    hasProductionLikeSourceKind: hasProductionLike,
    indexManifestCount,
    intakeDir: resolvedIntakeDir,
    manifestSourceCount,
    noteOpenItemCount: validator.noteOpenItemCount,
    noteStatus: validator.noteReport.status,
    reviewReasons,
    sourceDeclarationStatus: sourceDeclaration.status,
    sourceSampleSource: sourceDeclaration.sampleSource,
    sourceSampleSourceStatus: sourceDeclaration.sampleSourceStatus,
    status: createEntryStatus({
      blockerReasons,
      reviewReasons,
    }),
    validatorStatus: validator.status,
  };
}

export async function runAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport(
  options: RunAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReportOptions = {},
): Promise<AgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReportResult> {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const nextEvidenceTarget = createAgentSessionV3PilotRealCorpusBatchNextEvidenceTargetReport({
    projectRoot,
  });
  const p0Targets = nextEvidenceTarget.targets.filter((target) => target.priority === 'P0');
  const entries = await Promise.all((options.intakeDirs ?? []).map((intakeDir) => createEntry(intakeDir, {
    prettyJson: options.prettyJson,
  })));
  const p0TargetGapKinds = p0Targets.map((target) => target.gapKind);
  const p0TargetSignals = createP0TargetSignals({
    entries,
    p0TargetGapKinds,
  });
  const blockedCount = entries.filter((entry) => entry.status === 'blocked').length;
  const reviewNeededCount = entries.filter((entry) => entry.status === 'review-needed').length;
  const readyForManualReviewCount = entries.filter((entry) => entry.status === 'ready-for-manual-review').length;
  const resultWithoutText: AgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReportResult = {
    blockedCount,
    entries,
    guardrail: 'caller-owned P0 intake target status report only; does not discover directories, collect samples, run smoke tests, create task queues, create handoff bundles, choose thresholds, route permissions, execute tools, decide recovery, define workflows, change readiness, define runtime action order, or grant runtime authority.',
    intakeCount: entries.length,
    jsonText: null,
    kind: 'agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report',
    nextEvidenceTargetSummaryText: nextEvidenceTarget.summaryText,
    nextPriority: nextEvidenceTarget.nextPriority,
    p0TargetCount: p0Targets.length,
    p0TargetGapKinds,
    p0TargetSignals,
    readyForManualReviewCount,
    readyForProductionRuntime: false,
    reportText: '',
    reviewNeededCount,
    status: createAggregateStatus({
      blockedCount,
      intakeCount: entries.length,
      reviewNeededCount,
    }),
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

async function runAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReportCli() {
  const options = parseArgs(process.argv.slice(2));
  const result = await runAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport(options);
  console.log(result.reportText);
  if (result.jsonText) {
    console.log(result.jsonText);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReportCli().catch((error: unknown) => {
    const errorText = error instanceof Error ? error.message : String(error);
    console.error(errorText);
    process.exitCode = 1;
  });
}
