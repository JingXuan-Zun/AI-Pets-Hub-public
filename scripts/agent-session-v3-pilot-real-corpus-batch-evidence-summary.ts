import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  runAgentSessionV3PilotRealCorpusBatchIntakeValidator,
  type AgentSessionV3PilotRealCorpusBatchIntakeValidatorResult,
} from './agent-session-v3-pilot-real-corpus-batch-intake-validator.ts';
import {
  runAgentSessionV3PilotRealCorpusBatchMetadataQualityReport,
  type AgentSessionV3PilotRealCorpusBatchMetadataQualityReportResult,
} from './agent-session-v3-pilot-real-corpus-batch-metadata-quality-report.ts';

export type AgentSessionV3PilotRealCorpusBatchEvidenceSummaryStatus =
  | 'blocked'
  | 'manual-review-needed'
  | 'manual-review-ready';

export type AgentSessionV3PilotRealCorpusBatchEvidenceGapCode =
  | 'consistency-issues'
  | 'index-empty'
  | 'index-mixed'
  | 'index-not-ready'
  | 'manifest-empty'
  | 'metadata-quality-blocked'
  | 'metadata-quality-review'
  | 'missing-required-files'
  | 'note-incomplete'
  | 'note-missing'
  | 'path-issues'
  | 'schema-issues';

export type AgentSessionV3PilotRealCorpusBatchEvidenceGapSeverity =
  | 'blocker'
  | 'review';

export type AgentSessionV3PilotRealCorpusBatchEvidencePhaseCoverageStatus =
  | 'clean'
  | 'needs-review'
  | 'unavailable';

export interface AgentSessionV3PilotRealCorpusBatchEvidenceGap {
  code: AgentSessionV3PilotRealCorpusBatchEvidenceGapCode;
  detail: string;
  severity: AgentSessionV3PilotRealCorpusBatchEvidenceGapSeverity;
}

export interface RunAgentSessionV3PilotRealCorpusBatchEvidenceSummaryOptions {
  includeJsonText?: boolean;
  intakeDir: string;
  prettyJson?: boolean;
}

export interface AgentSessionV3PilotRealCorpusBatchEvidenceSummaryResult {
  blockerCount: number;
  evidenceGaps: AgentSessionV3PilotRealCorpusBatchEvidenceGap[];
  intakeDir: string;
  jsonText: string | null;
  kind: 'agent-session-v3-pilot-real-corpus-batch-evidence-summary';
  metadataCounts: {
    metadataBlockers: number;
    metadataIssues: number;
    metadataReview: number;
    noteOpenItems: number;
  };
  metadataQuality: AgentSessionV3PilotRealCorpusBatchMetadataQualityReportResult;
  phaseCoverageCounts: {
    failedCheckCount: number;
    failedManifestCount: number;
    sourceKindCleanCount: number;
    sourceKindCount: number;
    sourceKindNeedsReviewCount: number;
    status: AgentSessionV3PilotRealCorpusBatchEvidencePhaseCoverageStatus;
  };
  readinessCounts: {
    indexManifests: number;
    indexMixed: number;
    indexNotReady: number;
    indexReady: number;
    manifestSources: number;
  };
  reportText: string;
  reviewCount: number;
  status: AgentSessionV3PilotRealCorpusBatchEvidenceSummaryStatus;
  summaryText: string;
  validator: AgentSessionV3PilotRealCorpusBatchIntakeValidatorResult;
  version: 1;
}

function parseAgentSessionV3PilotRealCorpusBatchEvidenceSummaryArgs(
  args: readonly string[],
): RunAgentSessionV3PilotRealCorpusBatchEvidenceSummaryOptions {
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
    throw new Error('Usage: npx tsx scripts/agent-session-v3-pilot-real-corpus-batch-evidence-summary.ts --dir intake-dir [--json] [--pretty]');
  }

  return {
    includeJsonText,
    intakeDir,
    prettyJson,
  };
}

function createGap(options: AgentSessionV3PilotRealCorpusBatchEvidenceGap) {
  return options;
}

function createEvidenceGaps(
  validator: AgentSessionV3PilotRealCorpusBatchIntakeValidatorResult,
  metadataQuality: AgentSessionV3PilotRealCorpusBatchMetadataQualityReportResult,
): AgentSessionV3PilotRealCorpusBatchEvidenceGap[] {
  const gaps: AgentSessionV3PilotRealCorpusBatchEvidenceGap[] = [];

  if (validator.missingPaths.length > 0) {
    gaps.push(createGap({
      code: 'missing-required-files',
      detail: `${validator.missingPaths.length} required intake file(s) are missing.`,
      severity: 'blocker',
    }));
  }

  if (validator.schemaShapeReport.status !== 'valid') {
    gaps.push(createGap({
      code: 'schema-issues',
      detail: `${validator.schemaIssueCount} schema-shape issue(s) should be fixed before interpreting readiness.`,
      severity: 'blocker',
    }));
  }

  if (validator.pathHealthReport.status !== 'healthy') {
    gaps.push(createGap({
      code: 'path-issues',
      detail: `${validator.pathIssueCount} path-health issue(s) should be fixed before interpreting readiness.`,
      severity: 'blocker',
    }));
  }

  if (validator.consistencyReport.status !== 'consistent') {
    gaps.push(createGap({
      code: 'consistency-issues',
      detail: `${validator.consistencyIssueCount} manifest/index consistency issue(s) should be fixed before deeper report review.`,
      severity: 'blocker',
    }));
  }

  if (validator.manifestReport?.sourceCount === 0) {
    gaps.push(createGap({
      code: 'manifest-empty',
      detail: 'Real corpus manifest has no source entries.',
      severity: 'blocker',
    }));
  }

  if (validator.indexReport?.manifestCount === 0) {
    gaps.push(createGap({
      code: 'index-empty',
      detail: 'Corpus batch index has no manifest entries.',
      severity: 'blocker',
    }));
  }

  if (validator.indexReport && validator.indexReport.multiReport.statusCounts.notReady > 0) {
    gaps.push(createGap({
      code: 'index-not-ready',
      detail: `${validator.indexReport.multiReport.statusCounts.notReady} indexed manifest report(s) are not ready.`,
      severity: 'blocker',
    }));
  }

  if (validator.indexReport && validator.indexReport.multiReport.statusCounts.mixed > 0) {
    gaps.push(createGap({
      code: 'index-mixed',
      detail: `${validator.indexReport.multiReport.statusCounts.mixed} indexed manifest report(s) are mixed and need manual review.`,
      severity: 'review',
    }));
  }

  if (validator.noteMissing) {
    gaps.push(createGap({
      code: 'note-missing',
      detail: 'sample-note-template.md is missing; evidence context should be recorded before manual interpretation.',
      severity: 'review',
    }));
  } else if (validator.noteOpenItemCount > 0) {
    gaps.push(createGap({
      code: 'note-incomplete',
      detail: `${validator.noteOpenItemCount} sample note placeholder(s) remain open.`,
      severity: 'review',
    }));
  }

  if (metadataQuality.blockerCount > 0) {
    gaps.push(createGap({
      code: 'metadata-quality-blocked',
      detail: `${metadataQuality.blockerCount} metadata quality blocker(s) need caller review; validator readiness is unchanged.`,
      severity: 'review',
    }));
  } else if (metadataQuality.reviewCount > 0) {
    gaps.push(createGap({
      code: 'metadata-quality-review',
      detail: `${metadataQuality.reviewCount} metadata quality review item(s) remain open; validator readiness is unchanged.`,
      severity: 'review',
    }));
  }

  return gaps;
}

function createStatus(options: {
  blockerCount: number;
  reviewCount: number;
  validator: AgentSessionV3PilotRealCorpusBatchIntakeValidatorResult;
}): AgentSessionV3PilotRealCorpusBatchEvidenceSummaryStatus {
  if (options.blockerCount > 0 || options.validator.status === 'missing' || options.validator.status === 'empty' || options.validator.status === 'not-ready') {
    return 'blocked';
  }

  if (options.reviewCount > 0 || options.validator.status === 'mixed') {
    return 'manual-review-needed';
  }

  return 'manual-review-ready';
}

function createReadinessCounts(
  validator: AgentSessionV3PilotRealCorpusBatchIntakeValidatorResult,
): AgentSessionV3PilotRealCorpusBatchEvidenceSummaryResult['readinessCounts'] {
  return {
    indexManifests: validator.indexReport?.manifestCount ?? 0,
    indexMixed: validator.indexReport?.multiReport.statusCounts.mixed ?? 0,
    indexNotReady: validator.indexReport?.multiReport.statusCounts.notReady ?? 0,
    indexReady: validator.indexReport?.multiReport.statusCounts.ready ?? 0,
    manifestSources: validator.manifestReport?.sourceCount ?? 0,
  };
}

function createMetadataCounts(
  metadataQuality: AgentSessionV3PilotRealCorpusBatchMetadataQualityReportResult,
): AgentSessionV3PilotRealCorpusBatchEvidenceSummaryResult['metadataCounts'] {
  return {
    metadataBlockers: metadataQuality.blockerCount,
    metadataIssues: metadataQuality.issueCount,
    metadataReview: metadataQuality.reviewCount,
    noteOpenItems: metadataQuality.noteOpenItemCount,
  };
}

function createPhaseCoverageCounts(
  validator: AgentSessionV3PilotRealCorpusBatchIntakeValidatorResult,
): AgentSessionV3PilotRealCorpusBatchEvidenceSummaryResult['phaseCoverageCounts'] {
  const sourceKindNeedsReviewCount = validator.phaseCoverageSourceKindSummaries.filter((summary) => (
    summary.phaseCoverageNeedsReview > 0
  )).length;

  return {
    failedCheckCount: validator.phaseCoverageCalibration?.failedCheckCount ?? 0,
    failedManifestCount: validator.phaseCoverageCalibration?.failedManifestCount ?? 0,
    sourceKindCleanCount: validator.phaseCoverageSourceKindSummaries.length - sourceKindNeedsReviewCount,
    sourceKindCount: validator.phaseCoverageSourceKindSummaries.length,
    sourceKindNeedsReviewCount,
    status: validator.phaseCoverageCalibration?.status ?? 'unavailable',
  };
}

function createSummaryText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchEvidenceSummaryResult,
    'blockerCount' | 'metadataCounts' | 'metadataQuality' | 'phaseCoverageCounts' | 'readinessCounts' | 'reviewCount' | 'status' | 'validator'
  >,
) {
  return [
    `AgentSessionV3PilotRealCorpusBatchEvidenceSummary status=${result.status}`,
    `validator=${result.validator.status}`,
    `metadata=${result.metadataQuality.status}`,
    `blockers=${result.blockerCount}`,
    `review=${result.reviewCount}`,
    `metadataIssues=${result.metadataCounts.metadataIssues}`,
    `metadataBlockers=${result.metadataCounts.metadataBlockers}`,
    `metadataReview=${result.metadataCounts.metadataReview}`,
    `manifestSources=${result.readinessCounts.manifestSources}`,
    `indexManifests=${result.readinessCounts.indexManifests}`,
    `indexReady=${result.readinessCounts.indexReady}`,
    `indexMixed=${result.readinessCounts.indexMixed}`,
    `indexNotReady=${result.readinessCounts.indexNotReady}`,
    `phaseCoverage=${result.phaseCoverageCounts.status}`,
    `phaseCoverageFailedManifests=${result.phaseCoverageCounts.failedManifestCount}`,
    `phaseCoverageNeedsReviewSourceKinds=${result.phaseCoverageCounts.sourceKindNeedsReviewCount}`,
  ].join(' ');
}

function createReportText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchEvidenceSummaryResult,
    'evidenceGaps' | 'metadataQuality' | 'phaseCoverageCounts' | 'summaryText' | 'validator'
  >,
) {
  const gapLines = result.evidenceGaps.length
    ? [
      'evidenceGaps:',
      ...result.evidenceGaps.map((gap) => [
        `- severity=${gap.severity}`,
        `code=${gap.code}`,
        `detail=${gap.detail}`,
      ].join(' ')),
    ]
    : ['evidenceGaps: none'];
  const phaseCoverageLine = [
    'phaseCoverageCalibration',
    `status=${result.phaseCoverageCounts.status}`,
    `failedManifests=${result.phaseCoverageCounts.failedManifestCount}`,
    `failedChecks=${result.phaseCoverageCounts.failedCheckCount}`,
    `sourceKinds=${result.phaseCoverageCounts.sourceKindCount}`,
    `sourceKindClean=${result.phaseCoverageCounts.sourceKindCleanCount}`,
    `sourceKindNeedsReview=${result.phaseCoverageCounts.sourceKindNeedsReviewCount}`,
  ].join(' ');

  return [
    result.summaryText,
    ...gapLines,
    phaseCoverageLine,
    result.metadataQuality.summaryText,
    result.validator.summaryText,
  ].join('\n');
}

function createJsonText(
  result: AgentSessionV3PilotRealCorpusBatchEvidenceSummaryResult,
  options: { prettyJson?: boolean } = {},
) {
  return JSON.stringify(result, null, options.prettyJson ? 2 : 0);
}

export async function runAgentSessionV3PilotRealCorpusBatchEvidenceSummary(
  options: RunAgentSessionV3PilotRealCorpusBatchEvidenceSummaryOptions,
): Promise<AgentSessionV3PilotRealCorpusBatchEvidenceSummaryResult> {
  const intakeDir = path.resolve(options.intakeDir);
  const validator = await runAgentSessionV3PilotRealCorpusBatchIntakeValidator({
    intakeDir,
    prettyJson: options.prettyJson,
  });
  const metadataQuality = await runAgentSessionV3PilotRealCorpusBatchMetadataQualityReport({
    intakeDir,
    prettyJson: options.prettyJson,
  });
  const evidenceGaps = createEvidenceGaps(validator, metadataQuality);
  const blockerCount = evidenceGaps.filter((gap) => gap.severity === 'blocker').length;
  const reviewCount = evidenceGaps.filter((gap) => gap.severity === 'review').length;
  const metadataCounts = createMetadataCounts(metadataQuality);
  const phaseCoverageCounts = createPhaseCoverageCounts(validator);
  const readinessCounts = createReadinessCounts(validator);
  const resultWithoutJson: AgentSessionV3PilotRealCorpusBatchEvidenceSummaryResult = {
    blockerCount,
    evidenceGaps,
    intakeDir,
    jsonText: null,
    kind: 'agent-session-v3-pilot-real-corpus-batch-evidence-summary',
    metadataCounts,
    metadataQuality,
    phaseCoverageCounts,
    readinessCounts,
    reportText: '',
    reviewCount,
    status: createStatus({
      blockerCount,
      reviewCount,
      validator,
    }),
    summaryText: '',
    validator,
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

async function runAgentSessionV3PilotRealCorpusBatchEvidenceSummaryCli() {
  const options = parseAgentSessionV3PilotRealCorpusBatchEvidenceSummaryArgs(process.argv.slice(2));
  const result = await runAgentSessionV3PilotRealCorpusBatchEvidenceSummary(options);
  console.log(result.reportText);
  if (result.jsonText) {
    console.log(result.jsonText);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAgentSessionV3PilotRealCorpusBatchEvidenceSummaryCli().catch((error: unknown) => {
    const errorText = error instanceof Error ? error.message : String(error);
    console.error(errorText);
    process.exitCode = 1;
  });
}
