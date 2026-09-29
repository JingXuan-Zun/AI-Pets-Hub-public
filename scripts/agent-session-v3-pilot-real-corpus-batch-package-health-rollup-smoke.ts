import assert from 'node:assert/strict';
import { assertSourceDoesNotUseRuntimeOrFixedDesktopChain } from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import { createAgentSessionV3PilotRealCorpusBatchPackageHealthRollup } from './agent-session-v3-pilot-real-corpus-batch-package-health-rollup.ts';
import { projectRoot, readProjectSources } from './smokeTestHarness.ts';

const { source } = readProjectSources({
  source: 'scripts/agent-session-v3-pilot-real-corpus-batch-package-health-rollup.ts',
});

assert.match(
  source,
  /export function createAgentSessionV3PilotRealCorpusBatchPackageHealthRollup/u,
  'real corpus batch package health rollup should expose a caller-owned report builder.',
);
assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  source,
  'agent-session-v3-pilot-real-corpus-batch-package-health-rollup.ts',
);
assert.doesNotMatch(
  source,
  /spawnSync|execSync|npm\.cmd/u,
  'package health rollup should not execute smoke tests or shell commands.',
);

const result = createAgentSessionV3PilotRealCorpusBatchPackageHealthRollup({
  projectRoot,
});

assert.equal(result.kind, 'agent-session-v3-pilot-real-corpus-batch-package-health-rollup');
assert.equal(result.version, 1);
assert.equal(result.readyForProductionRuntime, false);
assert.equal(result.status, 'missing-real-evidence');
assert.equal(result.packageEntryCount, 28);
assert.equal(result.missingPackageEntryCount, 0);
assert.deepEqual(result.missingPackageEntryPaths, []);
assert.equal(result.p0IntakeTargetStatusLinkStatus, 'linked');
assert.equal(result.p0IntakeTargetStatusLinkMissingSignalCount, 0);
assert.ok(result.realSampleGapCount > 0, 'package health should preserve real sample gaps.');
assert.equal(result.gapKindEntryCount, 6);
assert.equal(result.unprioritizedGapCount, 0);
assert.equal(result.markerStatus, 'explicit-marker-covered');
assert.equal(result.closeoutStatus, 'aligned');
assert.deepEqual(result.priorityCounts, {
  P0: 2,
  P1: 2,
  P2: 2,
});
assert.match(result.evidencePackageSummaryText, /status=indexed/u);
assert.match(result.missingEvidenceSummaryText, /status=missing-real-evidence/u);
assert.match(result.summaryText, /status=missing-real-evidence/u);
assert.match(result.summaryText, /packageEntries=28/u);
assert.match(result.summaryText, /missingPackageEntries=0/u);
assert.match(result.summaryText, /p0IntakeTargetStatusLink=linked/u);
assert.match(result.summaryText, /p0IntakeTargetStatusLinkMissingSignals=0/u);
assert.match(result.summaryText, /P0=2/u);
assert.match(result.summaryText, /P1=2/u);
assert.match(result.summaryText, /P2=2/u);
assert.match(result.summaryText, /readyForProductionRuntime=no/u);
assert.match(result.reportText, /priorityCounts:/u);
assert.match(result.reportText, /p0IntakeTargetStatusLink status=linked missingSignals=0/u);
assert.match(result.reportText, /missingPackageEntries: none/u);
assert.match(result.reportText, /does not run smoke tests, collect samples, create handoff bundles, choose thresholds, route permissions, execute tools, decide recovery, define workflows, change readiness, define runtime action order, or grant runtime authority/u);

console.log('agent session v3 pilot real corpus batch package health rollup smoke ok');
