import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type {
  AgentSessionV3PilotRealCorpusBatchHandoffBundleSampleSource,
  AgentSessionV3PilotRealCorpusBatchHandoffBundleSampleSourceStatus,
} from './agent-session-v3-pilot-real-corpus-batch-handoff-bundle.ts';
import {
  runAgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyReport,
  type AgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyReportResult,
} from './agent-session-v3-pilot-real-corpus-batch-handoff-sample-source-consistency-report.ts';

export type AgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflightStatus =
  | 'blocked'
  | 'consistent'
  | 'review-needed';

export type AgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflightIssueSeverity =
  | 'blocker'
  | 'review';

export type AgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflightIssueCode =
  | 'derived-status-mismatch'
  | 'expected-source-mismatch'
  | 'handoff-source-mismatch'
  | 'handoff-status-blocked'
  | 'handoff-status-mismatch'
  | 'handoff-status-review-needed'
  | 'invalid-sample-source'
  | 'invalid-sample-source-status'
  | 'missing-sample-note'
  | 'missing-sample-source'
  | 'missing-sample-source-status'
  | 'unknown-sample-source';

export interface AgentSessionV3PilotRealCorpusBatchSourceDeclarationObservation {
  label: 'sample-note' | 'handoff-bundle';
  path: string;
  present: boolean;
  sampleSource: string | null;
  sampleSourceStatus: string | null;
}

export interface AgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflightIssue {
  code: AgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflightIssueCode;
  detail: string;
  path: string;
  severity: AgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflightIssueSeverity;
  source: AgentSessionV3PilotRealCorpusBatchSourceDeclarationObservation['label'];
}

export interface RunAgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflightOptions {
  expectedSampleSource?: AgentSessionV3PilotRealCorpusBatchHandoffBundleSampleSource;
  handoffBundleDir?: string;
  includeJsonText?: boolean;
  intakeDir: string;
  prettyJson?: boolean;
}

export interface AgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflightResult {
  blockerCount: number;
  expectedSampleSource: AgentSessionV3PilotRealCorpusBatchHandoffBundleSampleSource | null;
  handoffBundleDir: string | null;
  handoffConsistencyReport: AgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyReportResult | null;
  intakeDir: string;
  issueCount: number;
  issues: AgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflightIssue[];
  jsonText: string | null;
  kind: 'agent-session-v3-pilot-real-corpus-batch-source-declaration-preflight';
  observations: AgentSessionV3PilotRealCorpusBatchSourceDeclarationObservation[];
  readyForProductionRuntime: false;
  reportText: string;
  reviewCount: number;
  sampleNotePath: string;
  sampleSource: string | null;
  sampleSourceStatus: string | null;
  status: AgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflightStatus;
  summaryText: string;
  version: 1;
}

interface ReadTextResult {
  present: boolean;
  text: string | null;
}

function parseArgs(
  args: readonly string[],
): RunAgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflightOptions {
  let expectedSampleSource: AgentSessionV3PilotRealCorpusBatchHandoffBundleSampleSource | undefined;
  let handoffBundleDir: string | undefined;
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
    } else if (arg === '--handoff-dir') {
      const nextArg = args[index + 1];
      if (!nextArg) {
        throw new Error('Missing handoff bundle directory after --handoff-dir.');
      }
      handoffBundleDir = nextArg;
      index += 1;
    } else if (arg === '--expected-source') {
      const nextArg = args[index + 1];
      if (!nextArg) {
        throw new Error('Missing sample source after --expected-source.');
      }
      expectedSampleSource = parseSampleSource(nextArg);
      index += 1;
    } else if (!intakeDir) {
      intakeDir = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  if (!intakeDir) {
    throw new Error('Usage: npx tsx scripts/agent-session-v3-pilot-real-corpus-batch-source-declaration-preflight.ts --dir intake-dir [--handoff-dir handoff-bundle-dir] [--expected-source real-exported|rehearsal|unknown] [--json] [--pretty]');
  }

  return {
    expectedSampleSource,
    handoffBundleDir,
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

async function readTextFile(filePath: string): Promise<ReadTextResult> {
  try {
    return {
      present: true,
      text: await readFile(filePath, 'utf8'),
    };
  } catch (error: unknown) {
    if (getErrorCode(error) === 'ENOENT') {
      return {
        present: false,
        text: null,
      };
    }

    throw error;
  }
}

function extractLineValue(text: string | null, pattern: RegExp) {
  if (!text) {
    return null;
  }

  return pattern.exec(text)?.[1]?.trim() ?? null;
}

function parseSampleSource(value: string): AgentSessionV3PilotRealCorpusBatchHandoffBundleSampleSource {
  if (isSampleSource(value)) {
    return value;
  }

  throw new Error(`Invalid sample source: ${value}. Expected real-exported, rehearsal, or unknown.`);
}

function isSampleSource(value: unknown): value is AgentSessionV3PilotRealCorpusBatchHandoffBundleSampleSource {
  return value === 'real-exported' || value === 'rehearsal' || value === 'unknown';
}

function isSampleSourceStatus(value: unknown): value is AgentSessionV3PilotRealCorpusBatchHandoffBundleSampleSourceStatus {
  return value === 'real-exported-evidence'
    || value === 'synthetic-rehearsal'
    || value === 'missing-real-sample-declaration';
}

function expectedStatusForSampleSource(
  sampleSource: AgentSessionV3PilotRealCorpusBatchHandoffBundleSampleSource,
): AgentSessionV3PilotRealCorpusBatchHandoffBundleSampleSourceStatus {
  if (sampleSource === 'real-exported') {
    return 'real-exported-evidence';
  }
  if (sampleSource === 'rehearsal') {
    return 'synthetic-rehearsal';
  }

  return 'missing-real-sample-declaration';
}

function createIssue(options: {
  code: AgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflightIssueCode;
  detail: string;
  path: string;
  severity: AgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflightIssueSeverity;
  source: AgentSessionV3PilotRealCorpusBatchSourceDeclarationObservation['label'];
}): AgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflightIssue {
  return {
    code: options.code,
    detail: options.detail,
    path: options.path,
    severity: options.severity,
    source: options.source,
  };
}

function createSampleNoteObservation(options: {
  notePath: string;
  noteRead: ReadTextResult;
}): AgentSessionV3PilotRealCorpusBatchSourceDeclarationObservation {
  return {
    label: 'sample-note',
    path: options.notePath,
    present: options.noteRead.present,
    sampleSource: extractLineValue(options.noteRead.text, /^- Sample source:\s*(.+)$/mu),
    sampleSourceStatus: extractLineValue(options.noteRead.text, /^- Sample source status:\s*(.+)$/mu),
  };
}

function collectSampleNoteIssues(
  observation: AgentSessionV3PilotRealCorpusBatchSourceDeclarationObservation,
) {
  const issues: AgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflightIssue[] = [];

  if (!observation.present) {
    issues.push(createIssue({
      code: 'missing-sample-note',
      detail: 'sample-note-template.md is missing from the intake directory.',
      path: observation.path,
      severity: 'blocker',
      source: 'sample-note',
    }));
    return issues;
  }

  if (!observation.sampleSource) {
    issues.push(createIssue({
      code: 'missing-sample-source',
      detail: 'sample note does not declare Sample source.',
      path: observation.path,
      severity: 'blocker',
      source: 'sample-note',
    }));
  } else if (!isSampleSource(observation.sampleSource)) {
    issues.push(createIssue({
      code: 'invalid-sample-source',
      detail: `sample note declares invalid Sample source=${observation.sampleSource}.`,
      path: observation.path,
      severity: 'blocker',
      source: 'sample-note',
    }));
  }

  if (!observation.sampleSourceStatus) {
    issues.push(createIssue({
      code: 'missing-sample-source-status',
      detail: 'sample note does not declare Sample source status.',
      path: observation.path,
      severity: 'blocker',
      source: 'sample-note',
    }));
  } else if (!isSampleSourceStatus(observation.sampleSourceStatus)) {
    issues.push(createIssue({
      code: 'invalid-sample-source-status',
      detail: `sample note declares invalid Sample source status=${observation.sampleSourceStatus}.`,
      path: observation.path,
      severity: 'blocker',
      source: 'sample-note',
    }));
  }

  if (isSampleSource(observation.sampleSource) && isSampleSourceStatus(observation.sampleSourceStatus)) {
    const expectedStatus = expectedStatusForSampleSource(observation.sampleSource);
    if (observation.sampleSourceStatus !== expectedStatus) {
      issues.push(createIssue({
        code: 'derived-status-mismatch',
        detail: `sample source=${observation.sampleSource} should map to sampleSourceStatus=${expectedStatus}, got ${observation.sampleSourceStatus}.`,
        path: observation.path,
        severity: 'blocker',
        source: 'sample-note',
      }));
    }
  }

  if (observation.sampleSource === 'unknown') {
    issues.push(createIssue({
      code: 'unknown-sample-source',
      detail: 'sampleSource=unknown leaves the real sample declaration unresolved.',
      path: observation.path,
      severity: 'review',
      source: 'sample-note',
    }));
  }

  return issues;
}

function createHandoffObservation(
  report: AgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyReportResult | null,
): AgentSessionV3PilotRealCorpusBatchSourceDeclarationObservation | null {
  if (!report) {
    return null;
  }

  return {
    label: 'handoff-bundle',
    path: report.bundleDir,
    present: true,
    sampleSource: report.sampleSource,
    sampleSourceStatus: report.sampleSourceStatus,
  };
}

function collectCrossLayerIssues(options: {
  expectedSampleSource: AgentSessionV3PilotRealCorpusBatchHandoffBundleSampleSource | null;
  handoffReport: AgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyReportResult | null;
  sampleNote: AgentSessionV3PilotRealCorpusBatchSourceDeclarationObservation;
}) {
  const issues: AgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflightIssue[] = [];

  if (isSampleSource(options.sampleNote.sampleSource) && options.expectedSampleSource && options.sampleNote.sampleSource !== options.expectedSampleSource) {
    issues.push(createIssue({
      code: 'expected-source-mismatch',
      detail: `Expected sampleSource=${options.expectedSampleSource}, got ${options.sampleNote.sampleSource}.`,
      path: options.sampleNote.path,
      severity: 'blocker',
      source: 'sample-note',
    }));
  }

  if (!options.handoffReport) {
    return issues;
  }

  if (options.handoffReport.status === 'blocked') {
    issues.push(createIssue({
      code: 'handoff-status-blocked',
      detail: 'handoff sample-source consistency report is blocked.',
      path: options.handoffReport.bundleDir,
      severity: 'blocker',
      source: 'handoff-bundle',
    }));
  } else if (options.handoffReport.status === 'review-needed') {
    issues.push(createIssue({
      code: 'handoff-status-review-needed',
      detail: 'handoff sample-source consistency report still needs review.',
      path: options.handoffReport.bundleDir,
      severity: 'review',
      source: 'handoff-bundle',
    }));
  }

  if (isSampleSource(options.sampleNote.sampleSource) && isSampleSource(options.handoffReport.sampleSource) && options.sampleNote.sampleSource !== options.handoffReport.sampleSource) {
    issues.push(createIssue({
      code: 'handoff-source-mismatch',
      detail: `sample note sampleSource=${options.sampleNote.sampleSource} does not match handoff sampleSource=${options.handoffReport.sampleSource}.`,
      path: options.sampleNote.path,
      severity: 'blocker',
      source: 'sample-note',
    }));
  }

  if (isSampleSourceStatus(options.sampleNote.sampleSourceStatus) && isSampleSourceStatus(options.handoffReport.sampleSourceStatus) && options.sampleNote.sampleSourceStatus !== options.handoffReport.sampleSourceStatus) {
    issues.push(createIssue({
      code: 'handoff-status-mismatch',
      detail: `sample note sampleSourceStatus=${options.sampleNote.sampleSourceStatus} does not match handoff sampleSourceStatus=${options.handoffReport.sampleSourceStatus}.`,
      path: options.sampleNote.path,
      severity: 'blocker',
      source: 'sample-note',
    }));
  }

  return issues;
}

function createStatus(options: {
  blockerCount: number;
  reviewCount: number;
}): AgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflightStatus {
  if (options.blockerCount > 0) {
    return 'blocked';
  }

  return options.reviewCount > 0 ? 'review-needed' : 'consistent';
}

function createSummaryText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflightResult,
    | 'blockerCount'
    | 'expectedSampleSource'
    | 'handoffBundleDir'
    | 'issueCount'
    | 'reviewCount'
    | 'sampleSource'
    | 'sampleSourceStatus'
    | 'status'
  >,
) {
  return [
    `AgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflight status=${result.status}`,
    `issues=${result.issueCount}`,
    `blockers=${result.blockerCount}`,
    `review=${result.reviewCount}`,
    `sampleSource=${result.sampleSource ?? 'missing'}`,
    `sampleSourceStatus=${result.sampleSourceStatus ?? 'missing'}`,
    `expectedSampleSource=${result.expectedSampleSource ?? 'none'}`,
    `handoff=${result.handoffBundleDir ? 'yes' : 'no'}`,
  ].join(' ');
}

function createReportText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflightResult,
    | 'expectedSampleSource'
    | 'handoffBundleDir'
    | 'intakeDir'
    | 'issues'
    | 'observations'
    | 'summaryText'
  >,
) {
  return [
    result.summaryText,
    `intakeDir: ${result.intakeDir}`,
    `handoffBundleDir: ${result.handoffBundleDir ?? 'none'}`,
    `expectedSampleSource: ${result.expectedSampleSource ?? 'none'}`,
    'sourceDeclarations:',
    ...result.observations.map((observation) => [
      `- source=${observation.label}`,
      `present=${observation.present ? 'yes' : 'no'}`,
      `sampleSource=${observation.sampleSource ?? 'missing'}`,
      `sampleSourceStatus=${observation.sampleSourceStatus ?? 'missing'}`,
      `path=${observation.path}`,
    ].join(' ')),
    result.issues.length ? 'sourceDeclarationIssues:' : 'sourceDeclarationIssues: none',
    ...result.issues.map((issue) => [
      `- severity=${issue.severity}`,
      `source=${issue.source}`,
      `code=${issue.code}`,
      `path=${issue.path}`,
      `detail=${issue.detail}`,
    ].join(' ')),
    'guardrail=caller-owned source declaration preflight only; does not infer realness from file content, collect samples, choose thresholds, change readiness, route permissions, execute tools, decide recovery, define workflows, or grant runtime authority.',
  ].join('\n');
}

function createJsonText(
  result: AgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflightResult,
  options: { prettyJson?: boolean } = {},
) {
  return JSON.stringify(result, null, options.prettyJson ? 2 : 0);
}

export async function runAgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflight(
  options: RunAgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflightOptions,
): Promise<AgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflightResult> {
  const intakeDir = path.resolve(options.intakeDir);
  const sampleNotePath = path.join(intakeDir, 'sample-note-template.md');
  const expectedSampleSource = options.expectedSampleSource ?? null;
  const handoffBundleDir = options.handoffBundleDir
    ? path.resolve(options.handoffBundleDir)
    : null;
  const noteRead = await readTextFile(sampleNotePath);
  const sampleNoteObservation = createSampleNoteObservation({
    notePath: sampleNotePath,
    noteRead,
  });
  const handoffConsistencyReport = handoffBundleDir
    ? await runAgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyReport({
      bundleDir: handoffBundleDir,
      expectedSampleSource: expectedSampleSource ?? undefined,
      prettyJson: options.prettyJson,
    })
    : null;
  const handoffObservation = createHandoffObservation(handoffConsistencyReport);
  const observations = [
    sampleNoteObservation,
    ...(handoffObservation ? [handoffObservation] : []),
  ];
  const issues = [
    ...collectSampleNoteIssues(sampleNoteObservation),
    ...collectCrossLayerIssues({
      expectedSampleSource,
      handoffReport: handoffConsistencyReport,
      sampleNote: sampleNoteObservation,
    }),
  ];
  const blockerCount = issues.filter((issue) => issue.severity === 'blocker').length;
  const reviewCount = issues.filter((issue) => issue.severity === 'review').length;
  const resultWithoutText: AgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflightResult = {
    blockerCount,
    expectedSampleSource,
    handoffBundleDir,
    handoffConsistencyReport,
    intakeDir,
    issueCount: issues.length,
    issues,
    jsonText: null,
    kind: 'agent-session-v3-pilot-real-corpus-batch-source-declaration-preflight',
    observations,
    readyForProductionRuntime: false,
    reportText: '',
    reviewCount,
    sampleNotePath,
    sampleSource: sampleNoteObservation.sampleSource,
    sampleSourceStatus: sampleNoteObservation.sampleSourceStatus,
    status: createStatus({
      blockerCount,
      reviewCount,
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

async function runAgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflightCli() {
  const options = parseArgs(process.argv.slice(2));
  const result = await runAgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflight(options);
  console.log(result.reportText);
  if (result.jsonText) {
    console.log(result.jsonText);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflightCli().catch((error: unknown) => {
    const errorText = error instanceof Error ? error.message : String(error);
    console.error(errorText);
    process.exitCode = 1;
  });
}
