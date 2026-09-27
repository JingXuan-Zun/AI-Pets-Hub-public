import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { assertSourceDoesNotUseRuntimeOrFixedDesktopChain } from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import { runAgentSessionV3PilotRealCorpusBatchHandoffArtifactIntegrityReport } from './agent-session-v3-pilot-real-corpus-batch-handoff-artifact-integrity-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchHandoffBundle } from './agent-session-v3-pilot-real-corpus-batch-handoff-bundle.ts';
import { runAgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketSummary } from './agent-session-v3-pilot-real-corpus-batch-handoff-reviewer-packet-summary.ts';
import { runAgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyReport } from './agent-session-v3-pilot-real-corpus-batch-handoff-sample-source-consistency-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchOperatorChecklistReport } from './agent-session-v3-pilot-real-corpus-batch-operator-checklist-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReport } from './agent-session-v3-pilot-real-corpus-batch-p0-real-evidence-closeout-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample } from './agent-session-v3-pilot-real-corpus-batch-readiness-rollup-example.ts';
import { runAgentSessionV3PilotRealCorpusBatchReadinessRollupReport } from './agent-session-v3-pilot-real-corpus-batch-readiness-rollup-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchReviewSummary } from './agent-session-v3-pilot-real-corpus-batch-review-summary.ts';
import { projectRoot, readProjectSources } from './smokeTestHarness.ts';

async function readJsonFile(filePath: string) {
  return JSON.parse(await readFile(filePath, 'utf8')) as Record<string, unknown>;
}

for (const relativePath of [
  'scripts/agent-session-v3-pilot-real-corpus-batch-p0-real-evidence-closeout-report.ts',
  'scripts/agent-session-v3-pilot-real-corpus-batch-review-summary.ts',
  'scripts/agent-session-v3-pilot-real-corpus-batch-readiness-rollup-report.ts',
  'scripts/agent-session-v3-pilot-real-corpus-batch-operator-checklist-report.ts',
  'scripts/agent-session-v3-pilot-real-corpus-batch-handoff-bundle.ts',
  'scripts/agent-session-v3-pilot-real-corpus-batch-handoff-artifact-integrity-report.ts',
  'scripts/agent-session-v3-pilot-real-corpus-batch-handoff-sample-source-consistency-report.ts',
  'scripts/agent-session-v3-pilot-real-corpus-batch-handoff-reviewer-packet-summary.ts',
]) {
  assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
    readProjectSources({ source: relativePath }).source,
    `${relativePath} artifact rehearsal closeout`,
  );
}

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-artifact-rehearsal-closeout-'));
try {
  const example = await runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample({
    outDir: path.join(tempDir, 'example'),
    prettyJson: true,
  });
  const readyIntakeDir = example.intakeDirs.ready;
  const p0Closeout = await runAgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReport({
    includeJsonText: true,
    intakeDirs: [readyIntakeDir],
    prettyJson: true,
    projectRoot,
  });
  const reviewSummary = await runAgentSessionV3PilotRealCorpusBatchReviewSummary({
    includeJsonText: true,
    intakeDirs: [readyIntakeDir],
    prettyJson: true,
  });
  const rollup = await runAgentSessionV3PilotRealCorpusBatchReadinessRollupReport({
    includeJsonText: true,
    intakeDirs: [readyIntakeDir],
    prettyJson: true,
  });
  const checklist = await runAgentSessionV3PilotRealCorpusBatchOperatorChecklistReport({
    includeJsonText: true,
    intakeDir: readyIntakeDir,
    prettyJson: true,
  });
  const handoff = await runAgentSessionV3PilotRealCorpusBatchHandoffBundle({
    includeJsonText: true,
    intakeDirs: [readyIntakeDir],
    outDir: path.join(tempDir, 'handoff'),
    prettyJson: true,
    sampleSource: 'rehearsal',
  });
  const artifactIntegrity = await runAgentSessionV3PilotRealCorpusBatchHandoffArtifactIntegrityReport({
    bundleDir: handoff.outDir,
    includeJsonText: true,
    prettyJson: true,
  });
  const sampleSourceConsistency = await runAgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyReport({
    bundleDir: handoff.outDir,
    expectedSampleSource: 'rehearsal',
    includeJsonText: true,
    prettyJson: true,
  });
  const reviewerPacket = await runAgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketSummary({
    bundleDir: handoff.outDir,
    expectedSampleSource: 'rehearsal',
    includeJsonText: true,
    prettyJson: true,
  });

  assert.equal(p0Closeout.status, 'blocked');
  assert.equal(p0Closeout.p0IntakeTargetStatus, 'blocked');
  assert.equal(p0Closeout.readinessRollupStatus, 'ready-for-manual-review');
  assert.equal(p0Closeout.readyForProductionRuntime, false);
  assert.equal(p0Closeout.intakeCount, 1);
  assert.ok(p0Closeout.p0TargetCount > 0, 'P0 closeout should carry target-level evidence signals.');
  assert.deepEqual(
    p0Closeout.p0TargetSignals.map((signal) => `${signal.gapKind}:${signal.status}`).sort(),
    [
      'real-exported-corpus:missing',
      'real-production-like-sample:blocked',
    ],
    'rehearsal intake should not satisfy real exported P0 evidence.',
  );
  assert.match(p0Closeout.reportText, /guardrail=caller-owned P0 real evidence closeout report only/u);
  assert.match(p0Closeout.reportText, /does not discover directories, collect samples/u);
  assert.ok(p0Closeout.jsonText);
  assert.deepEqual(JSON.parse(p0Closeout.jsonText), {
    ...p0Closeout,
    jsonText: null,
  });

  assert.equal(reviewSummary.status, 'ready-for-manual-review');
  assert.equal(reviewSummary.statusCounts.readyForManualReview, 1);
  assert.equal(reviewSummary.statusCounts.blocked, 0);
  assert.equal(reviewSummary.statusCounts.reviewNeeded, 0);
  assert.equal(rollup.status, 'ready-for-manual-review');
  assert.equal(rollup.statusCounts.readyForManualReview, 1);
  assert.equal(checklist.status, 'ready-for-manual-review');
  assert.equal(checklist.blockerCount, 0);
  assert.equal(checklist.reviewCount, 0);

  assert.deepEqual(
    reviewSummary.intakeEntries.map((entry) => entry.intakeDir),
    rollup.entries.map((entry) => entry.intakeDir),
  );
  assert.deepEqual(
    handoff.reviewSummary.intakeEntries.map((entry) => entry.intakeDir),
    reviewSummary.intakeEntries.map((entry) => entry.intakeDir),
  );
  assert.deepEqual(
    handoff.rollup.entries.map((entry) => entry.intakeDir),
    rollup.entries.map((entry) => entry.intakeDir),
  );
  assert.deepEqual(
    handoff.checklistArtifacts.map((artifact) => artifact.intakeDir),
    [readyIntakeDir],
  );
  assert.equal(handoff.checklistArtifacts.length, 1);

  const handoffIndex = await readJsonFile(handoff.indexJsonPath);
  const handoffReviewSummaryJson = await readJsonFile(handoff.reviewSummaryJsonPath);
  const handoffRollupJson = await readJsonFile(handoff.rollupJsonPath);
  const [handoffChecklistArtifact] = handoff.checklistArtifacts;

  assert.ok(handoffChecklistArtifact);

  const handoffChecklistJson = await readJsonFile(handoffChecklistArtifact.jsonPath);

  assert.equal(handoff.reviewSummary.status, 'ready-for-manual-review');
  assert.equal(handoff.rollup.status, 'ready-for-manual-review');
  assert.equal(handoff.sampleSource, 'rehearsal');
  assert.equal(handoff.sampleSourceStatus, 'synthetic-rehearsal');
  assert.equal(handoffIndex.status, 'ready-for-manual-review');
  assert.equal(handoffIndex.sampleSource, 'rehearsal');
  assert.equal(handoffIndex.sampleSourceStatus, 'synthetic-rehearsal');
  assert.deepEqual(handoffIndex.reviewOrder, [
    'review-summary-report',
    'readiness-rollup-report',
    'operator-checklist-drill-down',
  ]);
  assert.equal(handoffReviewSummaryJson.kind, 'agent-session-v3-pilot-real-corpus-batch-review-summary');
  assert.equal(handoffReviewSummaryJson.status, 'ready-for-manual-review');
  assert.equal(handoffRollupJson.kind, 'agent-session-v3-pilot-real-corpus-batch-readiness-rollup-report');
  assert.equal(handoffRollupJson.status, 'ready-for-manual-review');
  assert.equal(handoffChecklistJson.kind, 'agent-session-v3-pilot-real-corpus-batch-operator-checklist-report');
  assert.equal(handoffChecklistJson.status, 'ready-for-manual-review');
  assert.match(handoff.index.guardrail, /caller-owned evidence bundle only/u);
  assert.match(handoff.index.guardrail, /no threshold decision/u);
  assert.match(handoff.index.guardrail, /runtime authority/u);

  assert.equal(artifactIntegrity.status, 'valid');
  assert.equal(artifactIntegrity.issueCount, 0);
  assert.equal(sampleSourceConsistency.status, 'consistent');
  assert.equal(sampleSourceConsistency.issueCount, 0);
  assert.equal(sampleSourceConsistency.sampleSource, 'rehearsal');
  assert.equal(sampleSourceConsistency.sampleSourceStatus, 'synthetic-rehearsal');
  assert.equal(reviewerPacket.status, 'ready-for-reviewer');
  assert.equal(reviewerPacket.issueCount, 0);
  assert.equal(reviewerPacket.artifactIntegrity.status, 'valid');
  assert.equal(reviewerPacket.sampleSourceConsistency.status, 'consistent');
  assert.equal(reviewerPacket.reviewSummaryStatus, 'ready-for-manual-review');
  assert.equal(reviewerPacket.readinessRollupStatus, 'ready-for-manual-review');
  assert.deepEqual(reviewerPacket.statusCounts, {
    blocked: 0,
    readyForManualReview: 1,
    reviewNeeded: 0,
  });
  assert.match(reviewerPacket.reportText, /reviewerPacketIssues: none/u);
  assert.match(reviewerPacket.reportText, /no sample collection, threshold decision, readiness change, runtime authority/u);
  assert.ok(reviewerPacket.jsonText);
  assert.deepEqual(JSON.parse(reviewerPacket.jsonText), {
    ...reviewerPacket,
    jsonText: null,
  });

  assert.ok(reviewSummary.jsonText);
  assert.ok(rollup.jsonText);
  assert.ok(checklist.jsonText);
  assert.ok(handoff.jsonText);
  assert.ok(artifactIntegrity.jsonText);
  assert.ok(sampleSourceConsistency.jsonText);
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch artifact rehearsal closeout smoke ok');
