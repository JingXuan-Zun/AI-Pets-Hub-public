import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  createAgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageObservation,
  formatAgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageObservation,
  type AgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageObservation,
} from './agent-session-v3-pilot-real-corpus-batch-handoff-phase-coverage-observation.ts';

export type AgentSessionV3PilotRealCorpusBatchHandoffArtifactIntegrityStatus =
  | 'blocked'
  | 'valid';

export type AgentSessionV3PilotRealCorpusBatchHandoffArtifactIntegrityIssueCode =
  | 'checklist-artifact-shape'
  | 'invalid-generated-by'
  | 'invalid-handoff-index-json'
  | 'invalid-handoff-index-shape'
  | 'invalid-json'
  | 'invalid-version'
  | 'missing-artifact'
  | 'missing-handoff-index'
  | 'missing-index-path-field'
  | 'review-order-mismatch'
  | 'status-mismatch'
  | 'unexpected-kind';

export type AgentSessionV3PilotRealCorpusBatchHandoffArtifactRole =
  | 'handoff-index'
  | 'handoff-manifest'
  | 'operator-checklist-json'
  | 'operator-checklist-report'
  | 'readiness-rollup-json'
  | 'readiness-rollup-report'
  | 'readme'
  | 'review-summary-json'
  | 'review-summary-report';

export interface AgentSessionV3PilotRealCorpusBatchHandoffArtifactObservation {
  expectedKind: string | null;
  expectedStatus: string | null;
  jsonKind: string | null;
  jsonStatus: string | null;
  label: string;
  optionalEvidenceReportCount: number | null;
  optionalEvidenceReportPaths: string[] | null;
  phaseCoverage: AgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageObservation | null;
  path: string;
  present: boolean;
  role: AgentSessionV3PilotRealCorpusBatchHandoffArtifactRole;
}

export interface AgentSessionV3PilotRealCorpusBatchHandoffArtifactIntegrityIssue {
  code: AgentSessionV3PilotRealCorpusBatchHandoffArtifactIntegrityIssueCode;
  detail: string;
  path: string;
  role: AgentSessionV3PilotRealCorpusBatchHandoffArtifactRole;
  severity: 'blocker';
}

export interface RunAgentSessionV3PilotRealCorpusBatchHandoffArtifactIntegrityReportOptions {
  bundleDir: string;
  includeJsonText?: boolean;
  prettyJson?: boolean;
}

export interface AgentSessionV3PilotRealCorpusBatchHandoffArtifactIntegrityReportResult {
  artifactCount: number;
  blockerCount: number;
  bundleDir: string;
  handoffIndexPath: string;
  issueCount: number;
  issues: AgentSessionV3PilotRealCorpusBatchHandoffArtifactIntegrityIssue[];
  jsonText: string | null;
  kind: 'agent-session-v3-pilot-real-corpus-batch-handoff-artifact-integrity-report';
  missingArtifactCount: number;
  observations: AgentSessionV3PilotRealCorpusBatchHandoffArtifactObservation[];
  presentArtifactCount: number;
  reportText: string;
  status: AgentSessionV3PilotRealCorpusBatchHandoffArtifactIntegrityStatus;
  summaryText: string;
  version: 1;
}

interface ReadTextResult {
  errorMessage: string | null;
  present: boolean;
  text: string | null;
}

interface ReadJsonResult {
  errorMessage: string | null;
  present: boolean;
  value: Record<string, unknown> | null;
}

interface ExpectedArtifact {
  expectedKind: string | null;
  expectedStatus: string | null;
  label: string;
  path: string;
  role: AgentSessionV3PilotRealCorpusBatchHandoffArtifactRole;
}

const EXPECTED_REVIEW_ORDER = [
  'review-summary-report',
  'readiness-rollup-report',
  'operator-checklist-drill-down',
];

function parseAgentSessionV3PilotRealCorpusBatchHandoffArtifactIntegrityReportArgs(
  args: readonly string[],
): RunAgentSessionV3PilotRealCorpusBatchHandoffArtifactIntegrityReportOptions {
  let bundleDir: string | null = null;
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
        throw new Error('Missing handoff bundle directory after --dir.');
      }
      bundleDir = nextArg;
      index += 1;
    } else if (!bundleDir) {
      bundleDir = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  if (!bundleDir) {
    throw new Error('Usage: npx tsx scripts/agent-session-v3-pilot-real-corpus-batch-handoff-artifact-integrity-report.ts --dir handoff-bundle-dir [--json] [--pretty]');
  }

  return {
    bundleDir,
    includeJsonText,
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
      present: true,
      text: await readFile(filePath, 'utf8'),
    };
  } catch (error: unknown) {
    if (getErrorCode(error) === 'ENOENT') {
      return {
        errorMessage: null,
        present: false,
        text: null,
      };
    }

    throw error;
  }
}

async function readJsonFile(filePath: string): Promise<ReadJsonResult> {
  const textRead = await readTextFile(filePath);

  if (!textRead.present || textRead.text === null) {
    return {
      errorMessage: null,
      present: false,
      value: null,
    };
  }

  try {
    const parsed = JSON.parse(textRead.text) as unknown;

    return {
      errorMessage: null,
      present: true,
      value: parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : null,
    };
  } catch (error: unknown) {
    return {
      errorMessage: getErrorMessage(error),
      present: true,
      value: null,
    };
  }
}

function stringValue(record: Record<string, unknown>, key: string) {
  return typeof record[key] === 'string' ? record[key] : null;
}

function optionalEvidenceReportPaths(value: Record<string, unknown> | null) {
  if (!value || !Array.isArray(value.optionalEvidenceReports)) {
    return [];
  }

  return value.optionalEvidenceReports
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry))
    .map((entry) => entry.path)
    .filter((entry): entry is string => typeof entry === 'string');
}

function phaseCoverageObservation(
  role: AgentSessionV3PilotRealCorpusBatchHandoffArtifactRole,
  value: Record<string, unknown> | null,
) {
  if (
    role !== 'operator-checklist-json'
    && role !== 'readiness-rollup-json'
    && role !== 'review-summary-json'
  ) {
    return null;
  }

  return createAgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageObservation({
    source: role,
    value,
  });
}

function resolveArtifactPath(bundleDir: string, value: string) {
  return path.resolve(bundleDir, value);
}

function createIssue(options: {
  code: AgentSessionV3PilotRealCorpusBatchHandoffArtifactIntegrityIssueCode;
  detail: string;
  path: string;
  role: AgentSessionV3PilotRealCorpusBatchHandoffArtifactRole;
}): AgentSessionV3PilotRealCorpusBatchHandoffArtifactIntegrityIssue {
  return {
    code: options.code,
    detail: options.detail,
    path: options.path,
    role: options.role,
    severity: 'blocker',
  };
}

function addPathArtifact(options: {
  artifacts: ExpectedArtifact[];
  bundleDir: string;
  expectedKind: string | null;
  expectedStatus: string | null;
  index: Record<string, unknown>;
  issues: AgentSessionV3PilotRealCorpusBatchHandoffArtifactIntegrityIssue[];
  label: string;
  pathField: string;
  role: AgentSessionV3PilotRealCorpusBatchHandoffArtifactRole;
}) {
  const rawPath = stringValue(options.index, options.pathField);

  if (!rawPath) {
    options.issues.push(createIssue({
      code: 'missing-index-path-field',
      detail: `handoff-index.json is missing string field ${options.pathField}.`,
      path: path.join(options.bundleDir, 'handoff-index.json'),
      role: 'handoff-index',
    }));
    return;
  }

  options.artifacts.push({
    expectedKind: options.expectedKind,
    expectedStatus: options.expectedStatus,
    label: options.label,
    path: resolveArtifactPath(options.bundleDir, rawPath),
    role: options.role,
  });
}

function collectExpectedArtifacts(options: {
  bundleDir: string;
  index: Record<string, unknown>;
  issues: AgentSessionV3PilotRealCorpusBatchHandoffArtifactIntegrityIssue[];
}) {
  const artifacts: ExpectedArtifact[] = [];
  const indexStatus = stringValue(options.index, 'status');

  addPathArtifact({
    artifacts,
    bundleDir: options.bundleDir,
    expectedKind: null,
    expectedStatus: null,
    index: options.index,
    issues: options.issues,
    label: 'README.md',
    pathField: 'readmePath',
    role: 'readme',
  });
  addPathArtifact({
    artifacts,
    bundleDir: options.bundleDir,
    expectedKind: null,
    expectedStatus: null,
    index: options.index,
    issues: options.issues,
    label: 'handoff-manifest.txt',
    pathField: 'handoffManifestPath',
    role: 'handoff-manifest',
  });
  addPathArtifact({
    artifacts,
    bundleDir: options.bundleDir,
    expectedKind: null,
    expectedStatus: null,
    index: options.index,
    issues: options.issues,
    label: 'review-summary-report.txt',
    pathField: 'reviewSummaryReportPath',
    role: 'review-summary-report',
  });
  addPathArtifact({
    artifacts,
    bundleDir: options.bundleDir,
    expectedKind: 'agent-session-v3-pilot-real-corpus-batch-review-summary',
    expectedStatus: indexStatus,
    index: options.index,
    issues: options.issues,
    label: 'review-summary-report.json',
    pathField: 'reviewSummaryJsonPath',
    role: 'review-summary-json',
  });
  addPathArtifact({
    artifacts,
    bundleDir: options.bundleDir,
    expectedKind: null,
    expectedStatus: null,
    index: options.index,
    issues: options.issues,
    label: 'readiness-rollup-report.txt',
    pathField: 'rollupReportPath',
    role: 'readiness-rollup-report',
  });
  addPathArtifact({
    artifacts,
    bundleDir: options.bundleDir,
    expectedKind: 'agent-session-v3-pilot-real-corpus-batch-readiness-rollup-report',
    expectedStatus: indexStatus,
    index: options.index,
    issues: options.issues,
    label: 'readiness-rollup-report.json',
    pathField: 'rollupJsonPath',
    role: 'readiness-rollup-json',
  });

  const checklistArtifacts = Array.isArray(options.index.checklistArtifacts)
    ? options.index.checklistArtifacts
    : [];

  if (!Array.isArray(options.index.checklistArtifacts)) {
    options.issues.push(createIssue({
      code: 'checklist-artifact-shape',
      detail: 'handoff-index.json checklistArtifacts should be an array.',
      path: path.join(options.bundleDir, 'handoff-index.json'),
      role: 'handoff-index',
    }));
  }

  checklistArtifacts.forEach((artifact, index) => {
    if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) {
      options.issues.push(createIssue({
        code: 'checklist-artifact-shape',
        detail: `checklistArtifacts[${index}] should be an object.`,
        path: path.join(options.bundleDir, 'handoff-index.json'),
        role: 'handoff-index',
      }));
      return;
    }

    const artifactRecord = artifact as Record<string, unknown>;
    const artifactStatus = stringValue(artifactRecord, 'status');
    const jsonPath = stringValue(artifactRecord, 'jsonPath');
    const reportPath = stringValue(artifactRecord, 'reportPath');

    if (!jsonPath || !reportPath || !artifactStatus) {
      options.issues.push(createIssue({
        code: 'checklist-artifact-shape',
        detail: `checklistArtifacts[${index}] should include string jsonPath, reportPath, and status fields.`,
        path: path.join(options.bundleDir, 'handoff-index.json'),
        role: 'handoff-index',
      }));
      return;
    }

    artifacts.push({
      expectedKind: null,
      expectedStatus: null,
      label: `intake-${String(index + 1).padStart(2, '0')}-operator-checklist.txt`,
      path: resolveArtifactPath(options.bundleDir, reportPath),
      role: 'operator-checklist-report',
    });
    artifacts.push({
      expectedKind: 'agent-session-v3-pilot-real-corpus-batch-operator-checklist-report',
      expectedStatus: artifactStatus,
      label: `intake-${String(index + 1).padStart(2, '0')}-operator-checklist.json`,
      path: resolveArtifactPath(options.bundleDir, jsonPath),
      role: 'operator-checklist-json',
    });
  });

  return artifacts;
}

async function inspectArtifact(
  artifact: ExpectedArtifact,
): Promise<{
  issues: AgentSessionV3PilotRealCorpusBatchHandoffArtifactIntegrityIssue[];
  observation: AgentSessionV3PilotRealCorpusBatchHandoffArtifactObservation;
}> {
  const issues: AgentSessionV3PilotRealCorpusBatchHandoffArtifactIntegrityIssue[] = [];

  if (!artifact.expectedKind) {
    const textRead = await readTextFile(artifact.path);
    if (!textRead.present) {
      issues.push(createIssue({
        code: 'missing-artifact',
        detail: `${artifact.label} is missing.`,
        path: artifact.path,
        role: artifact.role,
      }));
    }

    return {
      issues,
      observation: {
        expectedKind: null,
        expectedStatus: null,
        jsonKind: null,
        jsonStatus: null,
        label: artifact.label,
        optionalEvidenceReportCount: null,
        optionalEvidenceReportPaths: null,
        phaseCoverage: null,
        path: artifact.path,
        present: textRead.present,
        role: artifact.role,
      },
    };
  }

  const jsonRead = await readJsonFile(artifact.path);
  const jsonKind = stringValue(jsonRead.value ?? {}, 'kind');
  const jsonStatus = stringValue(jsonRead.value ?? {}, 'status');

  if (!jsonRead.present) {
    issues.push(createIssue({
      code: 'missing-artifact',
      detail: `${artifact.label} is missing.`,
      path: artifact.path,
      role: artifact.role,
    }));
  } else if (!jsonRead.value) {
    issues.push(createIssue({
      code: 'invalid-json',
      detail: jsonRead.errorMessage ?? `${artifact.label} is not a JSON object.`,
      path: artifact.path,
      role: artifact.role,
    }));
  } else {
    if (jsonKind !== artifact.expectedKind) {
      issues.push(createIssue({
        code: 'unexpected-kind',
        detail: `${artifact.label} kind should be ${artifact.expectedKind}, got ${jsonKind ?? 'missing'}.`,
        path: artifact.path,
        role: artifact.role,
      }));
    }
    if (artifact.expectedStatus && jsonStatus !== artifact.expectedStatus) {
      issues.push(createIssue({
        code: 'status-mismatch',
        detail: `${artifact.label} status should be ${artifact.expectedStatus}, got ${jsonStatus ?? 'missing'}.`,
        path: artifact.path,
        role: artifact.role,
      }));
    }
  }

  const optionalReportPaths = artifact.role === 'review-summary-json' && jsonRead.value
    ? optionalEvidenceReportPaths(jsonRead.value)
    : null;
  const phaseCoverage = phaseCoverageObservation(artifact.role, jsonRead.value);

  return {
    issues,
    observation: {
      expectedKind: artifact.expectedKind,
      expectedStatus: artifact.expectedStatus,
      jsonKind,
      jsonStatus,
      label: artifact.label,
      optionalEvidenceReportCount: optionalReportPaths ? optionalReportPaths.length : null,
      optionalEvidenceReportPaths: optionalReportPaths,
      phaseCoverage,
      path: artifact.path,
      present: jsonRead.present,
      role: artifact.role,
    },
  };
}

function collectIndexShapeIssues(options: {
  bundleDir: string;
  index: Record<string, unknown>;
}) {
  const issues: AgentSessionV3PilotRealCorpusBatchHandoffArtifactIntegrityIssue[] = [];
  const handoffIndexPath = path.join(options.bundleDir, 'handoff-index.json');

  if (options.index.generatedBy !== 'agent-session-v3-pilot-real-corpus-batch-handoff-bundle') {
    issues.push(createIssue({
      code: 'invalid-generated-by',
      detail: `handoff-index.json generatedBy should be agent-session-v3-pilot-real-corpus-batch-handoff-bundle, got ${String(options.index.generatedBy)}.`,
      path: handoffIndexPath,
      role: 'handoff-index',
    }));
  }

  if (options.index.version !== 1) {
    issues.push(createIssue({
      code: 'invalid-version',
      detail: `handoff-index.json version should be 1, got ${String(options.index.version)}.`,
      path: handoffIndexPath,
      role: 'handoff-index',
    }));
  }

  if (
    !Array.isArray(options.index.reviewOrder)
    || options.index.reviewOrder.length !== EXPECTED_REVIEW_ORDER.length
    || options.index.reviewOrder.some((entry, index) => entry !== EXPECTED_REVIEW_ORDER[index])
  ) {
    issues.push(createIssue({
      code: 'review-order-mismatch',
      detail: `handoff-index.json reviewOrder should be ${EXPECTED_REVIEW_ORDER.join(',')}.`,
      path: handoffIndexPath,
      role: 'handoff-index',
    }));
  }

  return issues;
}

function createSummaryText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchHandoffArtifactIntegrityReportResult,
    'artifactCount' | 'blockerCount' | 'issueCount' | 'missingArtifactCount' | 'presentArtifactCount' | 'status'
  >,
) {
  return [
    `AgentSessionV3PilotRealCorpusBatchHandoffArtifactIntegrityReport status=${result.status}`,
    `artifacts=${result.artifactCount}`,
    `present=${result.presentArtifactCount}`,
    `missing=${result.missingArtifactCount}`,
    `issues=${result.issueCount}`,
    `blockers=${result.blockerCount}`,
  ].join(' ');
}

function createReportText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchHandoffArtifactIntegrityReportResult,
    'bundleDir' | 'issues' | 'observations' | 'summaryText'
  >,
) {
  return [
    result.summaryText,
    `bundleDir: ${result.bundleDir}`,
    'handoffArtifacts:',
    ...result.observations.map((observation) => [
      `- role=${observation.role}`,
      `label=${observation.label}`,
      `present=${observation.present ? 'yes' : 'no'}`,
      `expectedKind=${observation.expectedKind ?? 'none'}`,
      `jsonKind=${observation.jsonKind ?? 'none'}`,
      `expectedStatus=${observation.expectedStatus ?? 'none'}`,
      `jsonStatus=${observation.jsonStatus ?? 'none'}`,
      `optionalEvidenceReports=${observation.optionalEvidenceReportCount ?? 'n/a'}`,
      `optionalEvidenceReportPaths=${observation.optionalEvidenceReportPaths?.length ? observation.optionalEvidenceReportPaths.join(',') : 'none'}`,
      `phaseCoverageEntries=${observation.phaseCoverage?.entryCount ?? 'n/a'}`,
      `phaseCoverageStatuses=${formatAgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageObservation(observation.phaseCoverage)}`,
      `path=${observation.path}`,
    ].join(' ')),
    result.issues.length ? 'handoffArtifactIntegrityIssues:' : 'handoffArtifactIntegrityIssues: none',
    ...result.issues.map((issue) => [
      `- severity=${issue.severity}`,
      `role=${issue.role}`,
      `code=${issue.code}`,
      `path=${issue.path}`,
      `detail=${issue.detail}`,
    ].join(' ')),
    'guardrail=caller-owned handoff artifact integrity report only; no sample collection, threshold decision, readiness change, runtime authority, tool selection, permission routing, execution, or recovery.',
  ].join('\n');
}

function createJsonText(
  result: AgentSessionV3PilotRealCorpusBatchHandoffArtifactIntegrityReportResult,
  options: { prettyJson?: boolean } = {},
) {
  return JSON.stringify(result, null, options.prettyJson ? 2 : 0);
}

export async function runAgentSessionV3PilotRealCorpusBatchHandoffArtifactIntegrityReport(
  options: RunAgentSessionV3PilotRealCorpusBatchHandoffArtifactIntegrityReportOptions,
): Promise<AgentSessionV3PilotRealCorpusBatchHandoffArtifactIntegrityReportResult> {
  const bundleDir = path.resolve(options.bundleDir);
  const handoffIndexPath = path.join(bundleDir, 'handoff-index.json');
  const indexRead = await readJsonFile(handoffIndexPath);
  let issues: AgentSessionV3PilotRealCorpusBatchHandoffArtifactIntegrityIssue[] = [];
  let observations: AgentSessionV3PilotRealCorpusBatchHandoffArtifactObservation[] = [{
    expectedKind: null,
    expectedStatus: null,
    jsonKind: null,
    jsonStatus: null,
    label: 'handoff-index.json',
    optionalEvidenceReportCount: null,
    optionalEvidenceReportPaths: null,
    phaseCoverage: null,
    path: handoffIndexPath,
    present: indexRead.present,
    role: 'handoff-index',
  }];

  if (!indexRead.present) {
    issues = [createIssue({
      code: 'missing-handoff-index',
      detail: 'handoff-index.json is missing from the handoff bundle.',
      path: handoffIndexPath,
      role: 'handoff-index',
    })];
  } else if (!indexRead.value) {
    issues = [createIssue({
      code: 'invalid-handoff-index-json',
      detail: indexRead.errorMessage ?? 'handoff-index.json is not a JSON object.',
      path: handoffIndexPath,
      role: 'handoff-index',
    })];
  } else {
    const expectedArtifacts = collectExpectedArtifacts({
      bundleDir,
      index: indexRead.value,
      issues,
    });
    const inspectedArtifacts = await Promise.all(expectedArtifacts.map(inspectArtifact));

    issues = [
      ...issues,
      ...collectIndexShapeIssues({
        bundleDir,
        index: indexRead.value,
      }),
      ...inspectedArtifacts.flatMap((artifact) => artifact.issues),
    ];
    observations = [
      ...observations,
      ...inspectedArtifacts.map((artifact) => artifact.observation),
    ];
  }

  const missingArtifactCount = observations.filter((observation) => !observation.present).length;
  const presentArtifactCount = observations.filter((observation) => observation.present).length;
  const resultWithoutText: AgentSessionV3PilotRealCorpusBatchHandoffArtifactIntegrityReportResult = {
    artifactCount: observations.length,
    blockerCount: issues.length,
    bundleDir,
    handoffIndexPath,
    issueCount: issues.length,
    issues,
    jsonText: null,
    kind: 'agent-session-v3-pilot-real-corpus-batch-handoff-artifact-integrity-report',
    missingArtifactCount,
    observations,
    presentArtifactCount,
    reportText: '',
    status: issues.length > 0 ? 'blocked' : 'valid',
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

async function runAgentSessionV3PilotRealCorpusBatchHandoffArtifactIntegrityReportCli() {
  const options = parseAgentSessionV3PilotRealCorpusBatchHandoffArtifactIntegrityReportArgs(process.argv.slice(2));
  const result = await runAgentSessionV3PilotRealCorpusBatchHandoffArtifactIntegrityReport(options);
  console.log(result.reportText);
  if (result.jsonText) {
    console.log(result.jsonText);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAgentSessionV3PilotRealCorpusBatchHandoffArtifactIntegrityReportCli().catch((error: unknown) => {
    const errorText = error instanceof Error ? error.message : String(error);
    console.error(errorText);
    process.exitCode = 1;
  });
}
