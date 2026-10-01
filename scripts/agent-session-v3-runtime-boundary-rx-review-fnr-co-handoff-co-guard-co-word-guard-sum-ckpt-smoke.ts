import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { readProjectFile } from './smokeTestHarness.ts';

type CallerOwnedFinalNegativeHandoffGuardCloseoutWordingGuardSummaryInput =
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

type CallerOwnedFinalNegativeHandoffGuardCloseoutWordingGuardSummarySignal =
  | 'guard-summary-current-status'
  | 'guarded-blocked-readout-preserved'
  | 'non-production-readout-preserved'
  | 'caller-owned-intake-blockers-preserved'
  | 'current-evidence-blockers-preserved'
  | 'manual-interpretation-blockers-preserved'
  | 'non-evidence-production-blockers-preserved'
  | 'positive-production-gate-remains-closed'
  | 'production-authority-remains-absent'
  | 'production-wiring-remains-deferred'
  | 'runtime-action-order-remains-absent'
  | 'tool-decision-language-remains-absent'
  | 'fixed-tool-chain-remains-absent';

type CallerOwnedFinalNegativeHandoffGuardCloseoutWordingGuardSummaryBlockerGroup =
  | 'caller-owned-intake'
  | 'current-evidence'
  | 'manual-interpretation'
  | 'remaining-non-evidence-production';

interface CallerOwnedFinalNegativeHandoffGuardCloseoutWordingGuardSummaryRow {
  blockerGroups: readonly CallerOwnedFinalNegativeHandoffGuardCloseoutWordingGuardSummaryBlockerGroup[];
  inputs: readonly CallerOwnedFinalNegativeHandoffGuardCloseoutWordingGuardSummaryInput[];
  interpretationReadyNow: false;
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  manualInterpretationOnly: true;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  signal: CallerOwnedFinalNegativeHandoffGuardCloseoutWordingGuardSummarySignal;
  summaryStatus: 'closed-out-final-negative-handoff-guard-closeout-wording-guard-still-blocked';
}

interface CallerOwnedFinalNegativeHandoffGuardCloseoutWordingGuardSummaryCheckpoint {
  closeout: 'caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-final-negative-readout-closeout-handoff-closeout-guard-closeout-wording-closeout-guard-closeout-summary';
  interpretationReadyNow: false;
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  manualInterpretationOnly: true;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly CallerOwnedFinalNegativeHandoffGuardCloseoutWordingGuardSummaryRow[];
  summaryDecision: 'caller-owned-final-negative-handoff-guard-closeout-wording-guard-summary-positive-gate-closed';
}

const sharedInputs = [
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
] as const satisfies readonly CallerOwnedFinalNegativeHandoffGuardCloseoutWordingGuardSummaryInput[];

const allBlockerGroups = [
  'caller-owned-intake',
  'current-evidence',
  'manual-interpretation',
  'remaining-non-evidence-production',
] as const satisfies readonly CallerOwnedFinalNegativeHandoffGuardCloseoutWordingGuardSummaryBlockerGroup[];

function row(
  signal: CallerOwnedFinalNegativeHandoffGuardCloseoutWordingGuardSummarySignal,
  blockerGroups: readonly CallerOwnedFinalNegativeHandoffGuardCloseoutWordingGuardSummaryBlockerGroup[],
) {
  return {
    blockerGroups,
    inputs: sharedInputs,
    interpretationReadyNow: false,
    isExecutionOrder: false,
    isImplementationPlan: false,
    isProductionWiringPlan: false,
    manualInterpretationOnly: true,
    positiveGateAllowed: false,
    productionAuthority: false,
    productionReady: false,
    signal,
    summaryStatus: 'closed-out-final-negative-handoff-guard-closeout-wording-guard-still-blocked',
  } as const satisfies CallerOwnedFinalNegativeHandoffGuardCloseoutWordingGuardSummaryRow;
}

const callerOwnedFinalNegativeHandoffGuardCloseoutWordingGuardSummaryCheckpoint = {
  closeout: 'caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-final-negative-readout-closeout-handoff-closeout-guard-closeout-wording-closeout-guard-closeout-summary',
  interpretationReadyNow: false,
  isExecutionOrder: false,
  isImplementationPlan: false,
  isProductionWiringPlan: false,
  manualInterpretationOnly: true,
  positiveGateAllowed: false,
  productionAuthority: false,
  productionReady: false,
  rows: [
    row('guard-summary-current-status', allBlockerGroups),
    row('guarded-blocked-readout-preserved', allBlockerGroups),
    row('non-production-readout-preserved', allBlockerGroups),
    row('caller-owned-intake-blockers-preserved', ['caller-owned-intake']),
    row('current-evidence-blockers-preserved', ['current-evidence']),
    row('manual-interpretation-blockers-preserved', ['manual-interpretation']),
    row('non-evidence-production-blockers-preserved', ['remaining-non-evidence-production']),
    row('positive-production-gate-remains-closed', allBlockerGroups),
    row('production-authority-remains-absent', ['remaining-non-evidence-production']),
    row('production-wiring-remains-deferred', ['remaining-non-evidence-production']),
    row('runtime-action-order-remains-absent', ['remaining-non-evidence-production']),
    row('tool-decision-language-remains-absent', ['remaining-non-evidence-production']),
    row('fixed-tool-chain-remains-absent', ['remaining-non-evidence-production']),
  ],
  summaryDecision: 'caller-owned-final-negative-handoff-guard-closeout-wording-guard-summary-positive-gate-closed',
} as const satisfies CallerOwnedFinalNegativeHandoffGuardCloseoutWordingGuardSummaryCheckpoint;

function assertContains(text: string, expected: string, label: string) {
  assert.ok(text.includes(expected), `${label} should include: ${expected}`);
}

function rowForSignal(signal: CallerOwnedFinalNegativeHandoffGuardCloseoutWordingGuardSummarySignal) {
  const row = callerOwnedFinalNegativeHandoffGuardCloseoutWordingGuardSummaryCheckpoint.rows
    .find((candidate) => candidate.signal === signal);

  assert.ok(row, `${signal} should exist in the caller-owned final negative wording guard summary.`);
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

assert.equal(callerOwnedFinalNegativeHandoffGuardCloseoutWordingGuardSummaryCheckpoint.interpretationReadyNow, false);
assert.equal(callerOwnedFinalNegativeHandoffGuardCloseoutWordingGuardSummaryCheckpoint.manualInterpretationOnly, true);
assert.equal(callerOwnedFinalNegativeHandoffGuardCloseoutWordingGuardSummaryCheckpoint.productionAuthority, false);
assert.equal(callerOwnedFinalNegativeHandoffGuardCloseoutWordingGuardSummaryCheckpoint.productionReady, false);
assert.equal(callerOwnedFinalNegativeHandoffGuardCloseoutWordingGuardSummaryCheckpoint.positiveGateAllowed, false);
assert.equal(callerOwnedFinalNegativeHandoffGuardCloseoutWordingGuardSummaryCheckpoint.isExecutionOrder, false);
assert.equal(callerOwnedFinalNegativeHandoffGuardCloseoutWordingGuardSummaryCheckpoint.isImplementationPlan, false);
assert.equal(callerOwnedFinalNegativeHandoffGuardCloseoutWordingGuardSummaryCheckpoint.isProductionWiringPlan, false);
assert.equal(
  callerOwnedFinalNegativeHandoffGuardCloseoutWordingGuardSummaryCheckpoint.summaryDecision,
  'caller-owned-final-negative-handoff-guard-closeout-wording-guard-summary-positive-gate-closed',
);

assert.deepEqual(
  callerOwnedFinalNegativeHandoffGuardCloseoutWordingGuardSummaryCheckpoint.rows.map((row) => row.signal).sort(),
  [
    'caller-owned-intake-blockers-preserved',
    'current-evidence-blockers-preserved',
    'fixed-tool-chain-remains-absent',
    'guard-summary-current-status',
    'guarded-blocked-readout-preserved',
    'manual-interpretation-blockers-preserved',
    'non-evidence-production-blockers-preserved',
    'non-production-readout-preserved',
    'positive-production-gate-remains-closed',
    'production-authority-remains-absent',
    'production-wiring-remains-deferred',
    'runtime-action-order-remains-absent',
    'tool-decision-language-remains-absent',
  ],
);

for (const row of callerOwnedFinalNegativeHandoffGuardCloseoutWordingGuardSummaryCheckpoint.rows) {
  assert.equal(row.summaryStatus, 'closed-out-final-negative-handoff-guard-closeout-wording-guard-still-blocked');
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

assert.deepEqual(rowForSignal('guard-summary-current-status').blockerGroups, allBlockerGroups);
assert.deepEqual(rowForSignal('guarded-blocked-readout-preserved').blockerGroups, allBlockerGroups);
assert.deepEqual(rowForSignal('non-production-readout-preserved').blockerGroups, allBlockerGroups);
assert.deepEqual(rowForSignal('caller-owned-intake-blockers-preserved').blockerGroups, ['caller-owned-intake']);
assert.deepEqual(rowForSignal('current-evidence-blockers-preserved').blockerGroups, ['current-evidence']);
assert.deepEqual(rowForSignal('manual-interpretation-blockers-preserved').blockerGroups, ['manual-interpretation']);
assert.deepEqual(rowForSignal('non-evidence-production-blockers-preserved').blockerGroups, ['remaining-non-evidence-production']);
assert.equal(rowForSignal('positive-production-gate-remains-closed').positiveGateAllowed, false);
assert.equal(rowForSignal('production-authority-remains-absent').productionAuthority, false);
assert.equal(rowForSignal('production-wiring-remains-deferred').isProductionWiringPlan, false);
assert.equal(rowForSignal('runtime-action-order-remains-absent').isExecutionOrder, false);
assert.equal(rowForSignal('tool-decision-language-remains-absent').isExecutionOrder, false);
assert.equal(rowForSignal('fixed-tool-chain-remains-absent').isExecutionOrder, false);

assertContains(
  wordingCloseoutGuardSmokeSource,
  'caller-owned-final-negative-handoff-guard-closeout-wording-closeout-guard-positive-gate-closed',
  'wording closeout guard smoke',
);
assertContains(
  wordingCloseoutGuardSmokeSource,
  'guarded-final-negative-handoff-guard-closeout-wording-closeout-still-blocked',
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
  'Caller-Owned Real-Exported Evidence Intake Review Readiness Post-Recheck Final Negative Readout Closeout Handoff Closeout Guard Closeout Wording Closeout Guard Closeout Summary Checkpoint Status',
  'preflight audit',
);
assertContains(
  auditText,
  'final negative handoff guard closeout wording guard summary keeps one current blocked guard readout',
  'preflight audit',
);
assertContains(
  statusText,
  'V3 runtime boundary caller-owned real-exported evidence intake review readiness post-recheck final negative readout closeout handoff closeout guard closeout wording closeout guard closeout summary checkpoint',
  'status',
);
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-rx-review-fnr-co-handoff-co-guard-co-word-guard-sum-ckpt-smoke.ts',
  'status',
);
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

const guardedSources = [
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

const serializedCheckpoint = JSON.stringify(callerOwnedFinalNegativeHandoffGuardCloseoutWordingGuardSummaryCheckpoint);
assert.doesNotMatch(
  serializedCheckpoint,
  /productionAuthority":true|productionReady":true|positiveGateAllowed":true/u,
  'Caller-owned final negative handoff guard closeout wording guard summary must not grant production readiness.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /isProductionWiringPlan":true|isImplementationPlan":true|production-wiring-ready|ready-for-production-wiring/u,
  'Caller-owned final negative handoff guard closeout wording guard summary must not become an implementation plan.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Caller-owned final negative handoff guard closeout wording guard summary should not define controller actions.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Caller-owned final negative handoff guard closeout wording guard summary should not prescribe desktop tools.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain|requiredReportOrder|implementationQueue|orderedSteps/iu,
  'Caller-owned final negative handoff guard closeout wording guard summary should not define fixed workflows.',
);

assertContains(boundarySource, 'AgentSessionV2 remains the production orchestrator', 'runtime boundary');
assertContains(boundarySource, 'no required ordered tool workflow', 'runtime boundary');
assertContains(boundarySource, 'no evidence adapter gains runtime authority', 'runtime boundary');
assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Caller-owned final negative handoff guard closeout wording guard summary must not add controller contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Caller-owned final negative handoff guard closeout wording guard summary must not add production runtime calls.',
);

console.log('agent session v3 runtime boundary caller-owned real-exported evidence intake review readiness post-recheck final negative readout closeout handoff closeout guard closeout wording guard summary checkpoint smoke ok');
