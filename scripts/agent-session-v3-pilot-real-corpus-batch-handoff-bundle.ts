import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  runAgentSessionV3PilotRealCorpusBatchOperatorChecklistReport,
  type AgentSessionV3PilotRealCorpusBatchOperatorChecklistReportResult,
} from './agent-session-v3-pilot-real-corpus-batch-operator-checklist-report.ts';
import {
  runAgentSessionV3PilotRealCorpusBatchReadinessRollupReport,
  type AgentSessionV3PilotRealCorpusBatchReadinessRollupReportResult,
} from './agent-session-v3-pilot-real-corpus-batch-readiness-rollup-report.ts';
import {
  runAgentSessionV3PilotRealCorpusBatchReviewSummary,
  type AgentSessionV3PilotRealCorpusBatchReviewSummaryResult,
} from './agent-session-v3-pilot-real-corpus-batch-review-summary.ts';

export type AgentSessionV3PilotRealCorpusBatchHandoffBundleSampleSource =
  | 'real-exported'
  | 'rehearsal'
  | 'unknown';

export type AgentSessionV3PilotRealCorpusBatchHandoffBundleSampleSourceStatus =
  | 'real-exported-evidence'
  | 'synthetic-rehearsal'
  | 'missing-real-sample-declaration';

export interface RunAgentSessionV3PilotRealCorpusBatchHandoffBundleOptions {
  includeJsonText?: boolean;
  intakeDirs: readonly string[];
  outDir: string;
  prettyJson?: boolean;
  sampleSource?: AgentSessionV3PilotRealCorpusBatchHandoffBundleSampleSource;
}

export interface AgentSessionV3PilotRealCorpusBatchHandoffBundleChecklistArtifact {
  intakeDir: string;
  jsonPath: string;
  reportPath: string;
  status: AgentSessionV3PilotRealCorpusBatchOperatorChecklistReportResult['status'];
  summaryText: string;
}

export interface AgentSessionV3PilotRealCorpusBatchHandoffBundleIndex {
  checklistArtifacts: AgentSessionV3PilotRealCorpusBatchHandoffBundleChecklistArtifact[];
  generatedBy: 'agent-session-v3-pilot-real-corpus-batch-handoff-bundle';
  guardrail: string;
  handoffManifestPath: string;
  intakeDirs: string[];
  readmePath: string;
  reviewOrder: string[];
  reviewSummaryJsonPath: string;
  reviewSummaryReportPath: string;
  rollupJsonPath: string;
  rollupReportPath: string;
  sampleSource: AgentSessionV3PilotRealCorpusBatchHandoffBundleSampleSource;
  sampleSourceStatus: AgentSessionV3PilotRealCorpusBatchHandoffBundleSampleSourceStatus;
  status: AgentSessionV3PilotRealCorpusBatchReviewSummaryResult['status'];
  statusCounts: AgentSessionV3PilotRealCorpusBatchReviewSummaryResult['statusCounts'];
  version: 1;
}

export interface AgentSessionV3PilotRealCorpusBatchHandoffBundleResult {
  checklistArtifacts: AgentSessionV3PilotRealCorpusBatchHandoffBundleChecklistArtifact[];
  index: AgentSessionV3PilotRealCorpusBatchHandoffBundleIndex;
  indexJsonPath: string;
  jsonText: string | null;
  kind: 'agent-session-v3-pilot-real-corpus-batch-handoff-bundle';
  outDir: string;
  handoffManifestPath: string;
  readmePath: string;
  reviewSummary: AgentSessionV3PilotRealCorpusBatchReviewSummaryResult;
  reviewSummaryJsonPath: string;
  reviewSummaryReportPath: string;
  rollup: AgentSessionV3PilotRealCorpusBatchReadinessRollupReportResult;
  rollupJsonPath: string;
  rollupReportPath: string;
  sampleSource: AgentSessionV3PilotRealCorpusBatchHandoffBundleSampleSource;
  sampleSourceStatus: AgentSessionV3PilotRealCorpusBatchHandoffBundleSampleSourceStatus;
  summaryText: string;
  version: 1;
}

function parseSampleSource(
  value: string,
): AgentSessionV3PilotRealCorpusBatchHandoffBundleSampleSource {
  if (value === 'real-exported' || value === 'rehearsal' || value === 'unknown') {
    return value;
  }

  throw new Error(`Invalid --sample-source value: ${value}. Expected real-exported, rehearsal, or unknown.`);
}

function getSampleSourceStatus(
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

function parseAgentSessionV3PilotRealCorpusBatchHandoffBundleArgs(
  args: readonly string[],
): RunAgentSessionV3PilotRealCorpusBatchHandoffBundleOptions {
  let includeJsonText = false;
  const intakeDirs: string[] = [];
  let outDir: string | null = null;
  let prettyJson = false;
  let sampleSource: AgentSessionV3PilotRealCorpusBatchHandoffBundleSampleSource = 'unknown';

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
    } else if (arg === '--out-dir') {
      const nextArg = args[index + 1];
      if (!nextArg) {
        throw new Error('Missing output directory after --out-dir.');
      }
      outDir = nextArg;
      index += 1;
    } else if (arg === '--sample-source') {
      const nextArg = args[index + 1];
      if (!nextArg) {
        throw new Error('Missing value after --sample-source.');
      }
      sampleSource = parseSampleSource(nextArg);
      index += 1;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  if (!outDir || intakeDirs.length === 0) {
    throw new Error('Usage: npx tsx scripts/agent-session-v3-pilot-real-corpus-batch-handoff-bundle.ts --out-dir output-dir --dir intake-dir [...--dir intake-dir] [--sample-source unknown|rehearsal|real-exported] [--json] [--pretty]');
  }

  return {
    includeJsonText,
    intakeDirs,
    outDir,
    prettyJson,
    sampleSource,
  };
}

function artifactStem(index: number) {
  return `intake-${String(index + 1).padStart(2, '0')}-operator-checklist`;
}

function createSummaryText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchHandoffBundleResult,
    'checklistArtifacts' | 'reviewSummary' | 'sampleSource' | 'sampleSourceStatus'
  >,
) {
  return [
    `AgentSessionV3PilotRealCorpusBatchHandoffBundle status=${result.reviewSummary.status}`,
    `intakes=${result.reviewSummary.intakeCount}`,
    `blocked=${result.reviewSummary.statusCounts.blocked}`,
    `reviewNeeded=${result.reviewSummary.statusCounts.reviewNeeded}`,
    `readyForManualReview=${result.reviewSummary.statusCounts.readyForManualReview}`,
    `checklists=${result.checklistArtifacts.length}`,
    `sampleSource=${result.sampleSource}`,
    `sampleSourceStatus=${result.sampleSourceStatus}`,
  ].join(' ');
}

function createIndex(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchHandoffBundleResult,
    | 'checklistArtifacts'
    | 'handoffManifestPath'
    | 'readmePath'
    | 'reviewSummary'
    | 'reviewSummaryJsonPath'
    | 'reviewSummaryReportPath'
    | 'rollupJsonPath'
    | 'rollupReportPath'
    | 'sampleSource'
    | 'sampleSourceStatus'
  >,
): AgentSessionV3PilotRealCorpusBatchHandoffBundleIndex {
  return {
    checklistArtifacts: result.checklistArtifacts,
    generatedBy: 'agent-session-v3-pilot-real-corpus-batch-handoff-bundle',
    guardrail: 'caller-owned evidence bundle only; no threshold decision, runtime authority, tool selection, permission routing, execution, or recovery.',
    handoffManifestPath: result.handoffManifestPath,
    intakeDirs: result.reviewSummary.intakeEntries.map((entry) => entry.intakeDir),
    readmePath: result.readmePath,
    reviewOrder: [
      'review-summary-report',
      'readiness-rollup-report',
      'operator-checklist-drill-down',
    ],
    reviewSummaryJsonPath: result.reviewSummaryJsonPath,
    reviewSummaryReportPath: result.reviewSummaryReportPath,
    rollupJsonPath: result.rollupJsonPath,
    rollupReportPath: result.rollupReportPath,
    sampleSource: result.sampleSource,
    sampleSourceStatus: result.sampleSourceStatus,
    status: result.reviewSummary.status,
    statusCounts: result.reviewSummary.statusCounts,
    version: 1,
  };
}

function createReadmeText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchHandoffBundleResult,
    | 'checklistArtifacts'
    | 'handoffManifestPath'
    | 'indexJsonPath'
    | 'readmePath'
    | 'reviewSummary'
    | 'reviewSummaryReportPath'
    | 'rollupReportPath'
    | 'sampleSource'
    | 'sampleSourceStatus'
    | 'summaryText'
  >,
) {
  return [
    '# Agent Runtime v3 Real Corpus Handoff Bundle',
    '',
    result.summaryText,
    '',
    '## Review Order',
    '',
    '1. Read `review-summary-report.txt` for the one-page human overview.',
    '2. Read `readiness-rollup-report.txt` for repeated checklist item detail.',
    '3. Open the `intake-XX-operator-checklist.txt` files only where drill-down is needed.',
    '',
    '## Sample Source',
    '',
    `- Declared sample source: ${result.sampleSource}`,
    `- Sample source status: ${result.sampleSourceStatus}`,
    '- This value is caller-declared. The bundle does not infer realness from file content.',
    '',
    '## Files',
    '',
    `- README: ${result.readmePath}`,
    `- Manifest: ${result.handoffManifestPath}`,
    `- Machine index: ${result.indexJsonPath}`,
    `- Review summary: ${result.reviewSummaryReportPath}`,
    `- Readiness rollup: ${result.rollupReportPath}`,
    ...result.checklistArtifacts.map((artifact) => (
      `- Operator checklist (${artifact.status}): ${artifact.reportPath}`
    )),
    '',
    '## Guardrail',
    '',
    'This is a caller-owned evidence bundle only. It does not collect samples, choose thresholds, change readiness, choose tools, route permissions, execute tools, decide recovery, or grant runtime authority.',
  ].join('\n');
}

function createManifestText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchHandoffBundleResult,
    | 'checklistArtifacts'
    | 'indexJsonPath'
    | 'reviewSummary'
    | 'reviewSummaryJsonPath'
    | 'reviewSummaryReportPath'
    | 'rollupJsonPath'
    | 'rollupReportPath'
    | 'sampleSource'
    | 'sampleSourceStatus'
    | 'summaryText'
  >,
) {
  return [
    result.summaryText,
    `status=${result.reviewSummary.status}`,
    `intakes=${result.reviewSummary.intakeCount}`,
    `sampleSource=${result.sampleSource}`,
    `sampleSourceStatus=${result.sampleSourceStatus}`,
    'sampleSourceGuardrail=caller-declared only; the bundle does not infer realness from file content.',
    'reviewOrder=review-summary-report,readiness-rollup-report,operator-checklist-drill-down',
    `reviewSummaryReportPath=${result.reviewSummaryReportPath}`,
    `reviewSummaryJsonPath=${result.reviewSummaryJsonPath}`,
    `readinessRollupReportPath=${result.rollupReportPath}`,
    `readinessRollupJsonPath=${result.rollupJsonPath}`,
    `indexJsonPath=${result.indexJsonPath}`,
    'operatorChecklists:',
    ...result.checklistArtifacts.map((artifact) => [
      `- status=${artifact.status}`,
      `reportPath=${artifact.reportPath}`,
      `jsonPath=${artifact.jsonPath}`,
      `intakeDir=${artifact.intakeDir}`,
    ].join(' ')),
    'guardrail=caller-owned evidence bundle only; no threshold decision, runtime authority, tool selection, permission routing, execution, or recovery.',
  ].join('\n');
}

function createJsonText(
  result: AgentSessionV3PilotRealCorpusBatchHandoffBundleResult,
  options: { prettyJson?: boolean } = {},
) {
  return JSON.stringify(result, null, options.prettyJson ? 2 : 0);
}

export async function runAgentSessionV3PilotRealCorpusBatchHandoffBundle(
  options: RunAgentSessionV3PilotRealCorpusBatchHandoffBundleOptions,
): Promise<AgentSessionV3PilotRealCorpusBatchHandoffBundleResult> {
  const outDir = path.resolve(options.outDir);
  const intakeDirs = options.intakeDirs.map((intakeDir) => path.resolve(intakeDir));
  const sampleSource = options.sampleSource ?? 'unknown';
  const sampleSourceStatus = getSampleSourceStatus(sampleSource);

  await mkdir(outDir, {
    recursive: true,
  });

  const reviewSummary = await runAgentSessionV3PilotRealCorpusBatchReviewSummary({
    intakeDirs,
    prettyJson: options.prettyJson,
  });
  const rollup = await runAgentSessionV3PilotRealCorpusBatchReadinessRollupReport({
    intakeDirs,
    prettyJson: options.prettyJson,
  });
  const checklists = await Promise.all(intakeDirs.map((intakeDir) => (
    runAgentSessionV3PilotRealCorpusBatchOperatorChecklistReport({
      intakeDir,
      prettyJson: options.prettyJson,
    })
  )));

  const reviewSummaryReportPath = path.join(outDir, 'review-summary-report.txt');
  const reviewSummaryJsonPath = path.join(outDir, 'review-summary-report.json');
  const rollupReportPath = path.join(outDir, 'readiness-rollup-report.txt');
  const rollupJsonPath = path.join(outDir, 'readiness-rollup-report.json');
  const indexJsonPath = path.join(outDir, 'handoff-index.json');
  const handoffManifestPath = path.join(outDir, 'handoff-manifest.txt');
  const readmePath = path.join(outDir, 'README.md');

  await writeFile(reviewSummaryReportPath, reviewSummary.reportText, 'utf8');
  await writeFile(
    reviewSummaryJsonPath,
    JSON.stringify(reviewSummary, null, options.prettyJson ? 2 : 0),
    'utf8',
  );
  await writeFile(rollupReportPath, rollup.reportText, 'utf8');
  await writeFile(
    rollupJsonPath,
    JSON.stringify(rollup, null, options.prettyJson ? 2 : 0),
    'utf8',
  );

  const checklistArtifacts: AgentSessionV3PilotRealCorpusBatchHandoffBundleChecklistArtifact[] = [];
  for (const [index, checklist] of checklists.entries()) {
    const stem = artifactStem(index);
    const reportPath = path.join(outDir, `${stem}.txt`);
    const jsonPath = path.join(outDir, `${stem}.json`);

    await writeFile(reportPath, checklist.reportText, 'utf8');
    await writeFile(
      jsonPath,
      JSON.stringify(checklist, null, options.prettyJson ? 2 : 0),
      'utf8',
    );
    checklistArtifacts.push({
      intakeDir: checklist.intakeDir,
      jsonPath,
      reportPath,
      status: checklist.status,
      summaryText: checklist.summaryText,
    });
  }

  const resultWithoutIndex: AgentSessionV3PilotRealCorpusBatchHandoffBundleResult = {
    checklistArtifacts,
    index: {
      checklistArtifacts: [],
      generatedBy: 'agent-session-v3-pilot-real-corpus-batch-handoff-bundle',
      guardrail: '',
      handoffManifestPath,
      intakeDirs: [],
      readmePath,
      reviewOrder: [],
      reviewSummaryJsonPath,
      reviewSummaryReportPath,
      rollupJsonPath,
      rollupReportPath,
      sampleSource,
      sampleSourceStatus,
      status: reviewSummary.status,
      statusCounts: reviewSummary.statusCounts,
      version: 1,
    },
    indexJsonPath,
    jsonText: null,
    kind: 'agent-session-v3-pilot-real-corpus-batch-handoff-bundle',
    outDir,
    handoffManifestPath,
    readmePath,
    reviewSummary,
    reviewSummaryJsonPath,
    reviewSummaryReportPath,
    rollup,
    rollupJsonPath,
    rollupReportPath,
    sampleSource,
    sampleSourceStatus,
    summaryText: '',
    version: 1,
  };
  const summaryText = createSummaryText(resultWithoutIndex);
  const resultWithIndex = {
    ...resultWithoutIndex,
    index: createIndex(resultWithoutIndex),
    summaryText,
  };

  await writeFile(
    indexJsonPath,
    JSON.stringify(resultWithIndex.index, null, options.prettyJson ? 2 : 0),
    'utf8',
  );
  await writeFile(
    handoffManifestPath,
    createManifestText(resultWithIndex),
    'utf8',
  );
  await writeFile(
    readmePath,
    createReadmeText(resultWithIndex),
    'utf8',
  );

  return {
    ...resultWithIndex,
    jsonText: options.includeJsonText
      ? createJsonText(resultWithIndex, {
        prettyJson: options.prettyJson,
      })
      : null,
  };
}

async function runAgentSessionV3PilotRealCorpusBatchHandoffBundleCli() {
  const options = parseAgentSessionV3PilotRealCorpusBatchHandoffBundleArgs(process.argv.slice(2));
  const result = await runAgentSessionV3PilotRealCorpusBatchHandoffBundle(options);

  console.log(result.summaryText);
  console.log(`outDir=${result.outDir}`);
  console.log(`readmePath=${result.readmePath}`);
  console.log(`handoffManifestPath=${result.handoffManifestPath}`);
  console.log(`indexJsonPath=${result.indexJsonPath}`);
  console.log(`sampleSource=${result.sampleSource}`);
  console.log(`sampleSourceStatus=${result.sampleSourceStatus}`);
  console.log(`reviewSummaryReportPath=${result.reviewSummaryReportPath}`);
  console.log(`readinessRollupReportPath=${result.rollupReportPath}`);
  for (const artifact of result.checklistArtifacts) {
    console.log(`operatorChecklist status=${artifact.status} reportPath=${artifact.reportPath} intakeDir=${artifact.intakeDir}`);
  }
  if (result.jsonText) {
    console.log(result.jsonText);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAgentSessionV3PilotRealCorpusBatchHandoffBundleCli().catch((error: unknown) => {
    const errorText = error instanceof Error ? error.message : String(error);
    console.error(errorText);
    process.exitCode = 1;
  });
}
