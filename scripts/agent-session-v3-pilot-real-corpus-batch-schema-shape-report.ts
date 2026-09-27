import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  type AgentSessionV3PilotCorpusBatchIndex,
} from './agent-session-v3-pilot-corpus-batch-index-report.ts';
import {
  type AgentSessionV3PilotExternalSampleCorpusManifest,
} from './agent-session-v3-pilot-external-sample-corpus-manifest-loader.ts';

export type AgentSessionV3PilotRealCorpusBatchSchemaShapeStatus =
  | 'issues'
  | 'missing'
  | 'valid';

export type AgentSessionV3PilotRealCorpusBatchSchemaShapeIssueScope =
  | 'index'
  | 'index-batch'
  | 'manifest'
  | 'manifest-source';

export type AgentSessionV3PilotRealCorpusBatchSchemaShapeIssueCode =
  | 'duplicate-label'
  | 'empty-source-kind'
  | 'invalid-array'
  | 'invalid-entry'
  | 'invalid-json'
  | 'invalid-object'
  | 'invalid-path-field'
  | 'missing-array'
  | 'missing-label'
  | 'missing-required-file';

export interface AgentSessionV3PilotRealCorpusBatchSchemaShapeIssue {
  code: AgentSessionV3PilotRealCorpusBatchSchemaShapeIssueCode;
  label: string;
  message: string;
  path: string;
  scope: AgentSessionV3PilotRealCorpusBatchSchemaShapeIssueScope;
}

export interface RunAgentSessionV3PilotRealCorpusBatchSchemaShapeReportOptions {
  includeJsonText?: boolean;
  intakeDir: string;
  prettyJson?: boolean;
}

export interface AgentSessionV3PilotRealCorpusBatchSchemaShapeReportResult {
  indexBatchCount: number;
  intakeDir: string;
  issueCount: number;
  issues: AgentSessionV3PilotRealCorpusBatchSchemaShapeIssue[];
  jsonText: string | null;
  kind: 'agent-session-v3-pilot-real-corpus-batch-schema-shape-report';
  manifestSourceCount: number;
  reportText: string;
  status: AgentSessionV3PilotRealCorpusBatchSchemaShapeStatus;
  summaryText: string;
  version: 1;
}

interface ReadJsonFileResult<T> {
  errorMessage: string | null;
  value: T | null;
  status: 'invalid-json' | 'missing' | 'present';
}

function parseAgentSessionV3PilotRealCorpusBatchSchemaShapeReportArgs(
  args: readonly string[],
): RunAgentSessionV3PilotRealCorpusBatchSchemaShapeReportOptions {
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
    throw new Error('Usage: npx tsx scripts/agent-session-v3-pilot-real-corpus-batch-schema-shape-report.ts --dir intake-dir [--json] [--pretty]');
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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function createIssue(options: {
  code: AgentSessionV3PilotRealCorpusBatchSchemaShapeIssueCode;
  label: string;
  message: string;
  path: string;
  scope: AgentSessionV3PilotRealCorpusBatchSchemaShapeIssueScope;
}): AgentSessionV3PilotRealCorpusBatchSchemaShapeIssue {
  return {
    code: options.code,
    label: options.label,
    message: options.message,
    path: options.path,
    scope: options.scope,
  };
}

function createRequiredFileIssues(options: {
  manifestRead: ReadJsonFileResult<unknown>;
  indexRead: ReadJsonFileResult<unknown>;
}) {
  const issues: AgentSessionV3PilotRealCorpusBatchSchemaShapeIssue[] = [];

  if (options.manifestRead.status === 'missing') {
    issues.push(createIssue({
      code: 'missing-required-file',
      label: 'real-corpus-manifest',
      message: 'Required real-corpus-manifest.json is missing.',
      path: 'real-corpus-manifest.json',
      scope: 'manifest',
    }));
  } else if (options.manifestRead.status === 'invalid-json') {
    issues.push(createIssue({
      code: 'invalid-json',
      label: 'real-corpus-manifest',
      message: options.manifestRead.errorMessage ?? 'Manifest JSON could not be parsed.',
      path: 'real-corpus-manifest.json',
      scope: 'manifest',
    }));
  }

  if (options.indexRead.status === 'missing') {
    issues.push(createIssue({
      code: 'missing-required-file',
      label: 'corpus-batch-index',
      message: 'Required corpus-batch-index.json is missing.',
      path: 'corpus-batch-index.json',
      scope: 'index',
    }));
  } else if (options.indexRead.status === 'invalid-json') {
    issues.push(createIssue({
      code: 'invalid-json',
      label: 'corpus-batch-index',
      message: options.indexRead.errorMessage ?? 'Batch index JSON could not be parsed.',
      path: 'corpus-batch-index.json',
      scope: 'index',
    }));
  }

  return issues;
}

function getArrayField(options: {
  fieldName: string;
  fileLabel: string;
  root: Record<string, unknown>;
  scope: 'index' | 'manifest';
}) {
  const value = options.root[options.fieldName];
  const missing = !(options.fieldName in options.root);

  if (Array.isArray(value)) {
    return {
      issues: [],
      value,
    };
  }

  return {
    issues: [
      createIssue({
        code: missing ? 'missing-array' : 'invalid-array',
        label: options.fileLabel,
        message: `${options.fieldName} must be an array for caller-owned intake reports.`,
        path: options.fieldName,
        scope: options.scope,
      }),
    ],
    value: [],
  };
}

function addDuplicateLabelIssues(options: {
  entries: readonly Record<string, unknown>[];
  issues: AgentSessionV3PilotRealCorpusBatchSchemaShapeIssue[];
  pathPrefix: string;
  scope: 'index-batch' | 'manifest-source';
}) {
  const labelCounts = new Map<string, number>();

  for (const entry of options.entries) {
    if (!isNonEmptyString(entry.label)) {
      continue;
    }
    const label = entry.label.trim();
    labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
  }

  options.entries.forEach((entry, index) => {
    if (!isNonEmptyString(entry.label)) {
      return;
    }
    const label = entry.label.trim();
    if ((labelCounts.get(label) ?? 0) <= 1) {
      return;
    }

    options.issues.push(createIssue({
      code: 'duplicate-label',
      label,
      message: 'Labels should be unique inside this intake file so reports can be compared reliably.',
      path: `${options.pathPrefix}[${index}].label`,
      scope: options.scope,
    }));
  });
}

function inspectManifestShape(
  manifest: AgentSessionV3PilotExternalSampleCorpusManifest | null,
) {
  const issues: AgentSessionV3PilotRealCorpusBatchSchemaShapeIssue[] = [];
  let sources: unknown[] = [];

  if (!isRecord(manifest)) {
    return {
      issues: [
        createIssue({
          code: 'invalid-object',
          label: 'real-corpus-manifest',
          message: 'real-corpus-manifest.json must contain a JSON object.',
          path: 'real-corpus-manifest.json',
          scope: 'manifest',
        }),
      ],
      sourceCount: 0,
    };
  }

  const arrayField = getArrayField({
    fieldName: 'sources',
    fileLabel: 'real-corpus-manifest',
    root: manifest,
    scope: 'manifest',
  });
  sources = arrayField.value;
  issues.push(...arrayField.issues);

  const sourceRecords: Record<string, unknown>[] = [];
  sources.forEach((source, index) => {
    if (!isRecord(source)) {
      issues.push(createIssue({
        code: 'invalid-entry',
        label: `manifest-source-${index}`,
        message: 'Each manifest source must be a JSON object.',
        path: `sources[${index}]`,
        scope: 'manifest-source',
      }));
      return;
    }

    sourceRecords.push(source);

    if (!isNonEmptyString(source.label)) {
      issues.push(createIssue({
        code: 'missing-label',
        label: `manifest-source-${index}`,
        message: 'Each manifest source should have a non-empty label.',
        path: `sources[${index}].label`,
        scope: 'manifest-source',
      }));
    }

    if (!isNonEmptyString(source.path)) {
      issues.push(createIssue({
        code: 'invalid-path-field',
        label: isNonEmptyString(source.label) ? source.label.trim() : `manifest-source-${index}`,
        message: 'Each manifest source must have a non-empty string path.',
        path: `sources[${index}].path`,
        scope: 'manifest-source',
      }));
    }
  });

  addDuplicateLabelIssues({
    entries: sourceRecords,
    issues,
    pathPrefix: 'sources',
    scope: 'manifest-source',
  });

  return {
    issues,
    sourceCount: sources.length,
  };
}

function inspectIndexShape(
  index: AgentSessionV3PilotCorpusBatchIndex | null,
) {
  const issues: AgentSessionV3PilotRealCorpusBatchSchemaShapeIssue[] = [];
  let batches: unknown[] = [];

  if (!isRecord(index)) {
    return {
      batchCount: 0,
      issues: [
        createIssue({
          code: 'invalid-object',
          label: 'corpus-batch-index',
          message: 'corpus-batch-index.json must contain a JSON object.',
          path: 'corpus-batch-index.json',
          scope: 'index',
        }),
      ],
    };
  }

  const arrayField = getArrayField({
    fieldName: 'batches',
    fileLabel: 'corpus-batch-index',
    root: index,
    scope: 'index',
  });
  batches = arrayField.value;
  issues.push(...arrayField.issues);

  const batchRecords: Record<string, unknown>[] = [];
  batches.forEach((batch, indexEntry) => {
    if (!isRecord(batch)) {
      issues.push(createIssue({
        code: 'invalid-entry',
        label: `index-batch-${indexEntry}`,
        message: 'Each batch index entry must be a JSON object.',
        path: `batches[${indexEntry}]`,
        scope: 'index-batch',
      }));
      return;
    }

    batchRecords.push(batch);

    if (!isNonEmptyString(batch.label)) {
      issues.push(createIssue({
        code: 'missing-label',
        label: `index-batch-${indexEntry}`,
        message: 'Each batch index entry should have a non-empty label.',
        path: `batches[${indexEntry}].label`,
        scope: 'index-batch',
      }));
    }

    if (!isNonEmptyString(batch.manifestPath)) {
      issues.push(createIssue({
        code: 'invalid-path-field',
        label: isNonEmptyString(batch.label) ? batch.label.trim() : `index-batch-${indexEntry}`,
        message: 'Each batch index entry must have a non-empty string manifestPath.',
        path: `batches[${indexEntry}].manifestPath`,
        scope: 'index-batch',
      }));
    }

    if (!isNonEmptyString(batch.sourceKind)) {
      issues.push(createIssue({
        code: 'empty-source-kind',
        label: isNonEmptyString(batch.label) ? batch.label.trim() : `index-batch-${indexEntry}`,
        message: 'Each batch index entry should have a non-empty sourceKind.',
        path: `batches[${indexEntry}].sourceKind`,
        scope: 'index-batch',
      }));
    }
  });

  addDuplicateLabelIssues({
    entries: batchRecords,
    issues,
    pathPrefix: 'batches',
    scope: 'index-batch',
  });

  return {
    batchCount: batches.length,
    issues,
  };
}

function createSummaryText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchSchemaShapeReportResult,
    'indexBatchCount' | 'issueCount' | 'manifestSourceCount' | 'status'
  >,
) {
  return [
    `AgentSessionV3PilotRealCorpusBatchSchemaShapeReport status=${result.status}`,
    `issues=${result.issueCount}`,
    `manifestSources=${result.manifestSourceCount}`,
    `indexBatches=${result.indexBatchCount}`,
  ].join(' ');
}

function createReportText(
  result: Pick<AgentSessionV3PilotRealCorpusBatchSchemaShapeReportResult, 'issues' | 'summaryText'>,
) {
  return [
    result.summaryText,
    result.issues.length ? 'schemaShapeIssues:' : 'schemaShapeIssues: none',
    ...result.issues.map((issue) => [
      `- scope=${issue.scope}`,
      `code=${issue.code}`,
      `path=${issue.path}`,
      `label=${issue.label}`,
      `message=${issue.message}`,
    ].join(' ')),
  ].join('\n');
}

function createJsonText(
  result: AgentSessionV3PilotRealCorpusBatchSchemaShapeReportResult,
  options: { prettyJson?: boolean } = {},
) {
  return JSON.stringify(result, null, options.prettyJson ? 2 : 0);
}

function createStatus(
  issues: readonly AgentSessionV3PilotRealCorpusBatchSchemaShapeIssue[],
): AgentSessionV3PilotRealCorpusBatchSchemaShapeStatus {
  if (issues.some((issue) => issue.code === 'missing-required-file')) {
    return 'missing';
  }

  return issues.length > 0 ? 'issues' : 'valid';
}

export async function runAgentSessionV3PilotRealCorpusBatchSchemaShapeReport(
  options: RunAgentSessionV3PilotRealCorpusBatchSchemaShapeReportOptions,
): Promise<AgentSessionV3PilotRealCorpusBatchSchemaShapeReportResult> {
  const intakeDir = path.resolve(options.intakeDir);
  const manifestPath = path.join(intakeDir, 'real-corpus-manifest.json');
  const indexPath = path.join(intakeDir, 'corpus-batch-index.json');
  const manifestRead = await readJsonFile<AgentSessionV3PilotExternalSampleCorpusManifest>(manifestPath);
  const indexRead = await readJsonFile<AgentSessionV3PilotCorpusBatchIndex>(indexPath);
  const requiredFileIssues = createRequiredFileIssues({
    indexRead,
    manifestRead,
  });
  const manifestShape = manifestRead.status === 'present'
    ? inspectManifestShape(manifestRead.value)
    : {
      issues: [],
      sourceCount: 0,
    };
  const indexShape = indexRead.status === 'present'
    ? inspectIndexShape(indexRead.value)
    : {
      batchCount: 0,
      issues: [],
    };
  const issues = [
    ...requiredFileIssues,
    ...manifestShape.issues,
    ...indexShape.issues,
  ];
  const resultWithoutJson: AgentSessionV3PilotRealCorpusBatchSchemaShapeReportResult = {
    indexBatchCount: indexShape.batchCount,
    intakeDir,
    issueCount: issues.length,
    issues,
    jsonText: null,
    kind: 'agent-session-v3-pilot-real-corpus-batch-schema-shape-report',
    manifestSourceCount: manifestShape.sourceCount,
    reportText: '',
    status: createStatus(issues),
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

async function runAgentSessionV3PilotRealCorpusBatchSchemaShapeReportCli() {
  const options = parseAgentSessionV3PilotRealCorpusBatchSchemaShapeReportArgs(process.argv.slice(2));
  const result = await runAgentSessionV3PilotRealCorpusBatchSchemaShapeReport(options);
  console.log(result.reportText);
  if (result.jsonText) {
    console.log(result.jsonText);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAgentSessionV3PilotRealCorpusBatchSchemaShapeReportCli().catch((error: unknown) => {
    const errorText = error instanceof Error ? error.message : String(error);
    console.error(errorText);
    process.exitCode = 1;
  });
}
