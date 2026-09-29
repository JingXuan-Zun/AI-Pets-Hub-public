import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { assertSourceDoesNotUseRuntimeOrFixedDesktopChain } from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import { runAgentSessionV3PilotRealCorpusBatchHandoffArtifactIntegrityReport } from './agent-session-v3-pilot-real-corpus-batch-handoff-artifact-integrity-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchHandoffBundle } from './agent-session-v3-pilot-real-corpus-batch-handoff-bundle.ts';
import { runAgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketSummary } from './agent-session-v3-pilot-real-corpus-batch-handoff-reviewer-packet-summary.ts';
import { runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample } from './agent-session-v3-pilot-real-corpus-batch-readiness-rollup-example.ts';
import { runAgentSessionV3PilotRealCorpusBatchReviewSummary } from './agent-session-v3-pilot-real-corpus-batch-review-summary.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const optionalEvidencePath = 'scripts/agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit.ts';

function optionalEvidencePathsFromReviewSummary(value: Record<string, unknown>) {
  assert.ok(Array.isArray(value.optionalEvidenceReports), 'review summary JSON should expose optional evidence reports.');

  return value.optionalEvidenceReports
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry))
    .map((entry) => entry.path)
    .filter((entry): entry is string => typeof entry === 'string');
}

const { source } = readProjectSources({
  source: 'scripts/agent-session-v3-pilot-real-corpus-batch-handoff-optional-evidence-continuity-smoke.ts',
});

assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  source,
  'agent-session-v3-pilot-real-corpus-batch-handoff-optional-evidence-continuity-smoke.ts',
);

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-handoff-optional-evidence-continuity-'));
try {
  const example = await runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample({
    outDir: path.join(tempDir, 'example'),
    prettyJson: true,
  });
  const reviewSummary = await runAgentSessionV3PilotRealCorpusBatchReviewSummary({
    intakeDirs: [
      example.intakeDirs.ready,
    ],
    prettyJson: true,
  });

  assert.equal(reviewSummary.status, 'ready-for-manual-review');
  assert.ok(
    reviewSummary.optionalEvidenceReports.some((report) => report.path === optionalEvidencePath),
    'review summary should publish the intake field completeness audit as optional follow-up evidence.',
  );
  assert.match(reviewSummary.reportText, /optionalEvidenceReports:/u);
  assert.match(reviewSummary.reportText, /intake-field-completeness-audit\.ts/u);

  const bundle = await runAgentSessionV3PilotRealCorpusBatchHandoffBundle({
    intakeDirs: [
      example.intakeDirs.ready,
    ],
    outDir: path.join(tempDir, 'handoff'),
    prettyJson: true,
    sampleSource: 'real-exported',
  });
  const bundledReviewSummaryJson = JSON.parse(
    await readFile(bundle.reviewSummaryJsonPath, 'utf8'),
  ) as Record<string, unknown>;
  const bundledOptionalEvidencePaths = optionalEvidencePathsFromReviewSummary(bundledReviewSummaryJson);

  assert.deepEqual(bundledOptionalEvidencePaths, [
    optionalEvidencePath,
  ]);

  const artifactIntegrity = await runAgentSessionV3PilotRealCorpusBatchHandoffArtifactIntegrityReport({
    bundleDir: bundle.outDir,
    prettyJson: true,
  });
  const reviewSummaryArtifactObservation = artifactIntegrity.observations.find((observation) => (
    observation.role === 'review-summary-json'
  ));

  assert.equal(artifactIntegrity.status, 'valid');
  assert.equal(artifactIntegrity.issueCount, 0);
  assert.ok(reviewSummaryArtifactObservation, 'artifact integrity should observe review-summary-json.');
  assert.equal(reviewSummaryArtifactObservation.optionalEvidenceReportCount, 1);
  assert.deepEqual(reviewSummaryArtifactObservation.optionalEvidenceReportPaths, [
    optionalEvidencePath,
  ]);
  assert.match(artifactIntegrity.reportText, /optionalEvidenceReports=1/u);
  assert.match(artifactIntegrity.reportText, /intake-field-completeness-audit\.ts/u);

  const reviewerPacket = await runAgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketSummary({
    bundleDir: bundle.outDir,
    expectedSampleSource: 'real-exported',
    prettyJson: true,
  });

  assert.equal(reviewerPacket.status, 'ready-for-reviewer');
  assert.equal(reviewerPacket.issueCount, 0);
  assert.equal(reviewerPacket.blockerCount, 0);
  assert.equal(reviewerPacket.reviewCount, 0);
  assert.equal(reviewerPacket.optionalEvidenceReportCount, 1);
  assert.deepEqual(reviewerPacket.optionalEvidenceReportPaths, [
    optionalEvidencePath,
  ]);
  assert.match(reviewerPacket.summaryText, /optionalEvidenceReports=1/u);
  assert.match(reviewerPacket.reportText, /optionalEvidenceReports: scripts\/agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit\.ts/u);
  assert.match(reviewerPacket.reportText, /reviewerPacketIssues: none/u);
  assert.match(reviewerPacket.reportText, /no sample collection, threshold decision, readiness change, runtime authority/u);
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch handoff optional evidence continuity smoke ok');
