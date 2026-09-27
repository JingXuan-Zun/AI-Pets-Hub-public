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

function runPathHealthCli(intakeDir: string) {
  const cliArgs = [
    'tsx',
    '.\\scripts\\agent-session-v3-pilot-real-corpus-batch-path-health-report.ts',
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
    reason: `${options.status} real corpus path health CLI sample`,
    status: options.status,
    v2Status: options.v2Status,
  };
}

const { pathHealthSource } = readProjectSources({
  pathHealthSource: 'scripts/agent-session-v3-pilot-real-corpus-batch-path-health-report.ts',
});

assert.match(
  pathHealthSource,
  /--dir/u,
  'real corpus batch path-health report CLI should expose an intake directory argument.',
);
assert.doesNotMatch(
  pathHealthSource,
  /runAgentSessionV2|execute_desktop|observe_windows_and_apps|locate_screen_elements|buildAgentPermissionRoute|toolExecutor/u,
  'real corpus batch path-health report CLI should not know runtime execution, permissions, concrete tools, or tool execution.',
);
assert.doesNotMatch(
  pathHealthSource,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'real corpus batch path-health report CLI should not encode a fixed desktop tool chain.',
);

const missingTempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-real-corpus-batch-path-health-cli-missing-'));
try {
  const missingCliResult = runPathHealthCli(missingTempDir);

  assert.equal(
    missingCliResult.status,
    0,
    missingCliResult.stderr || missingCliResult.stdout || missingCliResult.error?.message,
  );
  assert.match(missingCliResult.stdout, /AgentSessionV3PilotRealCorpusBatchPathHealthReport status=missing/u);
  assert.match(missingCliResult.stdout, /issues=2/u);
  assert.match(missingCliResult.stdout, /scope=required status=missing label=real-corpus-manifest/u);
  assert.match(missingCliResult.stdout, /scope=required status=missing label=corpus-batch-index/u);
  assert.match(missingCliResult.stdout, /agent-session-v3-pilot-real-corpus-batch-path-health-report/u);
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
      reason: 'begin real corpus path health CLI sample',
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

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-real-corpus-batch-path-health-cli-'));
try {
  const intakeTemplate = await runAgentSessionV3PilotRealCorpusBatchIntakeTemplate({
    outDir: tempDir,
    prettyJson: true,
  });

  const templateCliResult = runPathHealthCli(tempDir);

  assert.equal(
    templateCliResult.status,
    0,
    templateCliResult.stderr || templateCliResult.stdout || templateCliResult.error?.message,
  );
  assert.match(templateCliResult.stdout, /AgentSessionV3PilotRealCorpusBatchPathHealthReport status=issues/u);
  assert.match(templateCliResult.stdout, /manifestSources=1/u);
  assert.match(templateCliResult.stdout, /indexManifests=2/u);
  assert.match(templateCliResult.stdout, /scope=manifest-source status=missing/u);
  assert.match(templateCliResult.stdout, /scope=index-manifest status=missing/u);

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
      ],
    }, null, 2),
    'utf8',
  );

  const healthyCliResult = runPathHealthCli(tempDir);

  assert.equal(
    healthyCliResult.status,
    0,
    healthyCliResult.stderr || healthyCliResult.stdout || healthyCliResult.error?.message,
  );
  assert.match(healthyCliResult.stdout, /AgentSessionV3PilotRealCorpusBatchPathHealthReport status=healthy/u);
  assert.match(healthyCliResult.stdout, /issues=0/u);
  assert.match(healthyCliResult.stdout, /pathHealthIssues: none/u);
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch path health report CLI smoke ok');
