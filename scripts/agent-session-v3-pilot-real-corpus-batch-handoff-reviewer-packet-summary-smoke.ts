import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { assertSourceDoesNotUseRuntimeOrFixedDesktopChain } from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import { runAgentSessionV3PilotRealCorpusBatchHandoffBundle } from './agent-session-v3-pilot-real-corpus-batch-handoff-bundle.ts';
import { runAgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketSummary } from './agent-session-v3-pilot-real-corpus-batch-handoff-reviewer-packet-summary.ts';
import { runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample } from './agent-session-v3-pilot-real-corpus-batch-readiness-rollup-example.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const { source } = readProjectSources({
  source: 'scripts/agent-session-v3-pilot-real-corpus-batch-handoff-reviewer-packet-summary.ts',
});

async function rewriteReviewSummaryJson(
  reviewSummaryJsonPath: string,
  rewrite: (value: Record<string, unknown>) => Record<string, unknown>,
) {
  const reviewSummaryJson = JSON.parse(await readFile(reviewSummaryJsonPath, 'utf8')) as Record<string, unknown>;
  await writeFile(
    reviewSummaryJsonPath,
    JSON.stringify(rewrite(reviewSummaryJson), null, 2),
    'utf8',
  );
}

async function assertOptionalEvidenceReportPacketObservation(options: {
  bundleDir: string;
  expectedCount: number;
  expectedPaths: string[];
  expectedText: RegExp;
}) {
  const packet = await runAgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketSummary({
    bundleDir: options.bundleDir,
    expectedSampleSource: 'real-exported',
    prettyJson: true,
  });

  assert.equal(packet.status, 'ready-for-reviewer');
  assert.equal(packet.issueCount, 0);
  assert.equal(packet.blockerCount, 0);
  assert.equal(packet.reviewCount, 0);
  assert.equal(packet.optionalEvidenceReportCount, options.expectedCount);
  assert.deepEqual(packet.optionalEvidenceReportPaths, options.expectedPaths);
  assert.deepEqual(packet.reviewSummaryPhaseCoverage, {
    entryCount: 1,
    statusCounts: {
      clean: 1,
    },
    statuses: [
      'clean',
    ],
  });
  assert.deepEqual(packet.readinessRollupPhaseCoverage, {
    entryCount: 1,
    statusCounts: {
      clean: 1,
    },
    statuses: [
      'clean',
    ],
  });
  assert.match(packet.summaryText, new RegExp(`optionalEvidenceReports=${options.expectedCount}`, 'u'));
  assert.match(packet.reportText, options.expectedText);
  assert.doesNotMatch(packet.reportText, /reviewerPacketIssues:\n- /u);
}

assert.match(
  source,
  /export async function runAgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketSummary/u,
  'handoff reviewer packet summary should expose a caller-owned runner.',
);
assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  source,
  'agent-session-v3-pilot-real-corpus-batch-handoff-reviewer-packet-summary.ts',
);

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-handoff-reviewer-packet-summary-'));
try {
  const example = await runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample({
    outDir: path.join(tempDir, 'example'),
    prettyJson: true,
  });
  const blockedBundle = await runAgentSessionV3PilotRealCorpusBatchHandoffBundle({
    intakeDirs: [
      example.intakeDirs.missing,
      example.intakeDirs.mixed,
      example.intakeDirs.ready,
    ],
    outDir: path.join(tempDir, 'blocked-handoff'),
    prettyJson: true,
    sampleSource: 'rehearsal',
  });
  const reviewNeededPacket = await runAgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketSummary({
    bundleDir: blockedBundle.outDir,
    expectedSampleSource: 'rehearsal',
    includeJsonText: true,
    prettyJson: true,
  });

  assert.equal(reviewNeededPacket.kind, 'agent-session-v3-pilot-real-corpus-batch-handoff-reviewer-packet-summary');
  assert.equal(reviewNeededPacket.version, 1);
  assert.equal(reviewNeededPacket.status, 'review-needed');
  assert.equal(reviewNeededPacket.artifactIntegrity.status, 'valid');
  assert.equal(reviewNeededPacket.sampleSourceConsistency.status, 'consistent');
  assert.equal(reviewNeededPacket.reviewSummaryStatus, 'blocked');
  assert.equal(reviewNeededPacket.readinessRollupStatus, 'blocked');
  assert.equal(reviewNeededPacket.optionalEvidenceReportCount, 1);
  assert.deepEqual(reviewNeededPacket.optionalEvidenceReportPaths, [
    'scripts/agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit.ts',
  ]);
  assert.deepEqual(reviewNeededPacket.reviewSummaryPhaseCoverage, {
    entryCount: 3,
    statusCounts: {
      clean: 2,
      unavailable: 1,
    },
    statuses: [
      'clean',
      'unavailable',
    ],
  });
  assert.deepEqual(reviewNeededPacket.readinessRollupPhaseCoverage, {
    entryCount: 3,
    statusCounts: {
      clean: 2,
      unavailable: 1,
    },
    statuses: [
      'clean',
      'unavailable',
    ],
  });
  assert.ok(reviewNeededPacket.issues.some((issue) => issue.code === 'review-summary-blocked'));
  assert.ok(reviewNeededPacket.issues.some((issue) => issue.code === 'readiness-rollup-blocked'));
  assert.match(reviewNeededPacket.summaryText, /artifactIntegrity=valid/u);
  assert.match(reviewNeededPacket.summaryText, /optionalEvidenceReports=1/u);
  assert.match(reviewNeededPacket.summaryText, /reviewSummaryPhaseCoverage=clean:2,unavailable:1/u);
  assert.match(reviewNeededPacket.summaryText, /readinessRollupPhaseCoverage=clean:2,unavailable:1/u);
  assert.match(reviewNeededPacket.summaryText, /sampleSource=synthetic-rehearsal/u);
  assert.match(reviewNeededPacket.reportText, /reviewerPacketIssues:/u);
  assert.match(reviewNeededPacket.reportText, /reviewSummaryPhaseCoverage: clean:2,unavailable:1/u);
  assert.match(reviewNeededPacket.reportText, /readinessRollupPhaseCoverage: clean:2,unavailable:1/u);
  assert.match(reviewNeededPacket.reportText, /optionalEvidenceReports: scripts\/agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit\.ts/u);
  assert.match(reviewNeededPacket.reportText, /no sample collection, threshold decision, readiness change, runtime authority/u);
  assert.ok(reviewNeededPacket.jsonText);
  assert.deepEqual(JSON.parse(reviewNeededPacket.jsonText), {
    ...reviewNeededPacket,
    jsonText: null,
  });

  const unknownBundle = await runAgentSessionV3PilotRealCorpusBatchHandoffBundle({
    intakeDirs: [
      example.intakeDirs.ready,
    ],
    outDir: path.join(tempDir, 'unknown-handoff'),
    prettyJson: true,
  });
  const unknownPacket = await runAgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketSummary({
    bundleDir: unknownBundle.outDir,
    prettyJson: true,
  });
  assert.equal(unknownPacket.status, 'review-needed');
  assert.equal(unknownPacket.sampleSourceConsistency.status, 'review-needed');
  assert.ok(unknownPacket.issues.some((issue) => issue.code === 'sample-source-review-needed'));

  const brokenBundle = await runAgentSessionV3PilotRealCorpusBatchHandoffBundle({
    intakeDirs: [
      example.intakeDirs.ready,
    ],
    outDir: path.join(tempDir, 'broken-handoff'),
    prettyJson: true,
    sampleSource: 'real-exported',
  });
  await unlink(brokenBundle.rollupJsonPath);
  const blockedPacket = await runAgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketSummary({
    bundleDir: brokenBundle.outDir,
    expectedSampleSource: 'real-exported',
    prettyJson: true,
  });
  assert.equal(blockedPacket.status, 'blocked');
  assert.equal(blockedPacket.artifactIntegrity.status, 'blocked');
  assert.ok(blockedPacket.issues.some((issue) => issue.code === 'artifact-integrity-blocked'));

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
    prettyJson: true,
  });
  assert.equal(invalidReviewSummaryPacket.status, 'blocked');
  assert.ok(invalidReviewSummaryPacket.issues.some((issue) => issue.code === 'invalid-review-summary-json'));

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
    prettyJson: true,
  });
  assert.equal(invalidReadinessRollupPacket.status, 'blocked');
  assert.ok(invalidReadinessRollupPacket.issues.some((issue) => issue.code === 'invalid-readiness-rollup-json'));

  const missingOptionalBundle = await runAgentSessionV3PilotRealCorpusBatchHandoffBundle({
    intakeDirs: [
      example.intakeDirs.ready,
    ],
    outDir: path.join(tempDir, 'missing-optional-evidence-handoff'),
    prettyJson: true,
    sampleSource: 'real-exported',
  });
  await rewriteReviewSummaryJson(missingOptionalBundle.reviewSummaryJsonPath, (reviewSummaryJson) => {
    delete reviewSummaryJson.optionalEvidenceReports;
    return reviewSummaryJson;
  });
  await assertOptionalEvidenceReportPacketObservation({
    bundleDir: missingOptionalBundle.outDir,
    expectedCount: 0,
    expectedPaths: [],
    expectedText: /optionalEvidenceReports: none/u,
  });

  const emptyOptionalBundle = await runAgentSessionV3PilotRealCorpusBatchHandoffBundle({
    intakeDirs: [
      example.intakeDirs.ready,
    ],
    outDir: path.join(tempDir, 'empty-optional-evidence-handoff'),
    prettyJson: true,
    sampleSource: 'real-exported',
  });
  await rewriteReviewSummaryJson(emptyOptionalBundle.reviewSummaryJsonPath, (reviewSummaryJson) => ({
    ...reviewSummaryJson,
    optionalEvidenceReports: [],
  }));
  await assertOptionalEvidenceReportPacketObservation({
    bundleDir: emptyOptionalBundle.outDir,
    expectedCount: 0,
    expectedPaths: [],
    expectedText: /optionalEvidenceReports: none/u,
  });

  const malformedOptionalBundle = await runAgentSessionV3PilotRealCorpusBatchHandoffBundle({
    intakeDirs: [
      example.intakeDirs.ready,
    ],
    outDir: path.join(tempDir, 'malformed-optional-evidence-handoff'),
    prettyJson: true,
    sampleSource: 'real-exported',
  });
  await rewriteReviewSummaryJson(malformedOptionalBundle.reviewSummaryJsonPath, (reviewSummaryJson) => ({
    ...reviewSummaryJson,
    optionalEvidenceReports: [
      null,
      'not-an-object',
      {
        path: 123,
      },
      {
        path: 'scripts/custom-reviewer-follow-up.ts',
      },
    ],
  }));
  await assertOptionalEvidenceReportPacketObservation({
    bundleDir: malformedOptionalBundle.outDir,
    expectedCount: 1,
    expectedPaths: [
      'scripts/custom-reviewer-follow-up.ts',
    ],
    expectedText: /optionalEvidenceReports: scripts\/custom-reviewer-follow-up\.ts/u,
  });

  const missingPhaseCoverageBundle = await runAgentSessionV3PilotRealCorpusBatchHandoffBundle({
    intakeDirs: [
      example.intakeDirs.ready,
    ],
    outDir: path.join(tempDir, 'missing-phase-coverage-handoff'),
    prettyJson: true,
    sampleSource: 'real-exported',
  });
  await rewriteReviewSummaryJson(missingPhaseCoverageBundle.reviewSummaryJsonPath, (reviewSummaryJson) => ({
    ...reviewSummaryJson,
    intakeEntries: [
      {
        ...(reviewSummaryJson.intakeEntries as Record<string, unknown>[])[0],
        phaseCoverageCounts: undefined,
      },
    ],
  }));
  const missingPhaseCoveragePacket = await runAgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketSummary({
    bundleDir: missingPhaseCoverageBundle.outDir,
    expectedSampleSource: 'real-exported',
    prettyJson: true,
  });
  assert.equal(missingPhaseCoveragePacket.status, 'ready-for-reviewer');
  assert.deepEqual(missingPhaseCoveragePacket.reviewSummaryPhaseCoverage, {
    entryCount: 0,
    statusCounts: {},
    statuses: [],
  });
  assert.deepEqual(missingPhaseCoveragePacket.readinessRollupPhaseCoverage, {
    entryCount: 1,
    statusCounts: {
      clean: 1,
    },
    statuses: [
      'clean',
    ],
  });
  assert.match(missingPhaseCoveragePacket.reportText, /reviewSummaryPhaseCoverage: none/u);
  assert.match(missingPhaseCoveragePacket.reportText, /reviewerPacketIssues: none/u);
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch handoff reviewer packet summary smoke ok');
