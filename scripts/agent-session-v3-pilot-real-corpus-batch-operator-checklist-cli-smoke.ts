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
import { runAgentSessionV3PilotRealCorpusBatchIntakeTemplate } from './agent-session-v3-pilot-real-corpus-batch-intake-template.ts';
import { projectRoot, readProjectSources } from './smokeTestHarness.ts';

function runOperatorChecklistCli(intakeDir: string) {
  const cliArgs = [
    'tsx',
    '.\\scripts\\agent-session-v3-pilot-real-corpus-batch-operator-checklist-report.ts',
    '--dir',
    intakeDir,
    '--pretty',
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
    reason: `${options.status} real corpus operator checklist CLI sample`,
    status: options.status,
    v2Status: options.v2Status,
  };
}

const { checklistSource } = readProjectSources({
  checklistSource: 'scripts/agent-session-v3-pilot-real-corpus-batch-operator-checklist-report.ts',
});

assert.match(
  checklistSource,
  /--dir/u,
  'real corpus batch operator checklist CLI should expose an intake directory argument.',
);
assert.doesNotMatch(
  checklistSource,
  /runAgentSessionV2|execute_desktop|observe_windows_and_apps|locate_screen_elements|buildAgentPermissionRoute|toolExecutor/u,
  'real corpus batch operator checklist CLI should not know runtime execution, permissions, concrete tools, or tool execution.',
);
assert.doesNotMatch(
  checklistSource,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'real corpus batch operator checklist CLI should not encode a fixed desktop tool chain.',
);

const missingTempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-real-corpus-batch-operator-checklist-cli-missing-'));
try {
  const missingCliResult = runOperatorChecklistCli(missingTempDir);

  assert.equal(
    missingCliResult.status,
    0,
    missingCliResult.stderr || missingCliResult.stdout || missingCliResult.error?.message,
  );
  assert.match(missingCliResult.stdout, /AgentSessionV3PilotRealCorpusBatchOperatorChecklistReport status=blocked/u);
  assert.match(missingCliResult.stdout, /evidenceSummary=blocked/u);
  assert.match(missingCliResult.stdout, /validator=missing/u);
  assert.match(missingCliResult.stdout, /operatorChecklist:/u);
  assert.match(missingCliResult.stdout, /id=gap-missing-required-files/u);
  assert.match(missingCliResult.stdout, /id=gap-schema-issues/u);
  assert.match(missingCliResult.stdout, /id=gap-path-issues/u);
  assert.match(missingCliResult.stdout, /id=gap-consistency-issues/u);
  assert.match(missingCliResult.stdout, /id=metadata-quality-issue-samples/u);
  assert.match(missingCliResult.stdout, /id=runbook-manual-review/u);
  assert.match(missingCliResult.stdout, /PROJECT_AGENT_V3_REAL_CORPUS_BATCH_RUNBOOK\.md/u);
  assert.match(missingCliResult.stdout, /agent-session-v3-pilot-real-corpus-batch-evidence-summary/u);
} finally {
  await rm(missingTempDir, {
    force: true,
    recursive: true,
  });
}

const shadowResult = await runAgentSessionV3PilotShadowMode({
  enabled: true,
  events: [
    {
      reason: 'begin real corpus operator checklist CLI sample',
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

function createCorpus(status: AgentSessionV3PilotShadowAgreement['status']) {
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

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-real-corpus-batch-operator-checklist-cli-'));
try {
  const intakeTemplate = await runAgentSessionV3PilotRealCorpusBatchIntakeTemplate({
    outDir: tempDir,
    prettyJson: true,
  });
  await runAgentSessionV3PilotBaselineCorpusManifestReport({
    maxShadowDebugSamples: 3,
    outDir: path.join(tempDir, 'baseline'),
    prettyJson: true,
  });

  const corpusDir = path.join(tempDir, 'corpora');
  await mkdir(corpusDir, {
    recursive: true,
  });
  await writeFile(
    path.join(corpusDir, 'ready-corpus.json'),
    JSON.stringify(createCorpus('aligned')),
    'utf8',
  );
  await writeFile(
    path.join(corpusDir, 'mismatch-corpus.json'),
    JSON.stringify(createCorpus('mismatch')),
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

  const cliResult = runOperatorChecklistCli(tempDir);

  assert.equal(
    cliResult.status,
    0,
    cliResult.stderr || cliResult.stdout || cliResult.error?.message,
  );
  assert.match(cliResult.stdout, /AgentSessionV3PilotRealCorpusBatchOperatorChecklistReport status=review-needed/u);
  assert.match(cliResult.stdout, /evidenceSummary=manual-review-needed/u);
  assert.match(cliResult.stdout, /validator=mixed/u);
  assert.match(cliResult.stdout, /metadata=review-needed/u);
  assert.match(cliResult.stdout, /id=gap-index-mixed/u);
  assert.match(cliResult.stdout, /id=gap-note-incomplete/u);
  assert.match(cliResult.stdout, /id=gap-metadata-quality-review/u);
  assert.match(cliResult.stdout, /id=metadata-quality-issue-samples/u);
  assert.match(cliResult.stdout, /id=evidence-summary-status/u);
  assert.match(cliResult.stdout, /id=runbook-manual-review/u);
  assert.match(cliResult.stdout, /AgentSessionV3PilotRealCorpusBatchEvidenceSummary status=manual-review-needed/u);
  assert.match(cliResult.stdout, /agent-session-v3-pilot-real-corpus-batch-evidence-summary/u);
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch operator checklist CLI smoke ok');
