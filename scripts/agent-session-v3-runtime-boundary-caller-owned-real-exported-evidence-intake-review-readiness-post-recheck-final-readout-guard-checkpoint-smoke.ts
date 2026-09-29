import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { readProjectFile } from './smokeTestHarness.ts';

type CallerOwnedPostRecheckFinalReadoutGuardInput =
  | 'caller-owned-blocker-wording-closeout-summary'
  | 'caller-owned-blocker-wording-consistency'
  | 'caller-owned-post-closeout-production-gate-recheck'
  | 'caller-owned-post-recheck-remaining-blocker-handoff'
  | 'evidence-interpretation-to-production-gate-mapping'
  | 'generic-post-recheck-remaining-blocker-handoff'
  | 'preflight-audit'
  | 'remaining-non-evidence-production-blocker-inventory'
  | 'runtime-boundary-contract'
  | 'status-page';

type CallerOwnedPostRecheckFinalReadoutGuardCheck =
  | 'positive-production-readiness-language-absent'
  | 'production-authority-still-absent'
  | 'production-gate-still-closed'
  | 'blocker-groups-remain-separated'
  | 'manual-interpretation-still-not-ready'
  | 'runtime-action-order-still-absent'
  | 'tool-decision-language-still-absent'
  | 'production-wiring-still-deferred';

interface CallerOwnedPostRecheckFinalReadoutGuardRow {
  check: CallerOwnedPostRecheckFinalReadoutGuardCheck;
  guardStatus: 'final-readout-guarded-still-blocked';
  inputs: readonly CallerOwnedPostRecheckFinalReadoutGuardInput[];
  interpretationReadyNow: false;
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  manualInterpretationOnly: true;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
}

interface CallerOwnedPostRecheckFinalReadoutGuardCheckpoint {
  guard: 'caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-final-readout-guard';
  interpretationReadyNow: false;
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  manualInterpretationOnly: true;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly CallerOwnedPostRecheckFinalReadoutGuardRow[];
  summaryDecision: 'caller-owned-final-readout-guarded-positive-gate-closed';
}

const sharedInputs = [
  'caller-owned-blocker-wording-closeout-summary',
  'caller-owned-blocker-wording-consistency',
  'caller-owned-post-recheck-remaining-blocker-handoff',
  'caller-owned-post-closeout-production-gate-recheck',
  'generic-post-recheck-remaining-blocker-handoff',
  'evidence-interpretation-to-production-gate-mapping',
  'remaining-non-evidence-production-blocker-inventory',
  'preflight-audit',
  'status-page',
  'runtime-boundary-contract',
] as const satisfies readonly CallerOwnedPostRecheckFinalReadoutGuardInput[];

const callerOwnedPostRecheckFinalReadoutGuardCheckpoint = {
  guard: 'caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-final-readout-guard',
  interpretationReadyNow: false,
  isExecutionOrder: false,
  isImplementationPlan: false,
  isProductionWiringPlan: false,
  manualInterpretationOnly: true,
  positiveGateAllowed: false,
  productionAuthority: false,
  productionReady: false,
  rows: [
    {
      check: 'positive-production-readiness-language-absent',
      guardStatus: 'final-readout-guarded-still-blocked',
      inputs: sharedInputs,
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
    {
      check: 'production-authority-still-absent',
      guardStatus: 'final-readout-guarded-still-blocked',
      inputs: sharedInputs,
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
    {
      check: 'production-gate-still-closed',
      guardStatus: 'final-readout-guarded-still-blocked',
      inputs: sharedInputs,
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
    {
      check: 'blocker-groups-remain-separated',
      guardStatus: 'final-readout-guarded-still-blocked',
      inputs: sharedInputs,
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
    {
      check: 'manual-interpretation-still-not-ready',
      guardStatus: 'final-readout-guarded-still-blocked',
      inputs: sharedInputs,
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
    {
      check: 'runtime-action-order-still-absent',
      guardStatus: 'final-readout-guarded-still-blocked',
      inputs: sharedInputs,
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
    {
      check: 'tool-decision-language-still-absent',
      guardStatus: 'final-readout-guarded-still-blocked',
      inputs: sharedInputs,
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
    {
      check: 'production-wiring-still-deferred',
      guardStatus: 'final-readout-guarded-still-blocked',
      inputs: sharedInputs,
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
  ],
  summaryDecision: 'caller-owned-final-readout-guarded-positive-gate-closed',
} as const satisfies CallerOwnedPostRecheckFinalReadoutGuardCheckpoint;

function assertContains(text: string, expected: string, label: string) {
  assert.ok(text.includes(expected), `${label} should include: ${expected}`);
}

function rowForCheck(check: CallerOwnedPostRecheckFinalReadoutGuardCheck) {
  const row = callerOwnedPostRecheckFinalReadoutGuardCheckpoint.rows
    .find((candidate) => candidate.check === check);

  assert.ok(row, `${check} should exist in the caller-owned post-recheck final readout guard.`);
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
  'scripts/agent-session-v3-runtime-boundary-caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-blocker-wording-closeout-summary-checkpoint-smoke.ts',
);
const wordingConsistencySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-blocker-wording-consistency-checkpoint-smoke.ts',
);
const callerOwnedBlockerHandoffSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-remaining-blocker-handoff-checkpoint-smoke.ts',
);
const callerOwnedGateRecheckSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-caller-owned-real-exported-evidence-intake-review-readiness-post-closeout-production-gate-recheck-checkpoint-smoke.ts',
);
const genericBlockerHandoffSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-post-recheck-remaining-blocker-handoff-checkpoint-smoke.ts',
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

assert.equal(callerOwnedPostRecheckFinalReadoutGuardCheckpoint.interpretationReadyNow, false);
assert.equal(callerOwnedPostRecheckFinalReadoutGuardCheckpoint.manualInterpretationOnly, true);
assert.equal(callerOwnedPostRecheckFinalReadoutGuardCheckpoint.productionAuthority, false);
assert.equal(callerOwnedPostRecheckFinalReadoutGuardCheckpoint.productionReady, false);
assert.equal(callerOwnedPostRecheckFinalReadoutGuardCheckpoint.positiveGateAllowed, false);
assert.equal(callerOwnedPostRecheckFinalReadoutGuardCheckpoint.isExecutionOrder, false);
assert.equal(callerOwnedPostRecheckFinalReadoutGuardCheckpoint.isImplementationPlan, false);
assert.equal(callerOwnedPostRecheckFinalReadoutGuardCheckpoint.isProductionWiringPlan, false);
assert.equal(
  callerOwnedPostRecheckFinalReadoutGuardCheckpoint.summaryDecision,
  'caller-owned-final-readout-guarded-positive-gate-closed',
);

assert.deepEqual(
  callerOwnedPostRecheckFinalReadoutGuardCheckpoint.rows.map((row) => row.check).sort(),
  [
    'blocker-groups-remain-separated',
    'manual-interpretation-still-not-ready',
    'positive-production-readiness-language-absent',
    'production-authority-still-absent',
    'production-gate-still-closed',
    'production-wiring-still-deferred',
    'runtime-action-order-still-absent',
    'tool-decision-language-still-absent',
  ],
);

for (const row of callerOwnedPostRecheckFinalReadoutGuardCheckpoint.rows) {
  assert.equal(row.guardStatus, 'final-readout-guarded-still-blocked');
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

assert.equal(rowForCheck('positive-production-readiness-language-absent').productionReady, false);
assert.equal(rowForCheck('production-authority-still-absent').productionAuthority, false);
assert.equal(rowForCheck('production-gate-still-closed').positiveGateAllowed, false);
assert.equal(rowForCheck('blocker-groups-remain-separated').isImplementationPlan, false);
assert.equal(rowForCheck('manual-interpretation-still-not-ready').interpretationReadyNow, false);
assert.equal(rowForCheck('runtime-action-order-still-absent').isExecutionOrder, false);
assert.equal(rowForCheck('tool-decision-language-still-absent').isExecutionOrder, false);
assert.equal(rowForCheck('production-wiring-still-deferred').isProductionWiringPlan, false);

assertContains(closeoutSummarySmokeSource, 'caller-owned-blocker-wording-closeout-positive-gate-closed', 'closeout summary smoke');
assertContains(closeoutSummarySmokeSource, 'closed-out-wording-consistent-still-blocked', 'closeout summary smoke');
assertContains(closeoutSummarySmokeSource, 'no-production-readiness', 'closeout summary smoke');
assertContains(closeoutSummarySmokeSource, 'no-runtime-authority', 'closeout summary smoke');
assertContains(wordingConsistencySmokeSource, 'caller-owned-blocker-wording-consistent-positive-gate-closed', 'wording consistency smoke');
assertContains(callerOwnedBlockerHandoffSmokeSource, 'caller-owned-remaining-blockers-handed-off-positive-gate-closed', 'caller-owned blocker handoff smoke');
assertContains(callerOwnedGateRecheckSmokeSource, 'caller-owned-post-closeout-positive-gate-remains-closed-evidence-still-missing', 'caller-owned gate recheck smoke');
assertContains(genericBlockerHandoffSmokeSource, 'remaining-blockers-handed-off-positive-gate-closed', 'generic blocker handoff smoke');
assertContains(evidenceMappingSmokeSource, 'mapping-only-positive-gate-remains-closed', 'evidence mapping smoke');
assertContains(nonEvidenceInventorySmokeSource, 'non-evidence-blockers-remain-positive-gate-closed', 'non-evidence inventory smoke');

for (const blocker of [
  'no-explicit-real-exported-intake',
  'p0-real-exported-corpus-missing',
  'missing-real-or-production-like-traces',
  'manual-interpretation-not-ready',
  'production-gate-closed',
  'agent-session-v2-production-owner-retained',
  'production-adapter-contracts-missing',
  'controller-policy-contracts-missing',
  'runtime-action-order-not-owned-by-v3',
] as const) {
  assertContains(closeoutSummarySmokeSource, blocker, 'closeout summary smoke');
}

assertContains(auditText, 'Caller-Owned Real-Exported Evidence Intake Review Readiness Post-Recheck Final Readout Guard Checkpoint Status', 'preflight audit');
assertContains(auditText, 'final readout guard keeps the closed blocker wording readout negative and non-production', 'preflight audit');
assertContains(statusText, 'V3 runtime boundary caller-owned real-exported evidence intake review readiness post-recheck final readout guard checkpoint', 'status');
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-final-readout-guard-checkpoint-smoke.ts',
  'status',
);
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

const guardedSources = [
  ['closeout summary', closeoutSummarySmokeSource],
  ['blocker wording consistency', wordingConsistencySmokeSource],
  ['caller-owned blocker handoff', callerOwnedBlockerHandoffSmokeSource],
  ['caller-owned gate recheck', callerOwnedGateRecheckSmokeSource],
  ['generic blocker handoff', genericBlockerHandoffSmokeSource],
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

const serializedGuard = JSON.stringify(callerOwnedPostRecheckFinalReadoutGuardCheckpoint);
assert.doesNotMatch(
  serializedGuard,
  /productionAuthority":true|productionReady":true|positiveGateAllowed":true/u,
  'Caller-owned final readout guard must not grant production readiness or authority.',
);
assert.doesNotMatch(
  serializedGuard,
  /isProductionWiringPlan":true|isImplementationPlan":true|production-wiring-ready|ready-for-production-wiring/u,
  'Caller-owned final readout guard must not become an implementation plan or production wiring plan.',
);
assert.doesNotMatch(
  serializedGuard,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Caller-owned final readout guard should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedGuard,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Caller-owned final readout guard should not prescribe concrete desktop tools.',
);

assertContains(boundarySource, 'AgentSessionV2 remains the production orchestrator', 'runtime boundary');
assertContains(boundarySource, 'no required ordered tool workflow', 'runtime boundary');
assertContains(boundarySource, 'no evidence adapter gains runtime authority', 'runtime boundary');
assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Caller-owned final readout guard must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Caller-owned final readout guard must not add production calls to the boundary contract.',
);

console.log('agent session v3 runtime boundary caller-owned real-exported evidence intake review readiness post-recheck final readout guard checkpoint smoke ok');
