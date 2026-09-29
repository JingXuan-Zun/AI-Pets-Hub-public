import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { assertSourceDoesNotUseRuntimeOrFixedDesktopChain } from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import { runAgentSessionV3PilotRealCorpusBatchHandoffBundle } from './agent-session-v3-pilot-real-corpus-batch-handoff-bundle.ts';
import { runAgentSessionV3PilotRealCorpusBatchHandoffSourcePreflightRollup } from './agent-session-v3-pilot-real-corpus-batch-handoff-source-preflight-rollup.ts';
import { runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample } from './agent-session-v3-pilot-real-corpus-batch-readiness-rollup-example.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const { source } = readProjectSources({
  source: 'scripts/agent-session-v3-pilot-real-corpus-batch-handoff-source-preflight-rollup.ts',
});

assert.match(
  source,
  /export async function runAgentSessionV3PilotRealCorpusBatchHandoffSourcePreflightRollup/u,
  'handoff source preflight rollup should expose a caller-owned runner.',
);
assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  source,
  'agent-session-v3-pilot-real-corpus-batch-handoff-source-preflight-rollup.ts',
);
assert.doesNotMatch(
  source,
  /spawnSync|execSync|npm\.cmd/u,
  'handoff source preflight rollup should not execute shell commands.',
);

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-handoff-source-preflight-rollup-'));
try {
  const example = await runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample({
    outDir: path.join(tempDir, 'example'),
    prettyJson: true,
  });
  const consistentBundle = await runAgentSessionV3PilotRealCorpusBatchHandoffBundle({
    intakeDirs: [
      example.intakeDirs.ready,
    ],
    outDir: path.join(tempDir, 'consistent-handoff'),
    prettyJson: true,
    sampleSource: 'rehearsal',
  });
  const mismatchedBundle = await runAgentSessionV3PilotRealCorpusBatchHandoffBundle({
    intakeDirs: [
      example.intakeDirs.ready,
    ],
    outDir: path.join(tempDir, 'mismatched-handoff'),
    prettyJson: true,
    sampleSource: 'real-exported',
  });
  const unknownBundle = await runAgentSessionV3PilotRealCorpusBatchHandoffBundle({
    intakeDirs: [
      example.intakeDirs.ready,
    ],
    outDir: path.join(tempDir, 'unknown-handoff'),
    prettyJson: true,
    sampleSource: 'unknown',
  });
  const result = await runAgentSessionV3PilotRealCorpusBatchHandoffSourcePreflightRollup({
    entries: [
      {
        expectedSampleSource: 'rehearsal',
        handoffBundleDir: consistentBundle.outDir,
        intakeDir: example.intakeDirs.ready,
        label: 'consistent-rehearsal',
      },
      {
        expectedSampleSource: 'rehearsal',
        handoffBundleDir: mismatchedBundle.outDir,
        intakeDir: example.intakeDirs.ready,
        label: 'mismatched-real-exported',
      },
      {
        handoffBundleDir: unknownBundle.outDir,
        intakeDir: example.intakeDirs.ready,
        label: 'unknown-handoff',
      },
    ],
    includeJsonText: true,
    prettyJson: true,
  });

  assert.equal(result.kind, 'agent-session-v3-pilot-real-corpus-batch-handoff-source-preflight-rollup');
  assert.equal(result.version, 1);
  assert.equal(result.readyForProductionRuntime, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.entryCount, 3);
  assert.deepEqual(result.statusCounts, {
    blocked: 2,
    consistent: 1,
    'review-needed': 0,
  });
  assert.ok(result.issueCount > 0);
  assert.ok(result.blockerCount > 0);
  assert.equal(result.entries[0]?.status, 'consistent');
  assert.equal(result.entries[0]?.sourcePreflightStatus, 'consistent');
  assert.equal(result.entries[0]?.sampleSourceConsistencyStatus, 'consistent');
  assert.equal(result.entries[0]?.reviewerPacketStatus, 'ready-for-reviewer');
  assert.deepEqual(result.entries[0]?.reviewSummaryPhaseCoverage, {
    entryCount: 1,
    statusCounts: {
      clean: 1,
    },
    statuses: [
      'clean',
    ],
  });
  assert.deepEqual(result.entries[0]?.readinessRollupPhaseCoverage, {
    entryCount: 1,
    statusCounts: {
      clean: 1,
    },
    statuses: [
      'clean',
    ],
  });
  assert.deepEqual(result.entries[0]?.sourcePreflightIssueCodes, []);
  assert.deepEqual(result.entries[0]?.sampleSourceConsistencyIssueCodes, []);
  assert.deepEqual(result.entries[0]?.reviewerPacketIssueCodes, []);
  assert.equal(result.entries[1]?.status, 'blocked');
  assert.deepEqual(result.entries[1]?.reviewSummaryPhaseCoverage, {
    entryCount: 1,
    statusCounts: {
      clean: 1,
    },
    statuses: [
      'clean',
    ],
  });
  assert.deepEqual(result.entries[1]?.readinessRollupPhaseCoverage, {
    entryCount: 1,
    statusCounts: {
      clean: 1,
    },
    statuses: [
      'clean',
    ],
  });
  assert.deepEqual(result.entries[1]?.sourcePreflightIssueCodes, [
    'handoff-status-blocked',
    'handoff-source-mismatch',
    'handoff-status-mismatch',
  ]);
  assert.deepEqual(result.entries[1]?.sampleSourceConsistencyIssueCodes, ['expected-source-mismatch']);
  assert.deepEqual(result.entries[1]?.reviewerPacketIssueCodes, ['sample-source-blocked']);
  assert.equal(result.entries[2]?.status, 'blocked');
  assert.deepEqual(result.entries[2]?.reviewSummaryPhaseCoverage, {
    entryCount: 1,
    statusCounts: {
      clean: 1,
    },
    statuses: [
      'clean',
    ],
  });
  assert.deepEqual(result.entries[2]?.readinessRollupPhaseCoverage, {
    entryCount: 1,
    statusCounts: {
      clean: 1,
    },
    statuses: [
      'clean',
    ],
  });
  assert.deepEqual(result.entries[2]?.sourcePreflightIssueCodes, [
    'handoff-status-review-needed',
    'handoff-source-mismatch',
    'handoff-status-mismatch',
  ]);
  assert.deepEqual(result.entries[2]?.sampleSourceConsistencyIssueCodes, ['unknown-sample-source']);
  assert.deepEqual(result.entries[2]?.reviewerPacketIssueCodes, ['sample-source-review-needed']);
  assert.match(result.summaryText, /entries=3/u);
  assert.match(result.summaryText, /consistent=1/u);
  assert.match(result.summaryText, /blocked=2/u);
  assert.match(result.reportText, /handoffSourcePreflightEntries:/u);
  assert.match(result.reportText, /label=consistent-rehearsal status=consistent/u);
  assert.match(result.reportText, /reviewSummaryPhaseCoverage=clean:1/u);
  assert.match(result.reportText, /readinessRollupPhaseCoverage=clean:1/u);
  assert.match(result.reportText, /label=mismatched-real-exported status=blocked/u);
  assert.match(result.reportText, /label=unknown-handoff status=blocked/u);
  assert.match(result.reportText, /guardrail=caller-owned handoff source preflight rollup only/u);
  assert.ok(result.jsonText);
  assert.deepEqual(JSON.parse(result.jsonText), {
    ...result,
    jsonText: null,
  });
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch handoff source preflight rollup smoke ok');
