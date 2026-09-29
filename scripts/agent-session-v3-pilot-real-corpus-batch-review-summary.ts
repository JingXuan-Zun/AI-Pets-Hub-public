import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  runAgentSessionV3PilotRealCorpusBatchReadinessRollupReport,
  type AgentSessionV3PilotRealCorpusBatchReadinessRollupReportResult,
} from './agent-session-v3-pilot-real-corpus-batch-readiness-rollup-report.ts';

export interface AgentSessionV3PilotRealCorpusBatchReviewSummaryFocusItem {
  count: number;
  id: string;
  intakeDirs: string[];
  severity: string;
  title: string;
}

export interface AgentSessionV3PilotRealCorpusBatchReviewSummaryIntakeEntry {
  blockerCount: number;
  evidenceSummaryStatus: string;
  intakeDir: string;
  metadataStatus: string;
  phaseCoverageCounts: AgentSessionV3PilotRealCorpusBatchReadinessRollupReportResult['entries'][number]['phaseCoverageCounts'];
  readinessCounts: AgentSessionV3PilotRealCorpusBatchReadinessRollupReportResult['entries'][number]['readinessCounts'];
  reviewCount: number;
  status: string;
  validatorStatus: string;
}

export interface AgentSessionV3PilotRealCorpusBatchReviewSummaryOptionalEvidenceReport {
  boundary: string;
  path: string;
  purpose: string;
}

export interface RunAgentSessionV3PilotRealCorpusBatchReviewSummaryOptions {
  includeJsonText?: boolean;
  intakeDirs: readonly string[];
  prettyJson?: boolean;
}

export interface AgentSessionV3PilotRealCorpusBatchReviewSummaryResult {
  focusItems: AgentSessionV3PilotRealCorpusBatchReviewSummaryFocusItem[];
  intakeCount: number;
  intakeEntries: AgentSessionV3PilotRealCorpusBatchReviewSummaryIntakeEntry[];
  jsonText: string | null;
  kind: 'agent-session-v3-pilot-real-corpus-batch-review-summary';
  optionalEvidenceReports: AgentSessionV3PilotRealCorpusBatchReviewSummaryOptionalEvidenceReport[];
  reportText: string;
  rollup: AgentSessionV3PilotRealCorpusBatchReadinessRollupReportResult;
  status: AgentSessionV3PilotRealCorpusBatchReadinessRollupReportResult['status'];
  statusCounts: AgentSessionV3PilotRealCorpusBatchReadinessRollupReportResult['statusCounts'];
  summaryText: string;
  totalBlockerItems: number;
  totalReviewItems: number;
  version: 1;
}

const OPTIONAL_EVIDENCE_REPORTS: AgentSessionV3PilotRealCorpusBatchReviewSummaryOptionalEvidenceReport[] = [
  {
    boundary: 'optional manual completeness audit only; explicit caller-owned intake dirs only; no readiness decision.',
    path: 'scripts/agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit.ts',
    purpose: 'Review sample-note, manifest, and index field completeness across explicitly supplied intake directories.',
  },
];

function parseAgentSessionV3PilotRealCorpusBatchReviewSummaryArgs(
  args: readonly string[],
): RunAgentSessionV3PilotRealCorpusBatchReviewSummaryOptions {
  let includeJsonText = false;
  const intakeDirs: string[] = [];
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
      intakeDirs.push(arg);
    }
  }

  if (!intakeDirs.length) {
    throw new Error('Usage: npx tsx scripts/agent-session-v3-pilot-real-corpus-batch-review-summary.ts --dir intake-dir [...--dir intake-dir] [--json] [--pretty]');
  }

  return {
    includeJsonText,
    intakeDirs,
    prettyJson,
  };
}

function createIntakeEntries(
  rollup: AgentSessionV3PilotRealCorpusBatchReadinessRollupReportResult,
): AgentSessionV3PilotRealCorpusBatchReviewSummaryIntakeEntry[] {
  return rollup.entries.map((entry) => ({
    blockerCount: entry.blockerCount,
    evidenceSummaryStatus: entry.evidenceSummaryStatus,
    intakeDir: entry.intakeDir,
    metadataStatus: entry.metadataStatus,
    phaseCoverageCounts: entry.phaseCoverageCounts,
    readinessCounts: entry.readinessCounts,
    reviewCount: entry.reviewCount,
    status: entry.status,
    validatorStatus: entry.validatorStatus,
  }));
}

function createFocusItems(
  rollup: AgentSessionV3PilotRealCorpusBatchReadinessRollupReportResult,
): AgentSessionV3PilotRealCorpusBatchReviewSummaryFocusItem[] {
  return rollup.checklistItemSummaries
    .filter((item) => item.severity !== 'info')
    .slice(0, 8)
    .map((item) => ({
      count: item.count,
      id: item.id,
      intakeDirs: item.intakeDirs,
      severity: item.severity,
      title: item.title,
    }));
}

function createSummaryText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchReviewSummaryResult,
    'focusItems' | 'intakeCount' | 'status' | 'statusCounts' | 'totalBlockerItems' | 'totalReviewItems'
  >,
) {
  return [
    `AgentSessionV3PilotRealCorpusBatchReviewSummary status=${result.status}`,
    `intakes=${result.intakeCount}`,
    `blocked=${result.statusCounts.blocked}`,
    `reviewNeeded=${result.statusCounts.reviewNeeded}`,
    `readyForManualReview=${result.statusCounts.readyForManualReview}`,
    `blockerItems=${result.totalBlockerItems}`,
    `reviewItems=${result.totalReviewItems}`,
    `focusItems=${result.focusItems.length}`,
  ].join(' ');
}

function joinIds(ids: readonly string[]) {
  return ids.length ? ids.join(',') : 'none';
}

function createReportText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchReviewSummaryResult,
    'focusItems' | 'intakeEntries' | 'optionalEvidenceReports' | 'summaryText'
  >,
) {
  const intakeLines = result.intakeEntries.length
    ? [
      'reviewIntakes:',
      ...result.intakeEntries.map((entry) => [
        `- status=${entry.status}`,
        `intakeDir=${entry.intakeDir}`,
        `validator=${entry.validatorStatus}`,
        `evidenceSummary=${entry.evidenceSummaryStatus}`,
        `metadata=${entry.metadataStatus}`,
        `phaseCoverage=${entry.phaseCoverageCounts.status}`,
        `phaseCoverageFailedManifests=${entry.phaseCoverageCounts.failedManifestCount}`,
        `phaseCoverageNeedsReviewSourceKinds=${entry.phaseCoverageCounts.sourceKindNeedsReviewCount}`,
        `blockers=${entry.blockerCount}`,
        `review=${entry.reviewCount}`,
        `manifestSources=${entry.readinessCounts.manifestSources}`,
        `indexReady=${entry.readinessCounts.indexReady}`,
        `indexMixed=${entry.readinessCounts.indexMixed}`,
        `indexNotReady=${entry.readinessCounts.indexNotReady}`,
      ].join(' ')),
    ]
    : ['reviewIntakes: none'];
  const focusLines = result.focusItems.length
    ? [
      'reviewFocusItems:',
      ...result.focusItems.map((item) => [
        `- severity=${item.severity}`,
        `id=${item.id}`,
        `count=${item.count}`,
        `title=${item.title}`,
        `intakeDirs=${joinIds(item.intakeDirs)}`,
      ].join(' ')),
    ]
    : ['reviewFocusItems: none'];
  const optionalEvidenceLines = result.optionalEvidenceReports.length
    ? [
      'optionalEvidenceReports:',
      ...result.optionalEvidenceReports.map((report) => [
        `- path=${report.path}`,
        `purpose=${report.purpose}`,
        `boundary=${report.boundary}`,
      ].join(' ')),
    ]
    : ['optionalEvidenceReports: none'];

  return [
    result.summaryText,
    ...intakeLines,
    ...focusLines,
    ...optionalEvidenceLines,
    'reviewBoundary: summary-only evidence view; no threshold decision, runtime authority, tool selection, permission routing, execution, or recovery.',
  ].join('\n');
}

function createJsonText(
  result: AgentSessionV3PilotRealCorpusBatchReviewSummaryResult,
  options: { prettyJson?: boolean } = {},
) {
  return JSON.stringify(result, null, options.prettyJson ? 2 : 0);
}

export async function runAgentSessionV3PilotRealCorpusBatchReviewSummary(
  options: RunAgentSessionV3PilotRealCorpusBatchReviewSummaryOptions,
): Promise<AgentSessionV3PilotRealCorpusBatchReviewSummaryResult> {
  const rollup = await runAgentSessionV3PilotRealCorpusBatchReadinessRollupReport({
    intakeDirs: options.intakeDirs,
    prettyJson: options.prettyJson,
  });
  const intakeEntries = createIntakeEntries(rollup);
  const focusItems = createFocusItems(rollup);
  const resultWithoutJson: AgentSessionV3PilotRealCorpusBatchReviewSummaryResult = {
    focusItems,
    intakeCount: rollup.intakeCount,
    intakeEntries,
    jsonText: null,
    kind: 'agent-session-v3-pilot-real-corpus-batch-review-summary',
    optionalEvidenceReports: OPTIONAL_EVIDENCE_REPORTS,
    reportText: '',
    rollup,
    status: rollup.status,
    statusCounts: rollup.statusCounts,
    summaryText: '',
    totalBlockerItems: rollup.totalBlockerItems,
    totalReviewItems: rollup.totalReviewItems,
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

async function runAgentSessionV3PilotRealCorpusBatchReviewSummaryCli() {
  const options = parseAgentSessionV3PilotRealCorpusBatchReviewSummaryArgs(process.argv.slice(2));
  const result = await runAgentSessionV3PilotRealCorpusBatchReviewSummary(options);
  console.log(result.reportText);
  if (result.jsonText) {
    console.log(result.jsonText);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAgentSessionV3PilotRealCorpusBatchReviewSummaryCli().catch((error: unknown) => {
    const errorText = error instanceof Error ? error.message : String(error);
    console.error(errorText);
    process.exitCode = 1;
  });
}
