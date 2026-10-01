import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { readProjectFile } from './smokeTestHarness.ts';

type CallerOwnedFinalNegativeHandoffGuardSummaryWordingConsistencyCloseoutGuardWordingConsistencyCloseoutGuardInput =
  | 'final-negative-handoff-guard-summary-wording-consistency-closeout-guard-wording-consistency-closeout-summary'
  | 'final-negative-handoff-guard-summary-wording-consistency-closeout-guard-wording-consistency'
  | 'final-negative-handoff-guard-summary-wording-consistency-closeout-guard-closeout-summary'
  | 'final-negative-handoff-guard-summary-wording-consistency-closeout-guard'
  | 'production-gate-final-negative-readout'
  | 'evidence-interpretation-to-production-gate-mapping'
  | 'remaining-non-evidence-production-blocker-inventory'
  | 'runtime-boundary-contract'
  | 'status-page'
  | 'preflight-audit';

type CallerOwnedFinalNegativeHandoffGuardSummaryWordingConsistencyCloseoutGuardWordingConsistencyCloseoutGuardCheck =
  | 'closeout-summary-guarded'
  | 'blocked-readout-still-present'
  | 'non-production-readout-still-present'
  | 'caller-owned-intake-blockers-separated'
  | 'current-evidence-blockers-separated'
  | 'manual-interpretation-blockers-separated'
  | 'non-evidence-production-blockers-separated'
  | 'positive-production-gate-still-closed'
  | 'production-authority-still-absent'
  | 'production-wiring-still-deferred'
  | 'runtime-action-order-still-absent'
  | 'tool-decision-still-absent'
  | 'fixed-tool-chain-still-absent';

interface CallerOwnedFinalNegativeHandoffGuardSummaryWordingConsistencyCloseoutGuardWordingConsistencyCloseoutGuardRow {
  check: CallerOwnedFinalNegativeHandoffGuardSummaryWordingConsistencyCloseoutGuardWordingConsistencyCloseoutGuardCheck;
  inputs: readonly CallerOwnedFinalNegativeHandoffGuardSummaryWordingConsistencyCloseoutGuardWordingConsistencyCloseoutGuardInput[];
  interpretationReadyNow: false;
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  manualInterpretationOnly: true;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  guardStatus: 'guarded-final-negative-handoff-guard-summary-wording-consistency-closeout-guard-wording-consistency-closeout-still-blocked';
}

interface CallerOwnedFinalNegativeHandoffGuardSummaryWordingConsistencyCloseoutGuardWordingConsistencyCloseoutGuardCheckpoint {
  checkpoint: 'caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-final-negative-readout-closeout-handoff-closeout-guard-closeout-wording-closeout-guard-summary-wording-consistency-closeout-guard-closeout-wording-consistency-closeout-guard';
  interpretationReadyNow: false;
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  manualInterpretationOnly: true;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly CallerOwnedFinalNegativeHandoffGuardSummaryWordingConsistencyCloseoutGuardWordingConsistencyCloseoutGuardRow[];
  summaryDecision: 'caller-owned-final-negative-handoff-guard-summary-wording-consistency-closeout-guard-wording-consistency-closeout-guard-positive-gate-closed';
}

const sharedInputs = [
  'final-negative-handoff-guard-summary-wording-consistency-closeout-guard-wording-consistency-closeout-summary',
  'final-negative-handoff-guard-summary-wording-consistency-closeout-guard-wording-consistency',
  'final-negative-handoff-guard-summary-wording-consistency-closeout-guard-closeout-summary',
  'final-negative-handoff-guard-summary-wording-consistency-closeout-guard',
  'production-gate-final-negative-readout',
  'evidence-interpretation-to-production-gate-mapping',
  'remaining-non-evidence-production-blocker-inventory',
  'preflight-audit',
  'status-page',
  'runtime-boundary-contract',
] as const satisfies readonly CallerOwnedFinalNegativeHandoffGuardSummaryWordingConsistencyCloseoutGuardWordingConsistencyCloseoutGuardInput[];

const callerOwnedFinalNegativeHandoffGuardSummaryWordingConsistencyCloseoutGuardWordingConsistencyCloseoutGuardCheckpoint = {
  checkpoint: 'caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-final-negative-readout-closeout-handoff-closeout-guard-closeout-wording-closeout-guard-summary-wording-consistency-closeout-guard-closeout-wording-consistency-closeout-guard',
  interpretationReadyNow: false,
  isExecutionOrder: false,
  isImplementationPlan: false,
  isProductionWiringPlan: false,
  manualInterpretationOnly: true,
  positiveGateAllowed: false,
  productionAuthority: false,
  productionReady: false,
  rows: [
    'closeout-summary-guarded',
    'blocked-readout-still-present',
    'non-production-readout-still-present',
    'caller-owned-intake-blockers-separated',
    'current-evidence-blockers-separated',
    'manual-interpretation-blockers-separated',
    'non-evidence-production-blockers-separated',
    'positive-production-gate-still-closed',
    'production-authority-still-absent',
    'production-wiring-still-deferred',
    'runtime-action-order-still-absent',
    'tool-decision-still-absent',
    'fixed-tool-chain-still-absent',
  ].map((check) => ({
    check,
    inputs: sharedInputs,
    interpretationReadyNow: false,
    isExecutionOrder: false,
    isImplementationPlan: false,
    isProductionWiringPlan: false,
    manualInterpretationOnly: true,
    positiveGateAllowed: false,
    productionAuthority: false,
    productionReady: false,
    guardStatus: 'guarded-final-negative-handoff-guard-summary-wording-consistency-closeout-guard-wording-consistency-closeout-still-blocked',
  })),
  summaryDecision: 'caller-owned-final-negative-handoff-guard-summary-wording-consistency-closeout-guard-wording-consistency-closeout-guard-positive-gate-closed',
} as const satisfies CallerOwnedFinalNegativeHandoffGuardSummaryWordingConsistencyCloseoutGuardWordingConsistencyCloseoutGuardCheckpoint;

function assertContains(text: string, expected: string, label: string) {
  assert.ok(text.includes(expected), `${label} should include: ${expected}`);
}

function rowForCheck(check: CallerOwnedFinalNegativeHandoffGuardSummaryWordingConsistencyCloseoutGuardWordingConsistencyCloseoutGuardCheck) {
  const row = callerOwnedFinalNegativeHandoffGuardSummaryWordingConsistencyCloseoutGuardWordingConsistencyCloseoutGuardCheckpoint.rows
    .find((candidate) => candidate.check === check);

  assert.ok(row, `${check} should exist in the caller-owned final negative handoff guard summary wording consistency closeout guard wording consistency closeout guard.`);
  return row;
}

function stripNegativeAssertionBlocks(text: string) {
  const keptLines: string[] = [];
  let skipping = false;

  for (const line of text.split(/\r?\n/u)) {
    if (line.includes('assert.doesNotMatch(')) {
      skipping = true;
      continue;
    }

    if (skipping) {
      if (line.trim() === ');') {
        skipping = false;
      }
      continue;
    }

    keptLines.push(line);
  }

  return keptLines.join('\n');
}

const boundarySource = readProjectFile('src/agent/agentSessionV3RuntimeBoundary.ts');
const auditText = readProjectFile('PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md');
const statusText = readProjectFile('PROJECT_AGENT_V2_STATUS.md');
const wordingConsistencyCloseoutSummarySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-rx-intake-fn-handoff-co-guard-word-cons-co-sum-ckpt-smoke.ts',
);
const wordingConsistencySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-rx-intake-fn-handoff-co-guard-word-cons-ckpt-smoke.ts',
);
const closeoutGuardSummarySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-rx-intake-fn-handoff-co-guard-co-sum-ckpt-smoke.ts',
);
const closeoutGuardSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-rx-intake-fn-handoff-co-guard-ckpt-smoke.ts',
);
const productionGateFinalNegativeReadoutSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-rx-intake-review-post-rchk-prod-gate-final-neg-rdo-ckpt-smoke.ts',
);
const evidenceMappingSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-evidence-interpretation-to-production-gate-mapping-checkpoint-smoke.ts',
);
const nonEvidenceInventorySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-remaining-non-evidence-production-blocker-inventory-checkpoint-smoke.ts',
);

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');
assert.equal(boundaryContract.mode, 'contract-only');
assert.ok(boundaryContract.guardrails.includes('AgentSessionV2 remains the production orchestrator'));
assert.ok(boundaryContract.guardrails.includes('no required ordered tool workflow'));
assert.ok(boundaryContract.guardrails.includes('no evidence adapter gains runtime authority'));

assert.equal(callerOwnedFinalNegativeHandoffGuardSummaryWordingConsistencyCloseoutGuardWordingConsistencyCloseoutGuardCheckpoint.interpretationReadyNow, false);
assert.equal(callerOwnedFinalNegativeHandoffGuardSummaryWordingConsistencyCloseoutGuardWordingConsistencyCloseoutGuardCheckpoint.manualInterpretationOnly, true);
assert.equal(callerOwnedFinalNegativeHandoffGuardSummaryWordingConsistencyCloseoutGuardWordingConsistencyCloseoutGuardCheckpoint.productionAuthority, false);
assert.equal(callerOwnedFinalNegativeHandoffGuardSummaryWordingConsistencyCloseoutGuardWordingConsistencyCloseoutGuardCheckpoint.productionReady, false);
assert.equal(callerOwnedFinalNegativeHandoffGuardSummaryWordingConsistencyCloseoutGuardWordingConsistencyCloseoutGuardCheckpoint.positiveGateAllowed, false);
assert.equal(callerOwnedFinalNegativeHandoffGuardSummaryWordingConsistencyCloseoutGuardWordingConsistencyCloseoutGuardCheckpoint.isExecutionOrder, false);
assert.equal(callerOwnedFinalNegativeHandoffGuardSummaryWordingConsistencyCloseoutGuardWordingConsistencyCloseoutGuardCheckpoint.isImplementationPlan, false);
assert.equal(callerOwnedFinalNegativeHandoffGuardSummaryWordingConsistencyCloseoutGuardWordingConsistencyCloseoutGuardCheckpoint.isProductionWiringPlan, false);
assert.equal(
  callerOwnedFinalNegativeHandoffGuardSummaryWordingConsistencyCloseoutGuardWordingConsistencyCloseoutGuardCheckpoint.summaryDecision,
  'caller-owned-final-negative-handoff-guard-summary-wording-consistency-closeout-guard-wording-consistency-closeout-guard-positive-gate-closed',
);

assert.deepEqual(
  callerOwnedFinalNegativeHandoffGuardSummaryWordingConsistencyCloseoutGuardWordingConsistencyCloseoutGuardCheckpoint.rows.map((row) => row.check).sort(),
  [
    'blocked-readout-still-present',
    'caller-owned-intake-blockers-separated',
    'closeout-summary-guarded',
    'current-evidence-blockers-separated',
    'fixed-tool-chain-still-absent',
    'manual-interpretation-blockers-separated',
    'non-evidence-production-blockers-separated',
    'non-production-readout-still-present',
    'positive-production-gate-still-closed',
    'production-authority-still-absent',
    'production-wiring-still-deferred',
    'runtime-action-order-still-absent',
    'tool-decision-still-absent',
  ],
);

for (const row of callerOwnedFinalNegativeHandoffGuardSummaryWordingConsistencyCloseoutGuardWordingConsistencyCloseoutGuardCheckpoint.rows) {
  assert.equal(row.guardStatus, 'guarded-final-negative-handoff-guard-summary-wording-consistency-closeout-guard-wording-consistency-closeout-still-blocked');
  assert.equal(row.interpretationReadyNow, false);
  assert.equal(row.manualInterpretationOnly, true);
  assert.equal(row.isExecutionOrder, false);
  assert.equal(row.isImplementationPlan, false);
  assert.equal(row.isProductionWiringPlan, false);
  assert.equal(row.productionAuthority, false);
  assert.equal(row.productionReady, false);
  assert.equal(row.positiveGateAllowed, false);
  assert.deepEqual(row.inputs, sharedInputs);
}

assert.equal(rowForCheck('closeout-summary-guarded').productionReady, false);
assert.equal(rowForCheck('blocked-readout-still-present').productionReady, false);
assert.equal(rowForCheck('non-production-readout-still-present').productionAuthority, false);
assert.equal(rowForCheck('caller-owned-intake-blockers-separated').manualInterpretationOnly, true);
assert.equal(rowForCheck('current-evidence-blockers-separated').interpretationReadyNow, false);
assert.equal(rowForCheck('manual-interpretation-blockers-separated').interpretationReadyNow, false);
assert.equal(rowForCheck('non-evidence-production-blockers-separated').isProductionWiringPlan, false);
assert.equal(rowForCheck('positive-production-gate-still-closed').positiveGateAllowed, false);
assert.equal(rowForCheck('production-authority-still-absent').productionAuthority, false);
assert.equal(rowForCheck('production-wiring-still-deferred').isProductionWiringPlan, false);
assert.equal(rowForCheck('runtime-action-order-still-absent').isExecutionOrder, false);
assert.equal(rowForCheck('tool-decision-still-absent').isExecutionOrder, false);
assert.equal(rowForCheck('fixed-tool-chain-still-absent').isExecutionOrder, false);

assertContains(
  wordingConsistencyCloseoutSummarySmokeSource,
  'caller-owned-final-negative-handoff-guard-summary-wording-consistency-closeout-guard-wording-consistency-closeout-summary-positive-gate-closed',
  'wording consistency closeout summary smoke',
);
assertContains(
  wordingConsistencyCloseoutSummarySmokeSource,
  'closed-out-final-negative-handoff-guard-summary-wording-consistency-closeout-guard-wording-consistency-still-blocked',
  'wording consistency closeout summary smoke',
);
assertContains(
  wordingConsistencySmokeSource,
  'wording-consistent-final-negative-handoff-guard-summary-wording-consistency-closeout-guard-still-blocked',
  'wording consistency smoke',
);
assertContains(
  closeoutGuardSummarySmokeSource,
  'closed-out-final-negative-handoff-guard-summary-wording-consistency-closeout-guard-still-blocked',
  'closeout guard closeout summary smoke',
);
assertContains(
  closeoutGuardSmokeSource,
  'guarded-final-negative-handoff-guard-summary-wording-consistency-closeout-still-blocked',
  'closeout guard smoke',
);
assertContains(
  productionGateFinalNegativeReadoutSmokeSource,
  'final-negative-production-gate-readout-still-blocked',
  'production gate final negative readout smoke',
);
assertContains(evidenceMappingSmokeSource, 'mapping-only-positive-gate-remains-closed', 'evidence mapping smoke');
assertContains(nonEvidenceInventorySmokeSource, 'non-evidence-blockers-remain-positive-gate-closed', 'non-evidence inventory smoke');

assertContains(
  auditText,
  'Caller-Owned Real-Exported Evidence Intake Review Readiness Post-Recheck Final Negative Readout Closeout Handoff Closeout Guard Closeout Wording Closeout Guard Summary Wording Consistency Closeout Guard Closeout Wording Consistency Closeout Guard Checkpoint Status',
  'preflight audit',
);
assertContains(
  auditText,
  'final negative handoff guard summary wording consistency closeout guard closeout wording consistency closeout guard keeps the closeout summary blocked and non-production',
  'preflight audit',
);
assertContains(
  statusText,
  'V3 runtime boundary caller-owned real-exported evidence intake review readiness post-recheck final negative readout closeout handoff closeout guard closeout wording closeout guard summary wording consistency closeout guard closeout wording consistency closeout guard checkpoint',
  'status',
);
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-rx-intake-fn-handoff-co-guard-word-cons-co-guard-ckpt-smoke.ts',
  'status',
);
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

const guardedSources = [
  ['wording consistency closeout summary', wordingConsistencyCloseoutSummarySmokeSource],
  ['wording consistency', wordingConsistencySmokeSource],
  ['closeout guard closeout summary', closeoutGuardSummarySmokeSource],
  ['closeout guard', closeoutGuardSmokeSource],
  ['production gate final negative readout', productionGateFinalNegativeReadoutSmokeSource],
  ['evidence mapping', evidenceMappingSmokeSource],
  ['non-evidence inventory', nonEvidenceInventorySmokeSource],
  ['preflight audit', auditText],
  ['status page', statusText],
] as const;

for (const [label, source] of guardedSources) {
  const sourceWithoutNegativeAssertions = stripNegativeAssertionBlocks(source);

  assert.doesNotMatch(
    sourceWithoutNegativeAssertions,
    /ready-for-production-wiring|production-wiring-ready|productionGateCleared|positiveGateAllowed:\s*true|productionAuthority:\s*true|productionReady:\s*true/u,
    `${label} source wording must not claim positive production readiness outside negative assertions.`,
  );
  assert.doesNotMatch(
    sourceWithoutNegativeAssertions,
    /implementationQueue|orderedSteps|requiredReportOrder|nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
    `${label} source wording must not define queues, required order, tool decisions, or controller actions outside negative assertions.`,
  );
  assert.doesNotMatch(
    sourceWithoutNegativeAssertions,
    /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
    `${label} source wording must not prescribe concrete desktop tools outside negative assertions.`,
  );
  assert.doesNotMatch(
    sourceWithoutNegativeAssertions,
    /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain/iu,
    `${label} source wording must not define fixed workflows outside negative assertions.`,
  );
}

const serializedCheckpoint = JSON.stringify(callerOwnedFinalNegativeHandoffGuardSummaryWordingConsistencyCloseoutGuardWordingConsistencyCloseoutGuardCheckpoint);
assert.doesNotMatch(
  serializedCheckpoint,
  /productionAuthority":true|productionReady":true|positiveGateAllowed":true/u,
  'Caller-owned final negative handoff guard summary wording consistency closeout guard wording consistency closeout guard must not grant production readiness.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /isProductionWiringPlan":true|isImplementationPlan":true|production-wiring-ready|ready-for-production-wiring/u,
  'Caller-owned final negative handoff guard summary wording consistency closeout guard wording consistency closeout guard must not become an implementation plan.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Caller-owned final negative handoff guard summary wording consistency closeout guard wording consistency closeout guard should not define controller actions.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Caller-owned final negative handoff guard summary wording consistency closeout guard wording consistency closeout guard should not prescribe desktop tools.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain|requiredReportOrder|implementationQueue|orderedSteps/iu,
  'Caller-owned final negative handoff guard summary wording consistency closeout guard wording consistency closeout guard should not define fixed workflows.',
);

assertContains(boundarySource, 'AgentSessionV2 remains the production orchestrator', 'runtime boundary');
assertContains(boundarySource, 'no required ordered tool workflow', 'runtime boundary');
assertContains(boundarySource, 'no evidence adapter gains runtime authority', 'runtime boundary');
assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Caller-owned final negative handoff guard summary wording consistency closeout guard wording consistency closeout guard must not add controller contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Caller-owned final negative handoff guard summary wording consistency closeout guard wording consistency closeout guard must not add production runtime calls.',
);

console.log('agent session v3 runtime boundary caller-owned real-exported intake final negative handoff guard summary wording consistency closeout guard wording consistency closeout guard checkpoint smoke ok');
