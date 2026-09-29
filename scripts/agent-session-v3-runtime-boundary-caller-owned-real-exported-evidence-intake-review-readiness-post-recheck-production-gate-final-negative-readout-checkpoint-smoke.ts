import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { readProjectFile } from './smokeTestHarness.ts';

type CallerOwnedPostRecheckProductionGateFinalNegativeReadoutInput =
  | 'caller-owned-final-readout-closeout-summary'
  | 'caller-owned-final-readout-guard'
  | 'caller-owned-blocker-wording-closeout-summary'
  | 'caller-owned-post-closeout-production-gate-recheck'
  | 'caller-owned-post-recheck-remaining-blocker-handoff'
  | 'evidence-interpretation-to-production-gate-mapping'
  | 'remaining-non-evidence-production-blocker-inventory'
  | 'runtime-boundary-contract'
  | 'status-page'
  | 'preflight-audit';

type CallerOwnedPostRecheckProductionGateFinalNegativeReadoutBlockerGroup =
  | 'caller-owned-intake'
  | 'current-evidence'
  | 'manual-interpretation'
  | 'remaining-non-evidence-production';

type CallerOwnedPostRecheckProductionGateFinalNegativeReadoutSignal =
  | 'closed-final-readout-maps-to-negative-production-gate'
  | 'caller-owned-intake-blockers-still-open'
  | 'current-evidence-blockers-still-open'
  | 'manual-interpretation-blockers-still-open'
  | 'non-evidence-production-blockers-still-open'
  | 'positive-production-gate-still-closed'
  | 'production-authority-still-absent'
  | 'production-wiring-still-deferred'
  | 'runtime-action-order-still-absent'
  | 'tool-decision-language-still-absent';

interface CallerOwnedPostRecheckProductionGateFinalNegativeReadoutRow {
  blockerGroups: readonly CallerOwnedPostRecheckProductionGateFinalNegativeReadoutBlockerGroup[];
  inputs: readonly CallerOwnedPostRecheckProductionGateFinalNegativeReadoutInput[];
  interpretationReadyNow: false;
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  manualInterpretationOnly: true;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  signal: CallerOwnedPostRecheckProductionGateFinalNegativeReadoutSignal;
  summaryStatus: 'final-negative-production-gate-readout-still-blocked';
}

interface CallerOwnedPostRecheckProductionGateFinalNegativeReadoutCheckpoint {
  gate: 'caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-production-gate-final-negative-readout';
  interpretationReadyNow: false;
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  manualInterpretationOnly: true;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly CallerOwnedPostRecheckProductionGateFinalNegativeReadoutRow[];
  summaryDecision: 'caller-owned-production-gate-final-negative-readout-positive-gate-closed';
}

const sharedInputs = [
  'caller-owned-final-readout-closeout-summary',
  'caller-owned-final-readout-guard',
  'caller-owned-blocker-wording-closeout-summary',
  'caller-owned-post-recheck-remaining-blocker-handoff',
  'caller-owned-post-closeout-production-gate-recheck',
  'evidence-interpretation-to-production-gate-mapping',
  'remaining-non-evidence-production-blocker-inventory',
  'preflight-audit',
  'status-page',
  'runtime-boundary-contract',
] as const satisfies readonly CallerOwnedPostRecheckProductionGateFinalNegativeReadoutInput[];

const allBlockerGroups = [
  'caller-owned-intake',
  'current-evidence',
  'manual-interpretation',
  'remaining-non-evidence-production',
] as const satisfies readonly CallerOwnedPostRecheckProductionGateFinalNegativeReadoutBlockerGroup[];

const callerOwnedPostRecheckProductionGateFinalNegativeReadoutCheckpoint = {
  gate: 'caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-production-gate-final-negative-readout',
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
      signal: 'closed-final-readout-maps-to-negative-production-gate',
      summaryStatus: 'final-negative-production-gate-readout-still-blocked',
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
      signal: 'caller-owned-intake-blockers-still-open',
      summaryStatus: 'final-negative-production-gate-readout-still-blocked',
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
      signal: 'current-evidence-blockers-still-open',
      summaryStatus: 'final-negative-production-gate-readout-still-blocked',
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
      signal: 'manual-interpretation-blockers-still-open',
      summaryStatus: 'final-negative-production-gate-readout-still-blocked',
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
      signal: 'non-evidence-production-blockers-still-open',
      summaryStatus: 'final-negative-production-gate-readout-still-blocked',
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
      signal: 'positive-production-gate-still-closed',
      summaryStatus: 'final-negative-production-gate-readout-still-blocked',
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
      signal: 'production-authority-still-absent',
      summaryStatus: 'final-negative-production-gate-readout-still-blocked',
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
      signal: 'production-wiring-still-deferred',
      summaryStatus: 'final-negative-production-gate-readout-still-blocked',
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
      signal: 'runtime-action-order-still-absent',
      summaryStatus: 'final-negative-production-gate-readout-still-blocked',
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
      signal: 'tool-decision-language-still-absent',
      summaryStatus: 'final-negative-production-gate-readout-still-blocked',
    },
  ],
  summaryDecision: 'caller-owned-production-gate-final-negative-readout-positive-gate-closed',
} as const satisfies CallerOwnedPostRecheckProductionGateFinalNegativeReadoutCheckpoint;

function assertContains(text: string, expected: string, label: string) {
  assert.ok(text.includes(expected), `${label} should include: ${expected}`);
}

function rowForSignal(signal: CallerOwnedPostRecheckProductionGateFinalNegativeReadoutSignal) {
  const row = callerOwnedPostRecheckProductionGateFinalNegativeReadoutCheckpoint.rows
    .find((candidate) => candidate.signal === signal);

  assert.ok(row, `${signal} should exist in the caller-owned production gate final negative readout.`);
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
const finalReadoutCloseoutSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-final-readout-closeout-summary-checkpoint-smoke.ts',
);
const finalReadoutGuardSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-final-readout-guard-checkpoint-smoke.ts',
);
const blockerWordingCloseoutSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-blocker-wording-closeout-summary-checkpoint-smoke.ts',
);
const callerOwnedBlockerHandoffSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-remaining-blocker-handoff-checkpoint-smoke.ts',
);
const callerOwnedGateRecheckSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-caller-owned-real-exported-evidence-intake-review-readiness-post-closeout-production-gate-recheck-checkpoint-smoke.ts',
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

assert.equal(callerOwnedPostRecheckProductionGateFinalNegativeReadoutCheckpoint.interpretationReadyNow, false);
assert.equal(callerOwnedPostRecheckProductionGateFinalNegativeReadoutCheckpoint.manualInterpretationOnly, true);
assert.equal(callerOwnedPostRecheckProductionGateFinalNegativeReadoutCheckpoint.productionAuthority, false);
assert.equal(callerOwnedPostRecheckProductionGateFinalNegativeReadoutCheckpoint.productionReady, false);
assert.equal(callerOwnedPostRecheckProductionGateFinalNegativeReadoutCheckpoint.positiveGateAllowed, false);
assert.equal(callerOwnedPostRecheckProductionGateFinalNegativeReadoutCheckpoint.isExecutionOrder, false);
assert.equal(callerOwnedPostRecheckProductionGateFinalNegativeReadoutCheckpoint.isImplementationPlan, false);
assert.equal(callerOwnedPostRecheckProductionGateFinalNegativeReadoutCheckpoint.isProductionWiringPlan, false);
assert.equal(
  callerOwnedPostRecheckProductionGateFinalNegativeReadoutCheckpoint.summaryDecision,
  'caller-owned-production-gate-final-negative-readout-positive-gate-closed',
);

assert.deepEqual(
  callerOwnedPostRecheckProductionGateFinalNegativeReadoutCheckpoint.rows.map((row) => row.signal).sort(),
  [
    'caller-owned-intake-blockers-still-open',
    'closed-final-readout-maps-to-negative-production-gate',
    'current-evidence-blockers-still-open',
    'manual-interpretation-blockers-still-open',
    'non-evidence-production-blockers-still-open',
    'positive-production-gate-still-closed',
    'production-authority-still-absent',
    'production-wiring-still-deferred',
    'runtime-action-order-still-absent',
    'tool-decision-language-still-absent',
  ],
);

for (const row of callerOwnedPostRecheckProductionGateFinalNegativeReadoutCheckpoint.rows) {
  assert.equal(row.summaryStatus, 'final-negative-production-gate-readout-still-blocked');
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

assert.deepEqual(rowForSignal('closed-final-readout-maps-to-negative-production-gate').blockerGroups, allBlockerGroups);
assert.deepEqual(rowForSignal('caller-owned-intake-blockers-still-open').blockerGroups, ['caller-owned-intake']);
assert.deepEqual(rowForSignal('current-evidence-blockers-still-open').blockerGroups, ['current-evidence']);
assert.deepEqual(rowForSignal('manual-interpretation-blockers-still-open').blockerGroups, ['manual-interpretation']);
assert.deepEqual(rowForSignal('non-evidence-production-blockers-still-open').blockerGroups, ['remaining-non-evidence-production']);
assert.equal(rowForSignal('positive-production-gate-still-closed').positiveGateAllowed, false);
assert.equal(rowForSignal('production-authority-still-absent').productionAuthority, false);
assert.equal(rowForSignal('production-wiring-still-deferred').isProductionWiringPlan, false);
assert.equal(rowForSignal('runtime-action-order-still-absent').isExecutionOrder, false);
assert.equal(rowForSignal('tool-decision-language-still-absent').isExecutionOrder, false);

assertContains(
  finalReadoutCloseoutSmokeSource,
  'caller-owned-final-readout-closeout-positive-gate-closed',
  'final readout closeout smoke',
);
assertContains(finalReadoutCloseoutSmokeSource, 'closed-out-final-readout-still-blocked', 'final readout closeout smoke');
assertContains(finalReadoutGuardSmokeSource, 'caller-owned-final-readout-guarded-positive-gate-closed', 'final readout guard smoke');
assertContains(blockerWordingCloseoutSmokeSource, 'caller-owned-blocker-wording-closeout-positive-gate-closed', 'blocker wording closeout smoke');
assertContains(callerOwnedBlockerHandoffSmokeSource, 'caller-owned-remaining-blockers-handed-off-positive-gate-closed', 'caller-owned blocker handoff smoke');
assertContains(callerOwnedGateRecheckSmokeSource, 'caller-owned-post-closeout-positive-gate-remains-closed-evidence-still-missing', 'caller-owned gate recheck smoke');
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
  assertContains(blockerWordingCloseoutSmokeSource, blocker, 'blocker wording closeout smoke');
}

assertContains(
  auditText,
  'Caller-Owned Real-Exported Evidence Intake Review Readiness Post-Recheck Production Gate Final Negative Readout Checkpoint Status',
  'preflight audit',
);
assertContains(
  auditText,
  'production gate final negative readout remains closed, separated, and non-production',
  'preflight audit',
);
assertContains(
  statusText,
  'V3 runtime boundary caller-owned real-exported evidence intake review readiness post-recheck production gate final negative readout checkpoint',
  'status',
);
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-production-gate-final-negative-readout-checkpoint-smoke.ts',
  'status',
);
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

const guardedSources = [
  ['final readout closeout', finalReadoutCloseoutSmokeSource],
  ['final readout guard', finalReadoutGuardSmokeSource],
  ['blocker wording closeout', blockerWordingCloseoutSmokeSource],
  ['caller-owned blocker handoff', callerOwnedBlockerHandoffSmokeSource],
  ['caller-owned gate recheck', callerOwnedGateRecheckSmokeSource],
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

const serializedCheckpoint = JSON.stringify(callerOwnedPostRecheckProductionGateFinalNegativeReadoutCheckpoint);
assert.doesNotMatch(
  serializedCheckpoint,
  /productionAuthority":true|productionReady":true|positiveGateAllowed":true/u,
  'Caller-owned production gate final negative readout must not grant production readiness or authority.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /isProductionWiringPlan":true|isImplementationPlan":true|production-wiring-ready|ready-for-production-wiring/u,
  'Caller-owned production gate final negative readout must not become an implementation plan or production wiring plan.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Caller-owned production gate final negative readout should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Caller-owned production gate final negative readout should not prescribe concrete desktop tools.',
);

assertContains(boundarySource, 'AgentSessionV2 remains the production orchestrator', 'runtime boundary');
assertContains(boundarySource, 'no required ordered tool workflow', 'runtime boundary');
assertContains(boundarySource, 'no evidence adapter gains runtime authority', 'runtime boundary');
assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Caller-owned production gate final negative readout must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Caller-owned production gate final negative readout must not add production calls to the boundary contract.',
);

console.log('agent session v3 runtime boundary caller-owned real-exported evidence intake review readiness post-recheck production gate final negative readout checkpoint smoke ok');
