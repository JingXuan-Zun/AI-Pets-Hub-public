import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runAgentSessionV3PilotRealCorpusBatchIntakeTemplate } from './agent-session-v3-pilot-real-corpus-batch-intake-template.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const { intakeTemplateSource } = readProjectSources({
  intakeTemplateSource: 'scripts/agent-session-v3-pilot-real-corpus-batch-intake-template.ts',
});

assert.match(
  intakeTemplateSource,
  /export async function runAgentSessionV3PilotRealCorpusBatchIntakeTemplate/u,
  'real corpus batch intake template should expose a caller-owned runner.',
);
assert.doesNotMatch(
  intakeTemplateSource,
  /runAgentSessionV2|execute_desktop|observe_windows_and_apps|locate_screen_elements|buildAgentPermissionRoute|toolExecutor/u,
  'real corpus batch intake template should not know runtime execution, permissions, concrete tools, or tool execution.',
);
assert.doesNotMatch(
  intakeTemplateSource,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'real corpus batch intake template should not encode a fixed desktop tool chain.',
);

const compactTemplate = await runAgentSessionV3PilotRealCorpusBatchIntakeTemplate();

assert.equal(compactTemplate.kind, 'agent-session-v3-pilot-real-corpus-batch-intake-template');
assert.equal(compactTemplate.version, 1);
assert.equal(compactTemplate.manifestPath, null);
assert.equal(compactTemplate.indexPath, null);
assert.equal(compactTemplate.notePath, null);
assert.equal(compactTemplate.readmePath, null);
assert.equal(compactTemplate.jsonText, null);
assert.equal(compactTemplate.manifest.sources?.length, 1);
assert.equal(compactTemplate.manifest.sources?.[0]?.label, 'replace-with-real-batch-label');
assert.equal(compactTemplate.manifest.sources?.[0]?.path, './corpora/replace-with-debug-corpus.json');
assert.equal(compactTemplate.manifest.thresholdProfiles?.length, 3);
assert.equal(compactTemplate.index.batches?.length, 2);
assert.deepEqual(
  compactTemplate.index.batches?.map((batch) => batch.sourceKind),
  ['baseline', 'production-like'],
);
assert.deepEqual(
  compactTemplate.index.batches?.map((batch) => batch.manifestPath),
  ['./baseline/explicit-debug-corpus-manifest.json', './real-corpus-manifest.json'],
);
assert.match(compactTemplate.summaryText, /sources=1/u);
assert.match(compactTemplate.summaryText, /batches=2/u);
assert.match(compactTemplate.readmeText, /Preferred report-only validation/u);
assert.match(compactTemplate.readmeText, /sample-note-template\.md/u);
assert.match(compactTemplate.readmeText, /agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report\.ts/u);
assert.match(compactTemplate.readmeText, /agent-session-v3-pilot-real-corpus-batch-operator-checklist-report\.ts/u);
assert.match(compactTemplate.readmeText, /agent-session-v3-pilot-real-corpus-batch-evidence-summary\.ts/u);
assert.match(compactTemplate.readmeText, /agent-session-v3-pilot-real-corpus-batch-intake-validator\.ts/u);
assert.match(compactTemplate.readmeText, /agent-session-v3-pilot-real-corpus-batch-source-declaration-preflight\.ts/u);
assert.match(compactTemplate.readmeText, /--dir \.\\replace-with-intake-dir --expected-source real-exported --pretty/u);
assert.match(compactTemplate.readmeText, /agent-session-v3-pilot-real-corpus-batch-schema-shape-report\.ts/u);
assert.match(compactTemplate.readmeText, /agent-session-v3-pilot-real-corpus-batch-path-health-report\.ts/u);
assert.match(compactTemplate.readmeText, /agent-session-v3-pilot-real-corpus-batch-consistency-report\.ts/u);
assert.match(compactTemplate.readmeText, /PROJECT_AGENT_V3_REAL_CORPUS_BATCH_RUNBOOK\.md/u);
assert.match(compactTemplate.readmeText, /P0 target signal meaning/u);
assert.match(compactTemplate.readmeText, /`missing`: no supplied intake currently supports that P0 evidence target/u);
assert.match(compactTemplate.readmeText, /`blocked`: at least one supplied supporting intake has blocker evidence/u);
assert.match(compactTemplate.readmeText, /Operator checklist status meaning/u);
assert.match(compactTemplate.readmeText, /ready-for-manual-review/u);
assert.match(compactTemplate.readmeText, /Validator status meaning/u);
assert.match(compactTemplate.readmeText, /Evidence summary status meaning/u);
assert.match(compactTemplate.readmeText, /manual-review-needed/u);
assert.match(compactTemplate.readmeText, /`mixed`: at least one batch is ready/u);
assert.match(compactTemplate.readmeText, /Do not treat this template as production readiness/u);
assert.match(compactTemplate.noteText, /Batch label: replace-with-real-batch-label/u);
assert.match(compactTemplate.noteText, /Sample source: replace-with-sample-source-real-exported-rehearsal-or-unknown/u);
assert.match(compactTemplate.noteText, /Sample source status: replace-with-sample-source-status/u);
assert.match(compactTemplate.noteText, /Approximate sample count/u);
assert.match(compactTemplate.noteText, /Validator status/u);
assert.match(compactTemplate.noteText, /Failed readiness checks/u);
assert.match(compactTemplate.noteText, /Threshold profile comparison needed/u);
assert.match(compactTemplate.noteText, /P0 Target Signals/u);
assert.match(compactTemplate.noteText, /replace-with-p0-intake-dir/u);
assert.match(compactTemplate.noteText, /replace-with-real-production-like-sample-signal/u);
assert.match(compactTemplate.noteText, /replace-with-real-exported-corpus-signal/u);
assert.match(compactTemplate.noteText, /This note does not make v3 production-ready/u);

const jsonTemplate = await runAgentSessionV3PilotRealCorpusBatchIntakeTemplate({
  includeJsonText: true,
  prettyJson: true,
});

assert.ok(jsonTemplate.jsonText);
assert.match(jsonTemplate.jsonText, /\n/u);
assert.match(jsonTemplate.jsonText, /agent-session-v3-pilot-real-corpus-batch-intake-template/u);

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-real-corpus-batch-intake-template-'));
try {
  const writtenTemplate = await runAgentSessionV3PilotRealCorpusBatchIntakeTemplate({
    outDir: tempDir,
    prettyJson: true,
  });

  assert.equal(writtenTemplate.manifestPath, path.join(tempDir, 'real-corpus-manifest.json'));
  assert.equal(writtenTemplate.indexPath, path.join(tempDir, 'corpus-batch-index.json'));
  assert.equal(writtenTemplate.notePath, path.join(tempDir, 'sample-note-template.md'));
  assert.equal(writtenTemplate.readmePath, path.join(tempDir, 'README.md'));
  assert.equal(writtenTemplate.jsonText, null);

  const writtenManifest = JSON.parse(await readFile(writtenTemplate.manifestPath, 'utf8'));
  assert.deepEqual(writtenManifest, writtenTemplate.manifest);
  assert.equal(writtenManifest.sources[0]?.path, './corpora/replace-with-debug-corpus.json');
  assert.equal(writtenManifest.thresholdProfiles.length, 3);

  const writtenIndex = JSON.parse(await readFile(writtenTemplate.indexPath, 'utf8'));
  assert.deepEqual(writtenIndex, writtenTemplate.index);
  assert.equal(writtenIndex.batches[1]?.sourceKind, 'production-like');

  const writtenNote = await readFile(writtenTemplate.notePath, 'utf8');
  assert.equal(writtenNote, writtenTemplate.noteText);
  assert.match(writtenNote, /Corpus file paths/u);
  assert.match(writtenNote, /Sample source: replace-with-sample-source-real-exported-rehearsal-or-unknown/u);
  assert.match(writtenNote, /Sample source status: replace-with-sample-source-status/u);
  assert.match(writtenNote, /Threshold action/u);
  assert.match(writtenNote, /P0 Target Signals/u);
  assert.match(writtenNote, /replace-with-real-production-like-sample-signal/u);
  assert.match(writtenNote, /replace-with-real-exported-corpus-signal/u);

  const writtenReadme = await readFile(writtenTemplate.readmePath, 'utf8');
  assert.equal(writtenReadme, writtenTemplate.readmeText);
  assert.match(writtenReadme, /caller-owned/u);
  assert.match(writtenReadme, /agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report\.ts/u);
  assert.match(writtenReadme, /agent-session-v3-pilot-real-corpus-batch-operator-checklist-report\.ts/u);
  assert.match(writtenReadme, /agent-session-v3-pilot-real-corpus-batch-evidence-summary\.ts/u);
  assert.match(writtenReadme, /agent-session-v3-pilot-real-corpus-batch-source-declaration-preflight\.ts/u);
  assert.match(writtenReadme, /--dir \.\\replace-with-intake-dir --expected-source real-exported --pretty/u);
  assert.match(writtenReadme, /--dir \.\\replace-with-intake-dir --pretty/u);
  assert.match(writtenReadme, /agent-session-v3-pilot-real-corpus-batch-consistency-report\.ts/u);
  assert.match(writtenReadme, /P0 target signal meaning/u);

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

console.log('agent session v3 pilot real corpus batch intake template smoke ok');
