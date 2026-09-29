import assert from 'node:assert/strict';
import { assertSourceDoesNotUseRuntimeOrFixedDesktopChain } from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import { createAgentSessionV3PilotRealCorpusBatchGapActionChecklist } from './agent-session-v3-pilot-real-corpus-batch-gap-action-checklist.ts';
import { projectRoot, readProjectSources } from './smokeTestHarness.ts';

const { source } = readProjectSources({
  source: 'scripts/agent-session-v3-pilot-real-corpus-batch-gap-action-checklist.ts',
});

assert.match(
  source,
  /export function createAgentSessionV3PilotRealCorpusBatchGapActionChecklist/u,
  'real corpus batch gap action checklist should expose a caller-owned report builder.',
);
assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  source,
  'agent-session-v3-pilot-real-corpus-batch-gap-action-checklist.ts',
);
assert.doesNotMatch(
  source,
  /spawnSync|execSync|npm\.cmd/u,
  'gap action checklist should not execute smoke tests or shell commands.',
);

const result = createAgentSessionV3PilotRealCorpusBatchGapActionChecklist({
  projectRoot,
});
const dashboardGapCountSum = Object.values(result.dashboardGapCounts)
  .reduce((sum, count) => sum + count, 0);

assert.equal(result.kind, 'agent-session-v3-pilot-real-corpus-batch-gap-action-checklist');
assert.equal(result.version, 1);
assert.equal(result.readyForProductionRuntime, false);
assert.equal(result.dashboardGapCount, dashboardGapCountSum);
assert.ok(result.dashboardGapCount >= 6, 'dashboard should preserve at least one gap per current action kind.');
assert.match(result.dashboardSummaryText, new RegExp(`smokes=${result.dashboardSmokeIndexEntryCount}`, 'u'));
assert.ok(result.dashboardSmokeIndexEntryCount > 0);
assert.equal(result.dashboardSmokeIndexMissingCount, 0);
assert.equal(result.dashboardSmokeIndexUnindexedCount, 0);
assert.equal(result.actionCount, 6);
assert.deepEqual(result.priorityCounts, {
  P0: 2,
  P1: 2,
  P2: 2,
});
assert.deepEqual(
  result.actions.map((action) => `${action.priority}:${action.gapKind}`),
  [
    'P0:real-production-like-sample',
    'P0:real-exported-corpus',
    'P1:broader-real-corpus',
    'P1:manifest-distribution',
    'P2:real-exported-fixture',
    'P2:real-threshold-profile',
  ],
);
assert.ok(result.dashboardGapCounts['real-exported-corpus'] > 0);
assert.ok(result.dashboardGapCounts['broader-real-corpus'] > 0);
for (const action of result.actions) {
  assert.equal(
    action.gapCount,
    result.dashboardGapCounts[action.gapKind],
    `${action.gapKind} action count should mirror dashboard gap count.`,
  );
}
assert.match(result.summaryText, new RegExp(`dashboardGaps=${result.dashboardGapCount}`, 'u'));
assert.match(result.summaryText, /readyForProductionRuntime=no/u);
assert.match(result.reportText, /manualActionChecklist:/u);
assert.match(result.reportText, /priority=P0 gapKind=real-production-like-sample/u);
assert.match(result.reportText, /priority=P0 gapKind=real-exported-corpus/u);
assert.match(result.reportText, /priority=P2 gapKind=real-threshold-profile/u);
assert.match(result.reportText, /does not collect samples, run smoke tests, choose thresholds, route permissions, execute tools, decide recovery, define workflows, change readiness, or grant runtime authority/u);

console.log('agent session v3 pilot real corpus batch gap action checklist smoke ok');
