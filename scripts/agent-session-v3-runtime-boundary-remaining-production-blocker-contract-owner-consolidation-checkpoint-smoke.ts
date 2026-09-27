import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { readProjectFile } from './smokeTestHarness.ts';

type RemainingProductionBlocker =
  | 'agent-session-v2-production-owner-retained'
  | 'broad-stop-payload-contract-promotion-blocked'
  | 'controller-policy-contracts-missing'
  | 'fixed-tool-chain-prohibited'
  | 'permission-routing-ownership-not-delegated'
  | 'phase-port-payload-contracts-missing'
  | 'production-adapter-contracts-missing'
  | 'runtime-action-order-not-owned-by-v3'
  | 'tool-execution-ownership-not-delegated'
  | 'v3-pilot-shadow-debug-only';

type InventoryGroup =
  | 'controller-policy-contracts'
  | 'debug-shadow-attachment'
  | 'payload-contracts'
  | 'production-adapter-contracts'
  | 'production-ownership'
  | 'runtime-action-semantics';

type FutureContractOwnerCategory =
  | 'controller-policy-contract-owner'
  | 'non-fixed-runtime-scheduling-contract-owner'
  | 'phase-payload-contract-owner'
  | 'production-adapter-contract-owner'
  | 'production-orchestrator-ownership-contract-owner'
  | 'runtime-attachment-authority-contract-owner';

type Source =
  | 'boundary-contract'
  | 'final-closeout-summary-guard'
  | 'full-runtime-preflight-audit'
  | 'production-authority-drift-final-guard'
  | 'remaining-non-evidence-production-blocker-inventory'
  | 'status-page';

interface OwnerConsolidationRow {
  blocker: RemainingProductionBlocker;
  currentEvidenceBlocker: false;
  futureContractOwnerCategory: FutureContractOwnerCategory;
  futureOwnerOnly: true;
  implementationReadyNow: false;
  inventoryGroup: InventoryGroup;
  isEvidenceAdapter: false;
  isExecutionOrder: false;
  isProductionWiringPlan: false;
  mayInformFutureRuntimeSeam: true;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  sources: readonly Source[];
}

interface OwnerConsolidationCheckpoint {
  checkpoint: 'remaining-production-blocker-contract-owner-consolidation';
  currentEvidenceBlockersIncluded: false;
  futureOwnerOnly: true;
  implementationReadyNow: false;
  isExecutionOrder: false;
  isProductionWiringPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly OwnerConsolidationRow[];
  summaryDecision: 'remaining-production-blockers-mapped-to-future-contract-owners-positive-gate-closed';
}

const sources = [
  'remaining-non-evidence-production-blocker-inventory',
  'final-closeout-summary-guard',
  'production-authority-drift-final-guard',
  'full-runtime-preflight-audit',
  'status-page',
  'boundary-contract',
] as const satisfies readonly Source[];

function row(
  blocker: RemainingProductionBlocker,
  inventoryGroup: InventoryGroup,
  futureContractOwnerCategory: FutureContractOwnerCategory,
) {
  return {
    blocker,
    currentEvidenceBlocker: false,
    futureContractOwnerCategory,
    futureOwnerOnly: true,
    implementationReadyNow: false,
    inventoryGroup,
    isEvidenceAdapter: false,
    isExecutionOrder: false,
    isProductionWiringPlan: false,
    mayInformFutureRuntimeSeam: true,
    positiveGateAllowed: false,
    productionAuthority: false,
    productionReady: false,
    sources,
  } as const satisfies OwnerConsolidationRow;
}

const checkpoint = {
  checkpoint: 'remaining-production-blocker-contract-owner-consolidation',
  currentEvidenceBlockersIncluded: false,
  futureOwnerOnly: true,
  implementationReadyNow: false,
  isExecutionOrder: false,
  isProductionWiringPlan: false,
  positiveGateAllowed: false,
  productionAuthority: false,
  productionReady: false,
  rows: [
    row(
      'agent-session-v2-production-owner-retained',
      'production-ownership',
      'production-orchestrator-ownership-contract-owner',
    ),
    row('v3-pilot-shadow-debug-only', 'debug-shadow-attachment', 'runtime-attachment-authority-contract-owner'),
    row('production-adapter-contracts-missing', 'production-adapter-contracts', 'production-adapter-contract-owner'),
    row('tool-execution-ownership-not-delegated', 'production-adapter-contracts', 'production-adapter-contract-owner'),
    row('controller-policy-contracts-missing', 'controller-policy-contracts', 'controller-policy-contract-owner'),
    row('permission-routing-ownership-not-delegated', 'controller-policy-contracts', 'controller-policy-contract-owner'),
    row('broad-stop-payload-contract-promotion-blocked', 'payload-contracts', 'phase-payload-contract-owner'),
    row('phase-port-payload-contracts-missing', 'payload-contracts', 'phase-payload-contract-owner'),
    row('runtime-action-order-not-owned-by-v3', 'runtime-action-semantics', 'non-fixed-runtime-scheduling-contract-owner'),
    row('fixed-tool-chain-prohibited', 'runtime-action-semantics', 'non-fixed-runtime-scheduling-contract-owner'),
  ],
  summaryDecision: 'remaining-production-blockers-mapped-to-future-contract-owners-positive-gate-closed',
} as const satisfies OwnerConsolidationCheckpoint;

function assertContains(text: string, expected: string, label: string) {
  assert.ok(text.includes(expected), `${label} should include: ${expected}`);
}

function uniqueSorted(values: readonly string[]) {
  return Array.from(new Set(values)).sort();
}

function rowsForOwner(owner: FutureContractOwnerCategory) {
  return checkpoint.rows.filter((candidate) => candidate.futureContractOwnerCategory === owner);
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
const inventorySource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-remaining-non-evidence-production-blocker-inventory-checkpoint-smoke.ts',
);
const finalGuardSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-caller-owned-real-exported-intake-final-negative-handoff-guard-summary-wording-consistency-final-closeout-summary-guard-closeout-summary-guard-closeout-summary-guard-smoke.ts',
);
const authorityDriftSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-production-authority-drift-final-guard-smoke.ts',
);

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');
assert.equal(boundaryContract.mode, 'contract-only');
assert.ok(boundaryContract.guardrails.includes('AgentSessionV2 remains the production orchestrator'));
assert.ok(boundaryContract.guardrails.includes('no required ordered tool workflow'));
assert.ok(boundaryContract.guardrails.includes('no evidence adapter gains runtime authority'));

assert.equal(checkpoint.currentEvidenceBlockersIncluded, false);
assert.equal(checkpoint.futureOwnerOnly, true);
assert.equal(checkpoint.implementationReadyNow, false);
assert.equal(checkpoint.isExecutionOrder, false);
assert.equal(checkpoint.isProductionWiringPlan, false);
assert.equal(checkpoint.productionAuthority, false);
assert.equal(checkpoint.productionReady, false);
assert.equal(checkpoint.positiveGateAllowed, false);
assert.equal(
  checkpoint.summaryDecision,
  'remaining-production-blockers-mapped-to-future-contract-owners-positive-gate-closed',
);

assert.deepEqual(
  uniqueSorted(checkpoint.rows.map((candidate) => candidate.blocker)),
  [
    'agent-session-v2-production-owner-retained',
    'broad-stop-payload-contract-promotion-blocked',
    'controller-policy-contracts-missing',
    'fixed-tool-chain-prohibited',
    'permission-routing-ownership-not-delegated',
    'phase-port-payload-contracts-missing',
    'production-adapter-contracts-missing',
    'runtime-action-order-not-owned-by-v3',
    'tool-execution-ownership-not-delegated',
    'v3-pilot-shadow-debug-only',
  ],
);

assert.deepEqual(
  uniqueSorted(checkpoint.rows.map((candidate) => candidate.futureContractOwnerCategory)),
  [
    'controller-policy-contract-owner',
    'non-fixed-runtime-scheduling-contract-owner',
    'phase-payload-contract-owner',
    'production-adapter-contract-owner',
    'production-orchestrator-ownership-contract-owner',
    'runtime-attachment-authority-contract-owner',
  ],
);

for (const checkpointRow of checkpoint.rows) {
  assert.equal(checkpointRow.currentEvidenceBlocker, false);
  assert.equal(checkpointRow.futureOwnerOnly, true);
  assert.equal(checkpointRow.implementationReadyNow, false);
  assert.equal(checkpointRow.isEvidenceAdapter, false);
  assert.equal(checkpointRow.isExecutionOrder, false);
  assert.equal(checkpointRow.isProductionWiringPlan, false);
  assert.equal(checkpointRow.mayInformFutureRuntimeSeam, true);
  assert.equal(checkpointRow.productionAuthority, false);
  assert.equal(checkpointRow.productionReady, false);
  assert.equal(checkpointRow.positiveGateAllowed, false);
  assert.deepEqual(checkpointRow.sources, sources);
  assertContains(inventorySource, checkpointRow.blocker, 'remaining blocker inventory source');
}

assert.equal(rowsForOwner('production-orchestrator-ownership-contract-owner').length, 1);
assert.equal(rowsForOwner('runtime-attachment-authority-contract-owner').length, 1);
assert.equal(rowsForOwner('production-adapter-contract-owner').length, 2);
assert.equal(rowsForOwner('controller-policy-contract-owner').length, 2);
assert.equal(rowsForOwner('phase-payload-contract-owner').length, 2);
assert.equal(rowsForOwner('non-fixed-runtime-scheduling-contract-owner').length, 2);

assertContains(
  inventorySource,
  'non-evidence-blockers-remain-positive-gate-closed',
  'remaining blocker inventory source',
);
assertContains(
  finalGuardSource,
  'caller-owned-final-negative-handoff-guard-summary-wording-consistency-final-closeout-summary-guard-closeout-summary-guard-closeout-summary-guard-positive-gate-closed',
  'final guard source',
);
assertContains(authorityDriftSource, 'production authority drift final guard smoke ok', 'authority drift source');
assertContains(boundarySource, 'AgentSessionV2 remains the production orchestrator', 'runtime boundary');
assertContains(boundarySource, 'no required ordered tool workflow', 'runtime boundary');
assertContains(boundarySource, 'no evidence adapter gains runtime authority', 'runtime boundary');

assertContains(
  auditText,
  'Remaining Production Blocker Future Contract Owner Consolidation Checkpoint Status',
  'preflight audit',
);
assertContains(
  auditText,
  'remaining production blockers are mapped to future contract owners only',
  'preflight audit',
);
assertContains(
  statusText,
  'V3 runtime boundary remaining production blocker future contract owner consolidation checkpoint',
  'status page',
);
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-remaining-production-blocker-contract-owner-consolidation-checkpoint-smoke.ts',
  'status page',
);
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

const guardedSources = [
  ['inventory source', inventorySource],
  ['final guard source', finalGuardSource],
  ['authority drift source', authorityDriftSource],
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
  'Owner consolidation must not grant production readiness.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /implementationReadyNow":true|isProductionWiringPlan":true|isExecutionOrder":true/u,
  'Owner consolidation must not become implementation wiring.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /isEvidenceAdapter":true|currentEvidenceBlocker":true/u,
  'Owner consolidation must not recast non-evidence blockers as evidence adapters.',
);
assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Owner consolidation must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Owner consolidation must not add production runtime calls.',
);

console.log('agent session v3 runtime boundary remaining production blocker contract owner consolidation checkpoint smoke ok');
