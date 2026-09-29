import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runAgentSessionV3PilotRealCorpusBatchIntakeTemplate } from './agent-session-v3-pilot-real-corpus-batch-intake-template.ts';
import { projectRoot, readProjectSources } from './smokeTestHarness.ts';

function runValidatorCli(intakeDir: string) {
  const cliArgs = [
    'tsx',
    '.\\scripts\\agent-session-v3-pilot-real-corpus-batch-intake-validator.ts',
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

const { selfCheckSource } = readProjectSources({
  selfCheckSource: 'scripts/agent-session-v3-pilot-real-corpus-batch-intake-self-check-smoke.ts',
});
const forbiddenRuntimeTerms = [
  'run' + 'AgentSessionV2',
  'execute' + '_desktop',
  'observe' + '_windows_and_apps',
  'locate' + '_screen_elements',
  'build' + 'AgentPermissionRoute',
  'tool' + 'Executor',
].join('|');
const forbiddenFixedChain = [
  'observe' + '_windows_and_apps',
  '\\s*->\\s*',
  'locate' + '_screen_elements',
  '\\s*->\\s*',
  'execute' + '_desktop_sequence',
].join('');

assert.doesNotMatch(
  selfCheckSource,
  new RegExp(forbiddenRuntimeTerms, 'u'),
  'real corpus batch intake self-check smoke should not know runtime execution, permissions, concrete tools, or tool execution.',
);
assert.doesNotMatch(
  selfCheckSource,
  new RegExp(forbiddenFixedChain, 'iu'),
  'real corpus batch intake self-check smoke should not encode a fixed desktop tool chain.',
);

const missingTempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-real-corpus-batch-intake-self-check-missing-'));
try {
  const missingCliResult = runValidatorCli(missingTempDir);

  assert.equal(
    missingCliResult.status,
    0,
    missingCliResult.stderr || missingCliResult.stdout || missingCliResult.error?.message,
  );
  assert.match(missingCliResult.stdout, /AgentSessionV3PilotRealCorpusBatchIntakeValidator status=missing/u);
  assert.match(missingCliResult.stdout, /missing=2/u);
  assert.match(missingCliResult.stdout, /notePresent=no/u);
  assert.match(missingCliResult.stdout, /missingPaths:/u);
  assert.match(missingCliResult.stdout, /sampleNote: missing/u);
  assert.match(missingCliResult.stdout, /real-corpus-manifest\.json/u);
  assert.match(missingCliResult.stdout, /corpus-batch-index\.json/u);
  assert.match(missingCliResult.stdout, /agent-session-v3-pilot-real-corpus-batch-intake-validator/u);
} finally {
  await rm(missingTempDir, {
    force: true,
    recursive: true,
  });
}

const emptyTempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-real-corpus-batch-intake-self-check-empty-'));
try {
  const intakeTemplate = await runAgentSessionV3PilotRealCorpusBatchIntakeTemplate({
    outDir: emptyTempDir,
    prettyJson: true,
  });

  assert.ok(intakeTemplate.manifestPath);
  assert.ok(intakeTemplate.indexPath);
  assert.ok(intakeTemplate.notePath);
  assert.ok(intakeTemplate.readmePath);

  const noteText = await readFile(intakeTemplate.notePath, 'utf8');
  assert.match(noteText, /Batch label: replace-with-real-batch-label/u);
  assert.match(noteText, /Source environment/u);
  assert.match(noteText, /Approximate sample count/u);
  assert.match(noteText, /Validator status/u);
  assert.match(noteText, /Failed readiness checks/u);
  assert.match(noteText, /Threshold profile comparison needed/u);
  assert.match(noteText, /P0 Target Signals/u);
  assert.match(noteText, /replace-with-p0-intake-dir/u);
  assert.match(noteText, /replace-with-real-production-like-sample-signal/u);
  assert.match(noteText, /replace-with-real-exported-corpus-signal/u);

  const readmeText = await readFile(intakeTemplate.readmePath, 'utf8');
  assert.match(readmeText, /Preferred report-only validation from the project root/u);
  assert.match(readmeText, /sample-note-template\.md/u);
  assert.match(readmeText, /agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report\.ts/u);
  assert.match(readmeText, /agent-session-v3-pilot-real-corpus-batch-operator-checklist-report\.ts/u);
  assert.match(readmeText, /agent-session-v3-pilot-real-corpus-batch-evidence-summary\.ts/u);
  assert.match(readmeText, /agent-session-v3-pilot-real-corpus-batch-intake-validator\.ts/u);
  assert.match(readmeText, /--dir \.\\replace-with-intake-dir --pretty/u);
  assert.match(readmeText, /P0 target signal meaning/u);
  assert.match(readmeText, /`missing`: no supplied intake currently supports that P0 evidence target/u);
  assert.match(readmeText, /Operator checklist status meaning/u);
  assert.match(readmeText, /ready-for-manual-review/u);
  assert.match(readmeText, /Validator status meaning/u);
  assert.match(readmeText, /Evidence summary status meaning/u);
  assert.match(readmeText, /`missing`: required manifest or index files are absent/u);
  assert.match(readmeText, /`empty`: the manifest or index exists but has no usable evidence entries/u);
  assert.match(readmeText, /PROJECT_AGENT_V3_REAL_CORPUS_BATCH_RUNBOOK\.md/u);

  await writeFile(
    intakeTemplate.manifestPath,
    JSON.stringify({
      ...intakeTemplate.manifest,
      sources: [],
    }, null, 2),
    'utf8',
  );
  await writeFile(
    intakeTemplate.indexPath,
    JSON.stringify({
      ...intakeTemplate.index,
      batches: [],
    }, null, 2),
    'utf8',
  );

  const emptyCliResult = runValidatorCli(emptyTempDir);

  assert.equal(
    emptyCliResult.status,
    0,
    emptyCliResult.stderr || emptyCliResult.stdout || emptyCliResult.error?.message,
  );
  assert.match(emptyCliResult.stdout, /AgentSessionV3PilotRealCorpusBatchIntakeValidator status=not-ready/u);
  assert.match(emptyCliResult.stdout, /missing=0/u);
  assert.match(emptyCliResult.stdout, /notePresent=yes/u);
  assert.match(emptyCliResult.stdout, /consistency=issues/u);
  assert.match(emptyCliResult.stdout, /consistencyIssues=2/u);
  assert.match(emptyCliResult.stdout, /manifestSources=0/u);
  assert.match(emptyCliResult.stdout, /indexManifests=0/u);
  assert.match(emptyCliResult.stdout, /missingPaths: none/u);
  assert.match(emptyCliResult.stdout, /sampleNote: present/u);
  assert.match(emptyCliResult.stdout, /AgentSessionV3PilotRealCorpusBatchConsistencyReport status=issues/u);
  assert.match(emptyCliResult.stdout, /code=missing-baseline-entry/u);
  assert.match(emptyCliResult.stdout, /code=missing-real-manifest-entry/u);
  assert.match(emptyCliResult.stdout, /manifestReport: unavailable/u);
  assert.match(emptyCliResult.stdout, /indexReport: unavailable/u);
  assert.match(emptyCliResult.stdout, /agent-session-v3-pilot-real-corpus-batch-intake-validator/u);
} finally {
  await rm(emptyTempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch intake self-check smoke ok');
