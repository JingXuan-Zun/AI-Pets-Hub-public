import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  type AgentSessionV3PilotCorpusBatchIndex,
  type AgentSessionV3PilotCorpusBatchIndexEntry,
} from './agent-session-v3-pilot-corpus-batch-index-report.ts';
import {
  type AgentSessionV3PilotExternalSampleCorpusManifest,
  type AgentSessionV3PilotExternalSampleCorpusManifestSource,
} from './agent-session-v3-pilot-external-sample-corpus-manifest-loader.ts';
import {
  AGENT_SESSION_V3_PILOT_REAL_CORPUS_BATCH_SAMPLE_NOTE_OPEN_ITEM_CHECKS,
  runAgentSessionV3PilotRealCorpusBatchSampleNoteReport,
} from './agent-session-v3-pilot-real-corpus-batch-sample-note-report.ts';

export type AgentSessionV3PilotRealCorpusBatchMetadataQualityStatus =
  | 'blocked'
  | 'review-ready'
  | 'review-needed';

export type AgentSessionV3PilotRealCorpusBatchMetadataQualityIssueSeverity =
  | 'blocker'
  | 'review';

export type AgentSessionV3PilotRealCorpusBatchMetadataQualityIssueScope =
  | 'index-batch'
  | 'manifest-source'
  | 'sample-note';

export type AgentSessionV3PilotRealCorpusBatchMetadataQualityIssueCode =
  | 'missing-generated-at'
  | 'missing-notes'
  | 'missing-sample-note'
  | 'missing-source-kind'
  | 'open-sample-note-item'
  | 'placeholder-generated-at'
  | 'placeholder-label'
  | 'placeholder-notes'
  | 'placeholder-path'
  | 'placeholder-source-kind';

export interface AgentSessionV3PilotRealCorpusBatchMetadataQualityIssue {
  code: AgentSessionV3PilotRealCorpusBatchMetadataQualityIssueCode;
  label: string;
  message: string;
  path: string;
  scope: AgentSessionV3PilotRealCorpusBatchMetadataQualityIssueScope;
  severity: AgentSessionV3PilotRealCorpusBatchMetadataQualityIssueSeverity;
}

export interface RunAgentSessionV3PilotRealCorpusBatchMetadataQualityReportOptions {
  includeJsonText?: boolean;
  intakeDir: string;
  prettyJson?: boolean;
}

export interface AgentSessionV3PilotRealCorpusBatchMetadataQualityReportResult {
  blockerCount: number;
  indexBatchCount: number;
  intakeDir: string;
  issueCount: number;
  issues: AgentSessionV3PilotRealCorpusBatchMetadataQualityIssue[];
  jsonText: string | null;
  kind: 'agent-session-v3-pilot-real-corpus-batch-metadata-quality-report';
  manifestSourceCount: number;
  noteOpenItemCount: number;
  notePresent: boolean;
  reportText: string;
  reviewCount: number;
  status: AgentSessionV3PilotRealCorpusBatchMetadataQualityStatus;
  summaryText: string;
  version: 1;
}

interface ReadJsonFileResult<T> {
  errorMessage: string | null;
  status: 'invalid-json' | 'missing' | 'present';
  value: T | null;
}

function parseAgentSessionV3PilotRealCorpusBatchMetadataQualityReportArgs(
  args: readonly string[],
): RunAgentSessionV3PilotRealCorpusBatchMetadataQualityReportOptions {
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
    throw new Error('Usage: npx tsx scripts/agent-session-v3-pilot-real-corpus-batch-metadata-quality-report.ts --dir intake-dir [--json] [--pretty]');
  }

  return {
    includeJsonText,
    intakeDir,
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

async function readJsonFile<T>(filePath: string): Promise<ReadJsonFileResult<T>> {
  try {
    const text = await readFile(filePath, 'utf8');

    try {
      return {
        errorMessage: null,
        status: 'present',
        value: JSON.parse(text) as T,
      };
    } catch (error: unknown) {
      return {
        errorMessage: getErrorMessage(error),
        status: 'invalid-json',
        value: null,
      };
    }
  } catch (error: unknown) {
    if (getErrorCode(error) === 'ENOENT') {
      return {
        errorMessage: null,
        status: 'missing',
        value: null,
      };
    }

    throw error;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function isPlaceholderText(value: unknown) {
  const normalized = normalizeString(value).toLowerCase();

  return normalized.length === 0
    || normalized.includes('replace-with')
    || normalized.includes('optional ')
    || normalized === 'none recorded';
}

function createIssue(options: {
  code: AgentSessionV3PilotRealCorpusBatchMetadataQualityIssueCode;
  label: string;
  message: string;
  path: string;
  scope: AgentSessionV3PilotRealCorpusBatchMetadataQualityIssueScope;
  severity: AgentSessionV3PilotRealCorpusBatchMetadataQualityIssueSeverity;
}): AgentSessionV3PilotRealCorpusBatchMetadataQualityIssue {
  return {
    code: options.code,
    label: options.label,
    message: options.message,
    path: options.path,
    scope: options.scope,
    severity: options.severity,
  };
}

function inspectManifestMetadata(
  manifest: AgentSessionV3PilotExternalSampleCorpusManifest | null,
) {
  const issues: AgentSessionV3PilotRealCorpusBatchMetadataQualityIssue[] = [];
  const sources = Array.isArray(manifest?.sources) ? manifest.sources : [];

  sources.forEach((source: AgentSessionV3PilotExternalSampleCorpusManifestSource, index) => {
    const sourceRecord = isRecord(source) ? source : {};
    const label = normalizeString(sourceRecord.label) || `manifest-source-${index}`;

    if (isPlaceholderText(sourceRecord.label)) {
      issues.push(createIssue({
        code: 'placeholder-label',
        label,
        message: 'Manifest source label still looks like a placeholder, so manual calibration cannot compare this source reliably.',
        path: `sources[${index}].label`,
        scope: 'manifest-source',
        severity: 'review',
      }));
    }

    if (isPlaceholderText(sourceRecord.path)) {
      issues.push(createIssue({
        code: 'placeholder-path',
        label,
        message: 'Manifest source path still looks like a placeholder, so the intake is not tied to a real exported corpus file.',
        path: `sources[${index}].path`,
        scope: 'manifest-source',
        severity: 'blocker',
      }));
    }
  });

  return {
    issues,
    sourceCount: sources.length,
  };
}

function inspectIndexMetadata(
  index: AgentSessionV3PilotCorpusBatchIndex | null,
) {
  const issues: AgentSessionV3PilotRealCorpusBatchMetadataQualityIssue[] = [];
  const batches = Array.isArray(index?.batches) ? index.batches : [];

  batches.forEach((batch: AgentSessionV3PilotCorpusBatchIndexEntry, indexEntry) => {
    const batchRecord = isRecord(batch) ? batch : {};
    const label = normalizeString(batchRecord.label) || `index-batch-${indexEntry}`;

    if (isPlaceholderText(batchRecord.label)) {
      issues.push(createIssue({
        code: 'placeholder-label',
        label,
        message: 'Index batch label still looks like a placeholder, so batch reports cannot be compared reliably.',
        path: `batches[${indexEntry}].label`,
        scope: 'index-batch',
        severity: 'review',
      }));
    }

    if (!normalizeString(batchRecord.sourceKind)) {
      issues.push(createIssue({
        code: 'missing-source-kind',
        label,
        message: 'Index batch sourceKind is missing, so baseline/manual/production-like grouping is unavailable.',
        path: `batches[${indexEntry}].sourceKind`,
        scope: 'index-batch',
        severity: 'review',
      }));
    } else if (isPlaceholderText(batchRecord.sourceKind)) {
      issues.push(createIssue({
        code: 'placeholder-source-kind',
        label,
        message: 'Index batch sourceKind still looks like a placeholder, so source grouping needs manual review.',
        path: `batches[${indexEntry}].sourceKind`,
        scope: 'index-batch',
        severity: 'review',
      }));
    }

    if (!normalizeString(batchRecord.generatedAt)) {
      issues.push(createIssue({
        code: 'missing-generated-at',
        label,
        message: 'Index batch generatedAt is missing, so recency and trace provenance are unclear.',
        path: `batches[${indexEntry}].generatedAt`,
        scope: 'index-batch',
        severity: 'review',
      }));
    } else if (isPlaceholderText(batchRecord.generatedAt)) {
      issues.push(createIssue({
        code: 'placeholder-generated-at',
        label,
        message: 'Index batch generatedAt still looks like a placeholder, so recency cannot be interpreted.',
        path: `batches[${indexEntry}].generatedAt`,
        scope: 'index-batch',
        severity: 'review',
      }));
    }

    if (!normalizeString(batchRecord.notes)) {
      issues.push(createIssue({
        code: 'missing-notes',
        label,
        message: 'Index batch notes are missing, so reviewers lack source context.',
        path: `batches[${indexEntry}].notes`,
        scope: 'index-batch',
        severity: 'review',
      }));
    } else if (isPlaceholderText(batchRecord.notes)) {
      issues.push(createIssue({
        code: 'placeholder-notes',
        label,
        message: 'Index batch notes still look generic or placeholder-like, so reviewers should fill specific source context.',
        path: `batches[${indexEntry}].notes`,
        scope: 'index-batch',
        severity: 'review',
      }));
    }
  });

  return {
    batchCount: batches.length,
    issues,
  };
}

async function inspectSampleNoteMetadata(options: {
  notePath: string;
  prettyJson?: boolean;
}) {
  const noteReport = await runAgentSessionV3PilotRealCorpusBatchSampleNoteReport({
    notePath: options.notePath,
    prettyJson: options.prettyJson,
  });
  const issues: AgentSessionV3PilotRealCorpusBatchMetadataQualityIssue[] = [];

  if (!noteReport.notePresent) {
    issues.push(createIssue({
      code: 'missing-sample-note',
      label: 'sample-note-template',
      message: 'Sample note is missing, so manual interpretation context is unavailable.',
      path: 'sample-note-template.md',
      scope: 'sample-note',
      severity: 'review',
    }));
  }

  for (const item of noteReport.openItems) {
    issues.push(createIssue({
      code: 'open-sample-note-item',
      label: item.label,
      message: `${item.label} still contains ${item.placeholder}.`,
      path: `sample-note-template.md#${item.id}`,
      scope: 'sample-note',
      severity: AGENT_SESSION_V3_PILOT_REAL_CORPUS_BATCH_SAMPLE_NOTE_OPEN_ITEM_CHECKS
        .some((check) => check.id === item.id)
        ? 'review'
        : 'review',
    }));
  }

  return {
    issues,
    noteOpenItemCount: noteReport.openItemCount,
    notePresent: noteReport.notePresent,
  };
}

function createStatus(options: {
  blockerCount: number;
  reviewCount: number;
}): AgentSessionV3PilotRealCorpusBatchMetadataQualityStatus {
  if (options.blockerCount > 0) {
    return 'blocked';
  }

  return options.reviewCount > 0 ? 'review-needed' : 'review-ready';
}

function createSummaryText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchMetadataQualityReportResult,
    'blockerCount' | 'indexBatchCount' | 'issueCount' | 'manifestSourceCount' | 'noteOpenItemCount' | 'notePresent' | 'reviewCount' | 'status'
  >,
) {
  return [
    `AgentSessionV3PilotRealCorpusBatchMetadataQualityReport status=${result.status}`,
    `issues=${result.issueCount}`,
    `blockers=${result.blockerCount}`,
    `review=${result.reviewCount}`,
    `manifestSources=${result.manifestSourceCount}`,
    `indexBatches=${result.indexBatchCount}`,
    `notePresent=${result.notePresent ? 'yes' : 'no'}`,
    `noteOpenItems=${result.noteOpenItemCount}`,
  ].join(' ');
}

function createReportText(
  result: Pick<AgentSessionV3PilotRealCorpusBatchMetadataQualityReportResult, 'issues' | 'summaryText'>,
) {
  return [
    result.summaryText,
    result.issues.length ? 'metadataQualityIssues:' : 'metadataQualityIssues: none',
    ...result.issues.map((issue) => [
      `- severity=${issue.severity}`,
      `scope=${issue.scope}`,
      `code=${issue.code}`,
      `path=${issue.path}`,
      `label=${issue.label}`,
      `message=${issue.message}`,
    ].join(' ')),
  ].join('\n');
}

function createJsonText(
  result: AgentSessionV3PilotRealCorpusBatchMetadataQualityReportResult,
  options: { prettyJson?: boolean } = {},
) {
  return JSON.stringify(result, null, options.prettyJson ? 2 : 0);
}

export async function runAgentSessionV3PilotRealCorpusBatchMetadataQualityReport(
  options: RunAgentSessionV3PilotRealCorpusBatchMetadataQualityReportOptions,
): Promise<AgentSessionV3PilotRealCorpusBatchMetadataQualityReportResult> {
  const intakeDir = path.resolve(options.intakeDir);
  const manifestPath = path.join(intakeDir, 'real-corpus-manifest.json');
  const indexPath = path.join(intakeDir, 'corpus-batch-index.json');
  const notePath = path.join(intakeDir, 'sample-note-template.md');
  const manifestRead = await readJsonFile<AgentSessionV3PilotExternalSampleCorpusManifest>(manifestPath);
  const indexRead = await readJsonFile<AgentSessionV3PilotCorpusBatchIndex>(indexPath);
  const manifestMetadata = manifestRead.status === 'present'
    ? inspectManifestMetadata(manifestRead.value)
    : {
      issues: [],
      sourceCount: 0,
    };
  const indexMetadata = indexRead.status === 'present'
    ? inspectIndexMetadata(indexRead.value)
    : {
      batchCount: 0,
      issues: [],
    };
  const sampleNoteMetadata = await inspectSampleNoteMetadata({
    notePath,
    prettyJson: options.prettyJson,
  });
  const issues = [
    ...manifestMetadata.issues,
    ...indexMetadata.issues,
    ...sampleNoteMetadata.issues,
  ];
  const blockerCount = issues.filter((issue) => issue.severity === 'blocker').length;
  const reviewCount = issues.filter((issue) => issue.severity === 'review').length;
  const status = createStatus({
    blockerCount,
    reviewCount,
  });
  const resultWithoutText: AgentSessionV3PilotRealCorpusBatchMetadataQualityReportResult = {
    blockerCount,
    indexBatchCount: indexMetadata.batchCount,
    intakeDir,
    issueCount: issues.length,
    issues,
    jsonText: null,
    kind: 'agent-session-v3-pilot-real-corpus-batch-metadata-quality-report',
    manifestSourceCount: manifestMetadata.sourceCount,
    noteOpenItemCount: sampleNoteMetadata.noteOpenItemCount,
    notePresent: sampleNoteMetadata.notePresent,
    reportText: '',
    reviewCount,
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

async function runAgentSessionV3PilotRealCorpusBatchMetadataQualityReportCli() {
  const options = parseAgentSessionV3PilotRealCorpusBatchMetadataQualityReportArgs(process.argv.slice(2));
  const result = await runAgentSessionV3PilotRealCorpusBatchMetadataQualityReport(options);
  console.log(result.reportText);
  if (result.jsonText) {
    console.log(result.jsonText);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAgentSessionV3PilotRealCorpusBatchMetadataQualityReportCli().catch((error: unknown) => {
    const errorText = error instanceof Error ? error.message : String(error);
    console.error(errorText);
    process.exitCode = 1;
  });
}
