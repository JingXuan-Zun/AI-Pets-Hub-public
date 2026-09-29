import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { assertSourceDoesNotUseRuntimeOrFixedDesktopChain } from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import { runAgentSessionV3PilotRealCorpusBatchHandoffArtifactIntegrityReport } from './agent-session-v3-pilot-real-corpus-batch-handoff-artifact-integrity-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchHandoffBundle } from './agent-session-v3-pilot-real-corpus-batch-handoff-bundle.ts';
import { runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample } from './agent-session-v3-pilot-real-corpus-batch-readiness-rollup-example.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const { source } = readProjectSources({
  source: 'scripts/agent-session-v3-pilot-real-corpus-batch-handoff-artifact-integrity-report.ts',
});

async function assertOptionalEvidenceReportsObservation(options: {
  bundleDir: string;
  expectedCount: number;
  expectedPaths: string[];
  expectedText: RegExp;
}) {
  const report = await runAgentSessionV3PilotRealCorpusBatchHandoffArtifactIntegrityReport({
    bundleDir: options.bundleDir,
    prettyJson: true,
  });
  const observation = report.observations.find((entry) => (
    entry.role === 'review-summary-json'
  ));

  assert.equal(report.status, 'valid');
  assert.equal(report.issueCount, 0);
  assert.equal(report.blockerCount, 0);
  assert.ok(observation, 'artifact integrity should observe the review summary JSON artifact.');
  assert.equal(observation.optionalEvidenceReportCount, options.expectedCount);
  assert.deepEqual(observation.optionalEvidenceReportPaths, options.expectedPaths);
  assert.deepEqual(observation.phaseCoverage, {
    entryCount: 1,
    statusCounts: {
      clean: 1,
    },
    statuses: [
      'clean',
    ],
  });
  assert.match(report.reportText, options.expectedText);
}

assert.match(
  source,
  /export async function runAgentSessionV3PilotRealCorpusBatchHandoffArtifactIntegrityReport/u,
  'handoff artifact integrity report should expose a caller-owned runner.',
);
assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  source,
  'agent-session-v3-pilot-real-corpus-batch-handoff-artifact-integrity-report.ts',
);

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-handoff-artifact-integrity-'));
try {
  const example = await runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample({
    outDir: path.join(tempDir, 'example'),
    prettyJson: true,
  });
  const bundle = await runAgentSessionV3PilotRealCorpusBatchHandoffBundle({
    includeJsonText: true,
    intakeDirs: [
      example.intakeDirs.missing,
      example.intakeDirs.mixed,
      example.intakeDirs.ready,
    ],
    outDir: path.join(tempDir, 'handoff'),
    prettyJson: true,
    sampleSource: 'rehearsal',
  });
  const validReport = await runAgentSessionV3PilotRealCorpusBatchHandoffArtifactIntegrityReport({
    bundleDir: bundle.outDir,
    includeJsonText: true,
    prettyJson: true,
  });

  assert.equal(validReport.kind, 'agent-session-v3-pilot-real-corpus-batch-handoff-artifact-integrity-report');
  assert.equal(validReport.version, 1);
  assert.equal(validReport.status, 'valid');
  assert.equal(validReport.issueCount, 0);
  assert.equal(validReport.blockerCount, 0);
  assert.equal(validReport.artifactCount, 13);
  assert.equal(validReport.presentArtifactCount, 13);
  assert.equal(validReport.missingArtifactCount, 0);
  const reviewSummaryJsonObservation = validReport.observations.find((observation) => (
    observation.role === 'review-summary-json'
  ));
  assert.ok(reviewSummaryJsonObservation, 'artifact integrity should observe the review summary JSON artifact.');
  assert.equal(reviewSummaryJsonObservation.optionalEvidenceReportCount, 1);
  assert.deepEqual(reviewSummaryJsonObservation.optionalEvidenceReportPaths, [
    'scripts/agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit.ts',
  ]);
  assert.deepEqual(reviewSummaryJsonObservation.phaseCoverage, {
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
  const readinessRollupJsonObservation = validReport.observations.find((observation) => (
    observation.role === 'readiness-rollup-json'
  ));
  assert.ok(readinessRollupJsonObservation, 'artifact integrity should observe the readiness rollup JSON artifact.');
  assert.deepEqual(readinessRollupJsonObservation.phaseCoverage, {
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
  assert.ok(validReport.observations.some((observation) => (
    observation.role === 'operator-checklist-json'
    && observation.phaseCoverage?.entryCount === 1
    && observation.phaseCoverage.statusCounts.clean === 1
  )));
  assert.match(validReport.summaryText, /status=valid/u);
  assert.match(validReport.reportText, /handoffArtifactIntegrityIssues: none/u);
  assert.match(validReport.reportText, /review-summary-json/u);
  assert.match(validReport.reportText, /optionalEvidenceReports=1/u);
  assert.match(validReport.reportText, /optionalEvidenceReportPaths=scripts\/agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit\.ts/u);
  assert.match(validReport.reportText, /phaseCoverageEntries=3/u);
  assert.match(validReport.reportText, /phaseCoverageStatuses=clean:2,unavailable:1/u);
  assert.match(validReport.reportText, /operator-checklist-json/u);
  assert.match(validReport.reportText, /no sample collection, threshold decision, readiness change, runtime authority/u);
  assert.ok(validReport.jsonText);
  assert.deepEqual(JSON.parse(validReport.jsonText), {
    ...validReport,
    jsonText: null,
  });

  await unlink(bundle.rollupJsonPath);
  const missingReport = await runAgentSessionV3PilotRealCorpusBatchHandoffArtifactIntegrityReport({
    bundleDir: bundle.outDir,
    prettyJson: true,
  });
  assert.equal(missingReport.status, 'blocked');
  assert.ok(missingReport.issues.some((issue) => issue.code === 'missing-artifact'));
  assert.ok(missingReport.observations.some((observation) => (
    observation.role === 'readiness-rollup-json' && !observation.present
  )));

  const secondBundle = await runAgentSessionV3PilotRealCorpusBatchHandoffBundle({
    intakeDirs: [
      example.intakeDirs.ready,
    ],
    outDir: path.join(tempDir, 'kind-mismatch-handoff'),
    prettyJson: true,
    sampleSource: 'real-exported',
  });
  const reviewSummaryJson = JSON.parse(await readFile(secondBundle.reviewSummaryJsonPath, 'utf8'));
  await writeFile(
    secondBundle.reviewSummaryJsonPath,
    JSON.stringify({
      ...reviewSummaryJson,
      kind: 'wrong-kind',
    }, null, 2),
    'utf8',
  );
  const kindMismatchReport = await runAgentSessionV3PilotRealCorpusBatchHandoffArtifactIntegrityReport({
    bundleDir: secondBundle.outDir,
    prettyJson: true,
  });
  assert.equal(kindMismatchReport.status, 'blocked');
  assert.ok(kindMismatchReport.issues.some((issue) => issue.code === 'unexpected-kind'));
  assert.match(kindMismatchReport.reportText, /wrong-kind/u);

  const missingOptionalBundle = await runAgentSessionV3PilotRealCorpusBatchHandoffBundle({
    intakeDirs: [
      example.intakeDirs.ready,
    ],
    outDir: path.join(tempDir, 'missing-optional-evidence-handoff'),
    prettyJson: true,
    sampleSource: 'real-exported',
  });
  const missingOptionalReviewSummaryJson = JSON.parse(
    await readFile(missingOptionalBundle.reviewSummaryJsonPath, 'utf8'),
  );
  delete missingOptionalReviewSummaryJson.optionalEvidenceReports;
  await writeFile(
    missingOptionalBundle.reviewSummaryJsonPath,
    JSON.stringify(missingOptionalReviewSummaryJson, null, 2),
    'utf8',
  );
  await assertOptionalEvidenceReportsObservation({
    bundleDir: missingOptionalBundle.outDir,
    expectedCount: 0,
    expectedPaths: [],
    expectedText: /optionalEvidenceReports=0/u,
  });

  const emptyOptionalBundle = await runAgentSessionV3PilotRealCorpusBatchHandoffBundle({
    intakeDirs: [
      example.intakeDirs.ready,
    ],
    outDir: path.join(tempDir, 'empty-optional-evidence-handoff'),
    prettyJson: true,
    sampleSource: 'real-exported',
  });
  const emptyOptionalReviewSummaryJson = JSON.parse(
    await readFile(emptyOptionalBundle.reviewSummaryJsonPath, 'utf8'),
  );
  await writeFile(
    emptyOptionalBundle.reviewSummaryJsonPath,
    JSON.stringify({
      ...emptyOptionalReviewSummaryJson,
      optionalEvidenceReports: [],
    }, null, 2),
    'utf8',
  );
  await assertOptionalEvidenceReportsObservation({
    bundleDir: emptyOptionalBundle.outDir,
    expectedCount: 0,
    expectedPaths: [],
    expectedText: /optionalEvidenceReports=0/u,
  });

  const malformedOptionalBundle = await runAgentSessionV3PilotRealCorpusBatchHandoffBundle({
    intakeDirs: [
      example.intakeDirs.ready,
    ],
    outDir: path.join(tempDir, 'malformed-optional-evidence-handoff'),
    prettyJson: true,
    sampleSource: 'real-exported',
  });
  const malformedOptionalReviewSummaryJson = JSON.parse(
    await readFile(malformedOptionalBundle.reviewSummaryJsonPath, 'utf8'),
  );
  await writeFile(
    malformedOptionalBundle.reviewSummaryJsonPath,
    JSON.stringify({
      ...malformedOptionalReviewSummaryJson,
      optionalEvidenceReports: [
        null,
        'not-an-object',
        {
          path: 123,
        },
        {
          path: 'scripts/custom-follow-up.ts',
        },
      ],
    }, null, 2),
    'utf8',
  );
  await assertOptionalEvidenceReportsObservation({
    bundleDir: malformedOptionalBundle.outDir,
    expectedCount: 1,
    expectedPaths: [
      'scripts/custom-follow-up.ts',
    ],
    expectedText: /optionalEvidenceReportPaths=scripts\/custom-follow-up\.ts/u,
  });

  const missingPhaseCoverageBundle = await runAgentSessionV3PilotRealCorpusBatchHandoffBundle({
    intakeDirs: [
      example.intakeDirs.ready,
    ],
    outDir: path.join(tempDir, 'missing-phase-coverage-handoff'),
    prettyJson: true,
    sampleSource: 'real-exported',
  });
  const missingPhaseCoverageReviewSummaryJson = JSON.parse(
    await readFile(missingPhaseCoverageBundle.reviewSummaryJsonPath, 'utf8'),
  );
  await writeFile(
    missingPhaseCoverageBundle.reviewSummaryJsonPath,
    JSON.stringify({
      ...missingPhaseCoverageReviewSummaryJson,
      intakeEntries: [
        {
          ...missingPhaseCoverageReviewSummaryJson.intakeEntries[0],
          phaseCoverageCounts: undefined,
        },
      ],
    }, null, 2),
    'utf8',
  );
  const missingPhaseCoverageReport = await runAgentSessionV3PilotRealCorpusBatchHandoffArtifactIntegrityReport({
    bundleDir: missingPhaseCoverageBundle.outDir,
    prettyJson: true,
  });
  const missingPhaseCoverageObservation = missingPhaseCoverageReport.observations.find((observation) => (
    observation.role === 'review-summary-json'
  ));
  assert.equal(missingPhaseCoverageReport.status, 'valid');
  assert.ok(missingPhaseCoverageObservation, 'missing phase coverage should still produce a review summary observation.');
  assert.deepEqual(missingPhaseCoverageObservation.phaseCoverage, {
    entryCount: 0,
    statusCounts: {},
    statuses: [],
  });
  assert.match(missingPhaseCoverageReport.reportText, /phaseCoverageStatuses=none/u);
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch handoff artifact integrity report smoke ok');
