import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { assertSourceDoesNotUseRuntimeOrFixedDesktopChain } from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import { runAgentSessionV3PilotRealCorpusBatchIntakeValidator } from './agent-session-v3-pilot-real-corpus-batch-intake-validator.ts';
import { runAgentSessionV3PilotRealCorpusBatchOperatorChecklistReport } from './agent-session-v3-pilot-real-corpus-batch-operator-checklist-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample } from './agent-session-v3-pilot-real-corpus-batch-readiness-rollup-example.ts';
import { runAgentSessionV3PilotRealCorpusBatchReviewSummary } from './agent-session-v3-pilot-real-corpus-batch-review-summary.ts';
import { runAgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflight } from './agent-session-v3-pilot-real-corpus-batch-source-declaration-preflight.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const {
  exampleSource,
  preflightSource,
} = readProjectSources({
  exampleSource: 'scripts/agent-session-v3-pilot-real-corpus-batch-readiness-rollup-example.ts',
  preflightSource: 'scripts/agent-session-v3-pilot-real-corpus-batch-source-declaration-preflight.ts',
});

assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  exampleSource,
  'agent-session-v3-pilot-real-corpus-batch-readiness-rollup-example.ts filled sample rehearsal',
);
assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  preflightSource,
  'agent-session-v3-pilot-real-corpus-batch-source-declaration-preflight.ts filled sample rehearsal',
);
assert.match(
  exampleSource,
  /replace-with-sample-source-real-exported-rehearsal-or-unknown', 'rehearsal'/u,
  'ready rehearsal intake should declare rehearsal sample source.',
);
assert.match(
  exampleSource,
  /replace-with-sample-source-status', 'synthetic-rehearsal'/u,
  'ready rehearsal intake should declare synthetic rehearsal sample status.',
);

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-real-corpus-filled-sample-rehearsal-'));
try {
  const example = await runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample({
    includeJsonText: true,
    outDir: tempDir,
    prettyJson: true,
  });
  const readyIntakeDir = example.intakeDirs.ready;

  const sourcePreflight = await runAgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflight({
    expectedSampleSource: 'rehearsal',
    includeJsonText: true,
    intakeDir: readyIntakeDir,
    prettyJson: true,
  });
  assert.equal(sourcePreflight.status, 'consistent');
  assert.equal(sourcePreflight.issueCount, 0);
  assert.equal(sourcePreflight.sampleSource, 'rehearsal');
  assert.equal(sourcePreflight.sampleSourceStatus, 'synthetic-rehearsal');
  assert.equal(sourcePreflight.readyForProductionRuntime, false);
  assert.match(sourcePreflight.reportText, /sourceDeclarationIssues: none/u);
  assert.ok(sourcePreflight.jsonText);

  const validator = await runAgentSessionV3PilotRealCorpusBatchIntakeValidator({
    includeJsonText: true,
    intakeDir: readyIntakeDir,
    prettyJson: true,
  });
  assert.equal(validator.status, 'ready');
  assert.equal(validator.notePresent, true);
  assert.equal(validator.noteReport.status, 'complete');
  assert.equal(validator.noteOpenItemCount, 0);
  assert.equal(validator.indexReport?.multiReport.statusCounts.ready, 2);
  assert.equal(validator.indexReport?.multiReport.statusCounts.mixed, 0);
  assert.equal(validator.indexReport?.multiReport.statusCounts.notReady, 0);
  assert.ok(validator.jsonText);

  const checklist = await runAgentSessionV3PilotRealCorpusBatchOperatorChecklistReport({
    intakeDir: readyIntakeDir,
    prettyJson: true,
  });
  assert.equal(checklist.status, 'ready-for-manual-review');
  assert.equal(checklist.blockerCount, 0);
  assert.equal(checklist.reviewCount, 0);
  assert.match(checklist.reportText, /ready-for-manual-review/u);

  const reviewSummary = await runAgentSessionV3PilotRealCorpusBatchReviewSummary({
    includeJsonText: true,
    intakeDirs: [
      readyIntakeDir,
    ],
    prettyJson: true,
  });
  assert.equal(reviewSummary.status, 'ready-for-manual-review');
  assert.equal(reviewSummary.intakeCount, 1);
  assert.equal(reviewSummary.statusCounts.readyForManualReview, 1);
  assert.equal(reviewSummary.focusItems.length, 0);
  assert.match(reviewSummary.reportText, /reviewFocusItems: none/u);
  assert.match(reviewSummary.reportText, /reviewBoundary: summary-only evidence view/u);
  assert.ok(reviewSummary.jsonText);

  assert.equal(example.rollup.statusCounts.readyForManualReview, 1);
  assert.ok(example.reviewSummary.intakeEntries.some((entry) => entry.status === 'ready-for-manual-review'));
  assert.match(example.summaryText, /readyForManualReview=1/u);
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch filled sample rehearsal smoke ok');
