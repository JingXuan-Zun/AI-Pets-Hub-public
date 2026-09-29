import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { projectRoot, readProjectSources } from './smokeTestHarness.ts';

const { intakeTemplateSource } = readProjectSources({
  intakeTemplateSource: 'scripts/agent-session-v3-pilot-real-corpus-batch-intake-template.ts',
});

assert.match(
  intakeTemplateSource,
  /--out-dir/u,
  'real corpus batch intake template CLI should expose an output directory argument.',
);
assert.doesNotMatch(
  intakeTemplateSource,
  /runAgentSessionV2|execute_desktop|observe_windows_and_apps|locate_screen_elements|buildAgentPermissionRoute|toolExecutor/u,
  'real corpus batch intake template CLI should not know runtime execution, permissions, concrete tools, or tool execution.',
);
assert.doesNotMatch(
  intakeTemplateSource,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'real corpus batch intake template CLI should not encode a fixed desktop tool chain.',
);

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-real-corpus-batch-intake-template-cli-'));
try {
  const cliArgs = [
    'tsx',
    '.\\scripts\\agent-session-v3-pilot-real-corpus-batch-intake-template.ts',
    '--out-dir',
    tempDir,
    '--pretty',
  ];
  const cliResult = process.platform === 'win32'
    ? spawnSync('cmd.exe', ['/c', 'npx.cmd', ...cliArgs], {
      cwd: projectRoot,
      encoding: 'utf8',
    })
    : spawnSync('npx', cliArgs, {
      cwd: projectRoot,
      encoding: 'utf8',
    });

  assert.equal(
    cliResult.status,
    0,
    cliResult.stderr || cliResult.stdout || cliResult.error?.message,
  );
  assert.equal(cliResult.error, undefined);
  assert.match(cliResult.stdout, /AgentSessionV3PilotRealCorpusBatchIntakeTemplate/u);
  assert.match(cliResult.stdout, /sources=1/u);
  assert.match(cliResult.stdout, /batches=2/u);
  assert.match(cliResult.stdout, /manifestPath=/u);
  assert.match(cliResult.stdout, /indexPath=/u);
  assert.match(cliResult.stdout, /notePath=/u);
  assert.match(cliResult.stdout, /readmePath=/u);
  assert.match(cliResult.stdout, /agent-session-v3-pilot-real-corpus-batch-intake-template/u);

  const manifestPath = path.join(tempDir, 'real-corpus-manifest.json');
  const indexPath = path.join(tempDir, 'corpus-batch-index.json');
  const notePath = path.join(tempDir, 'sample-note-template.md');
  const readmePath = path.join(tempDir, 'README.md');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const index = JSON.parse(await readFile(indexPath, 'utf8'));
  const noteText = await readFile(notePath, 'utf8');
  const readmeText = await readFile(readmePath, 'utf8');

  assert.equal(manifest.sources.length, 1);
  assert.equal(manifest.sources[0]?.label, 'replace-with-real-batch-label');
  assert.equal(manifest.sources[0]?.path, './corpora/replace-with-debug-corpus.json');
  assert.equal(manifest.thresholdProfiles.length, 3);
  assert.equal(index.batches.length, 2);
  assert.equal(index.batches[0]?.sourceKind, 'baseline');
  assert.equal(index.batches[1]?.sourceKind, 'production-like');
  assert.match(noteText, /Batch label: replace-with-real-batch-label/u);
  assert.match(noteText, /Sample source: replace-with-sample-source-real-exported-rehearsal-or-unknown/u);
  assert.match(noteText, /Sample source status: replace-with-sample-source-status/u);
  assert.match(noteText, /Approximate sample count/u);
  assert.match(noteText, /Validator status/u);
  assert.match(noteText, /Failed readiness checks/u);
  assert.match(noteText, /Threshold profile comparison needed/u);
  assert.match(noteText, /P0 Target Signals/u);
  assert.match(noteText, /replace-with-p0-intake-dir/u);
  assert.match(noteText, /replace-with-real-production-like-sample-signal/u);
  assert.match(noteText, /replace-with-real-exported-corpus-signal/u);
  assert.match(readmeText, /Preferred report-only validation from the project root/u);
  assert.match(readmeText, /sample-note-template\.md/u);
  assert.match(readmeText, /agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report\.ts/u);
  assert.match(readmeText, /agent-session-v3-pilot-real-corpus-batch-operator-checklist-report\.ts/u);
  assert.match(readmeText, /agent-session-v3-pilot-real-corpus-batch-evidence-summary\.ts/u);
  assert.match(readmeText, /agent-session-v3-pilot-real-corpus-batch-intake-validator\.ts/u);
  assert.match(readmeText, /agent-session-v3-pilot-real-corpus-batch-source-declaration-preflight\.ts/u);
  assert.match(readmeText, /--dir \.\\replace-with-intake-dir --expected-source real-exported --pretty/u);
  assert.match(readmeText, /agent-session-v3-pilot-real-corpus-batch-schema-shape-report\.ts/u);
  assert.match(readmeText, /agent-session-v3-pilot-real-corpus-batch-path-health-report\.ts/u);
  assert.match(readmeText, /agent-session-v3-pilot-real-corpus-batch-consistency-report\.ts/u);
  assert.match(readmeText, /PROJECT_AGENT_V3_REAL_CORPUS_BATCH_RUNBOOK\.md/u);
  assert.match(readmeText, /P0 target signal meaning/u);
  assert.match(readmeText, /`ready-for-manual-review`: supporting intake evidence has no machine-detected blocker or review item/u);
  assert.match(readmeText, /Operator checklist status meaning/u);
  assert.match(readmeText, /ready-for-manual-review/u);
  assert.match(readmeText, /Validator status meaning/u);
  assert.match(readmeText, /Evidence summary status meaning/u);
  assert.match(readmeText, /manual-review-ready/u);
  assert.match(readmeText, /`not-ready`: at least one indexed report has failed readiness checks/u);
  assert.match(readmeText, /Do not treat this template as production readiness/u);

  assert.deepEqual(
    (await readdir(tempDir)).sort(),
    [
      'README.md',
      'corpus-batch-index.json',
      'real-corpus-manifest.json',
      'sample-note-template.md',
    ],
  );
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch intake template CLI smoke ok');
