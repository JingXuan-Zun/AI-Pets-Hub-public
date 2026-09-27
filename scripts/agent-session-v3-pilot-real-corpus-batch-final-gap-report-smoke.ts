import assert from 'node:assert/strict';
import { assertSourceDoesNotUseRuntimeOrFixedDesktopChain } from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import { createAgentSessionV3PilotRealCorpusBatchFinalGapReport } from './agent-session-v3-pilot-real-corpus-batch-final-gap-report.ts';
import { projectRoot, readProjectSources } from './smokeTestHarness.ts';

const { source } = readProjectSources({
  source: 'scripts/agent-session-v3-pilot-real-corpus-batch-final-gap-report.ts',
});

assert.match(
  source,
  /export function createAgentSessionV3PilotRealCorpusBatchFinalGapReport/u,
  'real corpus batch final gap report should expose a caller-owned report builder.',
);
assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  source,
  'agent-session-v3-pilot-real-corpus-batch-final-gap-report.ts',
);
assert.doesNotMatch(
  source,
  /spawnSync|execSync|npm\.cmd/u,
  'final gap report should not execute smoke tests or shell commands.',
);

const result = createAgentSessionV3PilotRealCorpusBatchFinalGapReport({
  projectRoot,
});
const gapCountSum = result.finalGaps.reduce((sum, gap) => sum + gap.gapCount, 0);

assert.equal(result.kind, 'agent-session-v3-pilot-real-corpus-batch-final-gap-report');
assert.equal(result.version, 1);
assert.equal(result.readyForProductionRuntime, false);
assert.equal(result.status, 'missing-real-evidence');
assert.equal(result.finalGapCount, 6);
assert.equal(result.dashboardGapCount, gapCountSum);
assert.deepEqual(result.priorityCounts, {
  P0: 2,
  P1: 2,
  P2: 2,
  unprioritized: 0,
});
assert.deepEqual(
  result.finalGaps.map((gap) => `${gap.priority}:${gap.gapKind}`),
  [
    'P0:real-exported-corpus',
    'P0:real-production-like-sample',
    'P1:broader-real-corpus',
    'P1:manifest-distribution',
    'P2:real-exported-fixture',
    'P2:real-threshold-profile',
  ],
);
for (const gap of result.finalGaps) {
  assert.ok(gap.gapCount > 0);
  assert.ok(gap.sourceReports.includes('PROJECT_AGENT_V3_PILOT_READINESS_CHECKLIST.md'));
  assert.ok(gap.sourceReports.includes('scripts/agent-session-v3-pilot-real-corpus-batch-status-dashboard-report.ts'));
  assert.ok(gap.sourceReports.includes('scripts/agent-session-v3-pilot-real-corpus-batch-gap-action-checklist.ts'));
  assert.ok(gap.sourceReports.includes('scripts/agent-session-v3-pilot-real-corpus-batch-missing-evidence-rollup.ts'));
  assert.doesNotMatch(gap.boundary, /runtime action order/iu);
}
for (const gap of result.finalGaps.filter((entry) => entry.priority === 'P0')) {
  assert.ok(
    gap.sourceReports.includes('scripts/agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts'),
    'P0 final gaps should point to the P0 intake target status report.',
  );
}
assert.match(result.missingEvidenceSummaryText, /status=missing-real-evidence/u);
assert.match(result.summaryText, /status=missing-real-evidence/u);
assert.match(result.summaryText, /finalGaps=6/u);
assert.match(result.summaryText, /P0=2/u);
assert.match(result.reportText, /finalManualGapList:/u);
assert.match(result.reportText, /priority=P0 gapKind=real-exported-corpus/u);
assert.match(result.reportText, /priority=P0 gapKind=real-production-like-sample/u);
assert.match(result.reportText, /sourceReports=PROJECT_AGENT_V3_PILOT_READINESS_CHECKLIST\.md/u);
assert.match(result.reportText, /does not discover directories, collect samples, run smoke tests, create task queues, create handoff bundles, choose thresholds, route permissions, execute tools, decide recovery, define workflows, change readiness, define runtime action order, or grant runtime authority/u);

console.log('agent session v3 pilot real corpus batch final gap report smoke ok');
