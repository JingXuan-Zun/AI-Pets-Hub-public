import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { assertSourceDoesNotUseRuntimeOrFixedDesktopChain } from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
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
  'scripts/agent-session-v3-pilot-real-corpus-batch-handoff-sample-source-consistency-report.ts',
  'scripts/agent-session-v3-pilot-real-corpus-batch-handoff-reviewer-packet-summary.ts',
]) {
  assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
    readProjectSources({ source: relativePath }).source,
    `${relativePath} handoff source preflight degraded rehearsal`,
  );
}

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-handoff-source-preflight-degraded-'));
try {
  const example = await runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample({
    outDir: path.join(tempDir, 'example'),
    prettyJson: true,
  });

  const realExportedBundle = await runAgentSessionV3PilotRealCorpusBatchHandoffBundle({
    intakeDirs: [
      example.intakeDirs.ready,
    ],
    outDir: path.join(tempDir, 'real-exported-handoff'),
    prettyJson: true,
    sampleSource: 'real-exported',
  });
  const realExportedSourcePreflight = await runAgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflight({
    expectedSampleSource: 'rehearsal',
    handoffBundleDir: realExportedBundle.outDir,
    includeJsonText: true,
    intakeDir: example.intakeDirs.ready,
    prettyJson: true,
  });
  const realExportedSampleSourceConsistency = await runAgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyReport({
    bundleDir: realExportedBundle.outDir,
    expectedSampleSource: 'rehearsal',
    includeJsonText: true,
    prettyJson: true,
  });
  const realExportedReviewerPacket = await runAgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketSummary({
    bundleDir: realExportedBundle.outDir,
    expectedSampleSource: 'rehearsal',
    includeJsonText: true,
    prettyJson: true,
  });

  assert.equal(realExportedSourcePreflight.status, 'blocked');
  assert.equal(realExportedSourcePreflight.sampleSource, 'rehearsal');
  assert.equal(realExportedSourcePreflight.sampleSourceStatus, 'synthetic-rehearsal');
  assert.equal(realExportedSourcePreflight.handoffConsistencyReport?.status, 'blocked');
  assert.equal(realExportedSourcePreflight.handoffConsistencyReport?.sampleSource, 'real-exported');
  assert.equal(realExportedSourcePreflight.handoffConsistencyReport?.sampleSourceStatus, 'real-exported-evidence');
  assert.deepEqual(
    realExportedSourcePreflight.issues.map((issue) => issue.code),
    [
      'handoff-status-blocked',
      'handoff-source-mismatch',
      'handoff-status-mismatch',
    ],
  );
  assert.equal(realExportedSampleSourceConsistency.status, 'blocked');
  assert.ok(realExportedSampleSourceConsistency.issues.some((issue) => issue.code === 'expected-source-mismatch'));
  assert.equal(realExportedReviewerPacket.status, 'blocked');
  assert.equal(realExportedReviewerPacket.artifactIntegrity.status, 'valid');
  assert.equal(realExportedReviewerPacket.sampleSourceConsistency.status, 'blocked');
  assert.equal(realExportedReviewerPacket.issueCount, 1);
  assert.deepEqual(
    realExportedReviewerPacket.issues.map((issue) => issue.code),
    ['sample-source-blocked'],
  );
  assert.match(realExportedSourcePreflight.reportText, /sourceDeclarationIssues:/u);
  assert.match(realExportedSourcePreflight.reportText, /code=handoff-source-mismatch/u);
  assert.match(realExportedReviewerPacket.reportText, /sampleSourceConsistencyStatus: blocked/u);
  assert.ok(realExportedSourcePreflight.jsonText);
  assert.ok(realExportedSampleSourceConsistency.jsonText);
  assert.ok(realExportedReviewerPacket.jsonText);

  const unknownBundle = await runAgentSessionV3PilotRealCorpusBatchHandoffBundle({
    intakeDirs: [
      example.intakeDirs.ready,
    ],
    outDir: path.join(tempDir, 'unknown-handoff'),
    prettyJson: true,
    sampleSource: 'unknown',
  });
  const unknownSourcePreflight = await runAgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflight({
    handoffBundleDir: unknownBundle.outDir,
    includeJsonText: true,
    intakeDir: example.intakeDirs.ready,
    prettyJson: true,
  });
  const unknownSampleSourceConsistency = await runAgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyReport({
    bundleDir: unknownBundle.outDir,
    includeJsonText: true,
    prettyJson: true,
  });
  const unknownReviewerPacket = await runAgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketSummary({
    bundleDir: unknownBundle.outDir,
    includeJsonText: true,
    prettyJson: true,
  });

  assert.equal(unknownSourcePreflight.status, 'blocked');
  assert.equal(unknownSourcePreflight.handoffConsistencyReport?.status, 'review-needed');
  assert.equal(unknownSourcePreflight.handoffConsistencyReport?.sampleSource, 'unknown');
  assert.equal(unknownSourcePreflight.handoffConsistencyReport?.sampleSourceStatus, 'missing-real-sample-declaration');
  assert.deepEqual(
    unknownSourcePreflight.issues.map((issue) => issue.code),
    [
      'handoff-status-review-needed',
      'handoff-source-mismatch',
      'handoff-status-mismatch',
    ],
  );
  assert.equal(unknownSampleSourceConsistency.status, 'review-needed');
  assert.deepEqual(
    unknownSampleSourceConsistency.issues.map((issue) => issue.code),
    ['unknown-sample-source'],
  );
  assert.equal(unknownReviewerPacket.status, 'review-needed');
  assert.equal(unknownReviewerPacket.artifactIntegrity.status, 'valid');
  assert.equal(unknownReviewerPacket.sampleSourceConsistency.status, 'review-needed');
  assert.deepEqual(
    unknownReviewerPacket.issues.map((issue) => issue.code),
    ['sample-source-review-needed'],
  );
  assert.match(unknownReviewerPacket.reportText, /status=review-needed/u);
  assert.match(unknownReviewerPacket.reportText, /no sample collection, threshold decision, readiness change, runtime authority/u);
  assert.ok(unknownSourcePreflight.jsonText);
  assert.ok(unknownSampleSourceConsistency.jsonText);
  assert.ok(unknownReviewerPacket.jsonText);
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch handoff source preflight degraded rehearsal smoke ok');
