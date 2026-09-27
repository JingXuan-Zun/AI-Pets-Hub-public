import assert from 'node:assert/strict';
import { assertSourceDoesNotUseRuntimeOrFixedDesktopChain } from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import { createAgentSessionV3PilotRealCorpusBatchEvidencePackageIndex } from './agent-session-v3-pilot-real-corpus-batch-evidence-package-index.ts';
import { projectRoot, readProjectSources } from './smokeTestHarness.ts';

const { source } = readProjectSources({
  source: 'scripts/agent-session-v3-pilot-real-corpus-batch-evidence-package-index.ts',
});

assert.match(
  source,
  /export function createAgentSessionV3PilotRealCorpusBatchEvidencePackageIndex/u,
  'real corpus batch evidence package index should expose a caller-owned report builder.',
);
assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  source,
  'agent-session-v3-pilot-real-corpus-batch-evidence-package-index.ts',
);
assert.doesNotMatch(
  source,
  /spawnSync|execSync|npm\.cmd/u,
  'evidence package index should not execute smoke tests or shell commands.',
);

const result = createAgentSessionV3PilotRealCorpusBatchEvidencePackageIndex({
  projectRoot,
});

assert.equal(result.kind, 'agent-session-v3-pilot-real-corpus-batch-evidence-package-index');
assert.equal(result.version, 1);
assert.equal(result.readyForProductionRuntime, false);
assert.equal(result.status, 'indexed');
assert.equal(result.packageEntryCount, 28);
assert.equal(result.missingPackageEntryCount, 0);
assert.deepEqual(result.missingPackageEntryPaths, []);
assert.equal(result.p0IntakeTargetStatusLink.status, 'linked');
assert.deepEqual(result.p0IntakeTargetStatusLink.missingSignals, []);
assert.equal(result.closeoutStatus, 'aligned');
assert.equal(result.missingEvidenceStatus, 'missing-real-evidence');
assert.ok(result.realSampleGapCount > 0, 'evidence package index should preserve real sample gaps.');
assert.ok(result.entries.every((entry) => entry.present));
assert.deepEqual(
  [...new Set(result.entries.map((entry) => entry.kind))].sort(),
  [
    'coverage-guard',
    'handoff-report',
    'manual-gap-report',
    'project-doc',
  ],
);
assert.ok(result.entries.some((entry) => entry.relativePath === 'PROJECT_AGENT_V3_PILOT_PLAN.md'));
assert.ok(result.entries.some((entry) => entry.relativePath === 'PROJECT_AGENT_V3_REAL_CORPUS_BATCH_RUNBOOK.md'));
assert.ok(result.entries.some((entry) => entry.relativePath === 'scripts/agent-session-v3-pilot-real-corpus-batch-closeout-audit.ts'));
assert.ok(result.entries.some((entry) => entry.relativePath === 'scripts/agent-session-v3-pilot-real-corpus-batch-missing-evidence-rollup.ts'));
assert.ok(result.entries.some((entry) => entry.relativePath === 'scripts/agent-session-v3-pilot-real-corpus-batch-final-gap-report.ts'));
assert.ok(result.entries.some((entry) => entry.relativePath === 'scripts/agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit.ts'));
assert.ok(result.entries.some((entry) => entry.relativePath === 'scripts/agent-session-v3-pilot-real-corpus-batch-intake-filling-support-report.ts'));
assert.ok(result.entries.some((entry) => entry.relativePath === 'scripts/agent-session-v3-pilot-real-corpus-batch-intake-readiness-gate-report.ts'));
assert.ok(result.entries.some((entry) => entry.relativePath === 'scripts/agent-session-v3-pilot-real-corpus-batch-next-evidence-target-report.ts'));
assert.ok(result.entries.some((entry) => entry.relativePath === 'scripts/agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts'));
assert.ok(result.entries.some((entry) => entry.relativePath === 'scripts/agent-session-v3-pilot-real-corpus-batch-p0-real-evidence-closeout-report.ts'));
assert.ok(result.entries.some((entry) => entry.relativePath === 'scripts/agent-session-v3-pilot-real-corpus-batch-runbook-completion-report.ts'));
assert.ok(result.entries.some((entry) => entry.relativePath === 'scripts/agent-session-v3-pilot-real-corpus-batch-handoff-bundle.ts'));
assert.ok(result.entries.some((entry) => entry.relativePath === 'scripts/agent-session-v3-pilot-real-corpus-batch-handoff-phase-coverage-consistency-audit.ts'));
assert.ok(result.entries.some((entry) => entry.relativePath === 'scripts/agent-session-v3-pilot-real-corpus-batch-readiness-snapshot-consistency-smoke.ts'));
assert.ok(result.entries.some((entry) => entry.relativePath === 'scripts/agent-session-v3-pilot-real-corpus-batch-next-step-consistency-smoke.ts'));
assert.ok(result.entries.some((entry) => entry.relativePath === 'scripts/agent-session-v3-pilot-real-corpus-batch-intake-field-requirements-consistency-smoke.ts'));
assert.ok(result.entries.some((entry) => entry.relativePath === 'scripts/agent-session-v3-pilot-real-corpus-batch-evidence-package-index.ts'));
assert.match(result.closeoutSummaryText, /status=aligned/u);
assert.match(result.missingEvidenceSummaryText, /status=missing-real-evidence/u);
assert.match(result.summaryText, /status=indexed/u);
assert.match(result.summaryText, /entries=28/u);
assert.match(result.summaryText, /missingEntries=0/u);
assert.match(result.summaryText, /p0IntakeTargetStatusLink=linked/u);
assert.match(result.summaryText, /readyForProductionRuntime=no/u);
assert.match(result.reportText, /missingPackageEntries: none/u);
assert.match(result.reportText, /p0IntakeTargetStatusLink status=linked missingSignals=none/u);
assert.match(result.reportText, /evidencePackageEntries:/u);
assert.match(result.reportText, /kind=handoff-report present=yes/u);
assert.match(result.reportText, /kind=coverage-guard present=yes/u);
assert.match(result.reportText, /path=scripts\/agent-session-v3-pilot-real-corpus-batch-handoff-phase-coverage-consistency-audit\.ts/u);
assert.match(result.reportText, /does not run smoke tests, collect samples, create handoff bundles, choose thresholds, route permissions, execute tools, decide recovery, define workflows, change readiness, define runtime action order, or grant runtime authority/u);

console.log('agent session v3 pilot real corpus batch evidence package index smoke ok');
