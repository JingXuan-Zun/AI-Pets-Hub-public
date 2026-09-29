import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  createAgentSessionV3PilotRealCorpusBatchIntakeFillingSupportReport,
  type AgentSessionV3PilotRealCorpusBatchIntakeFillingItem,
} from './agent-session-v3-pilot-real-corpus-batch-intake-filling-support-report.ts';

export type AgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAuditStatus =
  | 'complete'
  | 'no-intake-dirs'
  | 'open-fields'
  | 'unreadable';

export type AgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessFieldStatus =
  | 'complete'
  | 'missing'
  | 'placeholder'
  | 'unreadable';

export type AgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessFieldScope =
  | 'index'
  | 'manifest'
  | 'sample-note';

export interface AgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessRequirement {
  field: string;
  gapKinds: string[];
  priorities: string[];
  scope: AgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessFieldScope;
}

export interface AgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessFieldAudit {
  field: string;
  gapKinds: string[];
  message: string;
  priorities: string[];
  scope: AgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessFieldScope;
  status: AgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessFieldStatus;
}

export interface AgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAuditEntry {
  completeFieldCount: number;
  fieldAudits: AgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessFieldAudit[];
  intakeDir: string;
  missingFieldCount: number;
  openFieldCount: number;
  placeholderFieldCount: number;
  requiredFieldCount: number;
  status: Exclude<AgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAuditStatus, 'no-intake-dirs'>;
  unreadableFieldCount: number;
}

export interface AgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAuditResult {
  completeFieldCount: number;
  fieldStatusCountsByScope: Record<
    AgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessFieldScope,
    Record<AgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessFieldStatus, number>
  >;
  fieldRequirements: AgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessRequirement[];
  fillingSupportSummaryText: string;
  guardrail: string;
  intakeCount: number;
  intakeEntries: AgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAuditEntry[];
  intakeStatusCounts: Record<
    Exclude<AgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAuditStatus, 'no-intake-dirs'>,
    number
  >;
  jsonText: string | null;
  kind: 'agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit';
  missingFieldCount: number;
  openFieldCount: number;
  placeholderFieldCount: number;
  readyForProductionRuntime: false;
  requiredFieldCount: number;
  reportText: string;
  status: AgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAuditStatus;
  summaryText: string;
  unreadableFieldCount: number;
  version: 1;
}

export interface RunAgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAuditOptions {
  includeJsonText?: boolean;
  intakeDirs?: readonly string[];
  prettyJson?: boolean;
  projectRoot?: string;
}

interface ReadTextResult {
  status: 'missing' | 'present' | 'unreadable';
  text: string | null;
  errorMessage: string | null;
}

interface ReadJsonResult {
  status: 'invalid-json' | 'missing' | 'present' | 'unreadable';
  value: unknown;
  errorMessage: string | null;
}

function parseArgs(
  args: readonly string[],
): RunAgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAuditOptions {
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

function getErrorCode(error: unknown) {
  return error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: unknown }).code)
    : '';
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function readTextFile(filePath: string): Promise<ReadTextResult> {
  try {
    return {
      errorMessage: null,
      status: 'present',
      text: await readFile(filePath, 'utf8'),
    };
  } catch (error: unknown) {
    if (getErrorCode(error) === 'ENOENT') {
      return {
        errorMessage: null,
        status: 'missing',
        text: null,
      };
    }

    return {
      errorMessage: getErrorMessage(error),
      status: 'unreadable',
      text: null,
    };
  }
}

async function readJsonFile(filePath: string): Promise<ReadJsonResult> {
  const textResult = await readTextFile(filePath);

  if (textResult.status === 'missing') {
    return {
      errorMessage: null,
      status: 'missing',
      value: null,
    };
  }
  if (textResult.status === 'unreadable') {
    return {
      errorMessage: textResult.errorMessage,
      status: 'unreadable',
      value: null,
    };
  }

  try {
    return {
      errorMessage: null,
      status: 'present',
      value: JSON.parse(textResult.text ?? ''),
    };
  } catch (error: unknown) {
    return {
      errorMessage: getErrorMessage(error),
      status: 'invalid-json',
      value: null,
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function containsPlaceholder(value: unknown) {
  return typeof value === 'string' && /replace-with/u.test(value);
}

function normalizeStrings(values: Iterable<string>) {
  return [...new Set(values)].sort();
}

function createRequirementKey(
  scope: AgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessFieldScope,
  field: string,
) {
  return `${scope}:${field}`;
}

function addRequirement(
  requirements: Map<string, AgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessRequirement>,
  options: {
    field: string;
    gapKind: string;
    priority: string;
    scope: AgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessFieldScope;
  },
) {
  const key = createRequirementKey(options.scope, options.field);
  const existing = requirements.get(key);

  if (!existing) {
    requirements.set(key, {
      field: options.field,
      gapKinds: [options.gapKind],
      priorities: [options.priority],
      scope: options.scope,
    });
    return;
  }

  requirements.set(key, {
    ...existing,
    gapKinds: normalizeStrings([...existing.gapKinds, options.gapKind]),
    priorities: normalizeStrings([...existing.priorities, options.priority]),
  });
}

function createFieldRequirements(
  fillingItems: readonly AgentSessionV3PilotRealCorpusBatchIntakeFillingItem[],
) {
  const requirements = new Map<string, AgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessRequirement>();

  for (const item of fillingItems) {
    for (const field of item.sampleNoteFields) {
      addRequirement(requirements, {
        field: field.id,
        gapKind: item.gapKind,
        priority: item.priority,
        scope: 'sample-note',
      });
    }
    for (const field of item.manifestFields) {
      addRequirement(requirements, {
        field,
        gapKind: item.gapKind,
        priority: item.priority,
        scope: 'manifest',
      });
    }
    for (const field of item.indexFields) {
      addRequirement(requirements, {
        field,
        gapKind: item.gapKind,
        priority: item.priority,
        scope: 'index',
      });
    }
  }

  return [...requirements.values()].sort((left, right) => (
    left.scope.localeCompare(right.scope)
      || left.field.localeCompare(right.field)
  ));
}

function createFieldAudit(
  requirement: AgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessRequirement,
  options: {
    message: string;
    status: AgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessFieldStatus;
  },
): AgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessFieldAudit {
  return {
    field: requirement.field,
    gapKinds: requirement.gapKinds,
    message: options.message,
    priorities: requirement.priorities,
    scope: requirement.scope,
    status: options.status,
  };
}

function auditSampleNoteField(
  requirement: AgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessRequirement,
  noteRead: ReadTextResult,
  placeholderByField: Map<string, string>,
) {
  if (noteRead.status === 'missing') {
    return createFieldAudit(requirement, {
      message: 'sample note file is missing',
      status: 'missing',
    });
  }
  if (noteRead.status === 'unreadable') {
    return createFieldAudit(requirement, {
      message: noteRead.errorMessage ?? 'sample note file is unreadable',
      status: 'unreadable',
    });
  }

  const placeholder = placeholderByField.get(requirement.field);
  if (placeholder && (noteRead.text ?? '').includes(placeholder)) {
    return createFieldAudit(requirement, {
      message: `sample note still contains placeholder ${placeholder}`,
      status: 'placeholder',
    });
  }

  return createFieldAudit(requirement, {
    message: 'sample note placeholder is filled or absent',
    status: 'complete',
  });
}

function parseArrayField(field: string) {
  const match = field.match(/^([a-zA-Z0-9_]+)\[\]\.([a-zA-Z0-9_]+)$/u);

  if (!match) {
    return null;
  }

  return {
    arrayName: match[1],
    key: match[2],
  };
}

function auditJsonArrayField(
  requirement: AgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessRequirement,
  readResult: ReadJsonResult,
  fileLabel: string,
) {
  if (readResult.status === 'missing') {
    return createFieldAudit(requirement, {
      message: `${fileLabel} is missing`,
      status: 'missing',
    });
  }
  if (readResult.status === 'invalid-json' || readResult.status === 'unreadable') {
    return createFieldAudit(requirement, {
      message: readResult.errorMessage ?? `${fileLabel} is unreadable`,
      status: 'unreadable',
    });
  }

  const parsedField = parseArrayField(requirement.field);
  if (!parsedField || !isRecord(readResult.value)) {
    return createFieldAudit(requirement, {
      message: `${fileLabel} cannot be checked for ${requirement.field}`,
      status: 'unreadable',
    });
  }

  const value = readResult.value[parsedField.arrayName];
  if (!Array.isArray(value) || value.length === 0) {
    return createFieldAudit(requirement, {
      message: `${parsedField.arrayName} is missing or empty`,
      status: 'missing',
    });
  }

  const records = value.filter(isRecord);
  if (records.length !== value.length) {
    return createFieldAudit(requirement, {
      message: `${parsedField.arrayName} contains non-object entries`,
      status: 'unreadable',
    });
  }
  if (records.some((entry) => typeof entry[parsedField.key] !== 'string' || String(entry[parsedField.key]).trim() === '')) {
    return createFieldAudit(requirement, {
      message: `${requirement.field} has missing values`,
      status: 'missing',
    });
  }
  if (records.some((entry) => containsPlaceholder(entry[parsedField.key]))) {
    return createFieldAudit(requirement, {
      message: `${requirement.field} still contains placeholder values`,
      status: 'placeholder',
    });
  }

  return createFieldAudit(requirement, {
    message: `${requirement.field} is filled`,
    status: 'complete',
  });
}

function createEntryStatus(options: {
  openFieldCount: number;
  unreadableFieldCount: number;
}): AgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAuditEntry['status'] {
  if (options.unreadableFieldCount > 0) {
    return 'unreadable';
  }

  return options.openFieldCount > 0 ? 'open-fields' : 'complete';
}

function countFields(
  fieldAudits: readonly AgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessFieldAudit[],
  status: AgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessFieldStatus,
) {
  return fieldAudits.filter((field) => field.status === status).length;
}

async function createIntakeEntry(options: {
  intakeDir: string;
  placeholderByField: Map<string, string>;
  requirements: readonly AgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessRequirement[];
}) {
  const intakeDir = path.resolve(options.intakeDir);
  const notePath = path.join(intakeDir, 'sample-note-template.md');
  const manifestPath = path.join(intakeDir, 'real-corpus-manifest.json');
  const indexPath = path.join(intakeDir, 'corpus-batch-index.json');
  const [noteRead, manifestRead, indexRead] = await Promise.all([
    readTextFile(notePath),
    readJsonFile(manifestPath),
    readJsonFile(indexPath),
  ]);
  const fieldAudits = options.requirements.map((requirement) => {
    if (requirement.scope === 'sample-note') {
      return auditSampleNoteField(requirement, noteRead, options.placeholderByField);
    }
    if (requirement.scope === 'manifest') {
      return auditJsonArrayField(requirement, manifestRead, 'real-corpus-manifest.json');
    }

    return auditJsonArrayField(requirement, indexRead, 'corpus-batch-index.json');
  });
  const completeFieldCount = countFields(fieldAudits, 'complete');
  const missingFieldCount = countFields(fieldAudits, 'missing');
  const placeholderFieldCount = countFields(fieldAudits, 'placeholder');
  const unreadableFieldCount = countFields(fieldAudits, 'unreadable');
  const openFieldCount = missingFieldCount + placeholderFieldCount + unreadableFieldCount;

  return {
    completeFieldCount,
    fieldAudits,
    intakeDir,
    missingFieldCount,
    openFieldCount,
    placeholderFieldCount,
    requiredFieldCount: fieldAudits.length,
    status: createEntryStatus({
      openFieldCount,
      unreadableFieldCount,
    }),
    unreadableFieldCount,
  } satisfies AgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAuditEntry;
}

function createStatus(options: {
  intakeCount: number;
  openFieldCount: number;
  unreadableFieldCount: number;
}): AgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAuditStatus {
  if (options.intakeCount === 0) {
    return 'no-intake-dirs';
  }
  if (options.unreadableFieldCount > 0) {
    return 'unreadable';
  }

  return options.openFieldCount > 0 ? 'open-fields' : 'complete';
}

function sumEntryCounts(
  entries: readonly AgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAuditEntry[],
  key: keyof Pick<
    AgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAuditEntry,
    | 'completeFieldCount'
    | 'missingFieldCount'
    | 'openFieldCount'
    | 'placeholderFieldCount'
    | 'unreadableFieldCount'
  >,
) {
  return entries.reduce((sum, entry) => sum + entry[key], 0);
}

function createIntakeStatusCounts(
  entries: readonly AgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAuditEntry[],
) {
  const counts = {
    complete: 0,
    'open-fields': 0,
    unreadable: 0,
  } satisfies Record<
    Exclude<AgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAuditStatus, 'no-intake-dirs'>,
    number
  >;

  for (const entry of entries) {
    counts[entry.status] += 1;
  }

  return counts;
}

function createEmptyFieldStatusCounts() {
  return {
    complete: 0,
    missing: 0,
    placeholder: 0,
    unreadable: 0,
  } satisfies Record<AgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessFieldStatus, number>;
}

function createFieldStatusCountsByScope(
  entries: readonly AgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAuditEntry[],
) {
  const counts = {
    index: createEmptyFieldStatusCounts(),
    manifest: createEmptyFieldStatusCounts(),
    'sample-note': createEmptyFieldStatusCounts(),
  } satisfies Record<
    AgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessFieldScope,
    Record<AgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessFieldStatus, number>
  >;

  for (const entry of entries) {
    for (const field of entry.fieldAudits) {
      counts[field.scope][field.status] += 1;
    }
  }

  return counts;
}

function createSummaryText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAuditResult,
    | 'completeFieldCount'
    | 'intakeStatusCounts'
    | 'intakeCount'
    | 'missingFieldCount'
    | 'openFieldCount'
    | 'placeholderFieldCount'
    | 'readyForProductionRuntime'
    | 'requiredFieldCount'
    | 'status'
    | 'unreadableFieldCount'
  >,
) {
  return [
    `AgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAudit status=${result.status}`,
    `intakes=${result.intakeCount}`,
    `completeIntakes=${result.intakeStatusCounts.complete}`,
    `openFieldIntakes=${result.intakeStatusCounts['open-fields']}`,
    `unreadableIntakes=${result.intakeStatusCounts.unreadable}`,
    `requiredFields=${result.requiredFieldCount}`,
    `completeFields=${result.completeFieldCount}`,
    `openFields=${result.openFieldCount}`,
    `missingFields=${result.missingFieldCount}`,
    `placeholderFields=${result.placeholderFieldCount}`,
    `unreadableFields=${result.unreadableFieldCount}`,
    `readyForProductionRuntime=${result.readyForProductionRuntime ? 'yes' : 'no'}`,
  ].join(' ');
}

function createReportText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAuditResult,
    | 'fieldRequirements'
    | 'fieldStatusCountsByScope'
    | 'fillingSupportSummaryText'
    | 'guardrail'
    | 'intakeEntries'
    | 'intakeStatusCounts'
    | 'summaryText'
  >,
) {
  return [
    result.summaryText,
    `fillingSupportSummary=${result.fillingSupportSummaryText}`,
    'intakeStatusCounts:',
    ...Object.entries(result.intakeStatusCounts).map(([status, count]) => `- status=${status} intakes=${count}`),
    'fieldStatusCountsByScope:',
    ...Object.entries(result.fieldStatusCountsByScope).flatMap(([scope, counts]) => (
      Object.entries(counts).map(([status, count]) => `- scope=${scope} status=${status} fields=${count}`)
    )),
    result.fieldRequirements.length ? 'fieldRequirements:' : 'fieldRequirements: none',
    ...result.fieldRequirements.map((requirement) => [
      `- scope=${requirement.scope}`,
      `field=${requirement.field}`,
      `priorities=${requirement.priorities.join(',')}`,
      `gapKinds=${requirement.gapKinds.join(',')}`,
    ].join(' ')),
    result.intakeEntries.length ? 'intakeFieldCompleteness:' : 'intakeFieldCompleteness: none',
    ...result.intakeEntries.flatMap((entry) => [
      [
        `- intakeDir=${entry.intakeDir}`,
        `status=${entry.status}`,
        `required=${entry.requiredFieldCount}`,
        `complete=${entry.completeFieldCount}`,
        `open=${entry.openFieldCount}`,
        `missing=${entry.missingFieldCount}`,
        `placeholder=${entry.placeholderFieldCount}`,
        `unreadable=${entry.unreadableFieldCount}`,
      ].join(' '),
      ...entry.fieldAudits
        .filter((field) => field.status !== 'complete')
        .map((field) => [
          `  - scope=${field.scope}`,
          `field=${field.field}`,
          `status=${field.status}`,
          `priorities=${field.priorities.join(',')}`,
          `gapKinds=${field.gapKinds.join(',')}`,
          `message=${field.message}`,
        ].join(' ')),
    ]),
    `guardrail=${result.guardrail}`,
  ].join('\n');
}

function createJsonText(
  result: AgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAuditResult,
  options: { prettyJson?: boolean } = {},
) {
  return JSON.stringify(result, null, options.prettyJson ? 2 : 0);
}

export async function runAgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAudit(
  options: RunAgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAuditOptions = {},
): Promise<AgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAuditResult> {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const fillingSupport = createAgentSessionV3PilotRealCorpusBatchIntakeFillingSupportReport({
    projectRoot,
  });
  const fieldRequirements = createFieldRequirements(fillingSupport.fillingItems);
  const placeholderByField = new Map(
    fillingSupport.fillingItems.flatMap((item) => (
      item.sampleNoteFields.map((field) => [field.id, field.placeholder] as const)
    )),
  );
  const intakeEntries = await Promise.all((options.intakeDirs ?? []).map((intakeDir) => createIntakeEntry({
    intakeDir,
    placeholderByField,
    requirements: fieldRequirements,
  })));
  const completeFieldCount = sumEntryCounts(intakeEntries, 'completeFieldCount');
  const missingFieldCount = sumEntryCounts(intakeEntries, 'missingFieldCount');
  const placeholderFieldCount = sumEntryCounts(intakeEntries, 'placeholderFieldCount');
  const unreadableFieldCount = sumEntryCounts(intakeEntries, 'unreadableFieldCount');
  const openFieldCount = sumEntryCounts(intakeEntries, 'openFieldCount');
  const intakeStatusCounts = createIntakeStatusCounts(intakeEntries);
  const fieldStatusCountsByScope = createFieldStatusCountsByScope(intakeEntries);
  const resultWithoutText: AgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAuditResult = {
    completeFieldCount,
    fieldStatusCountsByScope,
    fieldRequirements,
    fillingSupportSummaryText: fillingSupport.summaryText,
    guardrail: 'caller-owned intake field completeness audit only; reads only explicitly supplied --dir intake directories; does not discover directories, create intake directories, collect samples, auto-fill files, write manifests, run smoke tests, create task queues, create handoff bundles, choose thresholds, route permissions, execute tools, decide recovery, define workflows, change readiness, define runtime action order, or grant runtime authority.',
    intakeCount: intakeEntries.length,
    intakeEntries,
    intakeStatusCounts,
    jsonText: null,
    kind: 'agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit',
    missingFieldCount,
    openFieldCount,
    placeholderFieldCount,
    readyForProductionRuntime: false,
    requiredFieldCount: fieldRequirements.length,
    reportText: '',
    status: createStatus({
      intakeCount: intakeEntries.length,
      openFieldCount,
      unreadableFieldCount,
    }),
    summaryText: '',
    unreadableFieldCount,
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

async function runAgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAuditCli() {
  const options = parseArgs(process.argv.slice(2));
  const result = await runAgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAudit(options);
  console.log(result.reportText);
  if (result.jsonText) {
    console.log(result.jsonText);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAuditCli().catch((error: unknown) => {
    const errorText = error instanceof Error ? error.message : String(error);
    console.error(errorText);
    process.exitCode = 1;
  });
}
