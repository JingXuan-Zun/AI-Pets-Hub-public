import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { assertSourceDoesNotUseRuntimeOrFixedDesktopChain } from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import { runAgentSessionV3PilotRealCorpusBatchHandoffBundle } from './agent-session-v3-pilot-real-corpus-batch-handoff-bundle.ts';
import { runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample } from './agent-session-v3-pilot-real-corpus-batch-readiness-rollup-example.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const { bundleSource } = readProjectSources({
  bundleSource: 'scripts/agent-session-v3-pilot-real-corpus-batch-handoff-bundle.ts',
});

assert.match(
  bundleSource,
  /export async function runAgentSessionV3PilotRealCorpusBatchHandoffBundle/u,
  'handoff bundle should expose a caller-owned runner.',
);
assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  bundleSource,
  'agent-session-v3-pilot-real-corpus-batch-handoff-bundle.ts',
);

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-real-corpus-handoff-bundle-'));
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

  assert.equal(bundle.kind, 'agent-session-v3-pilot-real-corpus-batch-handoff-bundle');
  assert.equal(bundle.version, 1);
  assert.equal(bundle.sampleSource, 'rehearsal');
  assert.equal(bundle.sampleSourceStatus, 'synthetic-rehearsal');
  assert.equal(bundle.reviewSummary.status, 'blocked');
  assert.equal(bundle.rollup.status, 'blocked');
  assert.equal(bundle.checklistArtifacts.length, 3);
  assert.deepEqual(
    bundle.checklistArtifacts.map((artifact) => artifact.status),
    ['blocked', 'review-needed', 'ready-for-manual-review'],
  );
  assert.match(bundle.summaryText, /status=blocked/u);
  assert.match(bundle.summaryText, /checklists=3/u);
  assert.match(bundle.summaryText, /sampleSource=rehearsal/u);
  assert.match(bundle.summaryText, /sampleSourceStatus=synthetic-rehearsal/u);
  assert.ok(bundle.jsonText);
  assert.deepEqual(JSON.parse(bundle.jsonText), {
    ...bundle,
    jsonText: null,
  });

  assert.deepEqual(
    (await readdir(bundle.outDir)).sort(),
    [
      'README.md',
      'handoff-index.json',
      'handoff-manifest.txt',
      'intake-01-operator-checklist.json',
      'intake-01-operator-checklist.txt',
      'intake-02-operator-checklist.json',
      'intake-02-operator-checklist.txt',
      'intake-03-operator-checklist.json',
      'intake-03-operator-checklist.txt',
      'readiness-rollup-report.json',
      'readiness-rollup-report.txt',
      'review-summary-report.json',
      'review-summary-report.txt',
    ],
  );

  const index = JSON.parse(await readFile(bundle.indexJsonPath, 'utf8'));
  const readmeText = await readFile(bundle.readmePath, 'utf8');
  const manifestText = await readFile(bundle.handoffManifestPath, 'utf8');
  const reviewSummaryText = await readFile(bundle.reviewSummaryReportPath, 'utf8');
  const reviewSummaryJson = JSON.parse(await readFile(bundle.reviewSummaryJsonPath, 'utf8'));
  const rollupText = await readFile(bundle.rollupReportPath, 'utf8');
  const rollupJson = JSON.parse(await readFile(bundle.rollupJsonPath, 'utf8'));
  const firstChecklistText = await readFile(bundle.checklistArtifacts[0].reportPath, 'utf8');
  const thirdChecklistJson = JSON.parse(await readFile(bundle.checklistArtifacts[2].jsonPath, 'utf8'));

  assert.equal(index.generatedBy, 'agent-session-v3-pilot-real-corpus-batch-handoff-bundle');
  assert.deepEqual(index.reviewOrder, [
    'review-summary-report',
    'readiness-rollup-report',
    'operator-checklist-drill-down',
  ]);
  assert.match(index.guardrail, /caller-owned evidence bundle only/u);
  assert.match(index.guardrail, /no threshold decision/u);
  assert.match(index.guardrail, /runtime authority/u);
  assert.equal(index.readmePath, bundle.readmePath);
  assert.equal(index.handoffManifestPath, bundle.handoffManifestPath);
  assert.equal(index.sampleSource, 'rehearsal');
  assert.equal(index.sampleSourceStatus, 'synthetic-rehearsal');
  assert.equal(index.status, 'blocked');
  assert.deepEqual(index.statusCounts, {
    blocked: 1,
    readyForManualReview: 1,
    reviewNeeded: 1,
  });
  assert.equal(index.checklistArtifacts.length, 3);
  assert.equal(reviewSummaryText, bundle.reviewSummary.reportText);
  assert.deepEqual(reviewSummaryJson, bundle.reviewSummary);
  assert.ok(
    reviewSummaryJson.intakeEntries.some((entry: Record<string, unknown>) => (
      (entry.phaseCoverageCounts as Record<string, unknown> | undefined)?.status === 'unavailable'
    )),
  );
  assert.ok(
    reviewSummaryJson.intakeEntries.some((entry: Record<string, unknown>) => (
      (entry.phaseCoverageCounts as Record<string, unknown> | undefined)?.status === 'clean'
    )),
  );
  assert.ok(
    reviewSummaryJson.optionalEvidenceReports.some((report: Record<string, unknown>) => (
      report.path === 'scripts/agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit.ts'
    )),
  );
  assert.equal(rollupText, bundle.rollup.reportText);
  assert.deepEqual(rollupJson, bundle.rollup);
  assert.ok(
    rollupJson.entries.some((entry: Record<string, unknown>) => (
      (entry.phaseCoverageCounts as Record<string, unknown> | undefined)?.status === 'clean'
    )),
  );
  assert.match(readmeText, /Agent Runtime v3 Real Corpus Handoff Bundle/u);
  assert.match(readmeText, /Read `review-summary-report\.txt` for the one-page human overview/u);
  assert.match(readmeText, /Read `readiness-rollup-report\.txt` for repeated checklist item detail/u);
  assert.match(readmeText, /Declared sample source: rehearsal/u);
  assert.match(readmeText, /Sample source status: synthetic-rehearsal/u);
  assert.match(readmeText, /does not infer realness from file content/u);
  assert.match(readmeText, /caller-owned evidence bundle only/u);
  assert.match(manifestText, /sampleSource=rehearsal/u);
  assert.match(manifestText, /sampleSourceStatus=synthetic-rehearsal/u);
  assert.match(manifestText, /sampleSourceGuardrail=caller-declared only/u);
  assert.match(manifestText, /reviewOrder=review-summary-report,readiness-rollup-report,operator-checklist-drill-down/u);
  assert.match(manifestText, /operatorChecklists:/u);
  assert.match(manifestText, /guardrail=caller-owned evidence bundle only/u);
  assert.match(firstChecklistText, /operatorChecklist:/u);
  assert.equal(thirdChecklistJson.kind, 'agent-session-v3-pilot-real-corpus-batch-operator-checklist-report');
  assert.equal(thirdChecklistJson.status, 'ready-for-manual-review');
  assert.equal(thirdChecklistJson.evidenceSummary.phaseCoverageCounts.status, 'clean');

  const defaultSourceBundle = await runAgentSessionV3PilotRealCorpusBatchHandoffBundle({
    intakeDirs: [
      example.intakeDirs.ready,
    ],
    outDir: path.join(tempDir, 'default-source-handoff'),
    prettyJson: true,
  });
  assert.equal(defaultSourceBundle.sampleSource, 'unknown');
  assert.equal(defaultSourceBundle.sampleSourceStatus, 'missing-real-sample-declaration');
  assert.match(defaultSourceBundle.summaryText, /sampleSource=unknown/u);
  assert.match(
    await readFile(defaultSourceBundle.readmePath, 'utf8'),
    /Sample source status: missing-real-sample-declaration/u,
  );
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch handoff bundle smoke ok');
