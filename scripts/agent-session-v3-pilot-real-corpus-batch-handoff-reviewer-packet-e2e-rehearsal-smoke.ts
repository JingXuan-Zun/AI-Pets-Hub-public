import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { assertSourceDoesNotUseRuntimeOrFixedDesktopChain } from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import { runAgentSessionV3PilotRealCorpusBatchHandoffArtifactIntegrityReport } from './agent-session-v3-pilot-real-corpus-batch-handoff-artifact-integrity-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchHandoffBundle } from './agent-session-v3-pilot-real-corpus-batch-handoff-bundle.ts';
import { runAgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketSummary } from './agent-session-v3-pilot-real-corpus-batch-handoff-reviewer-packet-summary.ts';
import { runAgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyReport } from './agent-session-v3-pilot-real-corpus-batch-handoff-sample-source-consistency-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample } from './agent-session-v3-pilot-real-corpus-batch-readiness-rollup-example.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const sourcesByPath = readProjectSources({
  'scripts/agent-session-v3-pilot-real-corpus-batch-readiness-rollup-example.ts':
    'scripts/agent-session-v3-pilot-real-corpus-batch-readiness-rollup-example.ts',
  'scripts/agent-session-v3-pilot-real-corpus-batch-handoff-bundle.ts':
    'scripts/agent-session-v3-pilot-real-corpus-batch-handoff-bundle.ts',
  'scripts/agent-session-v3-pilot-real-corpus-batch-handoff-artifact-integrity-report.ts':
    'scripts/agent-session-v3-pilot-real-corpus-batch-handoff-artifact-integrity-report.ts',
  'scripts/agent-session-v3-pilot-real-corpus-batch-handoff-sample-source-consistency-report.ts':
    'scripts/agent-session-v3-pilot-real-corpus-batch-handoff-sample-source-consistency-report.ts',
  'scripts/agent-session-v3-pilot-real-corpus-batch-handoff-reviewer-packet-summary.ts':
    'scripts/agent-session-v3-pilot-real-corpus-batch-handoff-reviewer-packet-summary.ts',
});

for (const [relativePath, source] of Object.entries(sourcesByPath)) {
  assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
    source,
    `${relativePath} handoff reviewer packet e2e rehearsal`,
  );
}

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-handoff-reviewer-packet-e2e-'));
try {
  const example = await runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample({
    outDir: path.join(tempDir, 'example'),
    prettyJson: true,
  });
  const reviewNeededBundle = await runAgentSessionV3PilotRealCorpusBatchHandoffBundle({
    intakeDirs: [
      example.intakeDirs.missing,
      example.intakeDirs.mixed,
      example.intakeDirs.ready,
    ],
    outDir: path.join(tempDir, 'review-needed-handoff'),
    prettyJson: true,
    sampleSource: 'rehearsal',
  });
  const artifactIntegrity = await runAgentSessionV3PilotRealCorpusBatchHandoffArtifactIntegrityReport({
    bundleDir: reviewNeededBundle.outDir,
    includeJsonText: true,
    prettyJson: true,
  });
  const sampleSourceConsistency = await runAgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyReport({
    bundleDir: reviewNeededBundle.outDir,
    expectedSampleSource: 'rehearsal',
    includeJsonText: true,
    prettyJson: true,
  });
  const reviewerPacket = await runAgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketSummary({
    bundleDir: reviewNeededBundle.outDir,
    expectedSampleSource: 'rehearsal',
    includeJsonText: true,
    prettyJson: true,
  });

  assert.equal(artifactIntegrity.status, 'valid');
  assert.equal(artifactIntegrity.issueCount, 0);
  assert.equal(sampleSourceConsistency.status, 'consistent');
  assert.equal(sampleSourceConsistency.issueCount, 0);
  assert.equal(sampleSourceConsistency.sampleSource, 'rehearsal');
  assert.equal(sampleSourceConsistency.sampleSourceStatus, 'synthetic-rehearsal');
  assert.equal(reviewerPacket.status, 'review-needed');
  assert.equal(reviewerPacket.blockerCount, 0);
  assert.equal(reviewerPacket.reviewCount, 2);
  assert.equal(reviewerPacket.issueCount, 2);
  assert.equal(reviewerPacket.artifactIntegrity.status, artifactIntegrity.status);
  assert.equal(reviewerPacket.sampleSourceConsistency.status, sampleSourceConsistency.status);
  assert.equal(reviewerPacket.reviewSummaryStatus, 'blocked');
  assert.equal(reviewerPacket.readinessRollupStatus, 'blocked');
  assert.deepEqual(reviewerPacket.statusCounts, {
    blocked: 1,
    readyForManualReview: 1,
    reviewNeeded: 1,
  });
  assert.deepEqual(
    reviewerPacket.issues.map((issue) => issue.code),
    [
      'review-summary-blocked',
      'readiness-rollup-blocked',
    ],
  );
  assert.match(reviewerPacket.summaryText, /status=review-needed/u);
  assert.match(reviewerPacket.reportText, /artifactIntegrityStatus: valid/u);
  assert.match(reviewerPacket.reportText, /sampleSourceConsistencyStatus: consistent/u);
  assert.match(reviewerPacket.reportText, /no sample collection, threshold decision, readiness change, runtime authority/u);
  assert.ok(artifactIntegrity.jsonText);
  assert.ok(sampleSourceConsistency.jsonText);
  assert.ok(reviewerPacket.jsonText);
  assert.deepEqual(JSON.parse(reviewerPacket.jsonText), {
    ...reviewerPacket,
    jsonText: null,
  });

  const readyBundle = await runAgentSessionV3PilotRealCorpusBatchHandoffBundle({
    intakeDirs: [
      example.intakeDirs.ready,
    ],
    outDir: path.join(tempDir, 'ready-handoff'),
    prettyJson: true,
    sampleSource: 'rehearsal',
  });
  const readyReviewerPacket = await runAgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketSummary({
    bundleDir: readyBundle.outDir,
    expectedSampleSource: 'rehearsal',
    includeJsonText: true,
    prettyJson: true,
  });

  assert.equal(readyReviewerPacket.status, 'ready-for-reviewer');
  assert.equal(readyReviewerPacket.issueCount, 0);
  assert.equal(readyReviewerPacket.artifactIntegrity.status, 'valid');
  assert.equal(readyReviewerPacket.sampleSourceConsistency.status, 'consistent');
  assert.equal(readyReviewerPacket.reviewSummaryStatus, 'ready-for-manual-review');
  assert.equal(readyReviewerPacket.readinessRollupStatus, 'ready-for-manual-review');
  assert.match(readyReviewerPacket.reportText, /reviewerPacketIssues: none/u);
  assert.ok(readyReviewerPacket.jsonText);
  assert.deepEqual(JSON.parse(readyReviewerPacket.jsonText), {
    ...readyReviewerPacket,
    jsonText: null,
  });
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch handoff reviewer packet e2e rehearsal smoke ok');
