import assert from 'node:assert/strict';
import { assertSourceDoesNotUseRuntimeOrFixedDesktopChain } from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import { createAgentSessionV3PilotRealCorpusBatchMissingEvidenceRollup } from './agent-session-v3-pilot-real-corpus-batch-missing-evidence-rollup.ts';
import { projectRoot, readProjectSources } from './smokeTestHarness.ts';

const { source } = readProjectSources({
  source: 'scripts/agent-session-v3-pilot-real-corpus-batch-missing-evidence-rollup.ts',
});

assert.match(
  source,
  /export function createAgentSessionV3PilotRealCorpusBatchMissingEvidenceRollup/u,
  'real corpus batch missing evidence rollup should expose a caller-owned report builder.',
);
assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  source,
  'agent-session-v3-pilot-real-corpus-batch-missing-evidence-rollup.ts',
);
assert.doesNotMatch(
  source,
  /spawnSync|execSync|npm\.cmd/u,
  'missing evidence rollup should not execute smoke tests or shell commands.',
);

const result = createAgentSessionV3PilotRealCorpusBatchMissingEvidenceRollup({
  projectRoot,
});
const dashboardGapCountSum = Object.values(result.dashboardGapCounts)
  .reduce((sum, count) => sum + count, 0);
const entryGapCountSum = result.missingEvidenceEntries
  .reduce((sum, entry) => sum + entry.gapCount, 0);

assert.equal(result.kind, 'agent-session-v3-pilot-real-corpus-batch-missing-evidence-rollup');
assert.equal(result.version, 1);
assert.equal(result.readyForProductionRuntime, false);
assert.equal(result.dashboardGapCount, dashboardGapCountSum);
assert.equal(result.dashboardGapCount, entryGapCountSum);
assert.match(result.dashboardSummaryText, new RegExp(`smokes=${result.dashboardSmokeIndexEntryCount}`, 'u'));
assert.ok(result.dashboardSmokeIndexEntryCount > 0);
assert.equal(result.dashboardSmokeIndexMissingCount, 0);
assert.equal(result.dashboardSmokeIndexUnindexedCount, 0);
assert.equal(result.missingEvidenceStatus, 'missing-real-evidence');
assert.equal(result.markerStatus, 'explicit-marker-covered');
assert.equal(result.dashboardGapSourceCounts['explicit-marker'], result.dashboardGapCount);
assert.equal(result.dashboardGapSourceCounts['legacy-wording'], 0);
assert.equal(result.actionCount, 6);
assert.equal(result.gapKindEntryCount, 6);
assert.deepEqual(result.priorityCounts, {
  P0: 2,
  P1: 2,
  P2: 2,
});
assert.deepEqual(result.unprioritizedGapKinds, []);
assert.deepEqual(
  result.missingEvidenceEntries.map((entry) => `${entry.priority}:${entry.gapKind}`),
  [
    'P0:real-production-like-sample',
    'P0:real-exported-corpus',
    'P1:broader-real-corpus',
    'P1:manifest-distribution',
    'P2:real-exported-fixture',
    'P2:real-threshold-profile',
  ],
);
for (const entry of result.missingEvidenceEntries) {
  assert.equal(
    entry.gapCount,
    result.dashboardGapCounts[entry.gapKind],
    `${entry.gapKind} missing evidence count should mirror dashboard gap count.`,
  );
  assert.equal(entry.markerSourceCounts['legacy-wording'], 0);
  assert.equal(entry.markerSourceCounts['explicit-marker'], entry.gapCount);
  assert.doesNotMatch(entry.boundary, /runtime action order/iu);
}
assert.match(result.summaryText, /status=missing-real-evidence/u);
assert.match(result.summaryText, /markerStatus=explicit-marker-covered/u);
assert.match(result.summaryText, /legacyWordingGaps=0/u);
assert.match(result.reportText, /missingEvidenceByKind:/u);
assert.match(result.reportText, /priority=P0 gapKind=real-production-like-sample/u);
assert.match(result.reportText, /priority=P0 gapKind=real-exported-corpus/u);
assert.match(result.reportText, /dashboardGapSources:/u);
assert.match(result.reportText, /unprioritizedGapKinds: none/u);
assert.match(result.reportText, /does not collect samples, run smoke tests, choose thresholds, route permissions, execute tools, decide recovery, define workflows, change readiness, define runtime action order, or grant runtime authority/u);

console.log('agent session v3 pilot real corpus batch missing evidence rollup smoke ok');
