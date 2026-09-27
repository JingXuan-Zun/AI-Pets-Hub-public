import assert from 'node:assert/strict';
import { assertSourceDoesNotUseRuntimeOrFixedDesktopChain } from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import {
  classifyAgentSessionV3PilotRealCorpusBatchStatusDashboardGap,
  collectAgentSessionV3PilotRealCorpusBatchStatusDashboardGaps,
  createAgentSessionV3PilotRealCorpusBatchStatusDashboardReport,
} from './agent-session-v3-pilot-real-corpus-batch-status-dashboard-report.ts';
import { projectRoot, readProjectSources } from './smokeTestHarness.ts';

const explicitMarkerPattern = /\[(?:gap-kind|real-corpus-gap)\s*[:=]\s*[a-z0-9-]+\]/u;

const {
  dashboardSource,
  markerCoverageSource,
  checklistText,
} = readProjectSources({
  dashboardSource: 'scripts/agent-session-v3-pilot-real-corpus-batch-status-dashboard-report.ts',
  markerCoverageSource: 'scripts/agent-session-v3-pilot-real-corpus-batch-status-dashboard-gap-marker-coverage-smoke.ts',
  checklistText: 'PROJECT_AGENT_V3_PILOT_READINESS_CHECKLIST.md',
});

assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  dashboardSource,
  'agent-session-v3-pilot-real-corpus-batch-status-dashboard-report.ts',
);
assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  markerCoverageSource,
  'agent-session-v3-pilot-real-corpus-batch-status-dashboard-gap-marker-coverage-smoke.ts',
);
const shellExecutionPattern = new RegExp([
  ['spa', 'wnSync'].join(''),
  ['ex', 'ecSync'].join(''),
  ['npm', '\\.cmd'].join(''),
].join('|'), 'u');

assert.doesNotMatch(
  markerCoverageSource,
  shellExecutionPattern,
  'gap marker coverage smoke should inspect files directly instead of executing smoke tests or shell commands.',
);

const collectedGaps = collectAgentSessionV3PilotRealCorpusBatchStatusDashboardGaps(checklistText);
const markedGaps = collectedGaps.filter((gap) => explicitMarkerPattern.test(gap.line));
const unmarkedGaps = collectedGaps.filter((gap) => !explicitMarkerPattern.test(gap.line));
const dashboard = createAgentSessionV3PilotRealCorpusBatchStatusDashboardReport({
  projectRoot,
});

assert.ok(collectedGaps.length > 0, 'readiness checklist should still expose real-sample gaps.');
assert.deepEqual(
  unmarkedGaps.map((gap) => gap.line),
  [],
  'every dashboard-collected readiness checklist gap should include an explicit gap marker.',
);
assert.equal(markedGaps.length, collectedGaps.length);
assert.equal(markedGaps.length, dashboard.gapCount);
assert.equal(dashboard.gapSourceCounts['explicit-marker'], dashboard.gapCount);
assert.equal(dashboard.gapSourceCounts['legacy-wording'], 0);
assert.ok(dashboard.gaps.every((gap) => gap.source === 'explicit-marker'));
assert.deepEqual(
  markedGaps.map((gap) => gap.kind),
  dashboard.gaps.map((gap) => gap.kind),
);

const markerCounts = Object.fromEntries(
  Object.keys(dashboard.gapCounts).map((kind) => [kind, 0]),
) as Record<string, number>;
for (const gap of markedGaps) {
  markerCounts[gap.kind] += 1;
}
assert.deepEqual(
  markerCounts,
  dashboard.gapCounts,
  'explicit marker coverage should preserve the dashboard gap kind distribution.',
);

assert.equal(
  classifyAgentSessionV3PilotRealCorpusBatchStatusDashboardGap(
    '- [gap-kind:real-exported-corpus] wording changed but marker remains authoritative.',
  ),
  'real-exported-corpus',
);
assert.equal(
  classifyAgentSessionV3PilotRealCorpusBatchStatusDashboardGap(
    '- [real-corpus-gap=broader-real-corpus] wording changed but alternate marker remains authoritative.',
  ),
  'broader-real-corpus',
);
assert.equal(
  classifyAgentSessionV3PilotRealCorpusBatchStatusDashboardGap(
    '- [gap-kind:not-a-real-gap] Real exported corpus batches are still needed.',
  ),
  'real-exported-corpus',
  'invalid explicit markers should fall back to legacy wording instead of creating a new kind.',
);
assert.equal(
  classifyAgentSessionV3PilotRealCorpusBatchStatusDashboardGap(
    '- Real exported corpus batches are still needed.',
  ),
  'real-exported-corpus',
  'legacy wording fallback should remain compatible for old checklist lines.',
);

console.log('agent session v3 pilot real corpus batch status dashboard gap marker coverage smoke ok');
