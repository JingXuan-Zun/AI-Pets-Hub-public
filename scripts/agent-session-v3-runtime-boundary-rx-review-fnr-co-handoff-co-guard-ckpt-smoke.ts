import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { readProjectFile } from './smokeTestHarness.ts';

type CallerOwnedFinalNegativeReadoutCloseoutHandoffCloseoutGuardInput =
  | 'final-negative-readout-closeout-handoff-closeout-summary'
  | 'final-negative-readout-closeout-handoff'
  | 'final-negative-readout-closeout-handoff-wording-consistency'
  | 'production-gate-final-negative-readout'
  | 'final-readout-closeout-summary'
  | 'final-readout-guard'
  | 'evidence-interpretation-to-production-gate-mapping'
  | 'remaining-non-evidence-production-blocker-inventory'
  | 'runtime-boundary-contract'
  | 'status-page'
  | 'preflight-audit';

type CallerOwnedFinalNegativeReadoutCloseoutHandoffCloseoutGuardCheck =
  | 'closeout-summary-remains-blocked'
  | 'production-readiness-language-absent'
  | 'production-authority-remains-absent'
  | 'positive-production-gate-remains-closed'
  | 'blocker-groups-remain-separated'
  | 'manual-interpretation-remains-not-ready'
  | 'production-wiring-remains-deferred'
  | 'runtime-action-order-remains-absent'
  | 'tool-decision-language-remains-absent'
  | 'fixed-tool-chain-remains-absent';

interface CallerOwnedFinalNegativeReadoutCloseoutHandoffCloseoutGuardRow {
  check: CallerOwnedFinalNegativeReadoutCloseoutHandoffCloseoutGuardCheck;
  guardStatus: 'final-negative-handoff-closeout-guarded-still-blocked';
  inputs: readonly CallerOwnedFinalNegativeReadoutCloseoutHandoffCloseoutGuardInput[];
  interpretationReadyNow: false;
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  manualInterpretationOnly: true;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
}

interface CallerOwnedFinalNegativeReadoutCloseoutHandoffCloseoutGuardCheckpoint {
  guard: 'caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-final-negative-readout-closeout-handoff-closeout-guard';
  interpretationReadyNow: false;
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  manualInterpretationOnly: true;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly CallerOwnedFinalNegativeReadoutCloseoutHandoffCloseoutGuardRow[];
  summaryDecision: 'caller-owned-final-negative-handoff-closeout-guard-positive-gate-closed';
}

const sharedInputs = [
  'final-negative-readout-closeout-handoff-closeout-summary',
  'final-negative-readout-closeout-handoff',
  'final-negative-readout-closeout-handoff-wording-consistency',
  'production-gate-final-negative-readout',
  'final-readout-closeout-summary',
  'final-readout-guard',
  'evidence-interpretation-to-production-gate-mapping',
  'remaining-non-evidence-production-blocker-inventory',
  'preflight-audit',
  'status-page',
  'runtime-boundary-contract',
] as const satisfies readonly CallerOwnedFinalNegativeReadoutCloseoutHandoffCloseoutGuardInput[];

const callerOwnedFinalNegativeReadoutCloseoutHandoffCloseoutGuardCheckpoint = {
  guard: 'caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-final-negative-readout-closeout-handoff-closeout-guard',
  interpretationReadyNow: false,
  isExecutionOrder: false,
  isImplementationPlan: false,
  isProductionWiringPlan: false,
  manualInterpretationOnly: true,
  positiveGateAllowed: false,
  productionAuthority: false,
  productionReady: false,
  rows: [
    'closeout-summary-remains-blocked',
    'production-readiness-language-absent',
    'production-authority-remains-absent',
    'positive-production-gate-remains-closed',
    'blocker-groups-remain-separated',
    'manual-interpretation-remains-not-ready',
    'production-wiring-remains-deferred',
    'runtime-action-order-remains-absent',
    'tool-decision-language-remains-absent',
    'fixed-tool-chain-remains-absent',
  ].map((check) => ({
    check,
    guardStatus: 'final-negative-handoff-closeout-guarded-still-blocked',
    inputs: sharedInputs,
    interpretationReadyNow: false,
    isExecutionOrder: false,
    isImplementationPlan: false,
    isProductionWiringPlan: false,
    manualInterpretationOnly: true,
    positiveGateAllowed: false,
    productionAuthority: false,
    productionReady: false,
  })),
  summaryDecision: 'caller-owned-final-negative-handoff-closeout-guard-positive-gate-closed',
} as const satisfies CallerOwnedFinalNegativeReadoutCloseoutHandoffCloseoutGuardCheckpoint;

function assertContains(text: string, expected: string, label: string) {
  assert.ok(text.includes(expected), `${label} should include: ${expected}`);
}

function rowForCheck(check: CallerOwnedFinalNegativeReadoutCloseoutHandoffCloseoutGuardCheck) {
  const row = callerOwnedFinalNegativeReadoutCloseoutHandoffCloseoutGuardCheckpoint.rows
    .find((candidate) => candidate.check === check);

  assert.ok(row, `${check} should exist in the caller-owned final negative handoff closeout guard.`);
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
const closeoutSummarySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-rx-review-fnr-co-handoff-co-sum-ckpt-smoke.ts',
);
const handoffSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-rx-review-fnr-co-handoff-ckpt-smoke.ts',
);
const wordingConsistencySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-rx-review-fnr-co-handoff-word-cons-ckpt-smoke.ts',
);
const productionGateFinalNegativeReadoutSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-rx-intake-review-post-rchk-prod-gate-final-neg-rdo-ckpt-smoke.ts',
);
const finalReadoutCloseoutSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-rx-intake-review-post-rchk-final-rdo-co-sum-ckpt-smoke.ts',
);
const finalReadoutGuardSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-rx-intake-review-post-rchk-final-rdo-guard-ckpt-smoke.ts',
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

assert.equal(callerOwnedFinalNegativeReadoutCloseoutHandoffCloseoutGuardCheckpoint.interpretationReadyNow, false);
assert.equal(callerOwnedFinalNegativeReadoutCloseoutHandoffCloseoutGuardCheckpoint.manualInterpretationOnly, true);
assert.equal(callerOwnedFinalNegativeReadoutCloseoutHandoffCloseoutGuardCheckpoint.productionAuthority, false);
assert.equal(callerOwnedFinalNegativeReadoutCloseoutHandoffCloseoutGuardCheckpoint.productionReady, false);
assert.equal(callerOwnedFinalNegativeReadoutCloseoutHandoffCloseoutGuardCheckpoint.positiveGateAllowed, false);
assert.equal(callerOwnedFinalNegativeReadoutCloseoutHandoffCloseoutGuardCheckpoint.isExecutionOrder, false);
assert.equal(callerOwnedFinalNegativeReadoutCloseoutHandoffCloseoutGuardCheckpoint.isImplementationPlan, false);
assert.equal(callerOwnedFinalNegativeReadoutCloseoutHandoffCloseoutGuardCheckpoint.isProductionWiringPlan, false);
assert.equal(
  callerOwnedFinalNegativeReadoutCloseoutHandoffCloseoutGuardCheckpoint.summaryDecision,
  'caller-owned-final-negative-handoff-closeout-guard-positive-gate-closed',
);

assert.deepEqual(
  callerOwnedFinalNegativeReadoutCloseoutHandoffCloseoutGuardCheckpoint.rows.map((row) => row.check).sort(),
  [
    'blocker-groups-remain-separated',
    'closeout-summary-remains-blocked',
    'fixed-tool-chain-remains-absent',
    'manual-interpretation-remains-not-ready',
    'positive-production-gate-remains-closed',
    'production-authority-remains-absent',
    'production-readiness-language-absent',
    'production-wiring-remains-deferred',
    'runtime-action-order-remains-absent',
    'tool-decision-language-remains-absent',
  ],
);

for (const row of callerOwnedFinalNegativeReadoutCloseoutHandoffCloseoutGuardCheckpoint.rows) {
  assert.equal(row.guardStatus, 'final-negative-handoff-closeout-guarded-still-blocked');
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

assert.equal(rowForCheck('closeout-summary-remains-blocked').productionReady, false);
assert.equal(rowForCheck('production-readiness-language-absent').productionReady, false);
assert.equal(rowForCheck('production-authority-remains-absent').productionAuthority, false);
assert.equal(rowForCheck('positive-production-gate-remains-closed').positiveGateAllowed, false);
assert.equal(rowForCheck('blocker-groups-remain-separated').isImplementationPlan, false);
assert.equal(rowForCheck('manual-interpretation-remains-not-ready').interpretationReadyNow, false);
assert.equal(rowForCheck('production-wiring-remains-deferred').isProductionWiringPlan, false);
assert.equal(rowForCheck('runtime-action-order-remains-absent').isExecutionOrder, false);
assert.equal(rowForCheck('tool-decision-language-remains-absent').isExecutionOrder, false);
assert.equal(rowForCheck('fixed-tool-chain-remains-absent').isExecutionOrder, false);

assertContains(
  closeoutSummarySmokeSource,
  'caller-owned-final-negative-handoff-closeout-positive-gate-closed',
  'closeout summary smoke',
);
assertContains(closeoutSummarySmokeSource, 'closed-out-final-negative-handoff-still-blocked', 'closeout summary smoke');
assertContains(handoffSmokeSource, 'caller-owned-final-negative-readout-closeout-handoff-positive-gate-closed', 'handoff smoke');
assertContains(handoffSmokeSource, 'final-negative-readout-closeout-handoff-still-blocked', 'handoff smoke');
assertContains(
  wordingConsistencySmokeSource,
  'caller-owned-final-negative-handoff-wording-consistent-positive-gate-closed',
  'wording consistency smoke',
);
assertContains(
  wordingConsistencySmokeSource,
  'final-negative-handoff-wording-consistent-still-blocked',
  'wording consistency smoke',
);
assertContains(
  productionGateFinalNegativeReadoutSmokeSource,
  'final-negative-production-gate-readout-still-blocked',
  'production gate final negative readout smoke',
);
assertContains(finalReadoutCloseoutSmokeSource, 'closed-out-final-readout-still-blocked', 'final readout closeout smoke');
assertContains(finalReadoutGuardSmokeSource, 'final-readout-guarded-still-blocked', 'final readout guard smoke');
assertContains(evidenceMappingSmokeSource, 'mapping-only-positive-gate-remains-closed', 'evidence mapping smoke');
assertContains(nonEvidenceInventorySmokeSource, 'non-evidence-blockers-remain-positive-gate-closed', 'non-evidence inventory smoke');

assertContains(
  auditText,
  'Caller-Owned Real-Exported Evidence Intake Review Readiness Post-Recheck Final Negative Readout Closeout Handoff Closeout Guard Checkpoint Status',
  'preflight audit',
);
assertContains(
  auditText,
  'final negative readout closeout handoff guard keeps the closeout summary blocked and non-production',
  'preflight audit',
);
assertContains(
  statusText,
  'V3 runtime boundary caller-owned real-exported evidence intake review readiness post-recheck final negative readout closeout handoff closeout guard checkpoint',
  'status',
);
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-rx-review-fnr-co-handoff-co-guard-ckpt-smoke.ts',
  'status',
);
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

const guardedSources = [
  ['closeout summary', closeoutSummarySmokeSource],
  ['handoff', handoffSmokeSource],
  ['wording consistency', wordingConsistencySmokeSource],
  ['production gate final negative readout', productionGateFinalNegativeReadoutSmokeSource],
  ['final readout closeout', finalReadoutCloseoutSmokeSource],
  ['final readout guard', finalReadoutGuardSmokeSource],
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

const serializedGuard = JSON.stringify(callerOwnedFinalNegativeReadoutCloseoutHandoffCloseoutGuardCheckpoint);
assert.doesNotMatch(
  serializedGuard,
  /productionAuthority":true|productionReady":true|positiveGateAllowed":true/u,
  'Caller-owned final negative handoff closeout guard must not grant production readiness or authority.',
);
assert.doesNotMatch(
  serializedGuard,
  /isProductionWiringPlan":true|isImplementationPlan":true|production-wiring-ready|ready-for-production-wiring/u,
  'Caller-owned final negative handoff closeout guard must not become an implementation plan or production wiring plan.',
);
assert.doesNotMatch(
  serializedGuard,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Caller-owned final negative handoff closeout guard should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedGuard,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Caller-owned final negative handoff closeout guard should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedGuard,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain|requiredReportOrder|implementationQueue|orderedSteps/iu,
  'Caller-owned final negative handoff closeout guard should not define fixed workflows, required report order, or task queues.',
);

assertContains(boundarySource, 'AgentSessionV2 remains the production orchestrator', 'runtime boundary');
assertContains(boundarySource, 'no required ordered tool workflow', 'runtime boundary');
assertContains(boundarySource, 'no evidence adapter gains runtime authority', 'runtime boundary');
assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Caller-owned final negative handoff closeout guard must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Caller-owned final negative handoff closeout guard must not add production calls to the boundary contract.',
);

console.log('agent session v3 runtime boundary caller-owned real-exported evidence intake review readiness post-recheck final negative readout closeout handoff closeout guard checkpoint smoke ok');
