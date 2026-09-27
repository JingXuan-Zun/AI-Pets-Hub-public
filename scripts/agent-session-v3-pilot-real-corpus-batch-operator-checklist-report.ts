import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  runAgentSessionV3PilotRealCorpusBatchEvidenceSummary,
  type AgentSessionV3PilotRealCorpusBatchEvidenceGap,
  type AgentSessionV3PilotRealCorpusBatchEvidenceSummaryResult,
} from './agent-session-v3-pilot-real-corpus-batch-evidence-summary.ts';

export type AgentSessionV3PilotRealCorpusBatchOperatorChecklistStatus =
  | 'blocked'
  | 'ready-for-manual-review'
  | 'review-needed';

export type AgentSessionV3PilotRealCorpusBatchOperatorChecklistItemSeverity =
  | 'blocker'
  | 'info'
  | 'review';

export type AgentSessionV3PilotRealCorpusBatchOperatorChecklistItemSource =
  | 'evidence-summary'
  | 'metadata-quality'
  | 'runbook'
  | 'validator';

export interface AgentSessionV3PilotRealCorpusBatchOperatorChecklistItem {
  action: string;
  detail: string;
  id: string;
  severity: AgentSessionV3PilotRealCorpusBatchOperatorChecklistItemSeverity;
  source: AgentSessionV3PilotRealCorpusBatchOperatorChecklistItemSource;
  title: string;
}

export interface RunAgentSessionV3PilotRealCorpusBatchOperatorChecklistReportOptions {
  includeJsonText?: boolean;
  intakeDir: string;
  prettyJson?: boolean;
}

export interface AgentSessionV3PilotRealCorpusBatchOperatorChecklistReportResult {
  blockerCount: number;
  checklistItems: AgentSessionV3PilotRealCorpusBatchOperatorChecklistItem[];
  evidenceSummary: AgentSessionV3PilotRealCorpusBatchEvidenceSummaryResult;
  infoCount: number;
  intakeDir: string;
  jsonText: string | null;
  kind: 'agent-session-v3-pilot-real-corpus-batch-operator-checklist-report';
  reportText: string;
  reviewCount: number;
  status: AgentSessionV3PilotRealCorpusBatchOperatorChecklistStatus;
  summaryText: string;
  version: 1;
}

function parseAgentSessionV3PilotRealCorpusBatchOperatorChecklistReportArgs(
  args: readonly string[],
): RunAgentSessionV3PilotRealCorpusBatchOperatorChecklistReportOptions {
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
    throw new Error('Usage: npx tsx scripts/agent-session-v3-pilot-real-corpus-batch-operator-checklist-report.ts --dir intake-dir [--json] [--pretty]');
  }

  return {
    includeJsonText,
    intakeDir,
    prettyJson,
  };
}

function mapEvidenceSummaryStatus(
  status: AgentSessionV3PilotRealCorpusBatchEvidenceSummaryResult['status'],
): AgentSessionV3PilotRealCorpusBatchOperatorChecklistStatus {
  if (status === 'blocked') {
    return 'blocked';
  }

  if (status === 'manual-review-needed') {
    return 'review-needed';
  }

  return 'ready-for-manual-review';
}

function getChecklistItemSource(
  gap: AgentSessionV3PilotRealCorpusBatchEvidenceGap,
): AgentSessionV3PilotRealCorpusBatchOperatorChecklistItemSource {
  if (gap.code.startsWith('metadata-quality')) {
    return 'metadata-quality';
  }

  if (gap.code === 'index-mixed') {
    return 'evidence-summary';
  }

  return 'validator';
}

function getGapTitle(gap: AgentSessionV3PilotRealCorpusBatchEvidenceGap) {
  switch (gap.code) {
    case 'consistency-issues':
      return 'Fix manifest/index consistency';
    case 'index-empty':
      return 'Add indexed manifest evidence';
    case 'index-mixed':
      return 'Review mixed readiness distribution';
    case 'index-not-ready':
      return 'Inspect not-ready indexed reports';
    case 'manifest-empty':
      return 'Add real corpus manifest sources';
    case 'metadata-quality-blocked':
      return 'Review metadata quality blockers';
    case 'metadata-quality-review':
      return 'Review metadata quality gaps';
    case 'missing-required-files':
      return 'Create required intake files';
    case 'note-incomplete':
      return 'Complete sample note prompts';
    case 'note-missing':
      return 'Add sample note context';
    case 'path-issues':
      return 'Fix referenced intake paths';
    case 'schema-issues':
      return 'Fix intake schema shape';
    default:
      return 'Review evidence gap';
  }
}

function getGapAction(gap: AgentSessionV3PilotRealCorpusBatchEvidenceGap) {
  switch (gap.code) {
    case 'consistency-issues':
      return 'Run the consistency report and repair missing baseline/current manifest entries or duplicate manifest paths.';
    case 'index-empty':
      return 'Add at least one baseline or real manifest entry to corpus-batch-index.json before interpreting readiness.';
    case 'index-mixed':
      return 'Inspect the nested batch index report and record why ready and mixed batches differ before threshold discussion.';
    case 'index-not-ready':
      return 'Inspect failed readiness checks in the nested manifest/index reports before changing thresholds.';
    case 'manifest-empty':
      return 'Add already exported corpus JSON files to real-corpus-manifest.json before running manual review.';
    case 'metadata-quality-blocked':
      return 'Open the nested metadata quality report and replace placeholder corpus paths or other blocker fields.';
    case 'metadata-quality-review':
      return 'Open the nested metadata quality report and fill provenance, notes, and sample-note context.';
    case 'missing-required-files':
      return 'Generate or restore the intake template files, then rerun this checklist report.';
    case 'note-incomplete':
      return 'Fill sample-note-template.md with batch identity, validator result, and manual interpretation context.';
    case 'note-missing':
      return 'Add sample-note-template.md or regenerate the intake template so review context is recorded.';
    case 'path-issues':
      return 'Run the path-health report and repair missing, invalid, or unparsable referenced JSON paths.';
    case 'schema-issues':
      return 'Run the schema-shape report and repair manifest sources, index batches, labels, paths, and sourceKind fields.';
    default:
      return 'Inspect the nested evidence summary and validator reports before manual interpretation.';
  }
}

function createChecklistItemFromEvidenceGap(
  gap: AgentSessionV3PilotRealCorpusBatchEvidenceGap,
): AgentSessionV3PilotRealCorpusBatchOperatorChecklistItem {
  return {
    action: getGapAction(gap),
    detail: gap.detail,
    id: `gap-${gap.code}`,
    severity: gap.severity,
    source: getChecklistItemSource(gap),
    title: getGapTitle(gap),
  };
}

function createMetadataIssueSampleItem(
  evidenceSummary: AgentSessionV3PilotRealCorpusBatchEvidenceSummaryResult,
): AgentSessionV3PilotRealCorpusBatchOperatorChecklistItem | null {
  const issues = evidenceSummary.metadataQuality.issues;

  if (issues.length === 0) {
    return null;
  }

  const sampleText = issues
    .slice(0, 3)
    .map((issue) => `${issue.scope}:${issue.path}:${issue.code}`)
    .join('; ');

  return {
    action: 'Use the nested metadata quality report for exact fields; metadata quality stays report-only and does not change validator readiness.',
    detail: `${issues.length} metadata quality issue(s). Samples: ${sampleText}`,
    id: 'metadata-quality-issue-samples',
    severity: 'review',
    source: 'metadata-quality',
    title: 'Inspect metadata quality issue samples',
  };
}

function createEvidenceSummaryItem(
  evidenceSummary: AgentSessionV3PilotRealCorpusBatchEvidenceSummaryResult,
): AgentSessionV3PilotRealCorpusBatchOperatorChecklistItem {
  return {
    action: 'Use this checklist as the short operator view, then open nested reports only for the listed gaps.',
    detail: `Evidence summary status=${evidenceSummary.status}, validator=${evidenceSummary.validator.status}, metadata=${evidenceSummary.metadataQuality.status}.`,
    id: 'evidence-summary-status',
    severity: 'info',
    source: 'evidence-summary',
    title: 'Read combined evidence status',
  };
}

function createRunbookItem(): AgentSessionV3PilotRealCorpusBatchOperatorChecklistItem {
  return {
    action: 'Follow PROJECT_AGENT_V3_REAL_CORPUS_BATCH_RUNBOOK.md for baseline, intake, manifest, index, notes, and threshold review rules.',
    detail: 'The runbook remains the manual source of truth for caller-owned real corpus batch review.',
    id: 'runbook-manual-review',
    severity: 'info',
    source: 'runbook',
    title: 'Keep review aligned with the runbook',
  };
}

function createChecklistItems(
  evidenceSummary: AgentSessionV3PilotRealCorpusBatchEvidenceSummaryResult,
): AgentSessionV3PilotRealCorpusBatchOperatorChecklistItem[] {
  const metadataIssueSampleItem = createMetadataIssueSampleItem(evidenceSummary);

  return [
    ...evidenceSummary.evidenceGaps.map(createChecklistItemFromEvidenceGap),
    ...(metadataIssueSampleItem ? [metadataIssueSampleItem] : []),
    createEvidenceSummaryItem(evidenceSummary),
    createRunbookItem(),
  ];
}

function countChecklistItems(
  checklistItems: AgentSessionV3PilotRealCorpusBatchOperatorChecklistItem[],
  severity: AgentSessionV3PilotRealCorpusBatchOperatorChecklistItemSeverity,
) {
  return checklistItems.filter((item) => item.severity === severity).length;
}

function createSummaryText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchOperatorChecklistReportResult,
    'blockerCount' | 'checklistItems' | 'evidenceSummary' | 'infoCount' | 'reviewCount' | 'status'
  >,
) {
  return [
    `AgentSessionV3PilotRealCorpusBatchOperatorChecklistReport status=${result.status}`,
    `evidenceSummary=${result.evidenceSummary.status}`,
    `validator=${result.evidenceSummary.validator.status}`,
    `metadata=${result.evidenceSummary.metadataQuality.status}`,
    `phaseCoverage=${result.evidenceSummary.phaseCoverageCounts.status}`,
    `phaseCoverageFailedManifests=${result.evidenceSummary.phaseCoverageCounts.failedManifestCount}`,
    `phaseCoverageNeedsReviewSourceKinds=${result.evidenceSummary.phaseCoverageCounts.sourceKindNeedsReviewCount}`,
    `checklistItems=${result.checklistItems.length}`,
    `blockers=${result.blockerCount}`,
    `review=${result.reviewCount}`,
    `info=${result.infoCount}`,
  ].join(' ');
}

function createReportText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchOperatorChecklistReportResult,
    'checklistItems' | 'evidenceSummary' | 'summaryText'
  >,
) {
  const checklistLines = result.checklistItems.length
    ? [
      'operatorChecklist:',
      ...result.checklistItems.map((item) => [
        `- severity=${item.severity}`,
        `source=${item.source}`,
        `id=${item.id}`,
        `title=${item.title}`,
        `detail=${item.detail}`,
        `action=${item.action}`,
      ].join(' ')),
    ]
    : ['operatorChecklist: none'];

  return [
    result.summaryText,
    ...checklistLines,
    [
      'phaseCoverageCalibration',
      `status=${result.evidenceSummary.phaseCoverageCounts.status}`,
      `failedManifests=${result.evidenceSummary.phaseCoverageCounts.failedManifestCount}`,
      `failedChecks=${result.evidenceSummary.phaseCoverageCounts.failedCheckCount}`,
      `sourceKindNeedsReview=${result.evidenceSummary.phaseCoverageCounts.sourceKindNeedsReviewCount}`,
    ].join(' '),
    result.evidenceSummary.summaryText,
  ].join('\n');
}

function createJsonText(
  result: AgentSessionV3PilotRealCorpusBatchOperatorChecklistReportResult,
  options: { prettyJson?: boolean } = {},
) {
  return JSON.stringify(result, null, options.prettyJson ? 2 : 0);
}

export async function runAgentSessionV3PilotRealCorpusBatchOperatorChecklistReport(
  options: RunAgentSessionV3PilotRealCorpusBatchOperatorChecklistReportOptions,
): Promise<AgentSessionV3PilotRealCorpusBatchOperatorChecklistReportResult> {
  const intakeDir = path.resolve(options.intakeDir);
  const evidenceSummary = await runAgentSessionV3PilotRealCorpusBatchEvidenceSummary({
    intakeDir,
    prettyJson: options.prettyJson,
  });
  const checklistItems = createChecklistItems(evidenceSummary);
  const resultWithoutJson: AgentSessionV3PilotRealCorpusBatchOperatorChecklistReportResult = {
    blockerCount: countChecklistItems(checklistItems, 'blocker'),
    checklistItems,
    evidenceSummary,
    infoCount: countChecklistItems(checklistItems, 'info'),
    intakeDir,
    jsonText: null,
    kind: 'agent-session-v3-pilot-real-corpus-batch-operator-checklist-report',
    reportText: '',
    reviewCount: countChecklistItems(checklistItems, 'review'),
    status: mapEvidenceSummaryStatus(evidenceSummary.status),
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

async function runAgentSessionV3PilotRealCorpusBatchOperatorChecklistReportCli() {
  const options = parseAgentSessionV3PilotRealCorpusBatchOperatorChecklistReportArgs(process.argv.slice(2));
  const result = await runAgentSessionV3PilotRealCorpusBatchOperatorChecklistReport(options);
  console.log(result.reportText);
  if (result.jsonText) {
    console.log(result.jsonText);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAgentSessionV3PilotRealCorpusBatchOperatorChecklistReportCli().catch((error: unknown) => {
    const errorText = error instanceof Error ? error.message : String(error);
    console.error(errorText);
    process.exitCode = 1;
  });
}
