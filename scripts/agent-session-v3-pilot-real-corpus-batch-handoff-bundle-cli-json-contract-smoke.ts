import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  assertNumberRecordKeys,
  assertObjectRecord,
  assertSourceDoesNotUseRuntimeOrFixedDesktopChain,
  parseTrailingJsonObject,
} from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import { runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample } from './agent-session-v3-pilot-real-corpus-batch-readiness-rollup-example.ts';
import { projectRoot, readProjectSources } from './smokeTestHarness.ts';

function runCli(args: readonly string[]) {
  return process.platform === 'win32'
    ? spawnSync('cmd.exe', ['/c', 'npx.cmd', 'tsx', ...args], {
      cwd: projectRoot,
      encoding: 'utf8',
    })
    : spawnSync('npx', ['tsx', ...args], {
      cwd: projectRoot,
      encoding: 'utf8',
    });
}

function assertStringValue(value: unknown, label: string) {
  assert.equal(typeof value, 'string', `${label} should be a string.`);
}

function assertStringArray(value: unknown, label: string) {
  assert.ok(Array.isArray(value), `${label} should be an array.`);
  for (const entry of value) {
    assert.equal(typeof entry, 'string', `${label} entries should be strings.`);
  }
}

function assertHandoffBundleContract(result: Record<string, unknown>) {
  assert.equal(result.kind, 'agent-session-v3-pilot-real-corpus-batch-handoff-bundle');
  assert.equal(result.version, 1);
  assertStringValue(result.outDir, 'outDir');
  assertStringValue(result.summaryText, 'summaryText');
  assertStringValue(result.readmePath, 'readmePath');
  assertStringValue(result.handoffManifestPath, 'handoffManifestPath');
  assertStringValue(result.indexJsonPath, 'indexJsonPath');
  assertStringValue(result.reviewSummaryReportPath, 'reviewSummaryReportPath');
  assertStringValue(result.reviewSummaryJsonPath, 'reviewSummaryJsonPath');
  assertStringValue(result.rollupReportPath, 'rollupReportPath');
  assertStringValue(result.rollupJsonPath, 'rollupJsonPath');
  assert.equal(result.sampleSource, 'real-exported');
  assert.equal(result.sampleSourceStatus, 'real-exported-evidence');

  const reviewSummary = assertObjectRecord(result.reviewSummary, 'reviewSummary');
  assert.equal(reviewSummary.kind, 'agent-session-v3-pilot-real-corpus-batch-review-summary');
  assert.equal(reviewSummary.status, 'blocked');
  assert.ok(Array.isArray(reviewSummary.intakeEntries), 'reviewSummary.intakeEntries should be an array.');
  assert.ok(
    (reviewSummary.intakeEntries as Record<string, unknown>[]).some((entry) => (
      assertObjectRecord(entry.phaseCoverageCounts, 'reviewSummary.intakeEntries.phaseCoverageCounts').status === 'clean'
    )),
    'reviewSummary should preserve phaseCoverageCounts on intake entries.',
  );

  const rollup = assertObjectRecord(result.rollup, 'rollup');
  assert.equal(rollup.kind, 'agent-session-v3-pilot-real-corpus-batch-readiness-rollup-report');
  assert.equal(rollup.status, 'blocked');
  assert.ok(Array.isArray(rollup.entries), 'rollup.entries should be an array.');
  assert.ok(
    (rollup.entries as Record<string, unknown>[]).some((entry) => (
      assertObjectRecord(entry.phaseCoverageCounts, 'rollup.entries.phaseCoverageCounts').status === 'clean'
    )),
    'rollup should preserve phaseCoverageCounts on entries.',
  );

  assert.ok(Array.isArray(result.checklistArtifacts), 'checklistArtifacts should be an array.');
  for (const artifact of result.checklistArtifacts as Record<string, unknown>[]) {
    assertStringValue(artifact.intakeDir, 'checklistArtifacts.intakeDir');
    assertStringValue(artifact.reportPath, 'checklistArtifacts.reportPath');
    assertStringValue(artifact.jsonPath, 'checklistArtifacts.jsonPath');
    assertStringValue(artifact.status, 'checklistArtifacts.status');
    assertStringValue(artifact.summaryText, 'checklistArtifacts.summaryText');
  }

  const index = assertObjectRecord(result.index, 'index');
  assert.equal(index.generatedBy, 'agent-session-v3-pilot-real-corpus-batch-handoff-bundle');
  assert.equal(index.version, 1);
  assert.equal(index.status, 'blocked');
  assertStringValue(index.readmePath, 'index.readmePath');
  assertStringValue(index.handoffManifestPath, 'index.handoffManifestPath');
  assertStringValue(index.guardrail, 'index.guardrail');
  assert.match(String(index.guardrail), /no threshold decision/u);
  assert.match(String(index.guardrail), /runtime authority/u);
  assert.equal(index.sampleSource, 'real-exported');
  assert.equal(index.sampleSourceStatus, 'real-exported-evidence');
  assertStringArray(index.reviewOrder, 'index.reviewOrder');
  assertStringArray(index.intakeDirs, 'index.intakeDirs');
  assertNumberRecordKeys(
    index.statusCounts,
    [
      'blocked',
      'readyForManualReview',
      'reviewNeeded',
    ],
    'index.statusCounts',
  );
  assert.ok(Array.isArray(index.checklistArtifacts), 'index.checklistArtifacts should be an array.');
}

const { bundleSource } = readProjectSources({
  bundleSource: 'scripts/agent-session-v3-pilot-real-corpus-batch-handoff-bundle.ts',
});

assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  bundleSource,
  'agent-session-v3-pilot-real-corpus-batch-handoff-bundle.ts CLI JSON contract',
);

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-handoff-bundle-json-contract-'));
try {
  const example = await runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample({
    outDir: path.join(tempDir, 'example'),
    prettyJson: true,
  });
  const outDir = path.join(tempDir, 'handoff');
  const cliResult = runCli([
    '.\\scripts\\agent-session-v3-pilot-real-corpus-batch-handoff-bundle.ts',
    '--out-dir',
    outDir,
    '--dir',
    example.intakeDirs.missing,
    '--dir',
    example.intakeDirs.mixed,
    '--dir',
    example.intakeDirs.ready,
    '--sample-source',
    'real-exported',
    '--pretty',
  ]);

  assert.equal(
    cliResult.status,
    0,
    cliResult.stderr || cliResult.stdout || cliResult.error?.message,
  );
  assert.match(cliResult.stdout, /AgentSessionV3PilotRealCorpusBatchHandoffBundle status=blocked/u);
  assert.match(cliResult.stdout, /readmePath=/u);
  assert.match(cliResult.stdout, /handoffManifestPath=/u);
  assert.match(cliResult.stdout, /indexJsonPath=/u);
  assert.match(cliResult.stdout, /sampleSource=real-exported/u);
  assert.match(cliResult.stdout, /sampleSourceStatus=real-exported-evidence/u);
  assert.match(cliResult.stdout, /reviewSummaryReportPath=/u);
  assert.match(cliResult.stdout, /readinessRollupReportPath=/u);
  assert.match(cliResult.stdout, /operatorChecklist status=blocked/u);
  assert.match(cliResult.stdout, /operatorChecklist status=review-needed/u);
  assert.match(cliResult.stdout, /operatorChecklist status=ready-for-manual-review/u);

  const result = parseTrailingJsonObject(cliResult.stdout);
  assertHandoffBundleContract(result);
  assert.equal(
    JSON.parse(await readFile(String(result.indexJsonPath), 'utf8')).status,
    'blocked',
  );
  assert.match(await readFile(String(result.readmePath), 'utf8'), /Review Order/u);
  assert.match(await readFile(String(result.readmePath), 'utf8'), /Declared sample source: real-exported/u);
  assert.match(await readFile(String(result.handoffManifestPath), 'utf8'), /operatorChecklists:/u);
  assert.match(await readFile(String(result.handoffManifestPath), 'utf8'), /sampleSourceStatus=real-exported-evidence/u);
  assert.equal(
    JSON.parse(await readFile(String(result.reviewSummaryJsonPath), 'utf8')).kind,
    'agent-session-v3-pilot-real-corpus-batch-review-summary',
  );
  const persistedReviewSummary = JSON.parse(await readFile(String(result.reviewSummaryJsonPath), 'utf8'));
  assert.ok(
    persistedReviewSummary.intakeEntries.some((entry: Record<string, unknown>) => (
      (entry.phaseCoverageCounts as Record<string, unknown> | undefined)?.status === 'clean'
    )),
  );
  const persistedRollup = JSON.parse(await readFile(String(result.rollupJsonPath), 'utf8'));
  assert.equal(
    persistedRollup.kind,
    'agent-session-v3-pilot-real-corpus-batch-readiness-rollup-report',
  );
  assert.ok(
    persistedRollup.entries.some((entry: Record<string, unknown>) => (
      (entry.phaseCoverageCounts as Record<string, unknown> | undefined)?.status === 'clean'
    )),
  );
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch handoff bundle CLI JSON contract smoke ok');
