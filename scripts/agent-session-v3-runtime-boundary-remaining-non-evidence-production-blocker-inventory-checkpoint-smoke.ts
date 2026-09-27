import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { readProjectFile } from './smokeTestHarness.ts';

type RemainingNonEvidenceProductionBlockerInput =
  | 'adapter-pre-contract-audit'
  | 'controller-policy-pre-contract-closeout'
  | 'evidence-interpretation-to-production-gate-mapping'
  | 'full-runtime-preflight-audit'
  | 'negative-gate-blocker-rollup'
  | 'payload-closeout-final-preflight-gate'
  | 'phase-port-payload-pre-contract-closeout'
  | 'positive-gate-precondition-closeout'
  | 'production-adapter-evidence-pre-contract-closeout'
  | 'production-wiring-gate-closeout-summary'
  | 'runtime-boundary-contract'
  | 'stop-payload-final-pre-contract-closeout';

type RemainingNonEvidenceProductionBlockerGroup =
  | 'production-ownership'
  | 'debug-shadow-attachment'
  | 'production-adapter-contracts'
  | 'controller-policy-contracts'
  | 'payload-contracts'
  | 'runtime-action-semantics';

type RemainingNonEvidenceProductionBlocker =
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

interface RemainingNonEvidenceProductionBlockerInventoryRow {
  blockers: readonly RemainingNonEvidenceProductionBlocker[];
  currentEvidencePackageReady: false;
  group: RemainingNonEvidenceProductionBlockerGroup;
  hypotheticalEvidenceAcceptedForInventoryOnly: true;
  inputs: readonly RemainingNonEvidenceProductionBlockerInput[];
  inventoryStatus: 'remaining-after-hypothetical-evidence-acceptance';
  isExecutionOrder: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
}

interface RemainingNonEvidenceProductionBlockerInventoryCheckpoint {
  evidenceBlockerScope: 'excluded-from-this-non-evidence-inventory-and-still-currently-open';
  gate: 'remaining-non-evidence-production-blocker-inventory';
  isProductionWiringPlan: false;
  mappingAuthority: 'non-authoritative-inventory';
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly RemainingNonEvidenceProductionBlockerInventoryRow[];
  summaryDecision: 'non-evidence-blockers-remain-positive-gate-closed';
}

const remainingNonEvidenceProductionBlockerInventoryCheckpoint = {
  evidenceBlockerScope: 'excluded-from-this-non-evidence-inventory-and-still-currently-open',
  gate: 'remaining-non-evidence-production-blocker-inventory',
  isProductionWiringPlan: false,
  mappingAuthority: 'non-authoritative-inventory',
  positiveGateAllowed: false,
  productionAuthority: false,
  productionReady: false,
  rows: [
    {
      blockers: ['agent-session-v2-production-owner-retained'],
      currentEvidencePackageReady: false,
      group: 'production-ownership',
      hypotheticalEvidenceAcceptedForInventoryOnly: true,
      inputs: [
        'runtime-boundary-contract',
        'full-runtime-preflight-audit',
        'positive-gate-precondition-closeout',
        'production-wiring-gate-closeout-summary',
        'evidence-interpretation-to-production-gate-mapping',
      ],
      inventoryStatus: 'remaining-after-hypothetical-evidence-acceptance',
      isExecutionOrder: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
    {
      blockers: ['v3-pilot-shadow-debug-only'],
      currentEvidencePackageReady: false,
      group: 'debug-shadow-attachment',
      hypotheticalEvidenceAcceptedForInventoryOnly: true,
      inputs: [
        'full-runtime-preflight-audit',
        'positive-gate-precondition-closeout',
        'production-wiring-gate-closeout-summary',
        'evidence-interpretation-to-production-gate-mapping',
      ],
      inventoryStatus: 'remaining-after-hypothetical-evidence-acceptance',
      isExecutionOrder: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
    {
      blockers: [
        'production-adapter-contracts-missing',
        'tool-execution-ownership-not-delegated',
      ],
      currentEvidencePackageReady: false,
      group: 'production-adapter-contracts',
      hypotheticalEvidenceAcceptedForInventoryOnly: true,
      inputs: [
        'adapter-pre-contract-audit',
        'production-adapter-evidence-pre-contract-closeout',
        'positive-gate-precondition-closeout',
        'production-wiring-gate-closeout-summary',
        'evidence-interpretation-to-production-gate-mapping',
      ],
      inventoryStatus: 'remaining-after-hypothetical-evidence-acceptance',
      isExecutionOrder: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
    {
      blockers: [
        'controller-policy-contracts-missing',
        'permission-routing-ownership-not-delegated',
      ],
      currentEvidencePackageReady: false,
      group: 'controller-policy-contracts',
      hypotheticalEvidenceAcceptedForInventoryOnly: true,
      inputs: [
        'controller-policy-pre-contract-closeout',
        'positive-gate-precondition-closeout',
        'production-wiring-gate-closeout-summary',
        'evidence-interpretation-to-production-gate-mapping',
      ],
      inventoryStatus: 'remaining-after-hypothetical-evidence-acceptance',
      isExecutionOrder: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
    {
      blockers: [
        'broad-stop-payload-contract-promotion-blocked',
        'phase-port-payload-contracts-missing',
      ],
      currentEvidencePackageReady: false,
      group: 'payload-contracts',
      hypotheticalEvidenceAcceptedForInventoryOnly: true,
      inputs: [
        'payload-closeout-final-preflight-gate',
        'phase-port-payload-pre-contract-closeout',
        'stop-payload-final-pre-contract-closeout',
        'positive-gate-precondition-closeout',
        'production-wiring-gate-closeout-summary',
      ],
      inventoryStatus: 'remaining-after-hypothetical-evidence-acceptance',
      isExecutionOrder: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
    {
      blockers: [
        'runtime-action-order-not-owned-by-v3',
        'fixed-tool-chain-prohibited',
      ],
      currentEvidencePackageReady: false,
      group: 'runtime-action-semantics',
      hypotheticalEvidenceAcceptedForInventoryOnly: true,
      inputs: [
        'runtime-boundary-contract',
        'negative-gate-blocker-rollup',
        'positive-gate-precondition-closeout',
        'production-wiring-gate-closeout-summary',
      ],
      inventoryStatus: 'remaining-after-hypothetical-evidence-acceptance',
      isExecutionOrder: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
  ],
  summaryDecision: 'non-evidence-blockers-remain-positive-gate-closed',
} as const satisfies RemainingNonEvidenceProductionBlockerInventoryCheckpoint;

function rowForGroup(group: RemainingNonEvidenceProductionBlockerGroup) {
  const row = remainingNonEvidenceProductionBlockerInventoryCheckpoint.rows.find((candidate) => candidate.group === group);
  assert.ok(row, `${group} should exist in the remaining non-evidence blocker inventory.`);
  return row;
}

function rowsForBlocker(blocker: RemainingNonEvidenceProductionBlocker) {
  return remainingNonEvidenceProductionBlockerInventoryCheckpoint.rows
    .filter((row) => row.blockers.includes(blocker));
}

function assertContains(text: string, expected: string, label: string) {
  assert.ok(text.includes(expected), `${label} should include: ${expected}`);
}

function uniqueSorted(values: readonly string[]) {
  return Array.from(new Set(values)).sort();
}

const boundarySource = readProjectFile('src/agent/agentSessionV3RuntimeBoundary.ts');
const auditText = readProjectFile('PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md');
const statusText = readProjectFile('PROJECT_AGENT_V2_STATUS.md');
const inventorySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-remaining-non-evidence-production-blocker-inventory-checkpoint-smoke.ts',
);
const mappingSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-evidence-interpretation-to-production-gate-mapping-checkpoint-smoke.ts',
);
const positiveGateCloseoutSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-production-wiring-positive-gate-precondition-closeout-gate-smoke.ts',
);
const gateCloseoutSummarySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-production-wiring-gate-closeout-summary-checkpoint-smoke.ts',
);
const negativeGateRollupSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-production-wiring-negative-gate-blocker-rollup-checkpoint-smoke.ts',
);

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');
assert.equal(boundaryContract.mode, 'contract-only');

assert.equal(remainingNonEvidenceProductionBlockerInventoryCheckpoint.mappingAuthority, 'non-authoritative-inventory');
assert.equal(
  remainingNonEvidenceProductionBlockerInventoryCheckpoint.evidenceBlockerScope,
  'excluded-from-this-non-evidence-inventory-and-still-currently-open',
);
assert.equal(remainingNonEvidenceProductionBlockerInventoryCheckpoint.productionAuthority, false);
assert.equal(remainingNonEvidenceProductionBlockerInventoryCheckpoint.productionReady, false);
assert.equal(remainingNonEvidenceProductionBlockerInventoryCheckpoint.positiveGateAllowed, false);
assert.equal(remainingNonEvidenceProductionBlockerInventoryCheckpoint.isProductionWiringPlan, false);
assert.equal(
  remainingNonEvidenceProductionBlockerInventoryCheckpoint.summaryDecision,
  'non-evidence-blockers-remain-positive-gate-closed',
);

assert.deepEqual(
  remainingNonEvidenceProductionBlockerInventoryCheckpoint.rows.map((row) => row.group).sort(),
  [
    'controller-policy-contracts',
    'debug-shadow-attachment',
    'payload-contracts',
    'production-adapter-contracts',
    'production-ownership',
    'runtime-action-semantics',
  ],
);

const flattenedBlockers = uniqueSorted(
  remainingNonEvidenceProductionBlockerInventoryCheckpoint.rows.flatMap((row) => row.blockers),
);
assert.deepEqual(
  flattenedBlockers,
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
assert.equal(flattenedBlockers.includes('missing-real-or-production-like-traces'), false);

for (const row of remainingNonEvidenceProductionBlockerInventoryCheckpoint.rows) {
  assert.equal(row.currentEvidencePackageReady, false);
  assert.equal(row.hypotheticalEvidenceAcceptedForInventoryOnly, true);
  assert.equal(row.inventoryStatus, 'remaining-after-hypothetical-evidence-acceptance');
  assert.equal(row.isExecutionOrder, false);
  assert.equal(row.productionAuthority, false);
  assert.equal(row.productionReady, false);
  assert.equal(row.positiveGateAllowed, false);
  assert.ok(row.inputs.length > 0);
  assert.ok(row.blockers.length > 0);
}

for (const blocker of flattenedBlockers as RemainingNonEvidenceProductionBlocker[]) {
  assert.equal(rowsForBlocker(blocker).length, 1, `${blocker} should appear exactly once in the inventory groups.`);
  assertContains(mappingSmokeSource, blocker, 'evidence interpretation mapping smoke');
  assertContains(positiveGateCloseoutSmokeSource, blocker, 'positive gate closeout smoke');
  assertContains(gateCloseoutSummarySmokeSource, blocker, 'gate closeout summary smoke');
  assertContains(negativeGateRollupSmokeSource, blocker, 'negative gate blocker rollup smoke');
}

assert.ok(rowForGroup('production-ownership').blockers.includes('agent-session-v2-production-owner-retained'));
assert.ok(rowForGroup('debug-shadow-attachment').blockers.includes('v3-pilot-shadow-debug-only'));
assert.ok(rowForGroup('production-adapter-contracts').blockers.includes('production-adapter-contracts-missing'));
assert.ok(rowForGroup('production-adapter-contracts').blockers.includes('tool-execution-ownership-not-delegated'));
assert.ok(rowForGroup('controller-policy-contracts').blockers.includes('controller-policy-contracts-missing'));
assert.ok(rowForGroup('controller-policy-contracts').blockers.includes('permission-routing-ownership-not-delegated'));
assert.ok(rowForGroup('payload-contracts').blockers.includes('broad-stop-payload-contract-promotion-blocked'));
assert.ok(rowForGroup('payload-contracts').blockers.includes('phase-port-payload-contracts-missing'));
assert.ok(rowForGroup('runtime-action-semantics').blockers.includes('runtime-action-order-not-owned-by-v3'));
assert.ok(rowForGroup('runtime-action-semantics').blockers.includes('fixed-tool-chain-prohibited'));

assertContains(mappingSmokeSource, 'manual-evidence-package-hypothetically-accepted', 'evidence interpretation mapping smoke');
assertContains(mappingSmokeSource, 'does-not-clear-non-evidence-blockers', 'evidence interpretation mapping smoke');
assertContains(mappingSmokeSource, 'mapping-only-positive-gate-remains-closed', 'evidence interpretation mapping smoke');
assertContains(gateCloseoutSummarySmokeSource, 'production-wiring-deferred', 'gate closeout summary smoke');
assertContains(positiveGateCloseoutSmokeSource, 'positive-gate-remains-closed', 'positive gate closeout smoke');
assertContains(boundarySource, 'AgentSessionV2 remains the production orchestrator', 'runtime boundary');
assertContains(boundarySource, 'no required ordered tool workflow', 'runtime boundary');

assertContains(auditText, 'Remaining Non-Evidence Production Blocker Inventory Checkpoint Status', 'preflight audit');
assertContains(auditText, 'non-evidence blockers remain and the positive gate remains closed', 'preflight audit');
assertContains(statusText, 'V3 runtime boundary remaining non-evidence production blocker inventory checkpoint', 'status');
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-remaining-non-evidence-production-blocker-inventory-checkpoint-smoke.ts',
  'status',
);
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

const serializedCheckpoint = JSON.stringify(remainingNonEvidenceProductionBlockerInventoryCheckpoint);
assert.doesNotMatch(
  serializedCheckpoint,
  /productionAuthority":true|productionReady":true|positiveGateAllowed":true/u,
  'Remaining non-evidence blocker inventory must not grant production readiness or authority.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /isProductionWiringPlan":true|ready-for-production-wiring|production-wiring-ready|productionGateCleared":true/u,
  'Remaining non-evidence blocker inventory must not become a production wiring plan or clear the gate.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /adapterContractPromotionAllowed|payloadContractPromotionAllowed|formalPolicyContractReady|formalContractReady/u,
  'Remaining non-evidence blocker inventory should not promote payload, adapter, or controller contracts.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Remaining non-evidence blocker inventory should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Remaining non-evidence blocker inventory should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain|requiredReportOrder|implementationQueue|orderedSteps/iu,
  'Remaining non-evidence blocker inventory should not define fixed workflows, required report order, or task queues.',
);

assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Remaining non-evidence blocker inventory must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Remaining non-evidence blocker inventory must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  inventorySmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Remaining non-evidence blocker inventory smoke should not call production v2 modules.',
);

console.log('agent session v3 runtime boundary remaining non-evidence production blocker inventory checkpoint smoke ok');
