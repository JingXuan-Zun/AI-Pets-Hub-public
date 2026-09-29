import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { assertSourceDoesNotUseRuntimeOrFixedDesktopChain } from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import { runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample } from './agent-session-v3-pilot-real-corpus-batch-readiness-rollup-example.ts';
import { runAgentSessionV3PilotRealCorpusBatchReviewSummary } from './agent-session-v3-pilot-real-corpus-batch-review-summary.ts';
import { readProjectSources } from './smokeTestHarness.ts';

function focusIds(
  report: Awaited<ReturnType<typeof runAgentSessionV3PilotRealCorpusBatchReviewSummary>>,
) {
  return new Set(report.focusItems.map((item) => item.id));
}

const { summarySource } = readProjectSources({
  summarySource: 'scripts/agent-session-v3-pilot-real-corpus-batch-review-summary.ts',
});

assert.match(
  summarySource,
  /export async function runAgentSessionV3PilotRealCorpusBatchReviewSummary/u,
  'batch review summary should expose a caller-owned runner.',
);
assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  summarySource,
  'agent-session-v3-pilot-real-corpus-batch-review-summary.ts',
);

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-batch-review-summary-'));
try {
  const example = await runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample({
    outDir: path.join(tempDir, 'example'),
    prettyJson: true,
  });
  const reviewSummary = await runAgentSessionV3PilotRealCorpusBatchReviewSummary({
    includeJsonText: true,
    intakeDirs: [
      example.intakeDirs.missing,
      example.intakeDirs.mixed,
      example.intakeDirs.ready,
    ],
    prettyJson: true,
  });

  assert.equal(reviewSummary.kind, 'agent-session-v3-pilot-real-corpus-batch-review-summary');
  assert.equal(reviewSummary.version, 1);
  assert.equal(reviewSummary.status, 'blocked');
  assert.equal(reviewSummary.intakeCount, 3);
  assert.ok(
    reviewSummary.optionalEvidenceReports.some((report) => (
      report.path === 'scripts/agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit.ts'
        && /no readiness decision/u.test(report.boundary)
    )),
  );
  assert.deepEqual(reviewSummary.statusCounts, {
    blocked: 1,
    readyForManualReview: 1,
    reviewNeeded: 1,
  });
  assert.equal(reviewSummary.intakeEntries.length, 3);
  assert.ok(reviewSummary.intakeEntries.some((entry) => entry.status === 'blocked' && entry.validatorStatus === 'missing'));
  assert.ok(reviewSummary.intakeEntries.some((entry) => entry.status === 'review-needed' && entry.evidenceSummaryStatus === 'manual-review-needed'));
  assert.ok(reviewSummary.intakeEntries.some((entry) => entry.status === 'ready-for-manual-review' && entry.evidenceSummaryStatus === 'manual-review-ready'));
  assert.ok(reviewSummary.intakeEntries.some((entry) => entry.validatorStatus === 'missing' && entry.phaseCoverageCounts.status === 'unavailable'));
  assert.ok(reviewSummary.intakeEntries.some((entry) => entry.status === 'review-needed' && entry.phaseCoverageCounts.status === 'clean'));
  assert.ok(reviewSummary.intakeEntries.some((entry) => entry.status === 'ready-for-manual-review' && entry.phaseCoverageCounts.status === 'clean'));
  assert.ok(reviewSummary.focusItems.length >= 3);
  assert.ok(focusIds(reviewSummary).has('gap-missing-required-files'));
  assert.ok(focusIds(reviewSummary).has('gap-index-mixed'));
  assert.ok(focusIds(reviewSummary).has('gap-note-incomplete'));
  assert.match(reviewSummary.summaryText, /status=blocked/u);
  assert.match(reviewSummary.summaryText, /focusItems=/u);
  assert.match(reviewSummary.reportText, /reviewIntakes:/u);
  assert.match(reviewSummary.reportText, /phaseCoverage=unavailable/u);
  assert.match(reviewSummary.reportText, /phaseCoverage=clean/u);
  assert.match(reviewSummary.reportText, /reviewFocusItems:/u);
  assert.match(reviewSummary.reportText, /optionalEvidenceReports:/u);
  assert.match(reviewSummary.reportText, /agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit\.ts/u);
  assert.match(reviewSummary.reportText, /reviewBoundary: summary-only evidence view/u);
  assert.ok(reviewSummary.jsonText);
  assert.deepEqual(JSON.parse(reviewSummary.jsonText), {
    ...reviewSummary,
    jsonText: null,
  });
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch review summary smoke ok');
