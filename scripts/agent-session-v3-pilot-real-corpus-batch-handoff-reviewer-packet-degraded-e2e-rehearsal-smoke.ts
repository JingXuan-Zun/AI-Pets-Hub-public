import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { assertSourceDoesNotUseRuntimeOrFixedDesktopChain } from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import { runAgentSessionV3PilotRealCorpusBatchHandoffArtifactIntegrityReport } from './agent-session-v3-pilot-real-corpus-batch-handoff-artifact-integrity-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchHandoffBundle } from './agent-session-v3-pilot-real-corpus-batch-handoff-bundle.ts';
import { runAgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketSummary } from './agent-session-v3-pilot-real-corpus-batch-handoff-reviewer-packet-summary.ts';
import { runAgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyReport } from './agent-session-v3-pilot-real-corpus-batch-handoff-sample-source-consistency-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample } from './agent-session-v3-pilot-real-corpus-batch-readiness-rollup-example.ts';
import { readProjectSources } from './smokeTestHarness.ts';

for (const relativePath of [
  'scripts/agent-session-v3-pilot-real-corpus-batch-readiness-rollup-example.ts',
  'scripts/agent-session-v3-pilot-real-corpus-batch-handoff-bundle.ts',
  'scripts/agent-session-v3-pilot-real-corpus-batch-handoff-artifact-integrity-report.ts',
  'scripts/agent-session-v3-pilot-real-corpus-batch-handoff-sample-source-consistency-report.ts',
  'scripts/agent-session-v3-pilot-real-corpus-batch-handoff-reviewer-packet-summary.ts',
]) {
  assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
    readProjectSources({ source: relativePath }).source,
    `${relativePath} handoff reviewer packet degraded e2e rehearsal`,
  );
}

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-handoff-reviewer-packet-degraded-e2e-'));
try {
  const example = await runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample({
    outDir: path.join(tempDir, 'example'),
    prettyJson: true,
  });

  const missingArtifactBundle = await runAgentSessionV3PilotRealCorpusBatchHandoffBundle({
    intakeDirs: [
      example.intakeDirs.ready,
    ],
    outDir: path.join(tempDir, 'missing-artifact-handoff'),
    prettyJson: true,
    sampleSource: 'real-exported',
  });
  await unlink(missingArtifactBundle.rollupJsonPath);
  const missingArtifactIntegrity = await runAgentSessionV3PilotRealCorpusBatchHandoffArtifactIntegrityReport({
    bundleDir: missingArtifactBundle.outDir,
    includeJsonText: true,
    prettyJson: true,
  });
  const missingArtifactPacket = await runAgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketSummary({
    bundleDir: missingArtifactBundle.outDir,
    expectedSampleSource: 'real-exported',
    includeJsonText: true,
    prettyJson: true,
  });

  assert.equal(missingArtifactIntegrity.status, 'blocked');
  assert.ok(missingArtifactIntegrity.issues.some((issue) => (
    issue.code === 'missing-artifact' && issue.role === 'readiness-rollup-json'
  )));
  assert.equal(missingArtifactPacket.status, 'blocked');
  assert.equal(missingArtifactPacket.artifactIntegrity.status, 'blocked');
  assert.equal(missingArtifactPacket.sampleSourceConsistency.status, 'consistent');
  assert.equal(missingArtifactPacket.readinessRollupStatus, null);
  assert.ok(missingArtifactPacket.issues.some((issue) => issue.code === 'artifact-integrity-blocked'));
  assert.ok(missingArtifactPacket.issues.some((issue) => issue.code === 'missing-readiness-rollup-json'));
  assert.ok(missingArtifactPacket.jsonText);
  assert.deepEqual(JSON.parse(missingArtifactPacket.jsonText), {
    ...missingArtifactPacket,
    jsonText: null,
  });

  const sampleSourceMismatchBundle = await runAgentSessionV3PilotRealCorpusBatchHandoffBundle({
    intakeDirs: [
      example.intakeDirs.ready,
    ],
    outDir: path.join(tempDir, 'sample-source-mismatch-handoff'),
    prettyJson: true,
    sampleSource: 'real-exported',
  });
  const readmeText = await readFile(sampleSourceMismatchBundle.readmePath, 'utf8');
  await writeFile(
    sampleSourceMismatchBundle.readmePath,
    readmeText.replace('Declared sample source: real-exported', 'Declared sample source: rehearsal'),
    'utf8',
  );
  const mismatchedSourceReport = await runAgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyReport({
    bundleDir: sampleSourceMismatchBundle.outDir,
    expectedSampleSource: 'real-exported',
    includeJsonText: true,
    prettyJson: true,
  });
  const mismatchedSourcePacket = await runAgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketSummary({
    bundleDir: sampleSourceMismatchBundle.outDir,
    expectedSampleSource: 'real-exported',
    includeJsonText: true,
    prettyJson: true,
  });

  assert.equal(mismatchedSourceReport.status, 'blocked');
  assert.ok(mismatchedSourceReport.issues.some((issue) => issue.code === 'sample-source-mismatch'));
  assert.ok(mismatchedSourceReport.issues.some((issue) => issue.code === 'derived-status-mismatch'));
  assert.equal(mismatchedSourcePacket.status, 'blocked');
  assert.equal(mismatchedSourcePacket.artifactIntegrity.status, 'valid');
  assert.equal(mismatchedSourcePacket.sampleSourceConsistency.status, 'blocked');
  assert.equal(mismatchedSourcePacket.reviewSummaryStatus, 'ready-for-manual-review');
  assert.equal(mismatchedSourcePacket.readinessRollupStatus, 'ready-for-manual-review');
  assert.ok(mismatchedSourcePacket.issues.some((issue) => issue.code === 'sample-source-blocked'));
  assert.match(mismatchedSourcePacket.reportText, /sampleSourceConsistencyStatus: blocked/u);
  assert.ok(mismatchedSourcePacket.jsonText);
  assert.deepEqual(JSON.parse(mismatchedSourcePacket.jsonText), {
    ...mismatchedSourcePacket,
    jsonText: null,
  });

  const invalidReviewSummaryBundle = await runAgentSessionV3PilotRealCorpusBatchHandoffBundle({
    intakeDirs: [
      example.intakeDirs.ready,
    ],
    outDir: path.join(tempDir, 'invalid-review-summary-handoff'),
    prettyJson: true,
    sampleSource: 'real-exported',
  });
  await writeFile(invalidReviewSummaryBundle.reviewSummaryJsonPath, '{', 'utf8');
  const invalidReviewSummaryPacket = await runAgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketSummary({
    bundleDir: invalidReviewSummaryBundle.outDir,
    expectedSampleSource: 'real-exported',
    includeJsonText: true,
    prettyJson: true,
  });

  assert.equal(invalidReviewSummaryPacket.status, 'blocked');
  assert.equal(invalidReviewSummaryPacket.artifactIntegrity.status, 'blocked');
  assert.equal(invalidReviewSummaryPacket.sampleSourceConsistency.status, 'consistent');
  assert.equal(invalidReviewSummaryPacket.reviewSummaryStatus, null);
  assert.ok(invalidReviewSummaryPacket.issues.some((issue) => issue.code === 'artifact-integrity-blocked'));
  assert.ok(invalidReviewSummaryPacket.issues.some((issue) => issue.code === 'invalid-review-summary-json'));
  assert.ok(invalidReviewSummaryPacket.jsonText);
  assert.deepEqual(JSON.parse(invalidReviewSummaryPacket.jsonText), {
    ...invalidReviewSummaryPacket,
    jsonText: null,
  });

  const invalidReadinessRollupBundle = await runAgentSessionV3PilotRealCorpusBatchHandoffBundle({
    intakeDirs: [
      example.intakeDirs.ready,
    ],
    outDir: path.join(tempDir, 'invalid-readiness-rollup-handoff'),
    prettyJson: true,
    sampleSource: 'real-exported',
  });
  await writeFile(invalidReadinessRollupBundle.rollupJsonPath, '{', 'utf8');
  const invalidReadinessRollupPacket = await runAgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketSummary({
    bundleDir: invalidReadinessRollupBundle.outDir,
    expectedSampleSource: 'real-exported',
    includeJsonText: true,
    prettyJson: true,
  });

  assert.equal(invalidReadinessRollupPacket.status, 'blocked');
  assert.equal(invalidReadinessRollupPacket.artifactIntegrity.status, 'blocked');
  assert.equal(invalidReadinessRollupPacket.sampleSourceConsistency.status, 'consistent');
  assert.equal(invalidReadinessRollupPacket.readinessRollupStatus, null);
  assert.ok(invalidReadinessRollupPacket.issues.some((issue) => issue.code === 'artifact-integrity-blocked'));
  assert.ok(invalidReadinessRollupPacket.issues.some((issue) => issue.code === 'invalid-readiness-rollup-json'));
  assert.match(invalidReadinessRollupPacket.reportText, /guardrail=caller-owned handoff reviewer packet summary only/u);
  assert.ok(invalidReadinessRollupPacket.jsonText);
  assert.deepEqual(JSON.parse(invalidReadinessRollupPacket.jsonText), {
    ...invalidReadinessRollupPacket,
    jsonText: null,
  });
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch handoff reviewer packet degraded e2e rehearsal smoke ok');
