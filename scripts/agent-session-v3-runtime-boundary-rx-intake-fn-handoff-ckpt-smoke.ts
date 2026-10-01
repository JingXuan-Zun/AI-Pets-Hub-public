import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { readProjectFile } from './smokeTestHarness.ts';

type CallerOwnedFinalNegativeHandoffGuardSummaryWordingConsistencyInput =
  | 'final-negative-readout-closeout-handoff-closeout-guard-closeout-wording-closeout-guard-closeout-summary'
  | 'final-negative-readout-closeout-handoff-closeout-guard-closeout-wording-closeout-guard'
  | 'final-negative-readout-closeout-handoff-closeout-guard-closeout-wording-closeout-summary'
  | 'final-negative-readout-closeout-handoff-closeout-guard-closeout-wording-consistency'
  | 'final-negative-readout-closeout-handoff-closeout-guard-closeout-summary'
  | 'production-gate-final-negative-readout'
  | 'evidence-interpretation-to-production-gate-mapping'
  | 'remaining-non-evidence-production-blocker-inventory'
  | 'runtime-boundary-contract'
  | 'status-page'
  | 'preflight-audit';

type CallerOwnedFinalNegativeHandoffGuardSummaryWordingConsistencyCheck =
  | 'guard-summary-wording-consistent'
  | 'blocked-status-wording-preserved'
  | 'non-production-wording-preserved'
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

type CallerOwnedFinalNegativeHandoffGuardSummaryWordingConsistencyBlockerGroup =
  | 'caller-owned-intake'
  | 'current-evidence'
  | 'manual-interpretation'
  | 'remaining-non-evidence-production';

interface CallerOwnedFinalNegativeHandoffGuardSummaryWordingConsistencyRow {
  blockerGroups: readonly CallerOwnedFinalNegativeHandoffGuardSummaryWordingConsistencyBlockerGroup[];
  check: CallerOwnedFinalNegativeHandoffGuardSummaryWordingConsistencyCheck;
  inputs: readonly CallerOwnedFinalNegativeHandoffGuardSummaryWordingConsistencyInput[];
  interpretationReadyNow: false;
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  manualInterpretationOnly: true;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  wordingStatus: 'final-negative-handoff-guard-summary-wording-consistent-still-blocked';
}

interface CallerOwnedFinalNegativeHandoffGuardSummaryWordingConsistencyCheckpoint {
  checkpoint: 'caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-final-negative-readout-closeout-handoff-closeout-guard-closeout-wording-closeout-guard-summary-wording-consistency';
  interpretationReadyNow: false;
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  manualInterpretationOnly: true;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly CallerOwnedFinalNegativeHandoffGuardSummaryWordingConsistencyRow[];
  summaryDecision: 'caller-owned-final-negative-handoff-guard-summary-wording-consistent-positive-gate-closed';
}

const sharedInputs = [
  'final-negative-readout-closeout-handoff-closeout-guard-closeout-wording-closeout-guard-closeout-summary',
  'final-negative-readout-closeout-handoff-closeout-guard-closeout-wording-closeout-guard',
  'final-negative-readout-closeout-handoff-closeout-guard-closeout-wording-closeout-summary',
  'final-negative-readout-closeout-handoff-closeout-guard-closeout-wording-consistency',
  'final-negative-readout-closeout-handoff-closeout-guard-closeout-summary',
  'production-gate-final-negative-readout',
  'evidence-interpretation-to-production-gate-mapping',
  'remaining-non-evidence-production-blocker-inventory',
  'preflight-audit',
  'status-page',
  'runtime-boundary-contract',
] as const satisfies readonly CallerOwnedFinalNegativeHandoffGuardSummaryWordingConsistencyInput[];

const allBlockerGroups = [
  'caller-owned-intake',
  'current-evidence',
  'manual-interpretation',
  'remaining-non-evidence-production',
] as const satisfies readonly CallerOwnedFinalNegativeHandoffGuardSummaryWordingConsistencyBlockerGroup[];

function row(
  check: CallerOwnedFinalNegativeHandoffGuardSummaryWordingConsistencyCheck,
  blockerGroups: readonly CallerOwnedFinalNegativeHandoffGuardSummaryWordingConsistencyBlockerGroup[],
) {
  return {
    blockerGroups,
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
    wordingStatus: 'final-negative-handoff-guard-summary-wording-consistent-still-blocked',
  } as const satisfies CallerOwnedFinalNegativeHandoffGuardSummaryWordingConsistencyRow;
}

const callerOwnedFinalNegativeHandoffGuardSummaryWordingConsistencyCheckpoint = {
  checkpoint: 'caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-final-negative-readout-closeout-handoff-closeout-guard-closeout-wording-closeout-guard-summary-wording-consistency',
  interpretationReadyNow: false,
  isExecutionOrder: false,
  isImplementationPlan: false,
  isProductionWiringPlan: false,
  manualInterpretationOnly: true,
  positiveGateAllowed: false,
  productionAuthority: false,
  productionReady: false,
  rows: [
    row('guard-summary-wording-consistent', allBlockerGroups),
    row('blocked-status-wording-preserved', allBlockerGroups),
    row('non-production-wording-preserved', allBlockerGroups),
    row('caller-owned-intake-blockers-separated', ['caller-owned-intake']),
    row('current-evidence-blockers-separated', ['current-evidence']),
    row('manual-interpretation-blockers-separated', ['manual-interpretation']),
    row('non-evidence-production-blockers-separated', ['remaining-non-evidence-production']),
    row('positive-production-gate-still-closed', allBlockerGroups),
    row('production-authority-still-absent', ['remaining-non-evidence-production']),
    row('production-wiring-still-deferred', ['remaining-non-evidence-production']),
    row('runtime-action-order-still-absent', ['remaining-non-evidence-production']),
    row('tool-decision-still-absent', ['remaining-non-evidence-production']),
    row('fixed-tool-chain-still-absent', ['remaining-non-evidence-production']),
  ],
  summaryDecision: 'caller-owned-final-negative-handoff-guard-summary-wording-consistent-positive-gate-closed',
} as const satisfies CallerOwnedFinalNegativeHandoffGuardSummaryWordingConsistencyCheckpoint;

function assertContains(text: string, expected: string, label: string) {
  assert.ok(text.includes(expected), `${label} should include: ${expected}`);
}

function rowForCheck(check: CallerOwnedFinalNegativeHandoffGuardSummaryWordingConsistencyCheck) {
  const row = callerOwnedFinalNegativeHandoffGuardSummaryWordingConsistencyCheckpoint.rows
    .find((candidate) => candidate.check === check);

  assert.ok(row, `${check} should exist in the caller-owned final negative handoff guard summary wording consistency checkpoint.`);
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
const guardSummarySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-rx-review-fnr-co-handoff-co-guard-co-word-guard-sum-ckpt-smoke.ts',
);
const wordingCloseoutGuardSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-rx-review-fnr-co-handoff-co-guard-co-word-co-guard-ckpt-smoke.ts',
);
const wordingCloseoutSummarySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-rx-review-fnr-co-handoff-co-guard-co-word-co-sum-ckpt-smoke.ts',
);
const wordingConsistencySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-rx-review-fnr-co-handoff-co-guard-co-word-cons-ckpt-smoke.ts',
);
const guardCloseoutSummarySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-rx-review-fnr-co-handoff-co-guard-co-sum-ckpt-smoke.ts',
);
const productionGateFinalNegativeReadoutSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-rx-intake-review-post-rchk-prod-gate-final-neg-rdo-ckpt-smoke.ts',
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

assert.equal(callerOwnedFinalNegativeHandoffGuardSummaryWordingConsistencyCheckpoint.interpretationReadyNow, false);
assert.equal(callerOwnedFinalNegativeHandoffGuardSummaryWordingConsistencyCheckpoint.manualInterpretationOnly, true);
assert.equal(callerOwnedFinalNegativeHandoffGuardSummaryWordingConsistencyCheckpoint.productionAuthority, false);
assert.equal(callerOwnedFinalNegativeHandoffGuardSummaryWordingConsistencyCheckpoint.productionReady, false);
assert.equal(callerOwnedFinalNegativeHandoffGuardSummaryWordingConsistencyCheckpoint.positiveGateAllowed, false);
assert.equal(callerOwnedFinalNegativeHandoffGuardSummaryWordingConsistencyCheckpoint.isExecutionOrder, false);
assert.equal(callerOwnedFinalNegativeHandoffGuardSummaryWordingConsistencyCheckpoint.isImplementationPlan, false);
assert.equal(callerOwnedFinalNegativeHandoffGuardSummaryWordingConsistencyCheckpoint.isProductionWiringPlan, false);
assert.equal(
  callerOwnedFinalNegativeHandoffGuardSummaryWordingConsistencyCheckpoint.summaryDecision,
  'caller-owned-final-negative-handoff-guard-summary-wording-consistent-positive-gate-closed',
);

assert.deepEqual(
  callerOwnedFinalNegativeHandoffGuardSummaryWordingConsistencyCheckpoint.rows.map((row) => row.check).sort(),
  [
    'blocked-status-wording-preserved',
    'caller-owned-intake-blockers-separated',
    'current-evidence-blockers-separated',
    'fixed-tool-chain-still-absent',
    'guard-summary-wording-consistent',
    'manual-interpretation-blockers-separated',
    'non-evidence-production-blockers-separated',
    'non-production-wording-preserved',
    'positive-production-gate-still-closed',
    'production-authority-still-absent',
    'production-wiring-still-deferred',
    'runtime-action-order-still-absent',
    'tool-decision-still-absent',
  ],
);

for (const row of callerOwnedFinalNegativeHandoffGuardSummaryWordingConsistencyCheckpoint.rows) {
  assert.equal(row.wordingStatus, 'final-negative-handoff-guard-summary-wording-consistent-still-blocked');
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

assert.deepEqual(rowForCheck('guard-summary-wording-consistent').blockerGroups, allBlockerGroups);
assert.deepEqual(rowForCheck('blocked-status-wording-preserved').blockerGroups, allBlockerGroups);
assert.deepEqual(rowForCheck('non-production-wording-preserved').blockerGroups, allBlockerGroups);
assert.deepEqual(rowForCheck('caller-owned-intake-blockers-separated').blockerGroups, ['caller-owned-intake']);
assert.deepEqual(rowForCheck('current-evidence-blockers-separated').blockerGroups, ['current-evidence']);
assert.deepEqual(rowForCheck('manual-interpretation-blockers-separated').blockerGroups, ['manual-interpretation']);
assert.deepEqual(rowForCheck('non-evidence-production-blockers-separated').blockerGroups, ['remaining-non-evidence-production']);
assert.equal(rowForCheck('positive-production-gate-still-closed').positiveGateAllowed, false);
assert.equal(rowForCheck('production-authority-still-absent').productionAuthority, false);
assert.equal(rowForCheck('production-wiring-still-deferred').isProductionWiringPlan, false);
assert.equal(rowForCheck('runtime-action-order-still-absent').isExecutionOrder, false);
assert.equal(rowForCheck('tool-decision-still-absent').isExecutionOrder, false);
assert.equal(rowForCheck('fixed-tool-chain-still-absent').isExecutionOrder, false);

assertContains(
  guardSummarySmokeSource,
  'caller-owned-final-negative-handoff-guard-closeout-wording-guard-summary-positive-gate-closed',
  'guard summary smoke',
);
assertContains(
  guardSummarySmokeSource,
  'closed-out-final-negative-handoff-guard-closeout-wording-guard-still-blocked',
  'guard summary smoke',
);
assertContains(
  wordingCloseoutGuardSmokeSource,
  'caller-owned-final-negative-handoff-guard-closeout-wording-closeout-guard-positive-gate-closed',
  'wording closeout guard smoke',
);
assertContains(
  wordingCloseoutSummarySmokeSource,
  'closed-out-final-negative-handoff-guard-closeout-wording-still-blocked',
  'wording closeout summary smoke',
);
assertContains(
  wordingConsistencySmokeSource,
  'final-negative-handoff-guard-closeout-wording-consistent-still-blocked',
  'wording consistency smoke',
);
assertContains(
  guardCloseoutSummarySmokeSource,
  'closed-out-final-negative-handoff-guard-still-blocked',
  'guard closeout summary smoke',
);
assertContains(
  productionGateFinalNegativeReadoutSmokeSource,
  'final-negative-production-gate-readout-still-blocked',
  'production gate final negative readout smoke',
);
assertContains(evidenceMappingSmokeSource, 'mapping-only-positive-gate-remains-closed', 'evidence mapping smoke');
assertContains(nonEvidenceInventorySmokeSource, 'non-evidence-blockers-remain-positive-gate-closed', 'non-evidence inventory smoke');

assertContains(
  auditText,
  'Caller-Owned Real-Exported Evidence Intake Review Readiness Post-Recheck Final Negative Readout Closeout Handoff Closeout Guard Closeout Wording Closeout Guard Summary Wording Consistency Checkpoint Status',
  'preflight audit',
);
assertContains(
  auditText,
  'final negative handoff guard summary wording remains consistent, blocked, and non-production',
  'preflight audit',
);
assertContains(
  statusText,
  'V3 runtime boundary caller-owned real-exported evidence intake review readiness post-recheck final negative readout closeout handoff closeout guard closeout wording closeout guard summary wording consistency checkpoint',
  'status',
);
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-rx-intake-fn-handoff-ckpt-smoke.ts',
  'status',
);
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

const guardedSources = [
  ['guard summary', guardSummarySmokeSource],
  ['wording closeout guard', wordingCloseoutGuardSmokeSource],
  ['wording closeout summary', wordingCloseoutSummarySmokeSource],
  ['wording consistency', wordingConsistencySmokeSource],
  ['guard closeout summary', guardCloseoutSummarySmokeSource],
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

const serializedCheckpoint = JSON.stringify(callerOwnedFinalNegativeHandoffGuardSummaryWordingConsistencyCheckpoint);
assert.doesNotMatch(
  serializedCheckpoint,
  /productionAuthority":true|productionReady":true|positiveGateAllowed":true/u,
  'Caller-owned final negative handoff guard summary wording consistency must not grant production readiness or authority.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /isProductionWiringPlan":true|isImplementationPlan":true|production-wiring-ready|ready-for-production-wiring/u,
  'Caller-owned final negative handoff guard summary wording consistency must not become an implementation plan or production wiring plan.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Caller-owned final negative handoff guard summary wording consistency should not define controller actions.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Caller-owned final negative handoff guard summary wording consistency should not prescribe desktop tools.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain|requiredReportOrder|implementationQueue|orderedSteps/iu,
  'Caller-owned final negative handoff guard summary wording consistency should not define fixed workflows.',
);

assertContains(boundarySource, 'AgentSessionV2 remains the production orchestrator', 'runtime boundary');
assertContains(boundarySource, 'no required ordered tool workflow', 'runtime boundary');
assertContains(boundarySource, 'no evidence adapter gains runtime authority', 'runtime boundary');
assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Caller-owned final negative handoff guard summary wording consistency must not add controller contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Caller-owned final negative handoff guard summary wording consistency must not add production runtime calls.',
);

console.log('agent session v3 runtime boundary caller-owned real-exported intake final negative handoff guard summary wording consistency checkpoint smoke ok');
