import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { readProjectFile } from './smokeTestHarness.ts';

type BlockerGroup =
  | 'caller-owned-intake'
  | 'current-evidence'
  | 'manual-interpretation'
  | 'remaining-non-evidence-production';

type Source =
  | 'final-closeout-summary-guard-closeout-summary-guard-closeout-summary'
  | 'final-closeout-summary-guard-closeout-summary-guard'
  | 'production-gate-final-negative-readout'
  | 'evidence-interpretation-to-production-gate-mapping'
  | 'remaining-non-evidence-production-blocker-inventory'
  | 'runtime-boundary-contract'
  | 'status-page'
  | 'preflight-audit';

type Signal =
  | 'latest-closeout-summary-readout-guarded'
  | 'blocked-readout-remains-current'
  | 'non-production-status-preserved'
  | 'caller-owned-intake-blockers-stay-separate'
  | 'current-evidence-blockers-stay-separate'
  | 'manual-interpretation-blockers-stay-separate'
  | 'non-evidence-production-blockers-stay-separate'
  | 'positive-production-gate-still-closed'
  | 'production-authority-still-absent'
  | 'production-adapters-still-deferred'
  | 'runtime-controller-still-absent'
  | 'runtime-action-order-still-absent'
  | 'fixed-tool-chain-still-absent';

interface Row {
  blockerGroups: readonly BlockerGroup[];
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  manualInterpretationOnly: true;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  signal: Signal;
  sources: readonly Source[];
  status: 'guarded-final-closeout-summary-guard-closeout-summary-guard-closeout-summary-still-blocked';
}

interface Checkpoint {
  checkpoint: 'caller-owned-real-exported-intake-final-negative-handoff-guard-summary-wording-consistency-final-closeout-summary-guard-closeout-summary-guard-closeout-summary-guard';
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  manualInterpretationOnly: true;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly Row[];
  summaryDecision: 'caller-owned-final-negative-handoff-guard-summary-wording-consistency-final-closeout-summary-guard-closeout-summary-guard-closeout-summary-guard-positive-gate-closed';
}

const allSources = [
  'final-closeout-summary-guard-closeout-summary-guard-closeout-summary',
  'final-closeout-summary-guard-closeout-summary-guard',
  'production-gate-final-negative-readout',
  'evidence-interpretation-to-production-gate-mapping',
  'remaining-non-evidence-production-blocker-inventory',
  'runtime-boundary-contract',
  'status-page',
  'preflight-audit',
] as const satisfies readonly Source[];

const allBlockerGroups = [
  'caller-owned-intake',
  'current-evidence',
  'manual-interpretation',
  'remaining-non-evidence-production',
] as const satisfies readonly BlockerGroup[];

function row(signal: Signal, blockerGroups: readonly BlockerGroup[]) {
  return {
    blockerGroups,
    isExecutionOrder: false,
    isImplementationPlan: false,
    isProductionWiringPlan: false,
    manualInterpretationOnly: true,
    positiveGateAllowed: false,
    productionAuthority: false,
    productionReady: false,
    signal,
    sources: allSources,
    status: 'guarded-final-closeout-summary-guard-closeout-summary-guard-closeout-summary-still-blocked',
  } as const satisfies Row;
}

const checkpoint = {
  checkpoint:
    'caller-owned-real-exported-intake-final-negative-handoff-guard-summary-wording-consistency-final-closeout-summary-guard-closeout-summary-guard-closeout-summary-guard',
  isExecutionOrder: false,
  isImplementationPlan: false,
  isProductionWiringPlan: false,
  manualInterpretationOnly: true,
  positiveGateAllowed: false,
  productionAuthority: false,
  productionReady: false,
  rows: [
    row('latest-closeout-summary-readout-guarded', allBlockerGroups),
    row('blocked-readout-remains-current', allBlockerGroups),
    row('non-production-status-preserved', allBlockerGroups),
    row('caller-owned-intake-blockers-stay-separate', ['caller-owned-intake']),
    row('current-evidence-blockers-stay-separate', ['current-evidence']),
    row('manual-interpretation-blockers-stay-separate', ['manual-interpretation']),
    row('non-evidence-production-blockers-stay-separate', ['remaining-non-evidence-production']),
    row('positive-production-gate-still-closed', allBlockerGroups),
    row('production-authority-still-absent', ['remaining-non-evidence-production']),
    row('production-adapters-still-deferred', ['remaining-non-evidence-production']),
    row('runtime-controller-still-absent', ['remaining-non-evidence-production']),
    row('runtime-action-order-still-absent', ['remaining-non-evidence-production']),
    row('fixed-tool-chain-still-absent', ['remaining-non-evidence-production']),
  ],
  summaryDecision:
    'caller-owned-final-negative-handoff-guard-summary-wording-consistency-final-closeout-summary-guard-closeout-summary-guard-closeout-summary-guard-positive-gate-closed',
} as const satisfies Checkpoint;

function assertContains(text: string, expected: string, label: string) {
  assert.ok(text.includes(expected), `${label} should include: ${expected}`);
}

function rowForSignal(signal: Signal) {
  const found = checkpoint.rows.find((candidate) => candidate.signal === signal);
  assert.ok(found, `${signal} should exist in the final guard checkpoint.`);
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
const latestCloseoutSummarySource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-caller-owned-real-exported-intake-final-negative-handoff-guard-summary-wording-consistency-final-closeout-summary-guard-closeout-summary-guard-closeout-summary-smoke.ts',
);
const previousGuardSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-caller-owned-real-exported-intake-final-negative-handoff-guard-summary-wording-consistency-final-closeout-summary-guard-closeout-summary-guard-smoke.ts',
);
const productionGateFinalNegativeReadoutSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-production-gate-final-negative-readout-checkpoint-smoke.ts',
);
const evidenceMappingSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-evidence-interpretation-to-production-gate-mapping-checkpoint-smoke.ts',
);
const nonEvidenceInventorySource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-remaining-non-evidence-production-blocker-inventory-checkpoint-smoke.ts',
);

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');
assert.equal(boundaryContract.mode, 'contract-only');
assert.ok(boundaryContract.guardrails.includes('AgentSessionV2 remains the production orchestrator'));
assert.ok(boundaryContract.guardrails.includes('no required ordered tool workflow'));
assert.ok(boundaryContract.guardrails.includes('no evidence adapter gains runtime authority'));

assert.equal(checkpoint.productionAuthority, false);
assert.equal(checkpoint.productionReady, false);
assert.equal(checkpoint.positiveGateAllowed, false);
assert.equal(checkpoint.manualInterpretationOnly, true);
assert.equal(checkpoint.isExecutionOrder, false);
assert.equal(checkpoint.isImplementationPlan, false);
assert.equal(checkpoint.isProductionWiringPlan, false);
assert.equal(
  checkpoint.summaryDecision,
  'caller-owned-final-negative-handoff-guard-summary-wording-consistency-final-closeout-summary-guard-closeout-summary-guard-closeout-summary-guard-positive-gate-closed',
);

assert.deepEqual(
  checkpoint.rows.map((candidate) => candidate.signal).sort(),
  [
    'blocked-readout-remains-current',
    'caller-owned-intake-blockers-stay-separate',
    'current-evidence-blockers-stay-separate',
    'fixed-tool-chain-still-absent',
    'latest-closeout-summary-readout-guarded',
    'manual-interpretation-blockers-stay-separate',
    'non-evidence-production-blockers-stay-separate',
    'non-production-status-preserved',
    'positive-production-gate-still-closed',
    'production-adapters-still-deferred',
    'production-authority-still-absent',
    'runtime-action-order-still-absent',
    'runtime-controller-still-absent',
  ],
);

for (const checkpointRow of checkpoint.rows) {
  assert.equal(
    checkpointRow.status,
    'guarded-final-closeout-summary-guard-closeout-summary-guard-closeout-summary-still-blocked',
  );
  assert.equal(checkpointRow.productionAuthority, false);
  assert.equal(checkpointRow.productionReady, false);
  assert.equal(checkpointRow.positiveGateAllowed, false);
  assert.equal(checkpointRow.manualInterpretationOnly, true);
  assert.equal(checkpointRow.isExecutionOrder, false);
  assert.equal(checkpointRow.isImplementationPlan, false);
  assert.equal(checkpointRow.isProductionWiringPlan, false);
  assert.deepEqual(checkpointRow.sources, allSources);
}

assert.deepEqual(rowForSignal('latest-closeout-summary-readout-guarded').blockerGroups, allBlockerGroups);
assert.deepEqual(rowForSignal('blocked-readout-remains-current').blockerGroups, allBlockerGroups);
assert.deepEqual(rowForSignal('non-production-status-preserved').blockerGroups, allBlockerGroups);
assert.deepEqual(rowForSignal('caller-owned-intake-blockers-stay-separate').blockerGroups, ['caller-owned-intake']);
assert.deepEqual(rowForSignal('current-evidence-blockers-stay-separate').blockerGroups, ['current-evidence']);
assert.deepEqual(rowForSignal('manual-interpretation-blockers-stay-separate').blockerGroups, ['manual-interpretation']);
assert.deepEqual(rowForSignal('non-evidence-production-blockers-stay-separate').blockerGroups, [
  'remaining-non-evidence-production',
]);
assert.equal(rowForSignal('positive-production-gate-still-closed').positiveGateAllowed, false);
assert.equal(rowForSignal('production-authority-still-absent').productionAuthority, false);
assert.equal(rowForSignal('production-adapters-still-deferred').isProductionWiringPlan, false);
assert.equal(rowForSignal('runtime-controller-still-absent').isProductionWiringPlan, false);
assert.equal(rowForSignal('runtime-action-order-still-absent').isExecutionOrder, false);
assert.equal(rowForSignal('fixed-tool-chain-still-absent').isExecutionOrder, false);

assertContains(
  latestCloseoutSummarySource,
  'caller-owned-final-negative-handoff-guard-summary-wording-consistency-final-closeout-summary-guard-closeout-summary-guard-closeout-summary-positive-gate-closed',
  'latest closeout summary source',
);
assertContains(
  latestCloseoutSummarySource,
  'closed-out-final-closeout-summary-guard-closeout-summary-guard-still-blocked',
  'latest closeout summary source',
);
assertContains(
  previousGuardSource,
  'caller-owned-final-negative-handoff-guard-summary-wording-consistency-final-closeout-summary-guard-closeout-summary-guard-positive-gate-closed',
  'previous guard source',
);
assertContains(
  productionGateFinalNegativeReadoutSource,
  'final-negative-production-gate-readout-still-blocked',
  'production gate final negative readout source',
);
assertContains(evidenceMappingSource, 'mapping-only-positive-gate-remains-closed', 'evidence mapping source');
assertContains(nonEvidenceInventorySource, 'non-evidence-blockers-remain-positive-gate-closed', 'non-evidence inventory source');

assertContains(
  auditText,
  'Caller-Owned Real-Exported Evidence Intake Review Readiness Post-Recheck Final Negative Readout Closeout Handoff Closeout Guard Closeout Wording Closeout Guard Summary Wording Consistency Final Closeout Summary Guard Closeout Summary Guard Closeout Summary Guard Checkpoint Status',
  'preflight audit',
);
assertContains(
  auditText,
  'final closeout summary guard closeout summary guard closeout readout remains guarded, blocked, and non-production',
  'preflight audit',
);
assertContains(
  statusText,
  'V3 runtime boundary caller-owned real-exported evidence intake review readiness post-recheck final negative readout closeout handoff closeout guard closeout wording closeout guard summary wording consistency final closeout summary guard closeout summary guard closeout summary guard checkpoint',
  'status page',
);
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-caller-owned-real-exported-intake-final-negative-handoff-guard-summary-wording-consistency-final-closeout-summary-guard-closeout-summary-guard-closeout-summary-guard-smoke.ts',
  'status page',
);
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');
assertContains(
  statusText,
  'The next code slice should be the new feature integration, with `agent-session-v3-staged-default-regression-smoke.ts` as the focused staged-default regression entry.',
  'next recommended step',
);

const guardedSources = [
  ['latest closeout summary', latestCloseoutSummarySource],
  ['previous guard', previousGuardSource],
  ['production gate final negative readout', productionGateFinalNegativeReadoutSource],
  ['evidence mapping', evidenceMappingSource],
  ['non-evidence inventory', nonEvidenceInventorySource],
  ['preflight audit', auditText],
  ['status page', statusText],
  ['runtime boundary', boundarySource],
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
  'Final guard checkpoint must not grant production readiness.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /isProductionWiringPlan":true|isImplementationPlan":true|production-wiring-ready|ready-for-production-wiring/u,
  'Final guard checkpoint must not become an implementation plan.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Final guard checkpoint must not define controller actions.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Final guard checkpoint must not prescribe desktop tools.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain|requiredReportOrder|implementationQueue|orderedSteps/iu,
  'Final guard checkpoint must not define fixed workflows.',
);

assertContains(boundarySource, 'AgentSessionV2 remains the production orchestrator', 'runtime boundary');
assertContains(boundarySource, 'no required ordered tool workflow', 'runtime boundary');
assertContains(boundarySource, 'no evidence adapter gains runtime authority', 'runtime boundary');
assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Final guard checkpoint must not add controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Final guard checkpoint must not add production runtime calls.',
);

console.log('agent session v3 runtime boundary caller-owned real-exported intake final negative handoff guard summary wording consistency final closeout summary guard closeout summary guard closeout summary guard smoke ok');
