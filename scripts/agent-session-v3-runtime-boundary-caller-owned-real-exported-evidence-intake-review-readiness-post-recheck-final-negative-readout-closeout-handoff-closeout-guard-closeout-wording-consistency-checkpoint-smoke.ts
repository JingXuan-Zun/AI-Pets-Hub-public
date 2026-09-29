import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { readProjectFile } from './smokeTestHarness.ts';

type CallerOwnedFinalNegativeHandoffGuardCloseoutWordingInput =
  | 'final-negative-readout-closeout-handoff-closeout-guard-closeout-summary'
  | 'final-negative-readout-closeout-handoff-closeout-guard'
  | 'final-negative-readout-closeout-handoff-closeout-summary'
  | 'final-negative-readout-closeout-handoff-wording-consistency'
  | 'final-negative-readout-closeout-handoff'
  | 'production-gate-final-negative-readout'
  | 'runtime-boundary-contract'
  | 'status-page'
  | 'preflight-audit';

type CallerOwnedFinalNegativeHandoffGuardCloseoutWordingCheck =
  | 'blocked-status-wording-consistent'
  | 'non-production-wording-consistent'
  | 'caller-owned-intake-wording-separated'
  | 'current-evidence-wording-separated'
  | 'manual-interpretation-wording-separated'
  | 'non-evidence-production-wording-separated'
  | 'positive-production-gate-wording-closed'
  | 'production-authority-wording-absent'
  | 'production-wiring-wording-deferred'
  | 'runtime-action-order-wording-absent'
  | 'tool-decision-wording-absent'
  | 'fixed-tool-chain-wording-absent';

interface CallerOwnedFinalNegativeHandoffGuardCloseoutWordingRow {
  check: CallerOwnedFinalNegativeHandoffGuardCloseoutWordingCheck;
  inputs: readonly CallerOwnedFinalNegativeHandoffGuardCloseoutWordingInput[];
  interpretationReadyNow: false;
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  manualInterpretationOnly: true;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  wordingStatus: 'final-negative-handoff-guard-closeout-wording-consistent-still-blocked';
}

interface CallerOwnedFinalNegativeHandoffGuardCloseoutWordingCheckpoint {
  checkpoint: 'caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-final-negative-readout-closeout-handoff-closeout-guard-closeout-wording-consistency';
  interpretationReadyNow: false;
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  manualInterpretationOnly: true;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly CallerOwnedFinalNegativeHandoffGuardCloseoutWordingRow[];
  summaryDecision: 'caller-owned-final-negative-handoff-guard-closeout-wording-consistent-positive-gate-closed';
}

const sharedInputs = [
  'final-negative-readout-closeout-handoff-closeout-guard-closeout-summary',
  'final-negative-readout-closeout-handoff-closeout-guard',
  'final-negative-readout-closeout-handoff-closeout-summary',
  'final-negative-readout-closeout-handoff-wording-consistency',
  'final-negative-readout-closeout-handoff',
  'production-gate-final-negative-readout',
  'preflight-audit',
  'status-page',
  'runtime-boundary-contract',
] as const satisfies readonly CallerOwnedFinalNegativeHandoffGuardCloseoutWordingInput[];

const callerOwnedFinalNegativeHandoffGuardCloseoutWordingCheckpoint = {
  checkpoint: 'caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-final-negative-readout-closeout-handoff-closeout-guard-closeout-wording-consistency',
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
    'non-production-wording-consistent',
    'caller-owned-intake-wording-separated',
    'current-evidence-wording-separated',
    'manual-interpretation-wording-separated',
    'non-evidence-production-wording-separated',
    'positive-production-gate-wording-closed',
    'production-authority-wording-absent',
    'production-wiring-wording-deferred',
    'runtime-action-order-wording-absent',
    'tool-decision-wording-absent',
    'fixed-tool-chain-wording-absent',
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
    wordingStatus: 'final-negative-handoff-guard-closeout-wording-consistent-still-blocked',
  })),
  summaryDecision: 'caller-owned-final-negative-handoff-guard-closeout-wording-consistent-positive-gate-closed',
} as const satisfies CallerOwnedFinalNegativeHandoffGuardCloseoutWordingCheckpoint;

function assertContains(text: string, expected: string, label: string) {
  assert.ok(text.includes(expected), `${label} should include: ${expected}`);
}

function rowForCheck(check: CallerOwnedFinalNegativeHandoffGuardCloseoutWordingCheck) {
  const row = callerOwnedFinalNegativeHandoffGuardCloseoutWordingCheckpoint.rows
    .find((candidate) => candidate.check === check);

  assert.ok(row, `${check} should exist in the caller-owned final negative handoff guard closeout wording checkpoint.`);
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
const guardCloseoutSummarySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-final-negative-readout-closeout-handoff-closeout-guard-closeout-summary-checkpoint-smoke.ts',
);
const guardSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-final-negative-readout-closeout-handoff-closeout-guard-checkpoint-smoke.ts',
);
const closeoutSummarySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-final-negative-readout-closeout-handoff-closeout-summary-checkpoint-smoke.ts',
);
const priorWordingConsistencySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-final-negative-readout-closeout-handoff-wording-consistency-checkpoint-smoke.ts',
);
const handoffSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-final-negative-readout-closeout-handoff-checkpoint-smoke.ts',
);
const productionGateFinalNegativeReadoutSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-production-gate-final-negative-readout-checkpoint-smoke.ts',
);

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');
assert.equal(boundaryContract.mode, 'contract-only');
assert.ok(boundaryContract.guardrails.includes('AgentSessionV2 remains the production orchestrator'));
assert.ok(boundaryContract.guardrails.includes('no required ordered tool workflow'));
assert.ok(boundaryContract.guardrails.includes('no evidence adapter gains runtime authority'));

assert.equal(callerOwnedFinalNegativeHandoffGuardCloseoutWordingCheckpoint.interpretationReadyNow, false);
assert.equal(callerOwnedFinalNegativeHandoffGuardCloseoutWordingCheckpoint.manualInterpretationOnly, true);
assert.equal(callerOwnedFinalNegativeHandoffGuardCloseoutWordingCheckpoint.productionAuthority, false);
assert.equal(callerOwnedFinalNegativeHandoffGuardCloseoutWordingCheckpoint.productionReady, false);
assert.equal(callerOwnedFinalNegativeHandoffGuardCloseoutWordingCheckpoint.positiveGateAllowed, false);
assert.equal(callerOwnedFinalNegativeHandoffGuardCloseoutWordingCheckpoint.isExecutionOrder, false);
assert.equal(callerOwnedFinalNegativeHandoffGuardCloseoutWordingCheckpoint.isImplementationPlan, false);
assert.equal(callerOwnedFinalNegativeHandoffGuardCloseoutWordingCheckpoint.isProductionWiringPlan, false);
assert.equal(
  callerOwnedFinalNegativeHandoffGuardCloseoutWordingCheckpoint.summaryDecision,
  'caller-owned-final-negative-handoff-guard-closeout-wording-consistent-positive-gate-closed',
);

assert.deepEqual(
  callerOwnedFinalNegativeHandoffGuardCloseoutWordingCheckpoint.rows.map((row) => row.check).sort(),
  [
    'blocked-status-wording-consistent',
    'caller-owned-intake-wording-separated',
    'current-evidence-wording-separated',
    'fixed-tool-chain-wording-absent',
    'manual-interpretation-wording-separated',
    'non-evidence-production-wording-separated',
    'non-production-wording-consistent',
    'positive-production-gate-wording-closed',
    'production-authority-wording-absent',
    'production-wiring-wording-deferred',
    'runtime-action-order-wording-absent',
    'tool-decision-wording-absent',
  ],
);

for (const row of callerOwnedFinalNegativeHandoffGuardCloseoutWordingCheckpoint.rows) {
  assert.equal(row.wordingStatus, 'final-negative-handoff-guard-closeout-wording-consistent-still-blocked');
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
assert.equal(rowForCheck('non-production-wording-consistent').productionReady, false);
assert.equal(rowForCheck('caller-owned-intake-wording-separated').manualInterpretationOnly, true);
assert.equal(rowForCheck('current-evidence-wording-separated').interpretationReadyNow, false);
assert.equal(rowForCheck('manual-interpretation-wording-separated').interpretationReadyNow, false);
assert.equal(rowForCheck('non-evidence-production-wording-separated').isProductionWiringPlan, false);
assert.equal(rowForCheck('positive-production-gate-wording-closed').positiveGateAllowed, false);
assert.equal(rowForCheck('production-authority-wording-absent').productionAuthority, false);
assert.equal(rowForCheck('production-wiring-wording-deferred').isProductionWiringPlan, false);
assert.equal(rowForCheck('runtime-action-order-wording-absent').isExecutionOrder, false);
assert.equal(rowForCheck('tool-decision-wording-absent').isExecutionOrder, false);
assert.equal(rowForCheck('fixed-tool-chain-wording-absent').isExecutionOrder, false);

assertContains(
  guardCloseoutSummarySmokeSource,
  'caller-owned-final-negative-handoff-guard-closeout-positive-gate-closed',
  'guard closeout summary smoke',
);
assertContains(
  guardCloseoutSummarySmokeSource,
  'closed-out-final-negative-handoff-guard-still-blocked',
  'guard closeout summary smoke',
);
assertContains(
  guardSmokeSource,
  'caller-owned-final-negative-handoff-closeout-guard-positive-gate-closed',
  'guard smoke',
);
assertContains(guardSmokeSource, 'final-negative-handoff-closeout-guarded-still-blocked', 'guard smoke');
assertContains(
  closeoutSummarySmokeSource,
  'caller-owned-final-negative-handoff-closeout-positive-gate-closed',
  'closeout summary smoke',
);
assertContains(closeoutSummarySmokeSource, 'closed-out-final-negative-handoff-still-blocked', 'closeout summary smoke');
assertContains(
  priorWordingConsistencySmokeSource,
  'caller-owned-final-negative-handoff-wording-consistent-positive-gate-closed',
  'prior wording consistency smoke',
);
assertContains(
  priorWordingConsistencySmokeSource,
  'final-negative-handoff-wording-consistent-still-blocked',
  'prior wording consistency smoke',
);
assertContains(handoffSmokeSource, 'final-negative-readout-closeout-handoff-still-blocked', 'handoff smoke');
assertContains(
  productionGateFinalNegativeReadoutSmokeSource,
  'final-negative-production-gate-readout-still-blocked',
  'production gate final negative readout smoke',
);

assertContains(
  auditText,
  'Caller-Owned Real-Exported Evidence Intake Review Readiness Post-Recheck Final Negative Readout Closeout Handoff Closeout Guard Closeout Wording Consistency Checkpoint Status',
  'preflight audit',
);
assertContains(
  auditText,
  'final negative handoff guard closeout wording remains consistent, blocked, and non-production',
  'preflight audit',
);
assertContains(
  statusText,
  'V3 runtime boundary caller-owned real-exported evidence intake review readiness post-recheck final negative readout closeout handoff closeout guard closeout wording consistency checkpoint',
  'status',
);
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-final-negative-readout-closeout-handoff-closeout-guard-closeout-wording-consistency-checkpoint-smoke.ts',
  'status',
);
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

for (const expected of [
  'final negative readout closeout handoff guard closeout keeps the chain blocked and non-production',
  'final negative readout closeout handoff guard keeps the closeout summary blocked and non-production',
  'final negative readout closeout handoff chain now has one current blocked closeout readout',
  'caller-owned intake blockers remain separate from current evidence blockers',
  'manual interpretation blockers remain separate from production wiring blockers',
  'remaining non-evidence production blockers remain open',
  'positive production-readiness language remains absent',
  'production authority remains absent',
  'no tool-decision, fixed-tool-chain, or runtime-action-order language is introduced',
] as const) {
  assertContains(auditText, expected, 'preflight audit');
}

const guardedSources = [
  ['guard closeout summary', guardCloseoutSummarySmokeSource],
  ['guard', guardSmokeSource],
  ['closeout summary', closeoutSummarySmokeSource],
  ['prior wording consistency', priorWordingConsistencySmokeSource],
  ['handoff', handoffSmokeSource],
  ['production gate final negative readout', productionGateFinalNegativeReadoutSmokeSource],
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

const serializedCheckpoint = JSON.stringify(callerOwnedFinalNegativeHandoffGuardCloseoutWordingCheckpoint);
assert.doesNotMatch(
  serializedCheckpoint,
  /productionAuthority":true|productionReady":true|positiveGateAllowed":true/u,
  'Caller-owned final negative handoff guard closeout wording consistency must not grant production readiness or authority.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /isProductionWiringPlan":true|isImplementationPlan":true|production-wiring-ready|ready-for-production-wiring/u,
  'Caller-owned final negative handoff guard closeout wording consistency must not become an implementation plan or production wiring plan.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Caller-owned final negative handoff guard closeout wording consistency should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Caller-owned final negative handoff guard closeout wording consistency should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain|requiredReportOrder|implementationQueue|orderedSteps/iu,
  'Caller-owned final negative handoff guard closeout wording consistency should not define fixed workflows, required report order, or task queues.',
);

assertContains(boundarySource, 'AgentSessionV2 remains the production orchestrator', 'runtime boundary');
assertContains(boundarySource, 'no required ordered tool workflow', 'runtime boundary');
assertContains(boundarySource, 'no evidence adapter gains runtime authority', 'runtime boundary');
assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Caller-owned final negative handoff guard closeout wording consistency must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Caller-owned final negative handoff guard closeout wording consistency must not add production calls to the boundary contract.',
);

console.log('agent session v3 runtime boundary caller-owned real-exported evidence intake review readiness post-recheck final negative readout closeout handoff closeout guard closeout wording consistency checkpoint smoke ok');
