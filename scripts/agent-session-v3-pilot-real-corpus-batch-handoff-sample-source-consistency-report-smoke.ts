import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { assertSourceDoesNotUseRuntimeOrFixedDesktopChain } from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import { runAgentSessionV3PilotRealCorpusBatchHandoffBundle } from './agent-session-v3-pilot-real-corpus-batch-handoff-bundle.ts';
import { runAgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyReport } from './agent-session-v3-pilot-real-corpus-batch-handoff-sample-source-consistency-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample } from './agent-session-v3-pilot-real-corpus-batch-readiness-rollup-example.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const { source } = readProjectSources({
  source: 'scripts/agent-session-v3-pilot-real-corpus-batch-handoff-sample-source-consistency-report.ts',
});

assert.match(
  source,
  /export async function runAgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyReport/u,
  'handoff sample-source consistency report should expose a caller-owned runner.',
);
assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  source,
  'agent-session-v3-pilot-real-corpus-batch-handoff-sample-source-consistency-report.ts',
);

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-handoff-sample-source-consistency-'));
try {
  const example = await runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample({
    outDir: path.join(tempDir, 'example'),
    prettyJson: true,
  });
  const bundle = await runAgentSessionV3PilotRealCorpusBatchHandoffBundle({
    intakeDirs: [
      example.intakeDirs.missing,
      example.intakeDirs.mixed,
      example.intakeDirs.ready,
    ],
    outDir: path.join(tempDir, 'handoff'),
    prettyJson: true,
    sampleSource: 'real-exported',
  });
  const consistent = await runAgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyReport({
    bundleDir: bundle.outDir,
    expectedSampleSource: 'real-exported',
    includeJsonText: true,
    prettyJson: true,
  });

  assert.equal(consistent.kind, 'agent-session-v3-pilot-real-corpus-batch-handoff-sample-source-consistency-report');
  assert.equal(consistent.version, 1);
  assert.equal(consistent.status, 'consistent');
  assert.equal(consistent.issueCount, 0);
  assert.equal(consistent.blockerCount, 0);
  assert.equal(consistent.reviewCount, 0);
  assert.equal(consistent.sampleSource, 'real-exported');
  assert.equal(consistent.sampleSourceStatus, 'real-exported-evidence');
  assert.equal(consistent.expectedSampleSource, 'real-exported');
  assert.equal(consistent.observations.length, 3);
  assert.deepEqual(
    consistent.observations.map((observation) => observation.label),
    ['handoff-index', 'handoff-manifest', 'readme'],
  );
  assert.match(consistent.summaryText, /status=consistent/u);
  assert.match(consistent.reportText, /sampleSourceConsistencyIssues: none/u);
  assert.match(consistent.reportText, /no sample collection, threshold decision, runtime authority/u);
  assert.ok(consistent.jsonText);
  assert.deepEqual(JSON.parse(consistent.jsonText), {
    ...consistent,
    jsonText: null,
  });

  const unknownBundle = await runAgentSessionV3PilotRealCorpusBatchHandoffBundle({
    intakeDirs: [
      example.intakeDirs.ready,
    ],
    outDir: path.join(tempDir, 'unknown-handoff'),
    prettyJson: true,
  });
  const unknownReport = await runAgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyReport({
    bundleDir: unknownBundle.outDir,
    prettyJson: true,
  });
  assert.equal(unknownReport.status, 'review-needed');
  assert.equal(unknownReport.sampleSource, 'unknown');
  assert.equal(unknownReport.sampleSourceStatus, 'missing-real-sample-declaration');
  assert.deepEqual(
    unknownReport.issues.map((issue) => issue.code),
    ['unknown-sample-source'],
  );

  const readmeText = await readFile(bundle.readmePath, 'utf8');
  await writeFile(
    bundle.readmePath,
    readmeText.replace('Declared sample source: real-exported', 'Declared sample source: rehearsal'),
    'utf8',
  );
  const mismatched = await runAgentSessionV3PilotRealCorpusBatchHandoffSampleSourceConsistencyReport({
    bundleDir: bundle.outDir,
    expectedSampleSource: 'real-exported',
    prettyJson: true,
  });
  assert.equal(mismatched.status, 'blocked');
  assert.ok(mismatched.issues.some((issue) => issue.code === 'sample-source-mismatch'));
  assert.ok(mismatched.issues.some((issue) => issue.code === 'derived-status-mismatch'));
  assert.match(mismatched.reportText, /source=readme/u);
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch handoff sample-source consistency report smoke ok');
