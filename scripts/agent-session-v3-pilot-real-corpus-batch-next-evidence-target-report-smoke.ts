import assert from 'node:assert/strict';
import { assertSourceDoesNotUseRuntimeOrFixedDesktopChain } from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import { createAgentSessionV3PilotRealCorpusBatchNextEvidenceTargetReport } from './agent-session-v3-pilot-real-corpus-batch-next-evidence-target-report.ts';
import { projectRoot, readProjectSources } from './smokeTestHarness.ts';

const { source } = readProjectSources({
  source: 'scripts/agent-session-v3-pilot-real-corpus-batch-next-evidence-target-report.ts',
});

assert.match(
  source,
  /export function createAgentSessionV3PilotRealCorpusBatchNextEvidenceTargetReport/u,
  'real corpus batch next evidence target report should expose a caller-owned report builder.',
);
assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  source,
  'agent-session-v3-pilot-real-corpus-batch-next-evidence-target-report.ts',
);
assert.doesNotMatch(
  source,
  /spawnSync|execSync|npm\.cmd/u,
  'next evidence target report should not execute smoke tests or shell commands.',
);
assert.doesNotMatch(
  source,
  /createTaskQueue|enqueue|handoff bundle creation|sample collector/iu,
  'next evidence target report should not create queues, bundles, or sample collectors.',
);

const result = createAgentSessionV3PilotRealCorpusBatchNextEvidenceTargetReport({
  projectRoot,
});

assert.equal(result.kind, 'agent-session-v3-pilot-real-corpus-batch-next-evidence-target-report');
assert.equal(result.version, 1);
assert.equal(result.readyForProductionRuntime, false);
assert.equal(result.status, 'target-needed');
assert.equal(result.packageHealthStatus, 'missing-real-evidence');
assert.equal(result.missingEvidenceStatus, 'missing-real-evidence');
assert.equal(result.packageEntryCount, 28);
assert.equal(result.missingPackageEntryCount, 0);
assert.deepEqual(result.missingPackageEntryPaths, []);
assert.ok(result.realSampleGapCount > 0, 'next evidence target report should preserve real sample gaps.');
assert.equal(result.gapKindEntryCount, 6);
assert.equal(result.targetCount, 6);
assert.equal(result.nextPriority, 'P0');
assert.deepEqual(result.priorityCounts, {
  P0: 2,
  P1: 2,
  P2: 2,
});
assert.deepEqual(
  result.targets.map((target) => `${target.priority}:${target.gapKind}`),
  [
    'P0:real-production-like-sample',
    'P0:real-exported-corpus',
    'P1:broader-real-corpus',
    'P1:manifest-distribution',
    'P2:real-exported-fixture',
    'P2:real-threshold-profile',
  ],
);
for (const target of result.targets) {
  assert.equal(target.markerSourceCounts['legacy-wording'], 0);
  assert.equal(target.markerSourceCounts['explicit-marker'], target.gapCount);
  assert.doesNotMatch(target.boundary, /runtime action order/iu);
}
assert.match(result.packageHealthSummaryText, /status=missing-real-evidence/u);
assert.match(result.packageHealthSummaryText, /p0IntakeTargetStatusLink=linked/u);
assert.match(result.packageHealthSummaryText, /p0IntakeTargetStatusLinkMissingSignals=0/u);
assert.match(result.missingEvidenceSummaryText, /status=missing-real-evidence/u);
assert.match(result.summaryText, /status=target-needed/u);
assert.match(result.summaryText, /packageHealth=missing-real-evidence/u);
assert.match(result.summaryText, /targets=6/u);
assert.match(result.summaryText, /nextPriority=P0/u);
assert.match(result.summaryText, /readyForProductionRuntime=no/u);
assert.match(result.reportText, /nextEvidenceTargets:/u);
assert.match(result.reportText, /priority=P0 gapKind=real-production-like-sample/u);
assert.match(result.reportText, /priority=P0 gapKind=real-exported-corpus/u);
assert.match(result.reportText, /missingPackageEntries: none/u);
assert.match(result.reportText, /does not collect samples, run smoke tests, create task queues, create handoff bundles, choose thresholds, route permissions, execute tools, decide recovery, define workflows, change readiness, define runtime action order, or grant runtime authority/u);

console.log('agent session v3 pilot real corpus batch next evidence target report smoke ok');
