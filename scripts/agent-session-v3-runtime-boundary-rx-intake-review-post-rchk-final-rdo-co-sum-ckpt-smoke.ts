import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { readProjectFile } from './smokeTestHarness.ts';

type CallerOwnedPostRecheckFinalReadoutCloseoutInput =
  | 'caller-owned-final-readout-guard'
  | 'caller-owned-blocker-wording-closeout-summary'
  | 'caller-owned-post-closeout-production-gate-recheck'
  | 'caller-owned-post-recheck-remaining-blocker-handoff'
  | 'evidence-interpretation-to-production-gate-mapping'
  | 'remaining-non-evidence-production-blocker-inventory'
  | 'runtime-boundary-contract'
  | 'status-page'
  | 'preflight-audit';

type CallerOwnedPostRecheckFinalReadoutCloseoutSignal =
  | 'final-readout-guard-closed-current-status'
  | 'positive-readiness-language-still-absent'
  | 'production-authority-still-absent'
  | 'production-gate-still-closed'
  | 'blocker-groups-still-separated'
  | 'manual-interpretation-still-not-ready'
  | 'runtime-action-order-still-absent'
  | 'tool-decision-language-still-absent'
  | 'closeout-remains-non-production';

interface CallerOwnedPostRecheckFinalReadoutCloseoutRow {
  inputs: readonly CallerOwnedPostRecheckFinalReadoutCloseoutInput[];
  interpretationReadyNow: false;
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  manualInterpretationOnly: true;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  signal: CallerOwnedPostRecheckFinalReadoutCloseoutSignal;
  summaryStatus: 'closed-out-final-readout-still-blocked';
}

interface CallerOwnedPostRecheckFinalReadoutCloseoutSummaryCheckpoint {
  gate: 'caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-final-readout-closeout-summary';
  interpretationReadyNow: false;
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  manualInterpretationOnly: true;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly CallerOwnedPostRecheckFinalReadoutCloseoutRow[];
  summaryDecision: 'caller-owned-final-readout-closeout-positive-gate-closed';
}

const sharedInputs = [
  'caller-owned-final-readout-guard',
  'caller-owned-blocker-wording-closeout-summary',
  'caller-owned-post-recheck-remaining-blocker-handoff',
  'caller-owned-post-closeout-production-gate-recheck',
  'evidence-interpretation-to-production-gate-mapping',
  'remaining-non-evidence-production-blocker-inventory',
  'preflight-audit',
  'status-page',
  'runtime-boundary-contract',
] as const satisfies readonly CallerOwnedPostRecheckFinalReadoutCloseoutInput[];

const callerOwnedPostRecheckFinalReadoutCloseoutSummaryCheckpoint = {
  gate: 'caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-final-readout-closeout-summary',
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
      inputs: sharedInputs,
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'final-readout-guard-closed-current-status',
      summaryStatus: 'closed-out-final-readout-still-blocked',
    },
    {
      inputs: sharedInputs,
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'positive-readiness-language-still-absent',
      summaryStatus: 'closed-out-final-readout-still-blocked',
    },
    {
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
      summaryStatus: 'closed-out-final-readout-still-blocked',
    },
    {
      inputs: sharedInputs,
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'production-gate-still-closed',
      summaryStatus: 'closed-out-final-readout-still-blocked',
    },
    {
      inputs: sharedInputs,
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'blocker-groups-still-separated',
      summaryStatus: 'closed-out-final-readout-still-blocked',
    },
    {
      inputs: sharedInputs,
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'manual-interpretation-still-not-ready',
      summaryStatus: 'closed-out-final-readout-still-blocked',
    },
    {
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
      summaryStatus: 'closed-out-final-readout-still-blocked',
    },
    {
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
      summaryStatus: 'closed-out-final-readout-still-blocked',
    },
    {
      inputs: sharedInputs,
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'closeout-remains-non-production',
      summaryStatus: 'closed-out-final-readout-still-blocked',
    },
  ],
  summaryDecision: 'caller-owned-final-readout-closeout-positive-gate-closed',
} as const satisfies CallerOwnedPostRecheckFinalReadoutCloseoutSummaryCheckpoint;

function assertContains(text: string, expected: string, label: string) {
  assert.ok(text.includes(expected), `${label} should include: ${expected}`);
}

function rowForSignal(signal: CallerOwnedPostRecheckFinalReadoutCloseoutSignal) {
  const row = callerOwnedPostRecheckFinalReadoutCloseoutSummaryCheckpoint.rows
    .find((candidate) => candidate.signal === signal);

  assert.ok(row, `${signal} should exist in the caller-owned final readout closeout summary.`);
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
const finalReadoutGuardSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-rx-intake-review-post-rchk-final-rdo-guard-ckpt-smoke.ts',
);
const blockerWordingCloseoutSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-rx-intake-review-post-rchk-blocker-word-co-sum-ckpt-smoke.ts',
);
const callerOwnedBlockerHandoffSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-rx-intake-review-post-rchk-remaining-blocker-handoff-ckpt-smoke.ts',
);
const callerOwnedGateRecheckSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-rx-intake-review-post-co-prod-gate-rchk-ckpt-smoke.ts',
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

assert.equal(callerOwnedPostRecheckFinalReadoutCloseoutSummaryCheckpoint.interpretationReadyNow, false);
assert.equal(callerOwnedPostRecheckFinalReadoutCloseoutSummaryCheckpoint.manualInterpretationOnly, true);
assert.equal(callerOwnedPostRecheckFinalReadoutCloseoutSummaryCheckpoint.productionAuthority, false);
assert.equal(callerOwnedPostRecheckFinalReadoutCloseoutSummaryCheckpoint.productionReady, false);
assert.equal(callerOwnedPostRecheckFinalReadoutCloseoutSummaryCheckpoint.positiveGateAllowed, false);
assert.equal(callerOwnedPostRecheckFinalReadoutCloseoutSummaryCheckpoint.isExecutionOrder, false);
assert.equal(callerOwnedPostRecheckFinalReadoutCloseoutSummaryCheckpoint.isImplementationPlan, false);
assert.equal(callerOwnedPostRecheckFinalReadoutCloseoutSummaryCheckpoint.isProductionWiringPlan, false);
assert.equal(
  callerOwnedPostRecheckFinalReadoutCloseoutSummaryCheckpoint.summaryDecision,
  'caller-owned-final-readout-closeout-positive-gate-closed',
);

assert.deepEqual(
  callerOwnedPostRecheckFinalReadoutCloseoutSummaryCheckpoint.rows.map((row) => row.signal).sort(),
  [
    'blocker-groups-still-separated',
    'closeout-remains-non-production',
    'final-readout-guard-closed-current-status',
    'manual-interpretation-still-not-ready',
    'positive-readiness-language-still-absent',
    'production-authority-still-absent',
    'production-gate-still-closed',
    'runtime-action-order-still-absent',
    'tool-decision-language-still-absent',
  ],
);

for (const row of callerOwnedPostRecheckFinalReadoutCloseoutSummaryCheckpoint.rows) {
  assert.equal(row.summaryStatus, 'closed-out-final-readout-still-blocked');
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

assert.equal(rowForSignal('final-readout-guard-closed-current-status').isImplementationPlan, false);
assert.equal(rowForSignal('positive-readiness-language-still-absent').productionReady, false);
assert.equal(rowForSignal('production-authority-still-absent').productionAuthority, false);
assert.equal(rowForSignal('production-gate-still-closed').positiveGateAllowed, false);
assert.equal(rowForSignal('blocker-groups-still-separated').isProductionWiringPlan, false);
assert.equal(rowForSignal('manual-interpretation-still-not-ready').interpretationReadyNow, false);
assert.equal(rowForSignal('runtime-action-order-still-absent').isExecutionOrder, false);
assert.equal(rowForSignal('tool-decision-language-still-absent').isExecutionOrder, false);
assert.equal(rowForSignal('closeout-remains-non-production').productionReady, false);

assertContains(finalReadoutGuardSmokeSource, 'caller-owned-final-readout-guarded-positive-gate-closed', 'final readout guard smoke');
assertContains(finalReadoutGuardSmokeSource, 'final-readout-guarded-still-blocked', 'final readout guard smoke');
assertContains(blockerWordingCloseoutSmokeSource, 'caller-owned-blocker-wording-closeout-positive-gate-closed', 'blocker wording closeout smoke');
assertContains(blockerWordingCloseoutSmokeSource, 'closed-out-wording-consistent-still-blocked', 'blocker wording closeout smoke');
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

assertContains(auditText, 'Caller-Owned Real-Exported Evidence Intake Review Readiness Post-Recheck Final Readout Closeout Summary Checkpoint Status', 'preflight audit');
assertContains(auditText, 'final readout closeout remains guarded, negative, and non-production', 'preflight audit');
assertContains(statusText, 'V3 runtime boundary caller-owned real-exported evidence intake review readiness post-recheck final readout closeout summary checkpoint', 'status');
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-rx-intake-review-post-rchk-final-rdo-co-sum-ckpt-smoke.ts',
  'status',
);
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

const guardedSources = [
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

const serializedCheckpoint = JSON.stringify(callerOwnedPostRecheckFinalReadoutCloseoutSummaryCheckpoint);
assert.doesNotMatch(
  serializedCheckpoint,
  /productionAuthority":true|productionReady":true|positiveGateAllowed":true/u,
  'Caller-owned final readout closeout summary must not grant production readiness or authority.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /isProductionWiringPlan":true|isImplementationPlan":true|production-wiring-ready|ready-for-production-wiring/u,
  'Caller-owned final readout closeout summary must not become an implementation plan or production wiring plan.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Caller-owned final readout closeout summary should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Caller-owned final readout closeout summary should not prescribe concrete desktop tools.',
);

assertContains(boundarySource, 'AgentSessionV2 remains the production orchestrator', 'runtime boundary');
assertContains(boundarySource, 'no required ordered tool workflow', 'runtime boundary');
assertContains(boundarySource, 'no evidence adapter gains runtime authority', 'runtime boundary');
assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Caller-owned final readout closeout summary must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Caller-owned final readout closeout summary must not add production calls to the boundary contract.',
);

console.log('agent session v3 runtime boundary caller-owned real-exported evidence intake review readiness post-recheck final readout closeout summary checkpoint smoke ok');
