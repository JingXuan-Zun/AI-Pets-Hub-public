import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { assertSourceDoesNotUseRuntimeOrFixedDesktopChain } from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import { runAgentSessionV3PilotRealCorpusBatchHandoffBundle } from './agent-session-v3-pilot-real-corpus-batch-handoff-bundle.ts';
import { runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample } from './agent-session-v3-pilot-real-corpus-batch-readiness-rollup-example.ts';
import { readProjectSources } from './smokeTestHarness.ts';

async function readJsonFile(filePath: string) {
  return JSON.parse(await readFile(filePath, 'utf8')) as Record<string, unknown>;
}

const { bundleSource, runbookText } = readProjectSources({
  bundleSource: 'scripts/agent-session-v3-pilot-real-corpus-batch-handoff-bundle.ts',
  runbookText: 'PROJECT_AGENT_V3_REAL_CORPUS_BATCH_RUNBOOK.md',
});

assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  bundleSource,
  'agent-session-v3-pilot-real-corpus-batch-handoff-bundle.ts e2e rehearsal',
);
assert.match(runbookText, /Read `README\.md` first when handing the bundle to another reviewer/u);
assert.match(runbookText, /Use `handoff-manifest\.txt` for a quick plain-text file list/u);

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-real-corpus-handoff-e2e-'));
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

  const readmeText = await readFile(bundle.readmePath, 'utf8');
  const manifestText = await readFile(bundle.handoffManifestPath, 'utf8');
  const index = await readJsonFile(bundle.indexJsonPath);
  const reviewSummary = await readJsonFile(bundle.reviewSummaryJsonPath);
  const rollup = await readJsonFile(bundle.rollupJsonPath);
  const checklistJsons = await Promise.all(
    bundle.checklistArtifacts.map((artifact) => readJsonFile(artifact.jsonPath)),
  );

  assert.match(readmeText, /1\. Read `review-summary-report\.txt`/u);
  assert.match(readmeText, /2\. Read `readiness-rollup-report\.txt`/u);
  assert.match(readmeText, /3\. Open the `intake-XX-operator-checklist\.txt` files/u);
  assert.match(readmeText, /Declared sample source: rehearsal/u);
  assert.match(readmeText, /Sample source status: synthetic-rehearsal/u);
  assert.match(readmeText, /caller-declared/u);
  assert.match(readmeText, new RegExp(bundle.indexJsonPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u'));
  assert.match(readmeText, new RegExp(bundle.handoffManifestPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u'));
  assert.match(readmeText, /does not collect samples, choose thresholds, change readiness/u);

  assert.match(manifestText, /reviewOrder=review-summary-report,readiness-rollup-report,operator-checklist-drill-down/u);
  assert.match(manifestText, /sampleSource=rehearsal/u);
  assert.match(manifestText, /sampleSourceStatus=synthetic-rehearsal/u);
  assert.match(manifestText, new RegExp(bundle.reviewSummaryReportPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u'));
  assert.match(manifestText, new RegExp(bundle.rollupReportPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u'));
  for (const artifact of bundle.checklistArtifacts) {
    assert.match(manifestText, new RegExp(artifact.reportPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u'));
    assert.match(manifestText, new RegExp(artifact.jsonPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u'));
  }

  assert.equal(index.status, 'blocked');
  assert.deepEqual(index.reviewOrder, [
    'review-summary-report',
    'readiness-rollup-report',
    'operator-checklist-drill-down',
  ]);
  assert.equal(index.readmePath, bundle.readmePath);
  assert.equal(index.handoffManifestPath, bundle.handoffManifestPath);
  assert.equal(index.sampleSource, 'rehearsal');
  assert.equal(index.sampleSourceStatus, 'synthetic-rehearsal');
  assert.equal(index.reviewSummaryReportPath, bundle.reviewSummaryReportPath);
  assert.equal(index.rollupReportPath, bundle.rollupReportPath);
  assert.equal(index.checklistArtifacts.length, 3);

  assert.equal(reviewSummary.kind, 'agent-session-v3-pilot-real-corpus-batch-review-summary');
  assert.equal(reviewSummary.status, 'blocked');
  assert.equal(rollup.kind, 'agent-session-v3-pilot-real-corpus-batch-readiness-rollup-report');
  assert.equal(rollup.status, 'blocked');
  assert.deepEqual(
    checklistJsons.map((checklist) => checklist.status),
    ['blocked', 'review-needed', 'ready-for-manual-review'],
  );

  assert.deepEqual(
    bundle.reviewSummary.intakeEntries.map((entry) => entry.intakeDir),
    bundle.rollup.entries.map((entry) => entry.intakeDir),
  );
  assert.deepEqual(
    bundle.checklistArtifacts.map((artifact) => artifact.intakeDir),
    bundle.rollup.entries.map((entry) => entry.intakeDir),
  );
  assert.match(String(index.guardrail), /caller-owned evidence bundle only/u);
  assert.match(String(index.guardrail), /no threshold decision/u);
  assert.match(String(index.guardrail), /runtime authority/u);
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch handoff bundle e2e rehearsal smoke ok');
