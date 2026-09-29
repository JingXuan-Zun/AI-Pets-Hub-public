import assert from 'node:assert/strict';
import { assertSourceDoesNotUseRuntimeOrFixedDesktopChain } from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import {
  classifyAgentSessionV3PilotRealCorpusBatchStatusDashboardGap,
  collectAgentSessionV3PilotRealCorpusBatchStatusDashboardGaps,
  createAgentSessionV3PilotRealCorpusBatchStatusDashboardReport,
} from './agent-session-v3-pilot-real-corpus-batch-status-dashboard-report.ts';
import { createAgentSessionV3PilotRealCorpusBatchSmokeIndex } from './agent-session-v3-pilot-real-corpus-batch-smoke-index.ts';
import { projectRoot, readProjectSources } from './smokeTestHarness.ts';

const { source } = readProjectSources({
  source: 'scripts/agent-session-v3-pilot-real-corpus-batch-status-dashboard-report.ts',
});

assert.match(
  source,
  /export function createAgentSessionV3PilotRealCorpusBatchStatusDashboardReport/u,
  'real corpus batch status dashboard should expose a caller-owned report builder.',
);
assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  source,
  'agent-session-v3-pilot-real-corpus-batch-status-dashboard-report.ts',
);
assert.doesNotMatch(
  source,
  /spawnSync|execSync|npm\.cmd/u,
  'status dashboard should not execute smoke tests or shell commands.',
);
assert.match(source, /gap-kind/u);
assert.match(source, /real-corpus-gap/u);

assert.equal(
  classifyAgentSessionV3PilotRealCorpusBatchStatusDashboardGap(
    '- [gap-kind:real-exported-corpus] caller-owned evidence still needed.',
  ),
  'real-exported-corpus',
);
assert.equal(
  classifyAgentSessionV3PilotRealCorpusBatchStatusDashboardGap(
    '- [real-corpus-gap=manifest-distribution] caller-owned manifest evidence pending.',
  ),
  'manifest-distribution',
);
assert.equal(
  classifyAgentSessionV3PilotRealCorpusBatchStatusDashboardGap(
    '- [gap-kind:not-a-real-gap] caller-owned evidence still needed.',
  ),
  null,
);
assert.equal(
  classifyAgentSessionV3PilotRealCorpusBatchStatusDashboardGap(
    '- Real exported corpus batches are still needed.',
  ),
  'real-exported-corpus',
);

const markedGaps = collectAgentSessionV3PilotRealCorpusBatchStatusDashboardGaps([
  '- [gap-kind:real-exported-corpus] marker-based exported corpus gap.',
  '- [real-corpus-gap=broader-real-corpus] marker-based broader corpus gap.',
  '- Marker-free non-gap line.',
].join('\n'));

assert.deepEqual(
  markedGaps.map((gap) => gap.kind),
  [
    'real-exported-corpus',
    'broader-real-corpus',
  ],
);

const result = createAgentSessionV3PilotRealCorpusBatchStatusDashboardReport({
  projectRoot,
});
const smokeIndex = createAgentSessionV3PilotRealCorpusBatchSmokeIndex({
  projectRoot,
});

assert.equal(result.kind, 'agent-session-v3-pilot-real-corpus-batch-status-dashboard-report');
assert.equal(result.version, 1);
assert.equal(result.readyForProductionRuntime, false);
assert.equal(result.smokeIndexMissingCount, 0);
assert.equal(result.smokeIndexUnindexedCount, 0);
assert.equal(result.smokeIndexEntryCount, smokeIndex.entryCount);
assert.equal(result.smokeGroupCounts['status-dashboard'], smokeIndex.groupCounts['status-dashboard']);
assert.equal(result.smokeGroupCounts['gap-action-checklist'], smokeIndex.groupCounts['gap-action-checklist']);
assert.equal(result.smokeGroupCounts['intake-readiness-gate'], smokeIndex.groupCounts['intake-readiness-gate']);
assert.equal(result.smokeGroupCounts['intake-template'], smokeIndex.groupCounts['intake-template']);
assert.ok(result.gapCount > 0, 'dashboard should preserve real sample gaps.');
assert.ok(result.gapCounts['real-exported-corpus'] > 0);
assert.ok(result.gapCounts['broader-real-corpus'] > 0);
assert.ok(result.gapCounts['manifest-distribution'] > 0);
assert.equal(result.gapSourceCounts['explicit-marker'], result.gapCount);
assert.equal(result.gapSourceCounts['legacy-wording'], 0);
assert.ok(result.gaps.every((gap) => gap.source === 'explicit-marker'));
assert.match(result.summaryText, /readyForProductionRuntime=no/u);
assert.match(result.summaryText, /unindexedSmokes=0/u);
assert.match(result.summaryText, /explicitMarkerGaps=/u);
assert.match(result.summaryText, /legacyWordingGaps=0/u);
assert.match(result.reportText, /realSampleGapCounts:/u);
assert.match(result.reportText, /realSampleGapSources:/u);
assert.match(result.reportText, /realSampleGaps:/u);
assert.match(result.reportText, /source=explicit-marker/u);
assert.match(result.reportText, /Real exported corpus batches are still needed/u);
assert.match(result.reportText, /Broader real exported corpus batches are still needed/u);
assert.match(result.reportText, /does not run smoke tests, collect samples, choose thresholds, route permissions, execute tools, decide recovery, define workflows, change readiness, or grant runtime authority/u);

console.log('agent session v3 pilot real corpus batch status dashboard report smoke ok');
