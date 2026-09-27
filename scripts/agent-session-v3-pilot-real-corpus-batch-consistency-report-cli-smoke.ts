import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runAgentSessionV3PilotRealCorpusBatchIntakeTemplate } from './agent-session-v3-pilot-real-corpus-batch-intake-template.ts';
import { projectRoot, readProjectSources } from './smokeTestHarness.ts';

function runConsistencyCli(intakeDir: string) {
  const cliArgs = [
    'tsx',
    '.\\scripts\\agent-session-v3-pilot-real-corpus-batch-consistency-report.ts',
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

const { consistencySource } = readProjectSources({
  consistencySource: 'scripts/agent-session-v3-pilot-real-corpus-batch-consistency-report.ts',
});

assert.match(
  consistencySource,
  /--dir/u,
  'real corpus batch consistency report CLI should expose an intake directory argument.',
);
assert.doesNotMatch(
  consistencySource,
  /runAgentSessionV2|execute_desktop|observe_windows_and_apps|locate_screen_elements|buildAgentPermissionRoute|toolExecutor/u,
  'real corpus batch consistency report CLI should not know runtime execution, permissions, concrete tools, or tool execution.',
);
assert.doesNotMatch(
  consistencySource,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'real corpus batch consistency report CLI should not encode a fixed desktop tool chain.',
);

const missingTempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-real-corpus-batch-consistency-cli-missing-'));
try {
  const missingCliResult = runConsistencyCli(missingTempDir);

  assert.equal(
    missingCliResult.status,
    0,
    missingCliResult.stderr || missingCliResult.stdout || missingCliResult.error?.message,
  );
  assert.match(missingCliResult.stdout, /AgentSessionV3PilotRealCorpusBatchConsistencyReport status=missing/u);
  assert.match(missingCliResult.stdout, /issues=2/u);
  assert.match(missingCliResult.stdout, /baseline=no/u);
  assert.match(missingCliResult.stdout, /realManifest=no/u);
  assert.match(missingCliResult.stdout, /consistencyIssues:/u);
  assert.match(missingCliResult.stdout, /agent-session-v3-pilot-real-corpus-batch-consistency-report/u);
} finally {
  await rm(missingTempDir, {
    force: true,
    recursive: true,
  });
}

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-real-corpus-batch-consistency-cli-'));
try {
  const intakeTemplate = await runAgentSessionV3PilotRealCorpusBatchIntakeTemplate({
    outDir: tempDir,
    prettyJson: true,
  });

  const consistentCliResult = runConsistencyCli(tempDir);

  assert.equal(
    consistentCliResult.status,
    0,
    consistentCliResult.stderr || consistentCliResult.stdout || consistentCliResult.error?.message,
  );
  assert.match(consistentCliResult.stdout, /AgentSessionV3PilotRealCorpusBatchConsistencyReport status=consistent/u);
  assert.match(consistentCliResult.stdout, /issues=0/u);
  assert.match(consistentCliResult.stdout, /baseline=yes/u);
  assert.match(consistentCliResult.stdout, /realManifest=yes/u);
  assert.match(consistentCliResult.stdout, /sourceKinds=baseline:1,production-like:1/u);
  assert.match(consistentCliResult.stdout, /consistencyIssues: none/u);
  assert.match(consistentCliResult.stdout, /agent-session-v3-pilot-real-corpus-batch-consistency-report/u);

  assert.ok(intakeTemplate.indexPath);
  await writeFile(
    intakeTemplate.indexPath,
    JSON.stringify({
      ...intakeTemplate.index,
      batches: [
        {
          label: 'baseline-wrong-target',
          manifestPath: './real-corpus-manifest.json',
          sourceKind: 'baseline',
        },
      ],
    }, null, 2),
    'utf8',
  );

  const issuesCliResult = runConsistencyCli(tempDir);

  assert.equal(
    issuesCliResult.status,
    0,
    issuesCliResult.stderr || issuesCliResult.stdout || issuesCliResult.error?.message,
  );
  assert.match(issuesCliResult.stdout, /AgentSessionV3PilotRealCorpusBatchConsistencyReport status=issues/u);
  assert.match(issuesCliResult.stdout, /code=baseline-points-to-real-manifest/u);
  assert.match(issuesCliResult.stdout, /agent-session-v3-pilot-real-corpus-batch-consistency-report/u);
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch consistency report CLI smoke ok');
