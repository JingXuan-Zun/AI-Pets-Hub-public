import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { readProjectFile } from './smokeTestHarness.ts';

type CallerOwnedFinalNegativeReadoutCloseoutHandoffCloseoutInput =
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

type CallerOwnedFinalNegativeReadoutCloseoutHandoffCloseoutBlockerGroup =
  | 'caller-owned-intake'
  | 'current-evidence'
  | 'manual-interpretation'
  | 'remaining-non-evidence-production';

type CallerOwnedFinalNegativeReadoutCloseoutHandoffCloseoutSignal =
  | 'final-negative-handoff-chain-closed-current-status'
  | 'blocked-status-closeout-preserved'
  | 'caller-owned-intake-blockers-separated'
  | 'current-evidence-blockers-separated'
  | 'manual-interpretation-blockers-separated'
  | 'non-evidence-production-blockers-separated'
  | 'positive-production-gate-remains-closed'
  | 'production-authority-remains-absent'
  | 'production-wiring-remains-deferred'
  | 'runtime-action-order-remains-absent'
  | 'tool-decision-language-remains-absent';

interface CallerOwnedFinalNegativeReadoutCloseoutHandoffCloseoutRow {
  blockerGroups: readonly CallerOwnedFinalNegativeReadoutCloseoutHandoffCloseoutBlockerGroup[];
  inputs: readonly CallerOwnedFinalNegativeReadoutCloseoutHandoffCloseoutInput[];
  interpretationReadyNow: false;
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  manualInterpretationOnly: true;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  signal: CallerOwnedFinalNegativeReadoutCloseoutHandoffCloseoutSignal;
  summaryStatus: 'closed-out-final-negative-handoff-still-blocked';
}

interface CallerOwnedFinalNegativeReadoutCloseoutHandoffCloseoutSummaryCheckpoint {
  closeout: 'caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-final-negative-readout-closeout-handoff-closeout-summary';
  interpretationReadyNow: false;
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  manualInterpretationOnly: true;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly CallerOwnedFinalNegativeReadoutCloseoutHandoffCloseoutRow[];
  summaryDecision: 'caller-owned-final-negative-handoff-closeout-positive-gate-closed';
}

const sharedInputs = [
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
] as const satisfies readonly CallerOwnedFinalNegativeReadoutCloseoutHandoffCloseoutInput[];

const allBlockerGroups = [
  'caller-owned-intake',
  'current-evidence',
  'manual-interpretation',
  'remaining-non-evidence-production',
] as const satisfies readonly CallerOwnedFinalNegativeReadoutCloseoutHandoffCloseoutBlockerGroup[];

const callerOwnedFinalNegativeReadoutCloseoutHandoffCloseoutSummaryCheckpoint = {
  closeout: 'caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-final-negative-readout-closeout-handoff-closeout-summary',
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
      blockerGroups: allBlockerGroups,
      inputs: sharedInputs,
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'final-negative-handoff-chain-closed-current-status',
      summaryStatus: 'closed-out-final-negative-handoff-still-blocked',
    },
    {
      blockerGroups: allBlockerGroups,
      inputs: sharedInputs,
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'blocked-status-closeout-preserved',
      summaryStatus: 'closed-out-final-negative-handoff-still-blocked',
    },
    {
      blockerGroups: ['caller-owned-intake'],
      inputs: sharedInputs,
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'caller-owned-intake-blockers-separated',
      summaryStatus: 'closed-out-final-negative-handoff-still-blocked',
    },
    {
      blockerGroups: ['current-evidence'],
      inputs: sharedInputs,
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'current-evidence-blockers-separated',
      summaryStatus: 'closed-out-final-negative-handoff-still-blocked',
    },
    {
      blockerGroups: ['manual-interpretation'],
      inputs: sharedInputs,
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'manual-interpretation-blockers-separated',
      summaryStatus: 'closed-out-final-negative-handoff-still-blocked',
    },
    {
      blockerGroups: ['remaining-non-evidence-production'],
      inputs: sharedInputs,
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'non-evidence-production-blockers-separated',
      summaryStatus: 'closed-out-final-negative-handoff-still-blocked',
    },
    {
      blockerGroups: allBlockerGroups,
      inputs: sharedInputs,
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'positive-production-gate-remains-closed',
      summaryStatus: 'closed-out-final-negative-handoff-still-blocked',
    },
    {
      blockerGroups: ['remaining-non-evidence-production'],
      inputs: sharedInputs,
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'production-authority-remains-absent',
      summaryStatus: 'closed-out-final-negative-handoff-still-blocked',
    },
    {
      blockerGroups: ['remaining-non-evidence-production'],
      inputs: sharedInputs,
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'production-wiring-remains-deferred',
      summaryStatus: 'closed-out-final-negative-handoff-still-blocked',
    },
    {
      blockerGroups: ['remaining-non-evidence-production'],
      inputs: sharedInputs,
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'runtime-action-order-remains-absent',
      summaryStatus: 'closed-out-final-negative-handoff-still-blocked',
    },
    {
      blockerGroups: ['remaining-non-evidence-production'],
      inputs: sharedInputs,
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'tool-decision-language-remains-absent',
      summaryStatus: 'closed-out-final-negative-handoff-still-blocked',
    },
  ],
  summaryDecision: 'caller-owned-final-negative-handoff-closeout-positive-gate-closed',
} as const satisfies CallerOwnedFinalNegativeReadoutCloseoutHandoffCloseoutSummaryCheckpoint;

function assertContains(text: string, expected: string, label: string) {
  assert.ok(text.includes(expected), `${label} should include: ${expected}`);
}

function rowForSignal(signal: CallerOwnedFinalNegativeReadoutCloseoutHandoffCloseoutSignal) {
  const row = callerOwnedFinalNegativeReadoutCloseoutHandoffCloseoutSummaryCheckpoint.rows
    .find((candidate) => candidate.signal === signal);

  assert.ok(row, `${signal} should exist in the caller-owned final negative handoff closeout summary.`);
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

assert.equal(callerOwnedFinalNegativeReadoutCloseoutHandoffCloseoutSummaryCheckpoint.interpretationReadyNow, false);
assert.equal(callerOwnedFinalNegativeReadoutCloseoutHandoffCloseoutSummaryCheckpoint.manualInterpretationOnly, true);
assert.equal(callerOwnedFinalNegativeReadoutCloseoutHandoffCloseoutSummaryCheckpoint.productionAuthority, false);
assert.equal(callerOwnedFinalNegativeReadoutCloseoutHandoffCloseoutSummaryCheckpoint.productionReady, false);
assert.equal(callerOwnedFinalNegativeReadoutCloseoutHandoffCloseoutSummaryCheckpoint.positiveGateAllowed, false);
assert.equal(callerOwnedFinalNegativeReadoutCloseoutHandoffCloseoutSummaryCheckpoint.isExecutionOrder, false);
assert.equal(callerOwnedFinalNegativeReadoutCloseoutHandoffCloseoutSummaryCheckpoint.isImplementationPlan, false);
assert.equal(callerOwnedFinalNegativeReadoutCloseoutHandoffCloseoutSummaryCheckpoint.isProductionWiringPlan, false);
assert.equal(
  callerOwnedFinalNegativeReadoutCloseoutHandoffCloseoutSummaryCheckpoint.summaryDecision,
  'caller-owned-final-negative-handoff-closeout-positive-gate-closed',
);

assert.deepEqual(
  callerOwnedFinalNegativeReadoutCloseoutHandoffCloseoutSummaryCheckpoint.rows.map((row) => row.signal).sort(),
  [
    'blocked-status-closeout-preserved',
    'caller-owned-intake-blockers-separated',
    'current-evidence-blockers-separated',
    'final-negative-handoff-chain-closed-current-status',
    'manual-interpretation-blockers-separated',
    'non-evidence-production-blockers-separated',
    'positive-production-gate-remains-closed',
    'production-authority-remains-absent',
    'production-wiring-remains-deferred',
    'runtime-action-order-remains-absent',
    'tool-decision-language-remains-absent',
  ],
);

for (const row of callerOwnedFinalNegativeReadoutCloseoutHandoffCloseoutSummaryCheckpoint.rows) {
  assert.equal(row.summaryStatus, 'closed-out-final-negative-handoff-still-blocked');
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

assert.deepEqual(rowForSignal('final-negative-handoff-chain-closed-current-status').blockerGroups, allBlockerGroups);
assert.deepEqual(rowForSignal('blocked-status-closeout-preserved').blockerGroups, allBlockerGroups);
assert.deepEqual(rowForSignal('caller-owned-intake-blockers-separated').blockerGroups, ['caller-owned-intake']);
assert.deepEqual(rowForSignal('current-evidence-blockers-separated').blockerGroups, ['current-evidence']);
assert.deepEqual(rowForSignal('manual-interpretation-blockers-separated').blockerGroups, ['manual-interpretation']);
assert.deepEqual(rowForSignal('non-evidence-production-blockers-separated').blockerGroups, ['remaining-non-evidence-production']);
assert.equal(rowForSignal('positive-production-gate-remains-closed').positiveGateAllowed, false);
assert.equal(rowForSignal('production-authority-remains-absent').productionAuthority, false);
assert.equal(rowForSignal('production-wiring-remains-deferred').isProductionWiringPlan, false);
assert.equal(rowForSignal('runtime-action-order-remains-absent').isExecutionOrder, false);
assert.equal(rowForSignal('tool-decision-language-remains-absent').isExecutionOrder, false);

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

assertContains(
  auditText,
  'Caller-Owned Real-Exported Evidence Intake Review Readiness Post-Recheck Final Negative Readout Closeout Handoff Closeout Summary Checkpoint Status',
  'preflight audit',
);
assertContains(
  auditText,
  'final negative readout closeout handoff chain now has one current blocked closeout readout',
  'preflight audit',
);
assertContains(
  statusText,
  'V3 runtime boundary caller-owned real-exported evidence intake review readiness post-recheck final negative readout closeout handoff closeout summary checkpoint',
  'status',
);
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-rx-review-fnr-co-handoff-co-sum-ckpt-smoke.ts',
  'status',
);
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

const guardedSources = [
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
}

const serializedCheckpoint = JSON.stringify(callerOwnedFinalNegativeReadoutCloseoutHandoffCloseoutSummaryCheckpoint);
assert.doesNotMatch(
  serializedCheckpoint,
  /productionAuthority":true|productionReady":true|positiveGateAllowed":true/u,
  'Caller-owned final negative handoff closeout summary must not grant production readiness or authority.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /isProductionWiringPlan":true|isImplementationPlan":true|production-wiring-ready|ready-for-production-wiring/u,
  'Caller-owned final negative handoff closeout summary must not become an implementation plan or production wiring plan.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Caller-owned final negative handoff closeout summary should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Caller-owned final negative handoff closeout summary should not prescribe concrete desktop tools.',
);

assertContains(boundarySource, 'AgentSessionV2 remains the production orchestrator', 'runtime boundary');
assertContains(boundarySource, 'no required ordered tool workflow', 'runtime boundary');
assertContains(boundarySource, 'no evidence adapter gains runtime authority', 'runtime boundary');
assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Caller-owned final negative handoff closeout summary must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Caller-owned final negative handoff closeout summary must not add production calls to the boundary contract.',
);

console.log('agent session v3 runtime boundary caller-owned real-exported evidence intake review readiness post-recheck final negative readout closeout handoff closeout summary checkpoint smoke ok');
