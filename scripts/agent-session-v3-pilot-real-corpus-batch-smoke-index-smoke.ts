import assert from 'node:assert/strict';
import { assertSourceDoesNotUseRuntimeOrFixedDesktopChain } from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import { createAgentSessionV3PilotRealCorpusBatchSmokeIndex } from './agent-session-v3-pilot-real-corpus-batch-smoke-index.ts';
import { projectRoot, readProjectSources } from './smokeTestHarness.ts';

const { source } = readProjectSources({
  source: 'scripts/agent-session-v3-pilot-real-corpus-batch-smoke-index.ts',
});

assert.match(
  source,
  /export function createAgentSessionV3PilotRealCorpusBatchSmokeIndex/u,
  'real corpus batch smoke index should expose a caller-owned report builder.',
);
assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  source,
  'agent-session-v3-pilot-real-corpus-batch-smoke-index.ts',
);
assert.doesNotMatch(
  source,
  /spawnSync|execSync|tsx|npm\.cmd/u,
  'smoke index should not execute smoke tests or shell commands.',
);

const result = createAgentSessionV3PilotRealCorpusBatchSmokeIndex({
  projectRoot,
});

assert.equal(result.kind, 'agent-session-v3-pilot-real-corpus-batch-smoke-index');
assert.equal(result.version, 1);
assert.equal(result.entryCount, 91);
assert.equal(result.missingCount, 0);
assert.deepEqual(result.missingNames, []);
assert.equal(result.unindexedCount, 0);
assert.deepEqual(result.unindexedNames, []);
assert.equal(result.groupCounts['cli-contract'], 29);
assert.equal(result.groupCounts['coverage-index'], 4);
assert.equal(result.groupCounts['evidence-package'], 1);
assert.equal(result.groupCounts['final-gap-report'], 1);
assert.equal(result.groupCounts['gap-action-checklist'], 1);
assert.equal(result.groupCounts.handoff, 10);
assert.equal(result.groupCounts['intake-field-completeness'], 2);
assert.equal(result.groupCounts['intake-filling-support'], 1);
assert.equal(result.groupCounts['intake-readiness-gate'], 1);
assert.equal(result.groupCounts['intake-template'], 6);
assert.equal(result.groupCounts['missing-evidence-rollup'], 1);
assert.equal(result.groupCounts['next-evidence-target'], 1);
assert.equal(result.groupCounts['p0-intake-target-status'], 2);
assert.equal(result.groupCounts['p0-real-evidence-closeout'], 2);
assert.equal(result.groupCounts['package-health'], 1);
assert.equal(result.groupCounts['reviewer-packet'], 3);
assert.equal(result.groupCounts.preflight, 7);
assert.equal(result.groupCounts['readiness-rollup'], 5);
assert.equal(result.groupCounts['runbook-completion'], 1);
assert.equal(result.groupCounts['status-dashboard'], 2);
assert.match(result.summaryText, /entries=91/u);
assert.match(result.summaryText, /missing=0/u);
assert.match(result.summaryText, /unindexed=0/u);
assert.match(result.reportText, /smokeGroups:/u);
assert.match(result.reportText, /missingSmokes: none/u);
assert.match(result.reportText, /unindexedSmokes: none/u);
assert.match(result.reportText, /agent-session-v3-pilot-real-corpus-batch-handoff-reviewer-packet-degraded-e2e-rehearsal-smoke\.ts/u);
assert.match(result.reportText, /boundary=reviewer packet degraded rehearsal only/u);
assert.match(result.reportText, /agent-session-v3-pilot-real-corpus-batch-handoff-source-preflight-integration-smoke\.ts/u);
assert.match(result.reportText, /boundary=handoff source preflight integration rehearsal only/u);
assert.match(result.reportText, /agent-session-v3-pilot-real-corpus-batch-handoff-source-preflight-degraded-rehearsal-smoke\.ts/u);
assert.match(result.reportText, /boundary=handoff source preflight degraded rehearsal only/u);
assert.match(result.reportText, /agent-session-v3-pilot-real-corpus-batch-handoff-source-preflight-rollup-smoke\.ts/u);
assert.match(result.reportText, /boundary=handoff source preflight rollup report only/u);
assert.match(result.reportText, /agent-session-v3-pilot-real-corpus-batch-handoff-source-preflight-rollup-degraded-cli-rehearsal-smoke\.ts/u);
assert.match(result.reportText, /boundary=handoff source preflight rollup degraded CLI rehearsal only/u);
assert.match(result.reportText, /agent-session-v3-pilot-real-corpus-batch-handoff-source-preflight-rollup-cli-json-contract-smoke\.ts/u);
assert.match(result.reportText, /boundary=machine-readable handoff source preflight rollup contract only/u);
assert.match(result.reportText, /agent-session-v3-pilot-real-corpus-batch-handoff-optional-evidence-continuity-smoke\.ts/u);
assert.match(result.reportText, /boundary=handoff optional evidence continuity rehearsal only/u);
assert.match(result.reportText, /agent-session-v3-pilot-real-corpus-batch-handoff-phase-coverage-consistency-audit-smoke\.ts/u);
assert.match(result.reportText, /boundary=handoff phase-coverage consistency audit only/u);
assert.match(result.reportText, /agent-session-v3-pilot-real-corpus-batch-handoff-phase-coverage-consistency-audit-cli-json-contract-smoke\.ts/u);
assert.match(result.reportText, /boundary=machine-readable handoff phase-coverage consistency contract only/u);
assert.match(result.reportText, /agent-session-v3-pilot-real-corpus-batch-smoke-index-smoke\.ts/u);
assert.match(result.reportText, /boundary=smoke coverage index only/u);
assert.match(result.reportText, /agent-session-v3-pilot-real-corpus-batch-readiness-snapshot-consistency-smoke\.ts/u);
assert.match(result.reportText, /boundary=readiness snapshot consistency smoke only; no runtime authority/u);
assert.match(result.reportText, /agent-session-v3-pilot-real-corpus-batch-next-step-consistency-smoke\.ts/u);
assert.match(result.reportText, /boundary=next-step consistency smoke only; no runtime authority/u);
assert.match(result.reportText, /agent-session-v3-pilot-real-corpus-batch-closeout-audit-smoke\.ts/u);
assert.match(result.reportText, /boundary=real corpus batch closeout audit report only/u);
assert.match(result.reportText, /agent-session-v3-pilot-real-corpus-batch-closeout-audit-cli-json-contract-smoke\.ts/u);
assert.match(result.reportText, /boundary=machine-readable closeout audit contract only/u);
assert.match(result.reportText, /agent-session-v3-pilot-real-corpus-batch-evidence-package-index-smoke\.ts/u);
assert.match(result.reportText, /boundary=evidence package index report only/u);
assert.match(result.reportText, /agent-session-v3-pilot-real-corpus-batch-evidence-package-index-cli-json-contract-smoke\.ts/u);
assert.match(result.reportText, /boundary=machine-readable evidence package index contract only/u);
assert.match(result.reportText, /agent-session-v3-pilot-real-corpus-batch-package-health-rollup-smoke\.ts/u);
assert.match(result.reportText, /boundary=package health rollup report only/u);
assert.match(result.reportText, /agent-session-v3-pilot-real-corpus-batch-package-health-rollup-cli-json-contract-smoke\.ts/u);
assert.match(result.reportText, /boundary=machine-readable package health rollup contract only/u);
assert.match(result.reportText, /agent-session-v3-pilot-real-corpus-batch-next-evidence-target-report-smoke\.ts/u);
assert.match(result.reportText, /boundary=next evidence target report only; no collection or runtime action order/u);
assert.match(result.reportText, /agent-session-v3-pilot-real-corpus-batch-next-evidence-target-report-cli-json-contract-smoke\.ts/u);
assert.match(result.reportText, /boundary=machine-readable next evidence target contract only/u);
assert.match(result.reportText, /agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report-smoke\.ts/u);
assert.match(result.reportText, /boundary=P0 intake target status report only; explicit caller-owned intake dirs only/u);
assert.match(result.reportText, /agent-session-v3-pilot-real-corpus-batch-p0-linkage-degraded-smoke\.ts/u);
assert.match(result.reportText, /boundary=P0 linkage degraded report rehearsal only/u);
assert.match(result.reportText, /agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report-cli-json-contract-smoke\.ts/u);
assert.match(result.reportText, /boundary=machine-readable P0 intake target status contract only/u);
assert.match(result.reportText, /agent-session-v3-pilot-real-corpus-batch-p0-real-evidence-closeout-report-smoke\.ts/u);
assert.match(result.reportText, /boundary=P0 real evidence closeout report only; explicit caller-owned intake dirs only/u);
assert.match(result.reportText, /agent-session-v3-pilot-real-corpus-batch-artifact-rehearsal-closeout-smoke\.ts/u);
assert.match(result.reportText, /boundary=artifact rehearsal closeout smoke only; no required runtime workflow/u);
assert.match(result.reportText, /agent-session-v3-pilot-real-corpus-batch-p0-real-evidence-closeout-report-cli-json-contract-smoke\.ts/u);
assert.match(result.reportText, /boundary=machine-readable P0 real evidence closeout contract only/u);
assert.match(result.reportText, /agent-session-v3-pilot-real-corpus-batch-status-dashboard-report-smoke\.ts/u);
assert.match(result.reportText, /boundary=status dashboard report only/u);
assert.match(result.reportText, /agent-session-v3-pilot-real-corpus-batch-status-dashboard-gap-marker-coverage-smoke\.ts/u);
assert.match(result.reportText, /boundary=status dashboard checklist marker coverage only/u);
assert.match(result.reportText, /agent-session-v3-pilot-real-corpus-batch-status-dashboard-cli-json-contract-smoke\.ts/u);
assert.match(result.reportText, /boundary=machine-readable status dashboard contract only/u);
assert.match(result.reportText, /agent-session-v3-pilot-real-corpus-batch-gap-action-checklist-smoke\.ts/u);
assert.match(result.reportText, /boundary=manual gap action checklist report only/u);
assert.match(result.reportText, /agent-session-v3-pilot-real-corpus-batch-gap-action-checklist-cli-json-contract-smoke\.ts/u);
assert.match(result.reportText, /boundary=machine-readable gap action checklist contract only/u);
assert.match(result.reportText, /agent-session-v3-pilot-real-corpus-batch-missing-evidence-rollup-smoke\.ts/u);
assert.match(result.reportText, /boundary=missing evidence rollup report only/u);
assert.match(result.reportText, /agent-session-v3-pilot-real-corpus-batch-missing-evidence-rollup-cli-json-contract-smoke\.ts/u);
assert.match(result.reportText, /boundary=machine-readable missing evidence rollup contract only/u);
assert.match(result.reportText, /agent-session-v3-pilot-real-corpus-batch-final-gap-report-smoke\.ts/u);
assert.match(result.reportText, /boundary=final manual gap report only; no runtime action order/u);
assert.match(result.reportText, /agent-session-v3-pilot-real-corpus-batch-final-gap-report-cli-json-contract-smoke\.ts/u);
assert.match(result.reportText, /boundary=machine-readable final gap report contract only/u);
assert.match(result.reportText, /agent-session-v3-pilot-real-corpus-batch-intake-filling-support-report-smoke\.ts/u);
assert.match(result.reportText, /boundary=intake filling support report only; no intake creation, auto-fill, or runtime action order/u);
assert.match(result.reportText, /agent-session-v3-pilot-real-corpus-batch-intake-filling-support-report-cli-json-contract-smoke\.ts/u);
assert.match(result.reportText, /boundary=machine-readable intake filling support contract only/u);
assert.match(result.reportText, /agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit-smoke\.ts/u);
assert.match(result.reportText, /boundary=intake field completeness audit only; explicit caller-owned intake dirs only/u);
assert.match(result.reportText, /agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit-cli-json-contract-smoke\.ts/u);
assert.match(result.reportText, /boundary=machine-readable intake field completeness audit contract only/u);
assert.match(result.reportText, /agent-session-v3-pilot-real-corpus-batch-intake-readiness-gate-report-smoke\.ts/u);
assert.match(result.reportText, /boundary=intake readiness gate report only; explicit caller-owned intake dirs only/u);
assert.match(result.reportText, /agent-session-v3-pilot-real-corpus-batch-intake-readiness-gate-report-cli-json-contract-smoke\.ts/u);
assert.match(result.reportText, /boundary=machine-readable intake readiness gate contract only/u);
assert.match(result.reportText, /agent-session-v3-pilot-real-corpus-batch-intake-field-requirements-consistency-smoke\.ts/u);
assert.match(result.reportText, /boundary=intake field requirements consistency smoke only; no runtime authority/u);
assert.match(result.reportText, /agent-session-v3-pilot-real-corpus-batch-runbook-completion-report-smoke\.ts/u);
assert.match(result.reportText, /boundary=runbook completion report only; explicit caller-owned intake dirs only/u);
assert.match(result.reportText, /agent-session-v3-pilot-real-corpus-batch-runbook-completion-report-cli-json-contract-smoke\.ts/u);
assert.match(result.reportText, /boundary=machine-readable runbook completion contract only/u);
assert.match(result.reportText, /agent-session-v3-pilot-real-corpus-batch-source-declaration-preflight-smoke\.ts/u);
assert.match(result.reportText, /boundary=caller-declared source metadata preflight only/u);
assert.match(result.reportText, /agent-session-v3-pilot-real-corpus-batch-source-declaration-preflight-cli-json-contract-smoke\.ts/u);
assert.match(result.reportText, /boundary=machine-readable source declaration contract only/u);
assert.match(result.reportText, /agent-session-v3-pilot-real-corpus-batch-filled-sample-rehearsal-smoke\.ts/u);
assert.match(result.reportText, /boundary=filled sample-note rehearsal only/u);
assert.match(result.reportText, /agent-session-v3-pilot-real-corpus-batch-starter-intake-blocked-smoke\.ts/u);
assert.match(result.reportText, /boundary=starter intake blocked contract only; no real evidence or runtime authority/u);
assert.match(result.reportText, /agent-session-v3-pilot-real-corpus-batch-starter-to-filled-delta-smoke\.ts/u);
assert.match(result.reportText, /boundary=starter-to-filled evidence delta only; no runtime action order/u);
assert.match(result.reportText, /does not run smoke tests, collect samples, choose thresholds, route permissions, execute tools, decide recovery, define workflows, or grant runtime authority/u);

console.log('agent session v3 pilot real corpus batch smoke index smoke ok');
