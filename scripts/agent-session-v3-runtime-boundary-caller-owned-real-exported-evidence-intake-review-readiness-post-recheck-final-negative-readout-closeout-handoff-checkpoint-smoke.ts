import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { readProjectFile } from './smokeTestHarness.ts';

type CallerOwnedPostRecheckFinalNegativeReadoutCloseoutHandoffInput =
  | 'caller-owned-production-gate-final-negative-readout'
  | 'caller-owned-final-readout-closeout-summary'
  | 'caller-owned-final-readout-guard'
  | 'caller-owned-post-recheck-remaining-blocker-handoff'
  | 'evidence-interpretation-to-production-gate-mapping'
  | 'remaining-non-evidence-production-blocker-inventory'
  | 'runtime-boundary-contract'
  | 'status-page'
  | 'preflight-audit';

type CallerOwnedPostRecheckFinalNegativeReadoutCloseoutHandoffBlockerGroup =
  | 'caller-owned-intake'
  | 'current-evidence'
  | 'manual-interpretation'
  | 'remaining-non-evidence-production';

type CallerOwnedPostRecheckFinalNegativeReadoutCloseoutHandoffSignal =
  | 'final-negative-readout-handed-off-as-blocked'
  | 'caller-owned-intake-blockers-preserved'
  | 'current-evidence-blockers-preserved'
  | 'manual-interpretation-blockers-preserved'
  | 'non-evidence-production-blockers-preserved'
  | 'positive-production-gate-remains-closed'
  | 'production-authority-remains-absent'
  | 'production-wiring-remains-deferred'
  | 'runtime-action-order-remains-absent'
  | 'tool-decision-language-remains-absent';

interface CallerOwnedPostRecheckFinalNegativeReadoutCloseoutHandoffRow {
  blockerGroups: readonly CallerOwnedPostRecheckFinalNegativeReadoutCloseoutHandoffBlockerGroup[];
  handoffStatus: 'final-negative-readout-closeout-handoff-still-blocked';
  inputs: readonly CallerOwnedPostRecheckFinalNegativeReadoutCloseoutHandoffInput[];
  interpretationReadyNow: false;
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  manualInterpretationOnly: true;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  signal: CallerOwnedPostRecheckFinalNegativeReadoutCloseoutHandoffSignal;
}

interface CallerOwnedPostRecheckFinalNegativeReadoutCloseoutHandoffCheckpoint {
  handoff: 'caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-final-negative-readout-closeout-handoff';
  interpretationReadyNow: false;
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  manualInterpretationOnly: true;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly CallerOwnedPostRecheckFinalNegativeReadoutCloseoutHandoffRow[];
  summaryDecision: 'caller-owned-final-negative-readout-closeout-handoff-positive-gate-closed';
}

const sharedInputs = [
  'caller-owned-production-gate-final-negative-readout',
  'caller-owned-final-readout-closeout-summary',
  'caller-owned-final-readout-guard',
  'caller-owned-post-recheck-remaining-blocker-handoff',
  'evidence-interpretation-to-production-gate-mapping',
  'remaining-non-evidence-production-blocker-inventory',
  'preflight-audit',
  'status-page',
  'runtime-boundary-contract',
] as const satisfies readonly CallerOwnedPostRecheckFinalNegativeReadoutCloseoutHandoffInput[];

const allBlockerGroups = [
  'caller-owned-intake',
  'current-evidence',
  'manual-interpretation',
  'remaining-non-evidence-production',
] as const satisfies readonly CallerOwnedPostRecheckFinalNegativeReadoutCloseoutHandoffBlockerGroup[];

const callerOwnedPostRecheckFinalNegativeReadoutCloseoutHandoffCheckpoint = {
  handoff: 'caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-final-negative-readout-closeout-handoff',
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
      handoffStatus: 'final-negative-readout-closeout-handoff-still-blocked',
      inputs: sharedInputs,
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'final-negative-readout-handed-off-as-blocked',
    },
    {
      blockerGroups: ['caller-owned-intake'],
      handoffStatus: 'final-negative-readout-closeout-handoff-still-blocked',
      inputs: sharedInputs,
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'caller-owned-intake-blockers-preserved',
    },
    {
      blockerGroups: ['current-evidence'],
      handoffStatus: 'final-negative-readout-closeout-handoff-still-blocked',
      inputs: sharedInputs,
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'current-evidence-blockers-preserved',
    },
    {
      blockerGroups: ['manual-interpretation'],
      handoffStatus: 'final-negative-readout-closeout-handoff-still-blocked',
      inputs: sharedInputs,
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'manual-interpretation-blockers-preserved',
    },
    {
      blockerGroups: ['remaining-non-evidence-production'],
      handoffStatus: 'final-negative-readout-closeout-handoff-still-blocked',
      inputs: sharedInputs,
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'non-evidence-production-blockers-preserved',
    },
    {
      blockerGroups: allBlockerGroups,
      handoffStatus: 'final-negative-readout-closeout-handoff-still-blocked',
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
    },
    {
      blockerGroups: ['remaining-non-evidence-production'],
      handoffStatus: 'final-negative-readout-closeout-handoff-still-blocked',
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
    },
    {
      blockerGroups: ['remaining-non-evidence-production'],
      handoffStatus: 'final-negative-readout-closeout-handoff-still-blocked',
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
    },
    {
      blockerGroups: ['remaining-non-evidence-production'],
      handoffStatus: 'final-negative-readout-closeout-handoff-still-blocked',
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
    },
    {
      blockerGroups: ['remaining-non-evidence-production'],
      handoffStatus: 'final-negative-readout-closeout-handoff-still-blocked',
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
    },
  ],
  summaryDecision: 'caller-owned-final-negative-readout-closeout-handoff-positive-gate-closed',
} as const satisfies CallerOwnedPostRecheckFinalNegativeReadoutCloseoutHandoffCheckpoint;

function assertContains(text: string, expected: string, label: string) {
  assert.ok(text.includes(expected), `${label} should include: ${expected}`);
}

function rowForSignal(signal: CallerOwnedPostRecheckFinalNegativeReadoutCloseoutHandoffSignal) {
  const row = callerOwnedPostRecheckFinalNegativeReadoutCloseoutHandoffCheckpoint.rows
    .find((candidate) => candidate.signal === signal);

  assert.ok(row, `${signal} should exist in the caller-owned final negative readout closeout handoff.`);
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
const productionGateFinalNegativeReadoutSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-production-gate-final-negative-readout-checkpoint-smoke.ts',
);
const finalReadoutCloseoutSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-final-readout-closeout-summary-checkpoint-smoke.ts',
);
const finalReadoutGuardSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-final-readout-guard-checkpoint-smoke.ts',
);
const callerOwnedBlockerHandoffSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-remaining-blocker-handoff-checkpoint-smoke.ts',
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

assert.equal(callerOwnedPostRecheckFinalNegativeReadoutCloseoutHandoffCheckpoint.interpretationReadyNow, false);
assert.equal(callerOwnedPostRecheckFinalNegativeReadoutCloseoutHandoffCheckpoint.manualInterpretationOnly, true);
assert.equal(callerOwnedPostRecheckFinalNegativeReadoutCloseoutHandoffCheckpoint.productionAuthority, false);
assert.equal(callerOwnedPostRecheckFinalNegativeReadoutCloseoutHandoffCheckpoint.productionReady, false);
assert.equal(callerOwnedPostRecheckFinalNegativeReadoutCloseoutHandoffCheckpoint.positiveGateAllowed, false);
assert.equal(callerOwnedPostRecheckFinalNegativeReadoutCloseoutHandoffCheckpoint.isExecutionOrder, false);
assert.equal(callerOwnedPostRecheckFinalNegativeReadoutCloseoutHandoffCheckpoint.isImplementationPlan, false);
assert.equal(callerOwnedPostRecheckFinalNegativeReadoutCloseoutHandoffCheckpoint.isProductionWiringPlan, false);
assert.equal(
  callerOwnedPostRecheckFinalNegativeReadoutCloseoutHandoffCheckpoint.summaryDecision,
  'caller-owned-final-negative-readout-closeout-handoff-positive-gate-closed',
);

assert.deepEqual(
  callerOwnedPostRecheckFinalNegativeReadoutCloseoutHandoffCheckpoint.rows.map((row) => row.signal).sort(),
  [
    'caller-owned-intake-blockers-preserved',
    'current-evidence-blockers-preserved',
    'final-negative-readout-handed-off-as-blocked',
    'manual-interpretation-blockers-preserved',
    'non-evidence-production-blockers-preserved',
    'positive-production-gate-remains-closed',
    'production-authority-remains-absent',
    'production-wiring-remains-deferred',
    'runtime-action-order-remains-absent',
    'tool-decision-language-remains-absent',
  ],
);

for (const row of callerOwnedPostRecheckFinalNegativeReadoutCloseoutHandoffCheckpoint.rows) {
  assert.equal(row.handoffStatus, 'final-negative-readout-closeout-handoff-still-blocked');
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

assert.deepEqual(rowForSignal('final-negative-readout-handed-off-as-blocked').blockerGroups, allBlockerGroups);
assert.deepEqual(rowForSignal('caller-owned-intake-blockers-preserved').blockerGroups, ['caller-owned-intake']);
assert.deepEqual(rowForSignal('current-evidence-blockers-preserved').blockerGroups, ['current-evidence']);
assert.deepEqual(rowForSignal('manual-interpretation-blockers-preserved').blockerGroups, ['manual-interpretation']);
assert.deepEqual(rowForSignal('non-evidence-production-blockers-preserved').blockerGroups, ['remaining-non-evidence-production']);
assert.equal(rowForSignal('positive-production-gate-remains-closed').positiveGateAllowed, false);
assert.equal(rowForSignal('production-authority-remains-absent').productionAuthority, false);
assert.equal(rowForSignal('production-wiring-remains-deferred').isProductionWiringPlan, false);
assert.equal(rowForSignal('runtime-action-order-remains-absent').isExecutionOrder, false);
assert.equal(rowForSignal('tool-decision-language-remains-absent').isExecutionOrder, false);

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
assertContains(finalReadoutCloseoutSmokeSource, 'caller-owned-final-readout-closeout-positive-gate-closed', 'final readout closeout smoke');
assertContains(finalReadoutGuardSmokeSource, 'caller-owned-final-readout-guarded-positive-gate-closed', 'final readout guard smoke');
assertContains(callerOwnedBlockerHandoffSmokeSource, 'caller-owned-remaining-blockers-handed-off-positive-gate-closed', 'caller-owned blocker handoff smoke');
assertContains(evidenceMappingSmokeSource, 'mapping-only-positive-gate-remains-closed', 'evidence mapping smoke');
assertContains(nonEvidenceInventorySmokeSource, 'non-evidence-blockers-remain-positive-gate-closed', 'non-evidence inventory smoke');

assertContains(
  auditText,
  'Caller-Owned Real-Exported Evidence Intake Review Readiness Post-Recheck Final Negative Readout Closeout Handoff Checkpoint Status',
  'preflight audit',
);
assertContains(
  auditText,
  'final negative readout closeout handoff remains stable, blocked, and non-production',
  'preflight audit',
);
assertContains(
  statusText,
  'V3 runtime boundary caller-owned real-exported evidence intake review readiness post-recheck final negative readout closeout handoff checkpoint',
  'status',
);
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-final-negative-readout-closeout-handoff-checkpoint-smoke.ts',
  'status',
);
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

const guardedSources = [
  ['production gate final negative readout', productionGateFinalNegativeReadoutSmokeSource],
  ['final readout closeout', finalReadoutCloseoutSmokeSource],
  ['final readout guard', finalReadoutGuardSmokeSource],
  ['caller-owned blocker handoff', callerOwnedBlockerHandoffSmokeSource],
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

const serializedCheckpoint = JSON.stringify(callerOwnedPostRecheckFinalNegativeReadoutCloseoutHandoffCheckpoint);
assert.doesNotMatch(
  serializedCheckpoint,
  /productionAuthority":true|productionReady":true|positiveGateAllowed":true/u,
  'Caller-owned final negative readout closeout handoff must not grant production readiness or authority.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /isProductionWiringPlan":true|isImplementationPlan":true|production-wiring-ready|ready-for-production-wiring/u,
  'Caller-owned final negative readout closeout handoff must not become an implementation plan or production wiring plan.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Caller-owned final negative readout closeout handoff should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Caller-owned final negative readout closeout handoff should not prescribe concrete desktop tools.',
);

assertContains(boundarySource, 'AgentSessionV2 remains the production orchestrator', 'runtime boundary');
assertContains(boundarySource, 'no required ordered tool workflow', 'runtime boundary');
assertContains(boundarySource, 'no evidence adapter gains runtime authority', 'runtime boundary');
assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Caller-owned final negative readout closeout handoff must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Caller-owned final negative readout closeout handoff must not add production calls to the boundary contract.',
);

console.log('agent session v3 runtime boundary caller-owned real-exported evidence intake review readiness post-recheck final negative readout closeout handoff checkpoint smoke ok');
