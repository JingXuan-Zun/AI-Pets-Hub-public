import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { assertSourceDoesNotUseRuntimeOrFixedDesktopChain } from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import { runAgentSessionV3PilotRealCorpusBatchOperatorChecklistReport } from './agent-session-v3-pilot-real-corpus-batch-operator-checklist-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample } from './agent-session-v3-pilot-real-corpus-batch-readiness-rollup-example.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const { runbookText, exampleSource } = readProjectSources({
  runbookText: 'PROJECT_AGENT_V3_REAL_CORPUS_BATCH_RUNBOOK.md',
  exampleSource: 'scripts/agent-session-v3-pilot-real-corpus-batch-readiness-rollup-example.ts',
});

assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  exampleSource,
  'agent-session-v3-pilot-real-corpus-batch-readiness-rollup-example.ts review-order rehearsal',
);
assert.match(runbookText, /start with the batch review summary/u);
assert.match(runbookText, /After the review summary, use the readiness rollup report/u);
assert.match(runbookText, /Then use the operator checklist report for each intake that needs drill-down/u);

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-real-corpus-review-order-rehearsal-'));
try {
  const example = await runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample({
    includeJsonText: true,
    outDir: tempDir,
    prettyJson: true,
  });

  const reviewSummaryText = await readFile(example.reviewSummaryReportPath, 'utf8');
  const readinessRollupText = await readFile(example.rollupReportPath, 'utf8');

  assert.equal(reviewSummaryText, example.reviewSummary.reportText);
  assert.equal(readinessRollupText, example.rollup.reportText);
  assert.match(reviewSummaryText, /AgentSessionV3PilotRealCorpusBatchReviewSummary status=blocked/u);
  assert.match(reviewSummaryText, /reviewIntakes:/u);
  assert.match(reviewSummaryText, /reviewFocusItems:/u);
  assert.match(reviewSummaryText, /reviewBoundary: summary-only evidence view/u);
  assert.match(readinessRollupText, /AgentSessionV3PilotRealCorpusBatchReadinessRollupReport status=blocked/u);
  assert.match(readinessRollupText, /checklistItemSummaries:/u);
  assert.match(readinessRollupText, /id=gap-missing-required-files/u);
  assert.match(readinessRollupText, /id=gap-index-mixed/u);

  const blockedChecklist = await runAgentSessionV3PilotRealCorpusBatchOperatorChecklistReport({
    intakeDir: example.intakeDirs.missing,
    prettyJson: true,
  });
  const reviewChecklist = await runAgentSessionV3PilotRealCorpusBatchOperatorChecklistReport({
    intakeDir: example.intakeDirs.mixed,
    prettyJson: true,
  });
  const readyChecklist = await runAgentSessionV3PilotRealCorpusBatchOperatorChecklistReport({
    intakeDir: example.intakeDirs.ready,
    prettyJson: true,
  });

  assert.equal(blockedChecklist.status, 'blocked');
  assert.equal(reviewChecklist.status, 'review-needed');
  assert.equal(readyChecklist.status, 'ready-for-manual-review');
  assert.ok(blockedChecklist.blockerCount > 0, 'blocked drill-down should expose blocker checklist items.');
  assert.ok(reviewChecklist.reviewCount > 0, 'review-needed drill-down should expose review checklist items.');
  assert.equal(readyChecklist.blockerCount, 0);
  assert.equal(readyChecklist.reviewCount, 0);
  assert.match(blockedChecklist.reportText, /operatorChecklist:/u);
  assert.match(reviewChecklist.reportText, /id=gap-index-mixed/u);
  assert.match(readyChecklist.reportText, /status=ready-for-manual-review/u);

  assert.deepEqual(
    example.reviewSummary.intakeEntries.map((entry) => entry.status),
    ['blocked', 'review-needed', 'ready-for-manual-review'],
  );
  assert.deepEqual(
    example.rollup.entries.map((entry) => entry.status),
    ['blocked', 'review-needed', 'ready-for-manual-review'],
  );
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch review order rehearsal smoke ok');
