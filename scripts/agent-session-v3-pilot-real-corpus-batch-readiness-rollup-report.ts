import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  runAgentSessionV3PilotRealCorpusBatchOperatorChecklistReport,
  type AgentSessionV3PilotRealCorpusBatchOperatorChecklistItem,
  type AgentSessionV3PilotRealCorpusBatchOperatorChecklistItemSeverity,
  type AgentSessionV3PilotRealCorpusBatchOperatorChecklistItemSource,
  type AgentSessionV3PilotRealCorpusBatchOperatorChecklistReportResult,
  type AgentSessionV3PilotRealCorpusBatchOperatorChecklistStatus,
} from './agent-session-v3-pilot-real-corpus-batch-operator-checklist-report.ts';

export type AgentSessionV3PilotRealCorpusBatchReadinessRollupStatus =
  | AgentSessionV3PilotRealCorpusBatchOperatorChecklistStatus
  | 'empty';

export interface AgentSessionV3PilotRealCorpusBatchReadinessRollupStatusCounts {
  blocked: number;
  readyForManualReview: number;
  reviewNeeded: number;
}

export interface AgentSessionV3PilotRealCorpusBatchReadinessRollupEntry {
  blockerCount: number;
  blockerItemIds: string[];
  checklistItemIds: string[];
  evidenceSummaryStatus: AgentSessionV3PilotRealCorpusBatchOperatorChecklistReportResult['evidenceSummary']['status'];
  infoCount: number;
  intakeDir: string;
  metadataCounts: AgentSessionV3PilotRealCorpusBatchOperatorChecklistReportResult['evidenceSummary']['metadataCounts'];
  metadataStatus: AgentSessionV3PilotRealCorpusBatchOperatorChecklistReportResult['evidenceSummary']['metadataQuality']['status'];
  phaseCoverageCounts: AgentSessionV3PilotRealCorpusBatchOperatorChecklistReportResult['evidenceSummary']['phaseCoverageCounts'];
  readinessCounts: AgentSessionV3PilotRealCorpusBatchOperatorChecklistReportResult['evidenceSummary']['readinessCounts'];
  reviewCount: number;
  reviewItemIds: string[];
  status: AgentSessionV3PilotRealCorpusBatchOperatorChecklistStatus;
  summaryText: string;
  validatorStatus: AgentSessionV3PilotRealCorpusBatchOperatorChecklistReportResult['evidenceSummary']['validator']['status'];
}

export interface AgentSessionV3PilotRealCorpusBatchReadinessRollupChecklistItemSummary {
  count: number;
  id: string;
  intakeDirs: string[];
  severity: AgentSessionV3PilotRealCorpusBatchOperatorChecklistItemSeverity;
  source: AgentSessionV3PilotRealCorpusBatchOperatorChecklistItemSource;
  title: string;
}

export interface RunAgentSessionV3PilotRealCorpusBatchReadinessRollupReportOptions {
  includeJsonText?: boolean;
  intakeDirs: readonly string[];
  prettyJson?: boolean;
}

export interface AgentSessionV3PilotRealCorpusBatchReadinessRollupReportResult {
  checklistItemSummaries: AgentSessionV3PilotRealCorpusBatchReadinessRollupChecklistItemSummary[];
  entries: AgentSessionV3PilotRealCorpusBatchReadinessRollupEntry[];
  intakeCount: number;
  jsonText: string | null;
  kind: 'agent-session-v3-pilot-real-corpus-batch-readiness-rollup-report';
  reportText: string;
  status: AgentSessionV3PilotRealCorpusBatchReadinessRollupStatus;
  statusCounts: AgentSessionV3PilotRealCorpusBatchReadinessRollupStatusCounts;
  summaryText: string;
  totalBlockerItems: number;
  totalInfoItems: number;
  totalReviewItems: number;
  version: 1;
}

function parseAgentSessionV3PilotRealCorpusBatchReadinessRollupReportArgs(
  args: readonly string[],
): RunAgentSessionV3PilotRealCorpusBatchReadinessRollupReportOptions {
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
    throw new Error('Usage: npx tsx scripts/agent-session-v3-pilot-real-corpus-batch-readiness-rollup-report.ts --dir intake-dir [...--dir intake-dir] [--json] [--pretty]');
  }

  return {
    includeJsonText,
    intakeDirs,
    prettyJson,
  };
}

function createStatusCounts(): AgentSessionV3PilotRealCorpusBatchReadinessRollupStatusCounts {
  return {
    blocked: 0,
    readyForManualReview: 0,
    reviewNeeded: 0,
  };
}

function incrementStatusCount(
  counts: AgentSessionV3PilotRealCorpusBatchReadinessRollupStatusCounts,
  status: AgentSessionV3PilotRealCorpusBatchOperatorChecklistStatus,
) {
  if (status === 'blocked') {
    counts.blocked += 1;
  } else if (status === 'review-needed') {
    counts.reviewNeeded += 1;
  } else {
    counts.readyForManualReview += 1;
  }
}

function createRollupStatus(
  statusCounts: AgentSessionV3PilotRealCorpusBatchReadinessRollupStatusCounts,
): AgentSessionV3PilotRealCorpusBatchReadinessRollupStatus {
  if (statusCounts.blocked > 0) {
    return 'blocked';
  }

  if (statusCounts.reviewNeeded > 0) {
    return 'review-needed';
  }

  if (statusCounts.readyForManualReview > 0) {
    return 'ready-for-manual-review';
  }

  return 'empty';
}

function getChecklistItemIds(
  checklist: AgentSessionV3PilotRealCorpusBatchOperatorChecklistReportResult,
  severity?: AgentSessionV3PilotRealCorpusBatchOperatorChecklistItemSeverity,
) {
  return checklist.checklistItems
    .filter((item) => !severity || item.severity === severity)
    .map((item) => item.id);
}

function createEntry(
  checklist: AgentSessionV3PilotRealCorpusBatchOperatorChecklistReportResult,
): AgentSessionV3PilotRealCorpusBatchReadinessRollupEntry {
  return {
    blockerCount: checklist.blockerCount,
    blockerItemIds: getChecklistItemIds(checklist, 'blocker'),
    checklistItemIds: getChecklistItemIds(checklist),
    evidenceSummaryStatus: checklist.evidenceSummary.status,
    infoCount: checklist.infoCount,
    intakeDir: checklist.intakeDir,
    metadataCounts: checklist.evidenceSummary.metadataCounts,
    metadataStatus: checklist.evidenceSummary.metadataQuality.status,
    phaseCoverageCounts: checklist.evidenceSummary.phaseCoverageCounts,
    readinessCounts: checklist.evidenceSummary.readinessCounts,
    reviewCount: checklist.reviewCount,
    reviewItemIds: getChecklistItemIds(checklist, 'review'),
    status: checklist.status,
    summaryText: checklist.summaryText,
    validatorStatus: checklist.evidenceSummary.validator.status,
  };
}

function severityRank(severity: AgentSessionV3PilotRealCorpusBatchOperatorChecklistItemSeverity) {
  if (severity === 'blocker') {
    return 0;
  }

  if (severity === 'review') {
    return 1;
  }

  return 2;
}

function createChecklistItemSummaries(
  checklists: readonly AgentSessionV3PilotRealCorpusBatchOperatorChecklistReportResult[],
): AgentSessionV3PilotRealCorpusBatchReadinessRollupChecklistItemSummary[] {
  const summaries = new Map<string, AgentSessionV3PilotRealCorpusBatchReadinessRollupChecklistItemSummary>();

  for (const checklist of checklists) {
    for (const item of checklist.checklistItems) {
      const existing = summaries.get(item.id);
      if (existing) {
        existing.count += 1;
        if (!existing.intakeDirs.includes(checklist.intakeDir)) {
          existing.intakeDirs.push(checklist.intakeDir);
        }
        continue;
      }

      summaries.set(item.id, {
        count: 1,
        id: item.id,
        intakeDirs: [checklist.intakeDir],
        severity: item.severity,
        source: item.source,
        title: item.title,
      });
    }
  }

  return [...summaries.values()].sort((left, right) => (
    severityRank(left.severity) - severityRank(right.severity)
      || right.count - left.count
      || left.id.localeCompare(right.id)
  ));
}

function createSummaryText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchReadinessRollupReportResult,
    'intakeCount' | 'status' | 'statusCounts' | 'totalBlockerItems' | 'totalInfoItems' | 'totalReviewItems'
  >,
) {
  return [
    `AgentSessionV3PilotRealCorpusBatchReadinessRollupReport status=${result.status}`,
    `intakes=${result.intakeCount}`,
    `blocked=${result.statusCounts.blocked}`,
    `reviewNeeded=${result.statusCounts.reviewNeeded}`,
    `readyForManualReview=${result.statusCounts.readyForManualReview}`,
    `blockerItems=${result.totalBlockerItems}`,
    `reviewItems=${result.totalReviewItems}`,
    `infoItems=${result.totalInfoItems}`,
  ].join(' ');
}

function joinIds(ids: readonly string[]) {
  return ids.length ? ids.join(',') : 'none';
}

function createReportText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchReadinessRollupReportResult,
    'checklistItemSummaries' | 'entries' | 'summaryText'
  >,
) {
  const entryLines = result.entries.length
    ? [
      'intakeEntries:',
      ...result.entries.map((entry) => [
        `- status=${entry.status}`,
        `intakeDir=${entry.intakeDir}`,
        `evidenceSummary=${entry.evidenceSummaryStatus}`,
        `validator=${entry.validatorStatus}`,
        `metadata=${entry.metadataStatus}`,
        `phaseCoverage=${entry.phaseCoverageCounts.status}`,
        `phaseCoverageFailedManifests=${entry.phaseCoverageCounts.failedManifestCount}`,
        `phaseCoverageNeedsReviewSourceKinds=${entry.phaseCoverageCounts.sourceKindNeedsReviewCount}`,
        `blockers=${entry.blockerCount}`,
        `review=${entry.reviewCount}`,
        `info=${entry.infoCount}`,
        `blockerItems=${joinIds(entry.blockerItemIds)}`,
        `reviewItems=${joinIds(entry.reviewItemIds)}`,
      ].join(' ')),
    ]
    : ['intakeEntries: none'];
  const summaryLines = result.checklistItemSummaries.length
    ? [
      'checklistItemSummaries:',
      ...result.checklistItemSummaries.map((item) => [
        `- severity=${item.severity}`,
        `source=${item.source}`,
        `id=${item.id}`,
        `count=${item.count}`,
        `title=${item.title}`,
        `intakeDirs=${item.intakeDirs.join(',')}`,
      ].join(' ')),
    ]
    : ['checklistItemSummaries: none'];

  return [
    result.summaryText,
    ...entryLines,
    ...summaryLines,
  ].join('\n');
}

function createJsonText(
  result: AgentSessionV3PilotRealCorpusBatchReadinessRollupReportResult,
  options: { prettyJson?: boolean } = {},
) {
  return JSON.stringify(result, null, options.prettyJson ? 2 : 0);
}

export async function runAgentSessionV3PilotRealCorpusBatchReadinessRollupReport(
  options: RunAgentSessionV3PilotRealCorpusBatchReadinessRollupReportOptions,
): Promise<AgentSessionV3PilotRealCorpusBatchReadinessRollupReportResult> {
  const intakeDirs = options.intakeDirs.map((intakeDir) => path.resolve(intakeDir));
  const checklists = await Promise.all(intakeDirs.map((intakeDir) => (
    runAgentSessionV3PilotRealCorpusBatchOperatorChecklistReport({
      intakeDir,
      prettyJson: options.prettyJson,
    })
  )));
  const statusCounts = createStatusCounts();
  for (const checklist of checklists) {
    incrementStatusCount(statusCounts, checklist.status);
  }
  const entries = checklists.map(createEntry);
  const checklistItemSummaries = createChecklistItemSummaries(checklists);
  const resultWithoutJson: AgentSessionV3PilotRealCorpusBatchReadinessRollupReportResult = {
    checklistItemSummaries,
    entries,
    intakeCount: entries.length,
    jsonText: null,
    kind: 'agent-session-v3-pilot-real-corpus-batch-readiness-rollup-report',
    reportText: '',
    status: createRollupStatus(statusCounts),
    statusCounts,
    summaryText: '',
    totalBlockerItems: entries.reduce((total, entry) => total + entry.blockerCount, 0),
    totalInfoItems: entries.reduce((total, entry) => total + entry.infoCount, 0),
    totalReviewItems: entries.reduce((total, entry) => total + entry.reviewCount, 0),
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

async function runAgentSessionV3PilotRealCorpusBatchReadinessRollupReportCli() {
  const options = parseAgentSessionV3PilotRealCorpusBatchReadinessRollupReportArgs(process.argv.slice(2));
  const result = await runAgentSessionV3PilotRealCorpusBatchReadinessRollupReport(options);
  console.log(result.reportText);
  if (result.jsonText) {
    console.log(result.jsonText);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAgentSessionV3PilotRealCorpusBatchReadinessRollupReportCli().catch((error: unknown) => {
    const errorText = error instanceof Error ? error.message : String(error);
    console.error(errorText);
    process.exitCode = 1;
  });
}
