import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runAgentSessionV3PilotRealCorpusBatchIntakeTemplate } from './agent-session-v3-pilot-real-corpus-batch-intake-template.ts';
import { projectRoot, readProjectSources } from './smokeTestHarness.ts';

function runSchemaShapeCli(intakeDir: string) {
  const cliArgs = [
    'tsx',
    '.\\scripts\\agent-session-v3-pilot-real-corpus-batch-schema-shape-report.ts',
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

const { schemaShapeSource } = readProjectSources({
  schemaShapeSource: 'scripts/agent-session-v3-pilot-real-corpus-batch-schema-shape-report.ts',
});

assert.match(
  schemaShapeSource,
  /--dir/u,
  'real corpus batch schema-shape report CLI should expose an intake directory argument.',
);
assert.doesNotMatch(
  schemaShapeSource,
  /runAgentSessionV2|execute_desktop|observe_windows_and_apps|locate_screen_elements|buildAgentPermissionRoute|toolExecutor/u,
  'real corpus batch schema-shape report CLI should not know runtime execution, permissions, concrete tools, or tool execution.',
);
assert.doesNotMatch(
  schemaShapeSource,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'real corpus batch schema-shape report CLI should not encode a fixed desktop tool chain.',
);

const missingTempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-real-corpus-batch-schema-shape-cli-missing-'));
try {
  const missingCliResult = runSchemaShapeCli(missingTempDir);

  assert.equal(
    missingCliResult.status,
    0,
    missingCliResult.stderr || missingCliResult.stdout || missingCliResult.error?.message,
  );
  assert.match(missingCliResult.stdout, /AgentSessionV3PilotRealCorpusBatchSchemaShapeReport status=missing/u);
  assert.match(missingCliResult.stdout, /issues=2/u);
  assert.match(missingCliResult.stdout, /scope=manifest code=missing-required-file/u);
  assert.match(missingCliResult.stdout, /scope=index code=missing-required-file/u);
  assert.match(missingCliResult.stdout, /agent-session-v3-pilot-real-corpus-batch-schema-shape-report/u);
} finally {
  await rm(missingTempDir, {
    force: true,
    recursive: true,
  });
}

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-real-corpus-batch-schema-shape-cli-'));
try {
  const intakeTemplate = await runAgentSessionV3PilotRealCorpusBatchIntakeTemplate({
    outDir: tempDir,
    prettyJson: true,
  });

  const validCliResult = runSchemaShapeCli(tempDir);

  assert.equal(
    validCliResult.status,
    0,
    validCliResult.stderr || validCliResult.stdout || validCliResult.error?.message,
  );
  assert.match(validCliResult.stdout, /AgentSessionV3PilotRealCorpusBatchSchemaShapeReport status=valid/u);
  assert.match(validCliResult.stdout, /issues=0/u);
  assert.match(validCliResult.stdout, /manifestSources=1/u);
  assert.match(validCliResult.stdout, /indexBatches=2/u);
  assert.match(validCliResult.stdout, /schemaShapeIssues: none/u);

  assert.ok(intakeTemplate.manifestPath);
  await writeFile(
    intakeTemplate.manifestPath,
    JSON.stringify({
      ...intakeTemplate.manifest,
      sources: {
        bad: true,
      },
    }, null, 2),
    'utf8',
  );

  const issuesCliResult = runSchemaShapeCli(tempDir);

  assert.equal(
    issuesCliResult.status,
    0,
    issuesCliResult.stderr || issuesCliResult.stdout || issuesCliResult.error?.message,
  );
  assert.match(issuesCliResult.stdout, /AgentSessionV3PilotRealCorpusBatchSchemaShapeReport status=issues/u);
  assert.match(issuesCliResult.stdout, /scope=manifest code=invalid-array/u);
  assert.match(issuesCliResult.stdout, /agent-session-v3-pilot-real-corpus-batch-schema-shape-report/u);
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch schema shape report CLI smoke ok');
