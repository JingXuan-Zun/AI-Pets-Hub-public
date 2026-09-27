import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  createAgentSessionV3PilotDebugSampleCorpusExport,
  createAgentSessionV3PilotShadowAgreementReport,
  createAgentSessionV3PilotShadowAgreementReportExport,
  createAgentSessionV3PilotShadowDebugExport,
  runAgentSessionV3PilotShadowMode,
  type AgentSessionV3PilotShadowAgreement,
} from '../src/agent/legacy/index.ts';
import { runAgentSessionV3PilotBaselineCorpusManifestReport } from './agent-session-v3-pilot-baseline-corpus-manifest-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchIntakeTemplate } from './agent-session-v3-pilot-real-corpus-batch-intake-template.ts';
import {
  runAgentSessionV3PilotRealCorpusBatchReadinessRollupReport,
  type AgentSessionV3PilotRealCorpusBatchReadinessRollupReportResult,
} from './agent-session-v3-pilot-real-corpus-batch-readiness-rollup-report.ts';
import {
  runAgentSessionV3PilotRealCorpusBatchReviewSummary,
  type AgentSessionV3PilotRealCorpusBatchReviewSummaryResult,
} from './agent-session-v3-pilot-real-corpus-batch-review-summary.ts';

export interface RunAgentSessionV3PilotRealCorpusBatchReadinessRollupExampleOptions {
  includeJsonText?: boolean;
  outDir: string;
  prettyJson?: boolean;
}

export interface AgentSessionV3PilotRealCorpusBatchReadinessRollupExampleIntakeDirs {
  missing: string;
  mixed: string;
  ready: string;
}

export interface AgentSessionV3PilotRealCorpusBatchReadinessRollupExampleResult {
  intakeDirs: AgentSessionV3PilotRealCorpusBatchReadinessRollupExampleIntakeDirs;
  jsonText: string | null;
  kind: 'agent-session-v3-pilot-real-corpus-batch-readiness-rollup-example';
  outDir: string;
  reviewSummary: AgentSessionV3PilotRealCorpusBatchReviewSummaryResult;
  reviewSummaryJsonPath: string;
  reviewSummaryReportPath: string;
  rollup: AgentSessionV3PilotRealCorpusBatchReadinessRollupReportResult;
  rollupJsonPath: string;
  rollupReportPath: string;
  summaryText: string;
  version: 1;
}

function parseAgentSessionV3PilotRealCorpusBatchReadinessRollupExampleArgs(
  args: readonly string[],
): RunAgentSessionV3PilotRealCorpusBatchReadinessRollupExampleOptions {
  let includeJsonText = false;
  let outDir: string | null = null;
  let prettyJson = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--json') {
      includeJsonText = true;
    } else if (arg === '--pretty') {
      includeJsonText = true;
      prettyJson = true;
    } else if (arg === '--out-dir') {
      const nextArg = args[index + 1];
      if (!nextArg) {
        throw new Error('Missing output directory after --out-dir.');
      }
      outDir = nextArg;
      index += 1;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  if (!outDir) {
    throw new Error('Usage: npx tsx scripts/agent-session-v3-pilot-real-corpus-batch-readiness-rollup-example.ts --out-dir output-dir [--json] [--pretty]');
  }

  return {
    includeJsonText,
    outDir,
    prettyJson,
  };
}

function createAgreement(
  options: Pick<AgentSessionV3PilotShadowAgreement, 'status' | 'v2Status'>,
): AgentSessionV3PilotShadowAgreement {
  return {
    expectations: [],
    observed: {
      lastEvent: null,
      phase: null,
      runnerStatus: null,
      shadowStatus: null,
      terminalStatus: null,
      transitionCount: null,
    },
    reason: `${options.status} real corpus readiness rollup example sample`,
    status: options.status,
    v2Status: options.v2Status,
  };
}

function createCorpus(
  status: AgentSessionV3PilotShadowAgreement['status'],
  shadowExport: ReturnType<typeof createAgentSessionV3PilotShadowDebugExport>,
) {
  return createAgentSessionV3PilotDebugSampleCorpusExport({
    agreementReport: createAgentSessionV3PilotShadowAgreementReportExport(
      createAgentSessionV3PilotShadowAgreementReport([
        createAgreement({
          status,
          v2Status: status === 'aligned' ? 'completed' : 'failed',
        }),
      ]),
      {
        includeSamples: true,
      },
    ),
    shadowDebugSamples: [{
      label: `${status}-shadow`,
      shadow: shadowExport,
    }],
  });
}

function fillReadySampleNote(noteText: string) {
  return noteText
    .replaceAll('replace-with-real-batch-label', 'ready-rehearsal-batch')
    .replaceAll('replace-with-export-date', '2026-06-23')
    .replaceAll('replace-with-machine-app-mode-or-branch', 'local-dev-agent-session-v2-shadow')
    .replaceAll('replace-with-scenario-family', 'terminal-state-alignment')
    .replaceAll('replace-with-export-command-or-manual-source', 'manual debug corpus export')
    .replaceAll('replace-with-sample-source-real-exported-rehearsal-or-unknown', 'rehearsal')
    .replaceAll('replace-with-sample-source-status', 'synthetic-rehearsal')
    .replaceAll('replace-with-corpus-json-paths', './corpora/ready-corpus.json')
    .replaceAll('replace-with-sample-count', '12')
    .replaceAll('replace-with-intake-dir', 'ready-intake')
    .replaceAll('replace-with-ready-mixed-not-ready-empty-or-missing', 'ready')
    .replaceAll('replace-with-manifestSources', '1')
    .replaceAll('replace-with-indexManifests', '2')
    .replaceAll('ready=replace mixed=replace notReady=replace empty=replace', 'ready=2 mixed=0 notReady=0 empty=0')
    .replaceAll('yes/no and why', 'no, this batch only confirms local baseline alignment')
    .replaceAll('replace-with-p0-intake-dir', 'ready-intake')
    .replaceAll('replace-with-real-production-like-sample-signal', 'ready-for-manual-review')
    .replaceAll('replace-with-real-exported-corpus-signal', 'missing')
    .replaceAll('replace-with-short-assessment', 'sufficient for manual baseline comparison')
    .replaceAll('replace-with-scope', 'v3 mirror alignment for this local sample set')
    .replaceAll('replace-with-limitations', 'synthetic rehearsal only; no production runtime authority or real exported evidence')
    .replaceAll('replace-with-next-samples', 'broader production-like traces')
    .replaceAll('keep-current / compare-profiles / propose-manual-review', 'keep-current');
}

async function createMixedIntake(
  intakeDir: string,
  shadowExport: ReturnType<typeof createAgentSessionV3PilotShadowDebugExport>,
  prettyJson?: boolean,
) {
  const intakeTemplate = await runAgentSessionV3PilotRealCorpusBatchIntakeTemplate({
    outDir: intakeDir,
    prettyJson,
  });
  await runAgentSessionV3PilotBaselineCorpusManifestReport({
    maxShadowDebugSamples: 3,
    outDir: path.join(intakeDir, 'baseline'),
    prettyJson,
  });

  const corpusDir = path.join(intakeDir, 'corpora');
  await mkdir(corpusDir, {
    recursive: true,
  });
  await writeFile(
    path.join(corpusDir, 'ready-corpus.json'),
    JSON.stringify(createCorpus('aligned', shadowExport), null, prettyJson ? 2 : 0),
    'utf8',
  );
  await writeFile(
    path.join(corpusDir, 'mismatch-corpus.json'),
    JSON.stringify(createCorpus('mismatch', shadowExport), null, prettyJson ? 2 : 0),
    'utf8',
  );

  if (!intakeTemplate.manifestPath) {
    throw new Error('Expected mixed intake manifest path.');
  }

  await writeFile(
    intakeTemplate.manifestPath,
    JSON.stringify({
      ...intakeTemplate.manifest,
      sources: [
        {
          label: 'ready-real-batch',
          path: './corpora/ready-corpus.json',
        },
        {
          label: 'mismatch-real-batch',
          path: './corpora/mismatch-corpus.json',
        },
      ],
    }, null, prettyJson ? 2 : 0),
    'utf8',
  );
}

async function createReadyIntake(
  intakeDir: string,
  shadowExport: ReturnType<typeof createAgentSessionV3PilotShadowDebugExport>,
  prettyJson?: boolean,
) {
  const intakeTemplate = await runAgentSessionV3PilotRealCorpusBatchIntakeTemplate({
    outDir: intakeDir,
    prettyJson,
  });
  await runAgentSessionV3PilotBaselineCorpusManifestReport({
    maxShadowDebugSamples: 3,
    outDir: path.join(intakeDir, 'baseline'),
    prettyJson,
  });

  const corpusDir = path.join(intakeDir, 'corpora');
  await mkdir(corpusDir, {
    recursive: true,
  });
  await writeFile(
    path.join(corpusDir, 'ready-corpus.json'),
    JSON.stringify(createCorpus('aligned', shadowExport), null, prettyJson ? 2 : 0),
    'utf8',
  );

  if (!intakeTemplate.indexPath || !intakeTemplate.manifestPath || !intakeTemplate.notePath) {
    throw new Error('Expected ready intake template paths.');
  }

  await writeFile(
    intakeTemplate.manifestPath,
    JSON.stringify({
      ...intakeTemplate.manifest,
      sources: [{
        label: 'ready-rehearsal-batch',
        path: './corpora/ready-corpus.json',
      }],
    }, null, prettyJson ? 2 : 0),
    'utf8',
  );
  await writeFile(
    intakeTemplate.indexPath,
    JSON.stringify({
      ...intakeTemplate.index,
      batches: [
        {
          generatedAt: '2026-06-23T10:00:00.000Z',
          label: 'baseline-artifact-flow',
          manifestPath: './baseline/explicit-debug-corpus-manifest.json',
          notes: 'baseline bundle generated by the reviewed baseline evidence artifact flow',
          sourceKind: 'baseline',
        },
        {
          generatedAt: '2026-06-23T10:05:00.000Z',
          label: 'ready-rehearsal-batch',
          manifestPath: './real-corpus-manifest.json',
          notes: 'synthetic production-like rehearsal corpus batch for manual review',
          sourceKind: 'production-like',
        },
      ],
    }, null, prettyJson ? 2 : 0),
    'utf8',
  );
  await writeFile(
    intakeTemplate.notePath,
    fillReadySampleNote(await readFile(intakeTemplate.notePath, 'utf8')),
    'utf8',
  );
}

function createSummaryText(result: Omit<AgentSessionV3PilotRealCorpusBatchReadinessRollupExampleResult, 'jsonText'>) {
  return [
    `AgentSessionV3PilotRealCorpusBatchReadinessRollupExample status=${result.rollup.status}`,
    `outDir=${result.outDir}`,
    `intakes=${result.rollup.intakeCount}`,
    `blocked=${result.rollup.statusCounts.blocked}`,
    `reviewNeeded=${result.rollup.statusCounts.reviewNeeded}`,
    `readyForManualReview=${result.rollup.statusCounts.readyForManualReview}`,
    `reviewSummaryReportPath=${result.reviewSummaryReportPath}`,
    `reviewSummaryJsonPath=${result.reviewSummaryJsonPath}`,
    `rollupReportPath=${result.rollupReportPath}`,
    `rollupJsonPath=${result.rollupJsonPath}`,
  ].join(' ');
}

function createJsonText(
  result: AgentSessionV3PilotRealCorpusBatchReadinessRollupExampleResult,
  options: { prettyJson?: boolean } = {},
) {
  return JSON.stringify(result, null, options.prettyJson ? 2 : 0);
}

export async function runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample(
  options: RunAgentSessionV3PilotRealCorpusBatchReadinessRollupExampleOptions,
): Promise<AgentSessionV3PilotRealCorpusBatchReadinessRollupExampleResult> {
  const outDir = path.resolve(options.outDir);
  const intakeDirs = {
    missing: path.join(outDir, 'missing-intake'),
    mixed: path.join(outDir, 'mixed-intake'),
    ready: path.join(outDir, 'ready-intake'),
  };

  await mkdir(intakeDirs.missing, {
    recursive: true,
  });

  const shadowResult = await runAgentSessionV3PilotShadowMode({
    enabled: true,
    events: [
      {
        reason: 'begin real corpus readiness rollup example sample',
        type: 'start',
      },
      {
        reason: 'terminal answer',
        route: 'terminal',
        terminalStatus: 'completed',
        type: 'model-decision-accepted',
      },
    ],
  });
  const shadowExport = createAgentSessionV3PilotShadowDebugExport(shadowResult);

  await createMixedIntake(intakeDirs.mixed, shadowExport, options.prettyJson);
  await createReadyIntake(intakeDirs.ready, shadowExport, options.prettyJson);

  const rollup = await runAgentSessionV3PilotRealCorpusBatchReadinessRollupReport({
    intakeDirs: [
      intakeDirs.missing,
      intakeDirs.mixed,
      intakeDirs.ready,
    ],
    prettyJson: options.prettyJson,
  });
  const rollupReportPath = path.join(outDir, 'readiness-rollup-report.txt');
  const rollupJsonPath = path.join(outDir, 'readiness-rollup-report.json');
  const reviewSummary = await runAgentSessionV3PilotRealCorpusBatchReviewSummary({
    intakeDirs: [
      intakeDirs.missing,
      intakeDirs.mixed,
      intakeDirs.ready,
    ],
    prettyJson: options.prettyJson,
  });
  const reviewSummaryReportPath = path.join(outDir, 'review-summary-report.txt');
  const reviewSummaryJsonPath = path.join(outDir, 'review-summary-report.json');

  await writeFile(rollupReportPath, rollup.reportText, 'utf8');
  await writeFile(
    rollupJsonPath,
    JSON.stringify(rollup, null, options.prettyJson ? 2 : 0),
    'utf8',
  );
  await writeFile(reviewSummaryReportPath, reviewSummary.reportText, 'utf8');
  await writeFile(
    reviewSummaryJsonPath,
    JSON.stringify(reviewSummary, null, options.prettyJson ? 2 : 0),
    'utf8',
  );

  const resultWithoutJson: AgentSessionV3PilotRealCorpusBatchReadinessRollupExampleResult = {
    intakeDirs,
    jsonText: null,
    kind: 'agent-session-v3-pilot-real-corpus-batch-readiness-rollup-example',
    outDir,
    reviewSummary,
    reviewSummaryJsonPath,
    reviewSummaryReportPath,
    rollup,
    rollupJsonPath,
    rollupReportPath,
    summaryText: '',
    version: 1,
  };
  const summaryText = createSummaryText(resultWithoutJson);
  const resultWithSummary = {
    ...resultWithoutJson,
    summaryText,
  };

  return {
    ...resultWithSummary,
    jsonText: options.includeJsonText
      ? createJsonText(resultWithSummary, {
        prettyJson: options.prettyJson,
      })
      : null,
  };
}

async function runAgentSessionV3PilotRealCorpusBatchReadinessRollupExampleCli() {
  const options = parseAgentSessionV3PilotRealCorpusBatchReadinessRollupExampleArgs(process.argv.slice(2));
  const result = await runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample(options);

  console.log(result.summaryText);
  console.log(`missingIntakeDir=${result.intakeDirs.missing}`);
  console.log(`mixedIntakeDir=${result.intakeDirs.mixed}`);
  console.log(`readyIntakeDir=${result.intakeDirs.ready}`);
  console.log(`reviewSummaryReportPath=${result.reviewSummaryReportPath}`);
  console.log(`reviewSummaryJsonPath=${result.reviewSummaryJsonPath}`);
  console.log(`rollupReportPath=${result.rollupReportPath}`);
  console.log(`rollupJsonPath=${result.rollupJsonPath}`);
  console.log(result.reviewSummary.reportText);
  console.log(result.rollup.reportText);
  if (result.jsonText) {
    console.log(result.jsonText);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAgentSessionV3PilotRealCorpusBatchReadinessRollupExampleCli().catch((error: unknown) => {
    const errorText = error instanceof Error ? error.message : String(error);
    console.error(errorText);
    process.exitCode = 1;
  });
}
