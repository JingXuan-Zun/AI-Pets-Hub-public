import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { readProjectFile } from './smokeTestHarness.ts';

type CallerOwnedPostRecheckBlockerWordingCloseoutInput =
  | 'caller-owned-post-closeout-production-gate-recheck'
  | 'caller-owned-post-recheck-blocker-wording-consistency'
  | 'caller-owned-post-recheck-remaining-blocker-handoff'
  | 'evidence-interpretation-to-production-gate-mapping'
  | 'generic-post-recheck-remaining-blocker-handoff'
  | 'preflight-audit'
  | 'remaining-non-evidence-production-blocker-inventory'
  | 'runtime-boundary-contract'
  | 'status-page';

type CallerOwnedPostRecheckBlockerWordingCloseoutSignal =
  | 'closeout-summary-current-readout'
  | 'caller-owned-intake-blockers-remain'
  | 'current-evidence-blockers-remain'
  | 'manual-interpretation-remains-blocked'
  | 'non-evidence-blockers-remain-separated'
  | 'positive-gate-remains-closed'
  | 'closeout-remains-non-production';

type CallerOwnedPostRecheckBlockerWordingCloseoutBlocker =
  | 'agent-session-v2-production-owner-retained'
  | 'controller-policy-contracts-missing'
  | 'manual-interpretation-not-ready'
  | 'missing-real-or-production-like-traces'
  | 'no-explicit-real-exported-intake'
  | 'non-evidence-blockers-remain'
  | 'package-health-missing-real-evidence'
  | 'p0-real-exported-corpus-missing'
  | 'production-adapter-contracts-missing'
  | 'production-gate-closed'
  | 'runtime-action-order-not-owned-by-v3';

type CallerOwnedPostRecheckBlockerWordingCloseoutGuard =
  | 'closeout-summary-only'
  | 'explicit-dir-only'
  | 'manual-review-only'
  | 'no-sample-collection'
  | 'no-auto-fill'
  | 'no-directory-discovery'
  | 'no-required-report-order'
  | 'no-runtime-action-order'
  | 'no-production-readiness'
  | 'no-runtime-authority';

interface CallerOwnedPostRecheckBlockerWordingCloseoutRow {
  blockersNow: readonly CallerOwnedPostRecheckBlockerWordingCloseoutBlocker[];
  closeoutStatus: 'closed-out-wording-consistent-still-blocked';
  guards: readonly CallerOwnedPostRecheckBlockerWordingCloseoutGuard[];
  inputs: readonly CallerOwnedPostRecheckBlockerWordingCloseoutInput[];
  interpretationReadyNow: false;
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  manualInterpretationOnly: true;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  signal: CallerOwnedPostRecheckBlockerWordingCloseoutSignal;
}

interface CallerOwnedPostRecheckBlockerWordingCloseoutSummaryCheckpoint {
  gate: 'caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-blocker-wording-closeout-summary';
  interpretationReadyNow: false;
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  manualInterpretationOnly: true;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly CallerOwnedPostRecheckBlockerWordingCloseoutRow[];
  summaryDecision: 'caller-owned-blocker-wording-closeout-positive-gate-closed';
}

const sharedInputs = [
  'caller-owned-post-recheck-blocker-wording-consistency',
  'caller-owned-post-recheck-remaining-blocker-handoff',
  'caller-owned-post-closeout-production-gate-recheck',
  'generic-post-recheck-remaining-blocker-handoff',
  'evidence-interpretation-to-production-gate-mapping',
  'remaining-non-evidence-production-blocker-inventory',
  'preflight-audit',
  'status-page',
  'runtime-boundary-contract',
] as const satisfies readonly CallerOwnedPostRecheckBlockerWordingCloseoutInput[];

const callerOwnedPostRecheckBlockerWordingCloseoutSummaryCheckpoint = {
  gate: 'caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-blocker-wording-closeout-summary',
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
      blockersNow: [
        'no-explicit-real-exported-intake',
        'p0-real-exported-corpus-missing',
        'manual-interpretation-not-ready',
      ],
      closeoutStatus: 'closed-out-wording-consistent-still-blocked',
      guards: [
        'closeout-summary-only',
        'explicit-dir-only',
        'manual-review-only',
      ],
      inputs: sharedInputs,
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'closeout-summary-current-readout',
    },
    {
      blockersNow: [
        'no-explicit-real-exported-intake',
        'p0-real-exported-corpus-missing',
      ],
      closeoutStatus: 'closed-out-wording-consistent-still-blocked',
      guards: [
        'closeout-summary-only',
        'explicit-dir-only',
        'no-sample-collection',
        'no-auto-fill',
        'no-directory-discovery',
      ],
      inputs: sharedInputs,
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'caller-owned-intake-blockers-remain',
    },
    {
      blockersNow: [
        'missing-real-or-production-like-traces',
        'package-health-missing-real-evidence',
      ],
      closeoutStatus: 'closed-out-wording-consistent-still-blocked',
      guards: [
        'closeout-summary-only',
        'manual-review-only',
        'no-required-report-order',
      ],
      inputs: sharedInputs,
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'current-evidence-blockers-remain',
    },
    {
      blockersNow: [
        'manual-interpretation-not-ready',
        'production-gate-closed',
      ],
      closeoutStatus: 'closed-out-wording-consistent-still-blocked',
      guards: [
        'closeout-summary-only',
        'manual-review-only',
        'no-production-readiness',
      ],
      inputs: sharedInputs,
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'manual-interpretation-remains-blocked',
    },
    {
      blockersNow: [
        'agent-session-v2-production-owner-retained',
        'production-adapter-contracts-missing',
        'controller-policy-contracts-missing',
        'runtime-action-order-not-owned-by-v3',
      ],
      closeoutStatus: 'closed-out-wording-consistent-still-blocked',
      guards: [
        'closeout-summary-only',
        'no-runtime-action-order',
        'no-runtime-authority',
      ],
      inputs: sharedInputs,
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'non-evidence-blockers-remain-separated',
    },
    {
      blockersNow: [
        'production-gate-closed',
        'non-evidence-blockers-remain',
      ],
      closeoutStatus: 'closed-out-wording-consistent-still-blocked',
      guards: [
        'closeout-summary-only',
        'no-production-readiness',
        'no-runtime-authority',
      ],
      inputs: sharedInputs,
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'positive-gate-remains-closed',
    },
    {
      blockersNow: [
        'production-gate-closed',
        'runtime-action-order-not-owned-by-v3',
      ],
      closeoutStatus: 'closed-out-wording-consistent-still-blocked',
      guards: [
        'closeout-summary-only',
        'no-required-report-order',
        'no-runtime-action-order',
        'no-production-readiness',
        'no-runtime-authority',
      ],
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
    },
  ],
  summaryDecision: 'caller-owned-blocker-wording-closeout-positive-gate-closed',
} as const satisfies CallerOwnedPostRecheckBlockerWordingCloseoutSummaryCheckpoint;

function assertContains(text: string, expected: string, label: string) {
  assert.ok(text.includes(expected), `${label} should include: ${expected}`);
}

function rowForSignal(signal: CallerOwnedPostRecheckBlockerWordingCloseoutSignal) {
  const row = callerOwnedPostRecheckBlockerWordingCloseoutSummaryCheckpoint.rows
    .find((candidate) => candidate.signal === signal);

  assert.ok(row, `${signal} should exist in the caller-owned blocker wording closeout summary.`);
  return row;
}

function rowsForGuard(guard: CallerOwnedPostRecheckBlockerWordingCloseoutGuard) {
  return callerOwnedPostRecheckBlockerWordingCloseoutSummaryCheckpoint.rows
    .filter((row) => row.guards.includes(guard));
}

function rowsForBlocker(blocker: CallerOwnedPostRecheckBlockerWordingCloseoutBlocker) {
  return callerOwnedPostRecheckBlockerWordingCloseoutSummaryCheckpoint.rows
    .filter((row) => row.blockersNow.includes(blocker));
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
const wordingConsistencySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-rx-intake-review-post-rchk-blocker-word-cons-ckpt-smoke.ts',
);
const callerOwnedBlockerHandoffSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-rx-intake-review-post-rchk-remaining-blocker-handoff-ckpt-smoke.ts',
);
const callerOwnedGateRecheckSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-rx-intake-review-post-co-prod-gate-rchk-ckpt-smoke.ts',
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

assert.equal(callerOwnedPostRecheckBlockerWordingCloseoutSummaryCheckpoint.interpretationReadyNow, false);
assert.equal(callerOwnedPostRecheckBlockerWordingCloseoutSummaryCheckpoint.manualInterpretationOnly, true);
assert.equal(callerOwnedPostRecheckBlockerWordingCloseoutSummaryCheckpoint.productionAuthority, false);
assert.equal(callerOwnedPostRecheckBlockerWordingCloseoutSummaryCheckpoint.productionReady, false);
assert.equal(callerOwnedPostRecheckBlockerWordingCloseoutSummaryCheckpoint.positiveGateAllowed, false);
assert.equal(callerOwnedPostRecheckBlockerWordingCloseoutSummaryCheckpoint.isExecutionOrder, false);
assert.equal(callerOwnedPostRecheckBlockerWordingCloseoutSummaryCheckpoint.isImplementationPlan, false);
assert.equal(callerOwnedPostRecheckBlockerWordingCloseoutSummaryCheckpoint.isProductionWiringPlan, false);
assert.equal(
  callerOwnedPostRecheckBlockerWordingCloseoutSummaryCheckpoint.summaryDecision,
  'caller-owned-blocker-wording-closeout-positive-gate-closed',
);

assert.deepEqual(
  callerOwnedPostRecheckBlockerWordingCloseoutSummaryCheckpoint.rows.map((row) => row.signal).sort(),
  [
    'caller-owned-intake-blockers-remain',
    'closeout-remains-non-production',
    'closeout-summary-current-readout',
    'current-evidence-blockers-remain',
    'manual-interpretation-remains-blocked',
    'non-evidence-blockers-remain-separated',
    'positive-gate-remains-closed',
  ],
);

for (const row of callerOwnedPostRecheckBlockerWordingCloseoutSummaryCheckpoint.rows) {
  assert.equal(row.closeoutStatus, 'closed-out-wording-consistent-still-blocked');
  assert.equal(row.interpretationReadyNow, false);
  assert.equal(row.manualInterpretationOnly, true);
  assert.equal(row.isExecutionOrder, false);
  assert.equal(row.isImplementationPlan, false);
  assert.equal(row.isProductionWiringPlan, false);
  assert.equal(row.productionAuthority, false);
  assert.equal(row.productionReady, false);
  assert.equal(row.positiveGateAllowed, false);
  assert.deepEqual(row.inputs, sharedInputs);
  assert.ok(row.blockersNow.length > 0);
  assert.ok(row.guards.length > 0);
}

assert.equal(
  rowsForGuard('closeout-summary-only').length,
  callerOwnedPostRecheckBlockerWordingCloseoutSummaryCheckpoint.rows.length,
);
assert.ok(rowsForGuard('explicit-dir-only').length >= 2);
assert.ok(rowsForGuard('manual-review-only').length >= 3);
assert.ok(rowsForGuard('no-sample-collection').length >= 1);
assert.ok(rowsForGuard('no-auto-fill').length >= 1);
assert.ok(rowsForGuard('no-directory-discovery').length >= 1);
assert.ok(rowsForGuard('no-required-report-order').length >= 2);
assert.ok(rowsForGuard('no-runtime-action-order').length >= 2);
assert.ok(rowsForGuard('no-production-readiness').length >= 3);
assert.ok(rowsForGuard('no-runtime-authority').length >= 3);

assert.ok(rowsForBlocker('no-explicit-real-exported-intake').length >= 2);
assert.ok(rowsForBlocker('p0-real-exported-corpus-missing').length >= 2);
assert.ok(rowsForBlocker('missing-real-or-production-like-traces').length >= 1);
assert.ok(rowsForBlocker('package-health-missing-real-evidence').length >= 1);
assert.ok(rowsForBlocker('manual-interpretation-not-ready').length >= 2);
assert.ok(rowsForBlocker('production-gate-closed').length >= 3);
assert.ok(rowsForBlocker('non-evidence-blockers-remain').length >= 1);
assert.ok(rowsForBlocker('agent-session-v2-production-owner-retained').length === 1);
assert.ok(rowsForBlocker('production-adapter-contracts-missing').length === 1);
assert.ok(rowsForBlocker('controller-policy-contracts-missing').length === 1);
assert.ok(rowsForBlocker('runtime-action-order-not-owned-by-v3').length >= 2);

assert.ok(rowForSignal('caller-owned-intake-blockers-remain').blockersNow.includes('p0-real-exported-corpus-missing'));
assert.ok(rowForSignal('current-evidence-blockers-remain').blockersNow.includes('missing-real-or-production-like-traces'));
assert.ok(rowForSignal('manual-interpretation-remains-blocked').blockersNow.includes('manual-interpretation-not-ready'));
assert.ok(rowForSignal('non-evidence-blockers-remain-separated').blockersNow.includes('agent-session-v2-production-owner-retained'));
assert.ok(rowForSignal('positive-gate-remains-closed').blockersNow.includes('production-gate-closed'));
assert.ok(rowForSignal('closeout-remains-non-production').guards.includes('no-runtime-action-order'));

assertContains(wordingConsistencySmokeSource, 'caller-owned-blocker-wording-consistent-positive-gate-closed', 'blocker wording consistency smoke');
assertContains(wordingConsistencySmokeSource, 'wording-consistent-still-blocked', 'blocker wording consistency smoke');
assertContains(callerOwnedBlockerHandoffSmokeSource, 'caller-owned-remaining-blockers-handed-off-positive-gate-closed', 'caller-owned blocker handoff smoke');
assertContains(callerOwnedGateRecheckSmokeSource, 'caller-owned-post-closeout-positive-gate-remains-closed-evidence-still-missing', 'caller-owned gate recheck smoke');
assertContains(genericBlockerHandoffSmokeSource, 'remaining-blockers-handed-off-positive-gate-closed', 'generic blocker handoff smoke');
assertContains(evidenceMappingSmokeSource, 'mapping-only-positive-gate-remains-closed', 'evidence mapping smoke');
assertContains(nonEvidenceInventorySmokeSource, 'non-evidence-blockers-remain-positive-gate-closed', 'non-evidence inventory smoke');

for (const blocker of [
  'no-explicit-real-exported-intake',
  'p0-real-exported-corpus-missing',
  'manual-interpretation-not-ready',
  'production-gate-closed',
] as const) {
  assertContains(wordingConsistencySmokeSource, blocker, 'blocker wording consistency smoke');
  assertContains(callerOwnedBlockerHandoffSmokeSource, blocker, 'caller-owned blocker handoff smoke');
  assertContains(callerOwnedGateRecheckSmokeSource, blocker, 'caller-owned gate recheck smoke');
}

assertContains(wordingConsistencySmokeSource, 'missing-real-or-production-like-traces', 'blocker wording consistency smoke');
assertContains(callerOwnedBlockerHandoffSmokeSource, 'missing-real-or-production-like-traces', 'caller-owned blocker handoff smoke');
assertContains(genericBlockerHandoffSmokeSource, 'missing-real-or-production-like-traces', 'generic blocker handoff smoke');
assertContains(evidenceMappingSmokeSource, 'missing-real-or-production-like-traces', 'evidence mapping smoke');
assertContains(nonEvidenceInventorySmokeSource, "flattenedBlockers.includes('missing-real-or-production-like-traces'), false", 'non-evidence inventory smoke');

for (const blocker of [
  'agent-session-v2-production-owner-retained',
  'production-adapter-contracts-missing',
  'controller-policy-contracts-missing',
  'runtime-action-order-not-owned-by-v3',
] as const) {
  assertContains(wordingConsistencySmokeSource, blocker, 'blocker wording consistency smoke');
  assertContains(callerOwnedBlockerHandoffSmokeSource, blocker, 'caller-owned blocker handoff smoke');
  assertContains(callerOwnedGateRecheckSmokeSource, blocker, 'caller-owned gate recheck smoke');
  assertContains(genericBlockerHandoffSmokeSource, blocker, 'generic blocker handoff smoke');
  assertContains(nonEvidenceInventorySmokeSource, blocker, 'non-evidence inventory smoke');
  assertContains(evidenceMappingSmokeSource, blocker, 'evidence mapping smoke');
}

assertContains(auditText, 'Caller-Owned Real-Exported Evidence Intake Review Readiness Post-Recheck Blocker Wording Closeout Summary Checkpoint Status', 'preflight audit');
assertContains(auditText, 'blocker wording closeout remains consistent, separated, and still blocked', 'preflight audit');
assertContains(statusText, 'V3 runtime boundary caller-owned real-exported evidence intake review readiness post-recheck blocker wording closeout summary checkpoint', 'status');
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-rx-intake-review-post-rchk-blocker-word-co-sum-ckpt-smoke.ts',
  'status',
);
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

const serializedCheckpoint = JSON.stringify(callerOwnedPostRecheckBlockerWordingCloseoutSummaryCheckpoint);
assert.doesNotMatch(
  serializedCheckpoint,
  /productionAuthority":true|productionReady":true|positiveGateAllowed":true/u,
  'Caller-owned blocker wording closeout summary must not grant production readiness or authority.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /isProductionWiringPlan":true|ready-for-production-wiring|production-wiring-ready|productionGateCleared":true/u,
  'Caller-owned blocker wording closeout summary must not become a production wiring plan or clear the gate.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Caller-owned blocker wording closeout summary should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Caller-owned blocker wording closeout summary should not prescribe concrete desktop tools.',
);

for (const [label, source] of [
  ['blocker wording consistency', wordingConsistencySmokeSource],
  ['caller-owned blocker handoff', callerOwnedBlockerHandoffSmokeSource],
  ['caller-owned gate recheck', callerOwnedGateRecheckSmokeSource],
  ['generic blocker handoff', genericBlockerHandoffSmokeSource],
  ['evidence mapping', evidenceMappingSmokeSource],
  ['non-evidence inventory', nonEvidenceInventorySmokeSource],
] as const) {
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
}

assertContains(boundarySource, 'AgentSessionV2 remains the production orchestrator', 'runtime boundary');
assertContains(boundarySource, 'no required ordered tool workflow', 'runtime boundary');
assertContains(boundarySource, 'no evidence adapter gains runtime authority', 'runtime boundary');
assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Caller-owned blocker wording closeout summary must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Caller-owned blocker wording closeout summary must not add production calls to the boundary contract.',
);

console.log('agent session v3 runtime boundary caller-owned real-exported evidence intake review readiness post-recheck blocker wording closeout summary checkpoint smoke ok');
