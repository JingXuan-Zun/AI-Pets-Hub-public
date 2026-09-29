import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  createAgentSessionV3PilotDebugSampleCorpusExport,
  createAgentSessionV3PilotShadowAgreementReport,
  createAgentSessionV3PilotShadowAgreementReportExport,
  createAgentSessionV3PilotShadowDebugExport,
  runAgentSessionV3PilotShadowMode,
  type AgentSessionV3PilotShadowAgreement,
} from '../src/agent/legacy/index.ts';
import { runAgentSessionV3PilotBaselineCorpusManifestReport } from './agent-session-v3-pilot-baseline-corpus-manifest-report.ts';
import { assertSourceDoesNotUseRuntimeOrFixedDesktopChain } from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import { runAgentSessionV3PilotRealCorpusBatchIntakeTemplate } from './agent-session-v3-pilot-real-corpus-batch-intake-template.ts';
import { projectRoot, readProjectSources } from './smokeTestHarness.ts';

function runRollupCli(intakeDirs: readonly string[]) {
  const cliArgs = [
    'tsx',
    '.\\scripts\\agent-session-v3-pilot-real-corpus-batch-readiness-rollup-report.ts',
    ...intakeDirs.flatMap((intakeDir) => ['--dir', intakeDir]),
  ];

  return process.platform === 'win32'
    ? spawnSync('cmd.exe', ['/c', 'npx.cmd', ...cliArgs], {
      cwd: projectRoot,
      encoding: 'utf8',
    })
    : spawnSync('npx', cliArgs, {
      cwd: projectRoot,
      encoding: 'utf8',
    });
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
    reason: `${options.status} real corpus readiness rollup CLI sample`,
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

async function createMixedIntake(
  intakeDir: string,
  shadowExport: ReturnType<typeof createAgentSessionV3PilotShadowDebugExport>,
) {
  const intakeTemplate = await runAgentSessionV3PilotRealCorpusBatchIntakeTemplate({
    outDir: intakeDir,
    prettyJson: true,
  });
  await runAgentSessionV3PilotBaselineCorpusManifestReport({
    maxShadowDebugSamples: 3,
    outDir: path.join(intakeDir, 'baseline'),
    prettyJson: true,
  });

  const corpusDir = path.join(intakeDir, 'corpora');
  await mkdir(corpusDir, {
    recursive: true,
  });
  await writeFile(
    path.join(corpusDir, 'ready-corpus.json'),
    JSON.stringify(createCorpus('aligned', shadowExport)),
    'utf8',
  );
  await writeFile(
    path.join(corpusDir, 'mismatch-corpus.json'),
    JSON.stringify(createCorpus('mismatch', shadowExport)),
    'utf8',
  );

  assert.ok(intakeTemplate.manifestPath);
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
    }, null, 2),
    'utf8',
  );
}

const { rollupSource } = readProjectSources({
  rollupSource: 'scripts/agent-session-v3-pilot-real-corpus-batch-readiness-rollup-report.ts',
});

assert.match(
  rollupSource,
  /--dir/u,
  'real corpus batch readiness rollup CLI should expose repeated intake directory arguments.',
);
assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  rollupSource,
  'agent-session-v3-pilot-real-corpus-batch-readiness-rollup-report.ts CLI',
);

const rootTempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-real-corpus-batch-readiness-rollup-cli-'));
try {
  const shadowResult = await runAgentSessionV3PilotShadowMode({
    enabled: true,
    events: [
      {
        reason: 'begin real corpus readiness rollup CLI sample',
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
  const missingIntakeDir = path.join(rootTempDir, 'missing-intake');
  const mixedIntakeDir = path.join(rootTempDir, 'mixed-intake');

  await mkdir(missingIntakeDir, {
    recursive: true,
  });
  await createMixedIntake(mixedIntakeDir, shadowExport);

  const cliResult = runRollupCli([
    missingIntakeDir,
    mixedIntakeDir,
  ]);

  assert.equal(
    cliResult.status,
    0,
    cliResult.stderr || cliResult.stdout || cliResult.error?.message,
  );
  assert.match(cliResult.stdout, /AgentSessionV3PilotRealCorpusBatchReadinessRollupReport status=blocked/u);
  assert.match(cliResult.stdout, /intakes=2/u);
  assert.match(cliResult.stdout, /blocked=1/u);
  assert.match(cliResult.stdout, /reviewNeeded=1/u);
  assert.match(cliResult.stdout, /readyForManualReview=0/u);
  assert.match(cliResult.stdout, /intakeEntries:/u);
  assert.match(cliResult.stdout, /status=blocked .*validator=missing/u);
  assert.match(cliResult.stdout, /status=review-needed .*evidenceSummary=manual-review-needed .*validator=mixed/u);
  assert.match(cliResult.stdout, /metadata=review-needed/u);
  assert.match(cliResult.stdout, /checklistItemSummaries:/u);
  assert.match(cliResult.stdout, /id=gap-missing-required-files/u);
  assert.match(cliResult.stdout, /id=gap-index-mixed/u);
  assert.match(cliResult.stdout, /id=gap-note-incomplete/u);
  assert.match(cliResult.stdout, /id=metadata-quality-issue-samples/u);
  assert.match(cliResult.stdout, /id=runbook-manual-review/u);
  assert.doesNotMatch(cliResult.stdout, /"kind"\s*:\s*"agent-session-v3-pilot-real-corpus-batch-readiness-rollup-report"/u);
} finally {
  await rm(rootTempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch readiness rollup CLI smoke ok');
