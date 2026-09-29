import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { assertSourceDoesNotUseRuntimeOrFixedDesktopChain } from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import { runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample } from './agent-session-v3-pilot-real-corpus-batch-readiness-rollup-example.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const { exampleSource } = readProjectSources({
  exampleSource: 'scripts/agent-session-v3-pilot-real-corpus-batch-readiness-rollup-example.ts',
});

assert.match(
  exampleSource,
  /export async function runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample/u,
  'readiness rollup example should expose a caller-owned runner.',
);
assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  exampleSource,
  'agent-session-v3-pilot-real-corpus-batch-readiness-rollup-example.ts',
);

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-readiness-rollup-example-'));
try {
  const result = await runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample({
    includeJsonText: true,
    outDir: tempDir,
    prettyJson: true,
  });

  assert.equal(result.kind, 'agent-session-v3-pilot-real-corpus-batch-readiness-rollup-example');
  assert.equal(result.version, 1);
  assert.equal(result.outDir, path.resolve(tempDir));
  assert.equal(result.rollup.status, 'blocked');
  assert.equal(result.rollup.intakeCount, 3);
  assert.deepEqual(result.rollup.statusCounts, {
    blocked: 1,
    readyForManualReview: 1,
    reviewNeeded: 1,
  });
  assert.match(result.summaryText, /status=blocked/u);
  assert.match(result.summaryText, /intakes=3/u);
  assert.match(result.summaryText, /reviewSummaryReportPath=/u);
  assert.match(result.reviewSummary.reportText, /reviewIntakes:/u);
  assert.match(result.reviewSummary.reportText, /reviewFocusItems:/u);
  assert.match(result.reviewSummary.reportText, /summary-only evidence view/u);
  assert.equal(result.reviewSummary.status, 'blocked');
  assert.match(result.rollup.reportText, /intakeEntries:/u);
  assert.match(result.rollup.reportText, /checklistItemSummaries:/u);
  assert.match(result.rollup.reportText, /id=gap-missing-required-files/u);
  assert.match(result.rollup.reportText, /id=gap-index-mixed/u);
  assert.match(result.rollup.reportText, /status=ready-for-manual-review/u);
  assert.ok(result.jsonText);
  assert.deepEqual(JSON.parse(result.jsonText), {
    ...result,
    jsonText: null,
  });

  assert.deepEqual(
    (await readdir(tempDir)).sort(),
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
  assert.deepEqual(
    (await readdir(result.intakeDirs.missing)).sort(),
    [],
  );
  assert.ok((await readdir(result.intakeDirs.mixed)).includes('real-corpus-manifest.json'));
  assert.ok((await readdir(result.intakeDirs.ready)).includes('sample-note-template.md'));

  const reportText = await readFile(result.rollupReportPath, 'utf8');
  const reportJson = JSON.parse(await readFile(result.rollupJsonPath, 'utf8'));
  const reviewSummaryText = await readFile(result.reviewSummaryReportPath, 'utf8');
  const reviewSummaryJson = JSON.parse(await readFile(result.reviewSummaryJsonPath, 'utf8'));
  const readyNoteText = await readFile(path.join(result.intakeDirs.ready, 'sample-note-template.md'), 'utf8');

  assert.equal(reportText, result.rollup.reportText);
  assert.equal(reportJson.kind, 'agent-session-v3-pilot-real-corpus-batch-readiness-rollup-report');
  assert.equal(reportJson.status, 'blocked');
  assert.equal(reviewSummaryText, result.reviewSummary.reportText);
  assert.equal(reviewSummaryJson.kind, 'agent-session-v3-pilot-real-corpus-batch-review-summary');
  assert.equal(reviewSummaryJson.status, 'blocked');
  assert.match(readyNoteText, /Batch label: ready-rehearsal-batch/u);
  assert.match(readyNoteText, /Sample source: rehearsal/u);
  assert.match(readyNoteText, /Sample source status: synthetic-rehearsal/u);
  assert.doesNotMatch(readyNoteText, /replace-with/u);
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch readiness rollup example smoke ok');
