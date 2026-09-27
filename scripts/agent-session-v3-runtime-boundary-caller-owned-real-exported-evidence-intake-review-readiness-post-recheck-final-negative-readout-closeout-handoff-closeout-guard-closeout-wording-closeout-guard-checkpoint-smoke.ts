import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { readProjectFile } from './smokeTestHarness.ts';

type CallerOwnedFinalNegativeHandoffGuardCloseoutWordingCloseoutGuardInput =
  | 'final-negative-readout-closeout-handoff-closeout-guard-closeout-wording-closeout-summary'
  | 'final-negative-readout-closeout-handoff-closeout-guard-closeout-wording-consistency'
  | 'final-negative-readout-closeout-handoff-closeout-guard-closeout-summary'
  | 'final-negative-readout-closeout-handoff-closeout-guard'
  | 'final-negative-readout-closeout-handoff-closeout-summary'
  | 'production-gate-final-negative-readout'
  | 'evidence-interpretation-to-production-gate-mapping'
  | 'remaining-non-evidence-production-blocker-inventory'
  | 'runtime-boundary-contract'
  | 'status-page'
  | 'preflight-audit';

type CallerOwnedFinalNegativeHandoffGuardCloseoutWordingCloseoutGuardCheck =
  | 'wording-closeout-summary-guarded'
  | 'blocked-wording-still-present'
  | 'non-production-wording-still-present'
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

interface CallerOwnedFinalNegativeHandoffGuardCloseoutWordingCloseoutGuardRow {
  check: CallerOwnedFinalNegativeHandoffGuardCloseoutWordingCloseoutGuardCheck;
  inputs: readonly CallerOwnedFinalNegativeHandoffGuardCloseoutWordingCloseoutGuardInput[];
  interpretationReadyNow: false;
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  manualInterpretationOnly: true;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  guardStatus: 'guarded-final-negative-handoff-guard-closeout-wording-closeout-still-blocked';
}

interface CallerOwnedFinalNegativeHandoffGuardCloseoutWordingCloseoutGuardCheckpoint {
  checkpoint: 'caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-final-negative-readout-closeout-handoff-closeout-guard-closeout-wording-closeout-guard';
  interpretationReadyNow: false;
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  manualInterpretationOnly: true;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly CallerOwnedFinalNegativeHandoffGuardCloseoutWordingCloseoutGuardRow[];
  summaryDecision: 'caller-owned-final-negative-handoff-guard-closeout-wording-closeout-guard-positive-gate-closed';
}

const sharedInputs = [
  'final-negative-readout-closeout-handoff-closeout-guard-closeout-wording-closeout-summary',
  'final-negative-readout-closeout-handoff-closeout-guard-closeout-wording-consistency',
  'final-negative-readout-closeout-handoff-closeout-guard-closeout-summary',
  'final-negative-readout-closeout-handoff-closeout-guard',
  'final-negative-readout-closeout-handoff-closeout-summary',
  'production-gate-final-negative-readout',
  'evidence-interpretation-to-production-gate-mapping',
  'remaining-non-evidence-production-blocker-inventory',
  'preflight-audit',
  'status-page',
  'runtime-boundary-contract',
] as const satisfies readonly CallerOwnedFinalNegativeHandoffGuardCloseoutWordingCloseoutGuardInput[];

const callerOwnedFinalNegativeHandoffGuardCloseoutWordingCloseoutGuardCheckpoint = {
  checkpoint: 'caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-final-negative-readout-closeout-handoff-closeout-guard-closeout-wording-closeout-guard',
  interpretationReadyNow: false,
  isExecutionOrder: false,
  isImplementationPlan: false,
  isProductionWiringPlan: false,
  manualInterpretationOnly: true,
  positiveGateAllowed: false,
  productionAuthority: false,
  productionReady: false,
  rows: [
    'wording-closeout-summary-guarded',
    'blocked-wording-still-present',
    'non-production-wording-still-present',
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
    guardStatus: 'guarded-final-negative-handoff-guard-closeout-wording-closeout-still-blocked',
  })),
  summaryDecision: 'caller-owned-final-negative-handoff-guard-closeout-wording-closeout-guard-positive-gate-closed',
} as const satisfies CallerOwnedFinalNegativeHandoffGuardCloseoutWordingCloseoutGuardCheckpoint;

function assertContains(text: string, expected: string, label: string) {
  assert.ok(text.includes(expected), `${label} should include: ${expected}`);
}

function rowForCheck(check: CallerOwnedFinalNegativeHandoffGuardCloseoutWordingCloseoutGuardCheck) {
  const row = callerOwnedFinalNegativeHandoffGuardCloseoutWordingCloseoutGuardCheckpoint.rows
    .find((candidate) => candidate.check === check);

  assert.ok(row, `${check} should exist in the caller-owned final negative wording closeout guard.`);
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
const wordingCloseoutSummarySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-final-negative-readout-closeout-handoff-closeout-guard-closeout-wording-closeout-summary-checkpoint-smoke.ts',
);
const wordingConsistencySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-final-negative-readout-closeout-handoff-closeout-guard-closeout-wording-consistency-checkpoint-smoke.ts',
);
const guardCloseoutSummarySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-final-negative-readout-closeout-handoff-closeout-guard-closeout-summary-checkpoint-smoke.ts',
);
const guardSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-final-negative-readout-closeout-handoff-closeout-guard-checkpoint-smoke.ts',
);
const closeoutSummarySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-final-negative-readout-closeout-handoff-closeout-summary-checkpoint-smoke.ts',
);
const productionGateFinalNegativeReadoutSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-production-gate-final-negative-readout-checkpoint-smoke.ts',
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

assert.equal(callerOwnedFinalNegativeHandoffGuardCloseoutWordingCloseoutGuardCheckpoint.interpretationReadyNow, false);
assert.equal(callerOwnedFinalNegativeHandoffGuardCloseoutWordingCloseoutGuardCheckpoint.manualInterpretationOnly, true);
assert.equal(callerOwnedFinalNegativeHandoffGuardCloseoutWordingCloseoutGuardCheckpoint.productionAuthority, false);
assert.equal(callerOwnedFinalNegativeHandoffGuardCloseoutWordingCloseoutGuardCheckpoint.productionReady, false);
assert.equal(callerOwnedFinalNegativeHandoffGuardCloseoutWordingCloseoutGuardCheckpoint.positiveGateAllowed, false);
assert.equal(callerOwnedFinalNegativeHandoffGuardCloseoutWordingCloseoutGuardCheckpoint.isExecutionOrder, false);
assert.equal(callerOwnedFinalNegativeHandoffGuardCloseoutWordingCloseoutGuardCheckpoint.isImplementationPlan, false);
assert.equal(callerOwnedFinalNegativeHandoffGuardCloseoutWordingCloseoutGuardCheckpoint.isProductionWiringPlan, false);
assert.equal(
  callerOwnedFinalNegativeHandoffGuardCloseoutWordingCloseoutGuardCheckpoint.summaryDecision,
  'caller-owned-final-negative-handoff-guard-closeout-wording-closeout-guard-positive-gate-closed',
);

assert.deepEqual(
  callerOwnedFinalNegativeHandoffGuardCloseoutWordingCloseoutGuardCheckpoint.rows.map((row) => row.check).sort(),
  [
    'blocked-wording-still-present',
    'caller-owned-intake-blockers-separated',
    'current-evidence-blockers-separated',
    'fixed-tool-chain-still-absent',
    'manual-interpretation-blockers-separated',
    'non-evidence-production-blockers-separated',
    'non-production-wording-still-present',
    'positive-production-gate-still-closed',
    'production-authority-still-absent',
    'production-wiring-still-deferred',
    'runtime-action-order-still-absent',
    'tool-decision-still-absent',
    'wording-closeout-summary-guarded',
  ],
);

for (const row of callerOwnedFinalNegativeHandoffGuardCloseoutWordingCloseoutGuardCheckpoint.rows) {
  assert.equal(row.guardStatus, 'guarded-final-negative-handoff-guard-closeout-wording-closeout-still-blocked');
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

assert.equal(rowForCheck('wording-closeout-summary-guarded').productionReady, false);
assert.equal(rowForCheck('blocked-wording-still-present').productionReady, false);
assert.equal(rowForCheck('non-production-wording-still-present').productionAuthority, false);
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
  wordingCloseoutSummarySmokeSource,
  'caller-owned-final-negative-handoff-guard-closeout-wording-closeout-positive-gate-closed',
  'wording closeout summary smoke',
);
assertContains(
  wordingCloseoutSummarySmokeSource,
  'closed-out-final-negative-handoff-guard-closeout-wording-still-blocked',
  'wording closeout summary smoke',
);
assertContains(
  wordingConsistencySmokeSource,
  'caller-owned-final-negative-handoff-guard-closeout-wording-consistent-positive-gate-closed',
  'wording consistency smoke',
);
assertContains(
  guardCloseoutSummarySmokeSource,
  'caller-owned-final-negative-handoff-guard-closeout-positive-gate-closed',
  'guard closeout summary smoke',
);
assertContains(guardSmokeSource, 'final-negative-handoff-closeout-guarded-still-blocked', 'guard smoke');
assertContains(closeoutSummarySmokeSource, 'closed-out-final-negative-handoff-still-blocked', 'closeout summary smoke');
assertContains(
  productionGateFinalNegativeReadoutSmokeSource,
  'final-negative-production-gate-readout-still-blocked',
  'production gate final negative readout smoke',
);
assertContains(evidenceMappingSmokeSource, 'mapping-only-positive-gate-remains-closed', 'evidence mapping smoke');
assertContains(nonEvidenceInventorySmokeSource, 'non-evidence-blockers-remain-positive-gate-closed', 'non-evidence inventory smoke');

assertContains(
  auditText,
  'Caller-Owned Real-Exported Evidence Intake Review Readiness Post-Recheck Final Negative Readout Closeout Handoff Closeout Guard Closeout Wording Closeout Guard Checkpoint Status',
  'preflight audit',
);
assertContains(
  auditText,
  'final negative handoff guard closeout wording closeout guard keeps the closeout summary blocked and non-production',
  'preflight audit',
);
assertContains(
  statusText,
  'V3 runtime boundary caller-owned real-exported evidence intake review readiness post-recheck final negative readout closeout handoff closeout guard closeout wording closeout guard checkpoint',
  'status',
);
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-final-negative-readout-closeout-handoff-closeout-guard-closeout-wording-closeout-guard-checkpoint-smoke.ts',
  'status',
);
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

const guardedSources = [
  ['wording closeout summary', wordingCloseoutSummarySmokeSource],
  ['wording consistency', wordingConsistencySmokeSource],
  ['guard closeout summary', guardCloseoutSummarySmokeSource],
  ['guard', guardSmokeSource],
  ['closeout summary', closeoutSummarySmokeSource],
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

const serializedCheckpoint = JSON.stringify(callerOwnedFinalNegativeHandoffGuardCloseoutWordingCloseoutGuardCheckpoint);
assert.doesNotMatch(
  serializedCheckpoint,
  /productionAuthority":true|productionReady":true|positiveGateAllowed":true/u,
  'Caller-owned final negative handoff guard closeout wording closeout guard must not grant production readiness.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /isProductionWiringPlan":true|isImplementationPlan":true|production-wiring-ready|ready-for-production-wiring/u,
  'Caller-owned final negative handoff guard closeout wording closeout guard must not become an implementation plan.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Caller-owned final negative handoff guard closeout wording closeout guard should not define controller actions.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Caller-owned final negative handoff guard closeout wording closeout guard should not prescribe desktop tools.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain|requiredReportOrder|implementationQueue|orderedSteps/iu,
  'Caller-owned final negative handoff guard closeout wording closeout guard should not define fixed workflows.',
);

assertContains(boundarySource, 'AgentSessionV2 remains the production orchestrator', 'runtime boundary');
assertContains(boundarySource, 'no required ordered tool workflow', 'runtime boundary');
assertContains(boundarySource, 'no evidence adapter gains runtime authority', 'runtime boundary');
assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Caller-owned final negative handoff guard closeout wording closeout guard must not add controller contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Caller-owned final negative handoff guard closeout wording closeout guard must not add production runtime calls.',
);

console.log('agent session v3 runtime boundary caller-owned real-exported evidence intake review readiness post-recheck final negative readout closeout handoff closeout guard closeout wording closeout guard checkpoint smoke ok');
