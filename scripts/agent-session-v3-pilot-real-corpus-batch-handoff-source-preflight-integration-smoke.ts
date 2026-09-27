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
import { runAgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflight } from './agent-session-v3-pilot-real-corpus-batch-source-declaration-preflight.ts';
import { readProjectSources } from './smokeTestHarness.ts';

for (const relativePath of [
  'scripts/agent-session-v3-pilot-real-corpus-batch-readiness-rollup-example.ts',
  'scripts/agent-session-v3-pilot-real-corpus-batch-source-declaration-preflight.ts',
  'scripts/agent-session-v3-pilot-real-corpus-batch-handoff-bundle.ts',
  'scripts/agent-session-v3-pilot-real-corpus-batch-handoff-artifact-integrity-report.ts',
  'scripts/agent-session-v3-pilot-real-corpus-batch-handoff-sample-source-consistency-report.ts',
  'scripts/agent-session-v3-pilot-real-corpus-batch-handoff-reviewer-packet-summary.ts',
]) {
  assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
    readProjectSources({ source: relativePath }).source,
    `${relativePath} handoff source preflight integration`,
  );
}

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-handoff-source-preflight-integration-'));
try {
  const example = await runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample({
    outDir: path.join(tempDir, 'example'),
    prettyJson: true,
  });

  const sourcePreflightOnly = await runAgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflight({
    expectedSampleSource: 'rehearsal',
    includeJsonText: true,
    intakeDir: example.intakeDirs.ready,
    prettyJson: true,
  });

  assert.equal(sourcePreflightOnly.status, 'consistent');
  assert.equal(sourcePreflightOnly.issueCount, 0);
  assert.equal(sourcePreflightOnly.sampleSource, 'rehearsal');
  assert.equal(sourcePreflightOnly.sampleSourceStatus, 'synthetic-rehearsal');
  assert.equal(sourcePreflightOnly.observations.length, 1);
  assert.equal(sourcePreflightOnly.observations[0]?.label, 'sample-note');
  assert.equal(sourcePreflightOnly.handoffConsistencyReport, null);
  assert.match(sourcePreflightOnly.reportText, /does not infer realness from file content/u);
  assert.ok(sourcePreflightOnly.jsonText);
  assert.deepEqual(JSON.parse(sourcePreflightOnly.jsonText), {
    ...sourcePreflightOnly,
    jsonText: null,
  });

  const handoffBundle = await runAgentSessionV3PilotRealCorpusBatchHandoffBundle({
    includeJsonText: true,
    intakeDirs: [
      example.intakeDirs.ready,
    ],
    outDir: path.join(tempDir, 'ready-rehearsal-handoff'),
    prettyJson: true,
    sampleSource: 'rehearsal',
  });

  assert.equal(handoffBundle.sampleSource, 'rehearsal');
  assert.equal(handoffBundle.sampleSourceStatus, 'synthetic-rehearsal');
  assert.equal(handoffBundle.reviewSummary.status, 'ready-for-manual-review');
  assert.ok(handoffBundle.jsonText);
  assert.deepEqual(JSON.parse(handoffBundle.jsonText), {
    ...handoffBundle,
    jsonText: null,
  });

  const sourcePreflightWithHandoff = await runAgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflight({
    expectedSampleSource: 'rehearsal',
    handoffBundleDir: handoffBundle.outDir,
    includeJsonText: true,
    intakeDir: example.intakeDirs.ready,
    prettyJson: true,
  });

  assert.equal(sourcePreflightWithHandoff.status, 'consistent');
  assert.equal(sourcePreflightWithHandoff.issueCount, 0);
  assert.equal(sourcePreflightWithHandoff.sampleSource, 'rehearsal');
  assert.equal(sourcePreflightWithHandoff.sampleSourceStatus, 'synthetic-rehearsal');
  assert.equal(sourcePreflightWithHandoff.observations.length, 2);
  assert.deepEqual(
    sourcePreflightWithHandoff.observations.map((observation) => observation.label),
    [
      'sample-note',
      'handoff-bundle',
    ],
  );
  assert.equal(sourcePreflightWithHandoff.handoffConsistencyReport?.status, 'consistent');
  assert.equal(sourcePreflightWithHandoff.handoffConsistencyReport?.sampleSource, 'rehearsal');
  assert.equal(sourcePreflightWithHandoff.handoffConsistencyReport?.sampleSourceStatus, 'synthetic-rehearsal');
  assert.match(sourcePreflightWithHandoff.summaryText, /handoff=yes/u);
  assert.ok(sourcePreflightWithHandoff.jsonText);
  assert.deepEqual(JSON.parse(sourcePreflightWithHandoff.jsonText), {
    ...sourcePreflightWithHandoff,
    jsonText: null,
  });

  const artifactIntegrity = await runAgentSessionV3PilotRealCorpusBatchHandoffArtifactIntegrityReport({
    bundleDir: handoffBundle.outDir,
    includeJsonText: true,
    prettyJson: true,
  });
  const sampleSourceConsistency = await runAgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyReport({
    bundleDir: handoffBundle.outDir,
    expectedSampleSource: 'rehearsal',
    includeJsonText: true,
    prettyJson: true,
  });
  const reviewerPacket = await runAgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketSummary({
    bundleDir: handoffBundle.outDir,
    expectedSampleSource: 'rehearsal',
    includeJsonText: true,
    prettyJson: true,
  });

  assert.equal(artifactIntegrity.status, 'valid');
  assert.equal(artifactIntegrity.issueCount, 0);
  assert.equal(sampleSourceConsistency.status, 'consistent');
  assert.equal(sampleSourceConsistency.issueCount, 0);
  assert.equal(sampleSourceConsistency.sampleSource, sourcePreflightWithHandoff.sampleSource);
  assert.equal(sampleSourceConsistency.sampleSourceStatus, sourcePreflightWithHandoff.sampleSourceStatus);
  assert.equal(reviewerPacket.status, 'ready-for-reviewer');
  assert.equal(reviewerPacket.issueCount, 0);
  assert.equal(reviewerPacket.artifactIntegrity.status, artifactIntegrity.status);
  assert.equal(reviewerPacket.sampleSourceConsistency.status, sampleSourceConsistency.status);
  assert.equal(reviewerPacket.reviewSummaryStatus, 'ready-for-manual-review');
  assert.equal(reviewerPacket.readinessRollupStatus, 'ready-for-manual-review');
  assert.equal(reviewerPacket.sampleSourceStatus, 'synthetic-rehearsal');
  assert.match(reviewerPacket.reportText, /reviewerPacketIssues: none/u);
  assert.match(reviewerPacket.reportText, /no sample collection, threshold decision, readiness change, runtime authority/u);
  assert.ok(artifactIntegrity.jsonText);
  assert.ok(sampleSourceConsistency.jsonText);
  assert.ok(reviewerPacket.jsonText);
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch handoff source preflight integration smoke ok');
