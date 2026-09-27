import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  assertNumberRecordKeys,
  assertObjectRecord,
  assertSourceDoesNotUseRuntimeOrFixedDesktopChain,
  parseTrailingJsonObject,
} from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
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

function assertExampleContract(result: Record<string, unknown>) {
  assert.equal(result.kind, 'agent-session-v3-pilot-real-corpus-batch-readiness-rollup-example');
  assert.equal(result.version, 1);
  assertStringValue(result.outDir, 'outDir');
  assertStringValue(result.summaryText, 'summaryText');
  assertStringValue(result.reviewSummaryReportPath, 'reviewSummaryReportPath');
  assertStringValue(result.reviewSummaryJsonPath, 'reviewSummaryJsonPath');
  assertStringValue(result.rollupReportPath, 'rollupReportPath');
  assertStringValue(result.rollupJsonPath, 'rollupJsonPath');

  const intakeDirs = assertObjectRecord(result.intakeDirs, 'intakeDirs');
  assertStringValue(intakeDirs.missing, 'intakeDirs.missing');
  assertStringValue(intakeDirs.mixed, 'intakeDirs.mixed');
  assertStringValue(intakeDirs.ready, 'intakeDirs.ready');

  const rollup = assertObjectRecord(result.rollup, 'rollup');
  assert.equal(rollup.kind, 'agent-session-v3-pilot-real-corpus-batch-readiness-rollup-report');
  assert.equal(rollup.version, 1);
  assert.equal(rollup.status, 'blocked');
  assertNumberRecordKeys(
    rollup,
    [
      'intakeCount',
      'totalBlockerItems',
      'totalInfoItems',
      'totalReviewItems',
    ],
    'rollup',
  );
  assertNumberRecordKeys(
    rollup.statusCounts,
    [
      'blocked',
      'readyForManualReview',
      'reviewNeeded',
    ],
    'rollup.statusCounts',
  );
  assert.ok(Array.isArray(rollup.entries), 'rollup.entries should be an array.');
  assert.ok(Array.isArray(rollup.checklistItemSummaries), 'rollup.checklistItemSummaries should be an array.');

  const reviewSummary = assertObjectRecord(result.reviewSummary, 'reviewSummary');
  assert.equal(reviewSummary.kind, 'agent-session-v3-pilot-real-corpus-batch-review-summary');
  assert.equal(reviewSummary.version, 1);
  assert.equal(reviewSummary.status, 'blocked');
  assertNumberRecordKeys(
    reviewSummary,
    [
      'intakeCount',
      'totalBlockerItems',
      'totalReviewItems',
    ],
    'reviewSummary',
  );
  assertNumberRecordKeys(
    reviewSummary.statusCounts,
    [
      'blocked',
      'readyForManualReview',
      'reviewNeeded',
    ],
    'reviewSummary.statusCounts',
  );
  assert.ok(Array.isArray(reviewSummary.intakeEntries), 'reviewSummary.intakeEntries should be an array.');
  assert.ok(Array.isArray(reviewSummary.focusItems), 'reviewSummary.focusItems should be an array.');
}

const { exampleSource } = readProjectSources({
  exampleSource: 'scripts/agent-session-v3-pilot-real-corpus-batch-readiness-rollup-example.ts',
});

assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  exampleSource,
  'agent-session-v3-pilot-real-corpus-batch-readiness-rollup-example.ts CLI JSON contract',
);

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-readiness-rollup-example-json-contract-'));
try {
  const outDir = path.join(tempDir, 'example');
  const cliResult = runCli([
    '.\\scripts\\agent-session-v3-pilot-real-corpus-batch-readiness-rollup-example.ts',
    '--out-dir',
    outDir,
    '--pretty',
  ]);

  assert.equal(
    cliResult.status,
    0,
    cliResult.stderr || cliResult.stdout || cliResult.error?.message,
  );
  assert.match(cliResult.stdout, /AgentSessionV3PilotRealCorpusBatchReadinessRollupExample status=blocked/u);
  assert.match(cliResult.stdout, /missingIntakeDir=/u);
  assert.match(cliResult.stdout, /mixedIntakeDir=/u);
  assert.match(cliResult.stdout, /readyIntakeDir=/u);
  assert.match(cliResult.stdout, /reviewSummaryReportPath=/u);
  assert.match(cliResult.stdout, /reviewIntakes:/u);
  assert.match(cliResult.stdout, /reviewBoundary: summary-only evidence view/u);
  assert.match(cliResult.stdout, /checklistItemSummaries:/u);

  const result = parseTrailingJsonObject(cliResult.stdout);
  assertExampleContract(result);
  assert.deepEqual(
    (await readdir(outDir)).sort(),
    [
      'missing-intake',
      'mixed-intake',
      'readiness-rollup-report.json',
      'readiness-rollup-report.txt',
      'ready-intake',
      'review-summary-report.json',
      'review-summary-report.txt',
    ],
  );
  assert.equal(
    JSON.parse(await readFile(String(result.reviewSummaryJsonPath), 'utf8')).status,
    'blocked',
  );
  assert.equal(
    JSON.parse(await readFile(String(result.rollupJsonPath), 'utf8')).status,
    'blocked',
  );
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch readiness rollup example CLI JSON contract smoke ok');
