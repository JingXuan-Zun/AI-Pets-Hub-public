import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { readProjectFile } from './smokeTestHarness.ts';

type Input =
  | 'final-closeout-summary'
  | 'guard-summary-wording-consistency'
  | 'production-gate-final-negative-readout'
  | 'evidence-interpretation-to-production-gate-mapping'
  | 'remaining-non-evidence-production-blocker-inventory'
  | 'runtime-boundary-contract'
  | 'status-page'
  | 'preflight-audit';

type Signal =
  | 'final-closeout-summary-guarded'
  | 'blocked-readout-preserved'
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

type BlockerGroup =
  | 'caller-owned-intake'
  | 'current-evidence'
  | 'manual-interpretation'
  | 'remaining-non-evidence-production';

interface Row {
  blockerGroups: readonly BlockerGroup[];
  inputs: readonly Input[];
  interpretationReadyNow: false;
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  manualInterpretationOnly: true;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  signal: Signal;
  status: 'guarded-final-closeout-summary-still-blocked';
}

interface Checkpoint {
  checkpoint: 'caller-owned-real-exported-intake-final-negative-handoff-guard-summary-wording-consistency-final-closeout-summary-guard';
  interpretationReadyNow: false;
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  manualInterpretationOnly: true;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly Row[];
  summaryDecision: 'caller-owned-final-negative-handoff-guard-summary-wording-consistency-final-closeout-summary-guard-positive-gate-closed';
}

const sharedInputs = [
  'final-closeout-summary',
  'guard-summary-wording-consistency',
  'production-gate-final-negative-readout',
  'evidence-interpretation-to-production-gate-mapping',
  'remaining-non-evidence-production-blocker-inventory',
  'preflight-audit',
  'status-page',
  'runtime-boundary-contract',
] as const satisfies readonly Input[];

const allBlockerGroups = [
  'caller-owned-intake',
  'current-evidence',
  'manual-interpretation',
  'remaining-non-evidence-production',
] as const satisfies readonly BlockerGroup[];

function row(signal: Signal, blockerGroups: readonly BlockerGroup[]) {
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
    status: 'guarded-final-closeout-summary-still-blocked',
  } as const satisfies Row;
}

const checkpoint = {
  checkpoint: 'caller-owned-real-exported-intake-final-negative-handoff-guard-summary-wording-consistency-final-closeout-summary-guard',
  interpretationReadyNow: false,
  isExecutionOrder: false,
  isImplementationPlan: false,
  isProductionWiringPlan: false,
  manualInterpretationOnly: true,
  positiveGateAllowed: false,
  productionAuthority: false,
  productionReady: false,
  rows: [
    row('final-closeout-summary-guarded', allBlockerGroups),
    row('blocked-readout-preserved', allBlockerGroups),
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
  summaryDecision: 'caller-owned-final-negative-handoff-guard-summary-wording-consistency-final-closeout-summary-guard-positive-gate-closed',
} as const satisfies Checkpoint;

function assertContains(text: string, expected: string, label: string) {
  assert.ok(text.includes(expected), `${label} should include: ${expected}`);
}

function rowForSignal(signal: Signal) {
  const found = checkpoint.rows.find((candidate) => candidate.signal === signal);
  assert.ok(found, `${signal} should exist in the final closeout summary guard checkpoint.`);
  return found;
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
const finalCloseoutSummarySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-rx-intake-fn-handoff-final-co-sum-smoke.ts',
);
const guardSummaryWordingConsistencySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-rx-intake-fn-handoff-co-guard-word-cons-guard-sum-word-cons-ckpt-smoke.ts',
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

assert.equal(checkpoint.interpretationReadyNow, false);
assert.equal(checkpoint.manualInterpretationOnly, true);
assert.equal(checkpoint.productionAuthority, false);
assert.equal(checkpoint.productionReady, false);
assert.equal(checkpoint.positiveGateAllowed, false);
assert.equal(checkpoint.isExecutionOrder, false);
assert.equal(checkpoint.isImplementationPlan, false);
assert.equal(checkpoint.isProductionWiringPlan, false);
assert.equal(
  checkpoint.summaryDecision,
  'caller-owned-final-negative-handoff-guard-summary-wording-consistency-final-closeout-summary-guard-positive-gate-closed',
);

assert.deepEqual(
  checkpoint.rows.map((row) => row.signal).sort(),
  [
    'blocked-readout-preserved',
    'caller-owned-intake-blockers-preserved',
    'current-evidence-blockers-preserved',
    'final-closeout-summary-guarded',
    'fixed-tool-chain-remains-absent',
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

for (const row of checkpoint.rows) {
  assert.equal(row.status, 'guarded-final-closeout-summary-still-blocked');
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

assert.deepEqual(rowForSignal('final-closeout-summary-guarded').blockerGroups, allBlockerGroups);
assert.deepEqual(rowForSignal('blocked-readout-preserved').blockerGroups, allBlockerGroups);
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
  finalCloseoutSummarySmokeSource,
  'caller-owned-final-negative-handoff-guard-summary-wording-consistency-final-closeout-summary-positive-gate-closed',
  'final closeout summary smoke',
);
assertContains(
  finalCloseoutSummarySmokeSource,
  'closed-out-final-negative-handoff-guard-summary-wording-consistency-final-readout-still-blocked',
  'final closeout summary smoke',
);
assertContains(
  guardSummaryWordingConsistencySmokeSource,
  'caller-owned-final-negative-handoff-guard-summary-wording-consistency-closeout-guard-wording-consistency-guard-summary-wording-consistency-positive-gate-closed',
  'guard summary wording consistency smoke',
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
  'Caller-Owned Real-Exported Evidence Intake Review Readiness Post-Recheck Final Negative Readout Closeout Handoff Closeout Guard Closeout Wording Closeout Guard Summary Wording Consistency Final Closeout Summary Guard Checkpoint Status',
  'preflight audit',
);
assertContains(
  auditText,
  'final closeout summary remains guarded, blocked, and non-production',
  'preflight audit',
);
assertContains(
  statusText,
  'V3 runtime boundary caller-owned real-exported evidence intake review readiness post-recheck final negative readout closeout handoff closeout guard closeout wording closeout guard summary wording consistency final closeout summary guard checkpoint',
  'status',
);
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-rx-intake-fn-handoff-final-co-sum-guard-smoke.ts',
  'status',
);
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

const guardedSources = [
  ['final closeout summary', finalCloseoutSummarySmokeSource],
  ['guard summary wording consistency', guardSummaryWordingConsistencySmokeSource],
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

const serializedCheckpoint = JSON.stringify(checkpoint);
assert.doesNotMatch(
  serializedCheckpoint,
  /productionAuthority":true|productionReady":true|positiveGateAllowed":true/u,
  'Final closeout summary guard must not grant production readiness.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /isProductionWiringPlan":true|isImplementationPlan":true|production-wiring-ready|ready-for-production-wiring/u,
  'Final closeout summary guard must not become an implementation plan.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Final closeout summary guard should not define controller actions.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Final closeout summary guard should not prescribe desktop tools.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain|requiredReportOrder|implementationQueue|orderedSteps/iu,
  'Final closeout summary guard should not define fixed workflows.',
);

assertContains(boundarySource, 'AgentSessionV2 remains the production orchestrator', 'runtime boundary');
assertContains(boundarySource, 'no required ordered tool workflow', 'runtime boundary');
assertContains(boundarySource, 'no evidence adapter gains runtime authority', 'runtime boundary');
assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Final closeout summary guard must not add controller contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Final closeout summary guard must not add production runtime calls.',
);

console.log('agent session v3 runtime boundary caller-owned real-exported intake final negative handoff guard summary wording consistency final closeout summary guard smoke ok');
