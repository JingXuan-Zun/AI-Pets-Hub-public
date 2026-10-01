import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { readProjectFile } from './smokeTestHarness.ts';

type CallerOwnedFinalNegativeReadoutCloseoutHandoffWordingInput =
  | 'final-negative-readout-closeout-handoff'
  | 'production-gate-final-negative-readout'
  | 'final-readout-closeout-summary'
  | 'final-readout-guard'
  | 'evidence-interpretation-to-production-gate-mapping'
  | 'remaining-non-evidence-production-blocker-inventory'
  | 'runtime-boundary-contract'
  | 'status-page'
  | 'preflight-audit';

type CallerOwnedFinalNegativeReadoutCloseoutHandoffWordingCheck =
  | 'blocked-status-wording-consistent'
  | 'caller-owned-intake-wording-separated'
  | 'current-evidence-wording-separated'
  | 'manual-interpretation-wording-separated'
  | 'non-evidence-production-wording-separated'
  | 'positive-production-gate-wording-closed'
  | 'production-authority-wording-absent'
  | 'production-wiring-wording-deferred'
  | 'runtime-action-order-wording-absent'
  | 'tool-decision-wording-absent';

interface CallerOwnedFinalNegativeReadoutCloseoutHandoffWordingRow {
  check: CallerOwnedFinalNegativeReadoutCloseoutHandoffWordingCheck;
  inputs: readonly CallerOwnedFinalNegativeReadoutCloseoutHandoffWordingInput[];
  interpretationReadyNow: false;
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  manualInterpretationOnly: true;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  wordingStatus: 'final-negative-handoff-wording-consistent-still-blocked';
}

interface CallerOwnedFinalNegativeReadoutCloseoutHandoffWordingCheckpoint {
  checkpoint: 'caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-final-negative-readout-closeout-handoff-wording-consistency';
  interpretationReadyNow: false;
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  manualInterpretationOnly: true;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly CallerOwnedFinalNegativeReadoutCloseoutHandoffWordingRow[];
  summaryDecision: 'caller-owned-final-negative-handoff-wording-consistent-positive-gate-closed';
}

const sharedInputs = [
  'final-negative-readout-closeout-handoff',
  'production-gate-final-negative-readout',
  'final-readout-closeout-summary',
  'final-readout-guard',
  'evidence-interpretation-to-production-gate-mapping',
  'remaining-non-evidence-production-blocker-inventory',
  'preflight-audit',
  'status-page',
  'runtime-boundary-contract',
] as const satisfies readonly CallerOwnedFinalNegativeReadoutCloseoutHandoffWordingInput[];

const callerOwnedFinalNegativeReadoutCloseoutHandoffWordingCheckpoint = {
  checkpoint: 'caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-final-negative-readout-closeout-handoff-wording-consistency',
  interpretationReadyNow: false,
  isExecutionOrder: false,
  isImplementationPlan: false,
  isProductionWiringPlan: false,
  manualInterpretationOnly: true,
  positiveGateAllowed: false,
  productionAuthority: false,
  productionReady: false,
  rows: [
    'blocked-status-wording-consistent',
    'caller-owned-intake-wording-separated',
    'current-evidence-wording-separated',
    'manual-interpretation-wording-separated',
    'non-evidence-production-wording-separated',
    'positive-production-gate-wording-closed',
    'production-authority-wording-absent',
    'production-wiring-wording-deferred',
    'runtime-action-order-wording-absent',
    'tool-decision-wording-absent',
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
    wordingStatus: 'final-negative-handoff-wording-consistent-still-blocked',
  })),
  summaryDecision: 'caller-owned-final-negative-handoff-wording-consistent-positive-gate-closed',
} as const satisfies CallerOwnedFinalNegativeReadoutCloseoutHandoffWordingCheckpoint;

function assertContains(text: string, expected: string, label: string) {
  assert.ok(text.includes(expected), `${label} should include: ${expected}`);
}

function rowForCheck(check: CallerOwnedFinalNegativeReadoutCloseoutHandoffWordingCheck) {
  const row = callerOwnedFinalNegativeReadoutCloseoutHandoffWordingCheckpoint.rows
    .find((candidate) => candidate.check === check);

  assert.ok(row, `${check} should exist in the final negative handoff wording consistency checkpoint.`);
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
const handoffSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-rx-review-fnr-co-handoff-ckpt-smoke.ts',
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

assert.equal(callerOwnedFinalNegativeReadoutCloseoutHandoffWordingCheckpoint.interpretationReadyNow, false);
assert.equal(callerOwnedFinalNegativeReadoutCloseoutHandoffWordingCheckpoint.manualInterpretationOnly, true);
assert.equal(callerOwnedFinalNegativeReadoutCloseoutHandoffWordingCheckpoint.productionAuthority, false);
assert.equal(callerOwnedFinalNegativeReadoutCloseoutHandoffWordingCheckpoint.productionReady, false);
assert.equal(callerOwnedFinalNegativeReadoutCloseoutHandoffWordingCheckpoint.positiveGateAllowed, false);
assert.equal(callerOwnedFinalNegativeReadoutCloseoutHandoffWordingCheckpoint.isExecutionOrder, false);
assert.equal(callerOwnedFinalNegativeReadoutCloseoutHandoffWordingCheckpoint.isImplementationPlan, false);
assert.equal(callerOwnedFinalNegativeReadoutCloseoutHandoffWordingCheckpoint.isProductionWiringPlan, false);
assert.equal(
  callerOwnedFinalNegativeReadoutCloseoutHandoffWordingCheckpoint.summaryDecision,
  'caller-owned-final-negative-handoff-wording-consistent-positive-gate-closed',
);

assert.deepEqual(
  callerOwnedFinalNegativeReadoutCloseoutHandoffWordingCheckpoint.rows.map((row) => row.check).sort(),
  [
    'blocked-status-wording-consistent',
    'caller-owned-intake-wording-separated',
    'current-evidence-wording-separated',
    'manual-interpretation-wording-separated',
    'non-evidence-production-wording-separated',
    'positive-production-gate-wording-closed',
    'production-authority-wording-absent',
    'production-wiring-wording-deferred',
    'runtime-action-order-wording-absent',
    'tool-decision-wording-absent',
  ],
);

for (const row of callerOwnedFinalNegativeReadoutCloseoutHandoffWordingCheckpoint.rows) {
  assert.equal(row.wordingStatus, 'final-negative-handoff-wording-consistent-still-blocked');
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

assert.equal(rowForCheck('blocked-status-wording-consistent').productionReady, false);
assert.equal(rowForCheck('caller-owned-intake-wording-separated').manualInterpretationOnly, true);
assert.equal(rowForCheck('current-evidence-wording-separated').interpretationReadyNow, false);
assert.equal(rowForCheck('manual-interpretation-wording-separated').interpretationReadyNow, false);
assert.equal(rowForCheck('non-evidence-production-wording-separated').isProductionWiringPlan, false);
assert.equal(rowForCheck('positive-production-gate-wording-closed').positiveGateAllowed, false);
assert.equal(rowForCheck('production-authority-wording-absent').productionAuthority, false);
assert.equal(rowForCheck('production-wiring-wording-deferred').isProductionWiringPlan, false);
assert.equal(rowForCheck('runtime-action-order-wording-absent').isExecutionOrder, false);
assert.equal(rowForCheck('tool-decision-wording-absent').isExecutionOrder, false);

assertContains(handoffSmokeSource, 'caller-owned-final-negative-readout-closeout-handoff-positive-gate-closed', 'handoff smoke');
assertContains(handoffSmokeSource, 'final-negative-readout-closeout-handoff-still-blocked', 'handoff smoke');
assertContains(
  productionGateFinalNegativeReadoutSmokeSource,
  'caller-owned-production-gate-final-negative-readout-positive-gate-closed',
  'production gate final negative readout smoke',
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

for (const expected of [
  'final negative readout closeout handoff remains stable, blocked, and non-production',
  'production gate final negative readout remains closed, separated, and non-production',
  'caller-owned intake blockers remain separate from current evidence blockers',
  'manual interpretation blockers remain separate from production wiring blockers',
  'remaining non-evidence production blockers remain open',
  'positive production-readiness language remains absent',
  'production authority remains absent',
  'no tool-decision or runtime-action-order language is introduced',
] as const) {
  assertContains(auditText, expected, 'preflight audit');
}

assertContains(
  auditText,
  'Caller-Owned Real-Exported Evidence Intake Review Readiness Post-Recheck Final Negative Readout Closeout Handoff Wording Consistency Checkpoint Status',
  'preflight audit',
);
assertContains(
  auditText,
  'final negative readout closeout handoff wording remains consistent, blocked, and non-production',
  'preflight audit',
);
assertContains(
  statusText,
  'V3 runtime boundary caller-owned real-exported evidence intake review readiness post-recheck final negative readout closeout handoff wording consistency checkpoint',
  'status',
);
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-rx-review-fnr-co-handoff-word-cons-ckpt-smoke.ts',
  'status',
);
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

const guardedSources = [
  ['handoff', handoffSmokeSource],
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
}

const serializedCheckpoint = JSON.stringify(callerOwnedFinalNegativeReadoutCloseoutHandoffWordingCheckpoint);
assert.doesNotMatch(
  serializedCheckpoint,
  /productionAuthority":true|productionReady":true|positiveGateAllowed":true/u,
  'Caller-owned final negative handoff wording consistency must not grant production readiness or authority.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /isProductionWiringPlan":true|isImplementationPlan":true|production-wiring-ready|ready-for-production-wiring/u,
  'Caller-owned final negative handoff wording consistency must not become an implementation plan or production wiring plan.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Caller-owned final negative handoff wording consistency should not define controller actions or tool decisions.',
);

assertContains(boundarySource, 'AgentSessionV2 remains the production orchestrator', 'runtime boundary');
assertContains(boundarySource, 'no required ordered tool workflow', 'runtime boundary');
assertContains(boundarySource, 'no evidence adapter gains runtime authority', 'runtime boundary');
assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Caller-owned final negative handoff wording consistency must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Caller-owned final negative handoff wording consistency must not add production calls to the boundary contract.',
);

console.log('agent session v3 runtime boundary caller-owned real-exported evidence intake review readiness post-recheck final negative readout closeout handoff wording consistency checkpoint smoke ok');
