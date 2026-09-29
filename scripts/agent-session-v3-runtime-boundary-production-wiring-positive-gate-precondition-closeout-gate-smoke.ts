import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { readProjectFile } from './smokeTestHarness.ts';

type PositiveGatePreconditionCloseoutInput =
  | 'adapter-pre-contract-audit'
  | 'controller-policy-pre-contract-closeout'
  | 'full-runtime-preflight-audit'
  | 'negative-gate-blocker-rollup'
  | 'negative-gate-consistency'
  | 'payload-closeout-final-preflight-gate'
  | 'phase-port-payload-pre-contract-closeout'
  | 'positive-gate-precondition-audit'
  | 'positive-gate-precondition-consistency'
  | 'production-adapter-evidence-pre-contract-closeout'
  | 'runtime-boundary-contract'
  | 'stop-payload-final-pre-contract-closeout';

type PositiveGatePreconditionCloseoutBlocker =
  | 'agent-session-v2-production-owner-retained'
  | 'broad-stop-payload-contract-promotion-blocked'
  | 'controller-policy-contracts-missing'
  | 'fixed-tool-chain-prohibited'
  | 'missing-real-or-production-like-traces'
  | 'permission-routing-ownership-not-delegated'
  | 'phase-port-payload-contracts-missing'
  | 'production-adapter-contracts-missing'
  | 'runtime-action-order-not-owned-by-v3'
  | 'tool-execution-ownership-not-delegated'
  | 'v3-pilot-shadow-debug-only';

type PositiveGatePreconditionCloseoutId =
  | 'formal-production-ownership-transfer'
  | 'non-debug-runtime-attachment'
  | 'production-adapter-contracts'
  | 'controller-policy-contracts'
  | 'broad-stop-payload-contracts'
  | 'phase-port-payload-contracts'
  | 'real-production-like-trace-corpus'
  | 'permission-phase-adapter-contract'
  | 'transaction-phase-adapter-contract'
  | 'controller-state-semantics'
  | 'non-fixed-adapter-scheduling-contract'
  | 'experimental-authority-switch';

interface PositiveGatePreconditionCloseoutRow {
  backedByConsistencyCheckpoint: true;
  backedByNegativeGate: true;
  blockedBy: readonly PositiveGatePreconditionCloseoutBlocker[];
  closeoutStatus: 'blocked-and-closed';
  inputEvidence: readonly PositiveGatePreconditionCloseoutInput[];
  preconditionId: PositiveGatePreconditionCloseoutId;
  productionAuthority: false;
  productionReady: false;
  readyForPositiveGate: false;
}

interface PositiveGatePreconditionCloseoutGate {
  closeoutDecision: 'positive-gate-remains-closed';
  gate: 'production-wiring-positive-gate-precondition-closeout';
  isProductionWiringPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly PositiveGatePreconditionCloseoutRow[];
}

const positiveGatePreconditionCloseoutGate = {
  closeoutDecision: 'positive-gate-remains-closed',
  gate: 'production-wiring-positive-gate-precondition-closeout',
  isProductionWiringPlan: false,
  positiveGateAllowed: false,
  productionAuthority: false,
  productionReady: false,
  rows: [
    {
      backedByConsistencyCheckpoint: true,
      backedByNegativeGate: true,
      blockedBy: ['agent-session-v2-production-owner-retained'],
      closeoutStatus: 'blocked-and-closed',
      inputEvidence: [
        'full-runtime-preflight-audit',
        'runtime-boundary-contract',
        'negative-gate-blocker-rollup',
        'negative-gate-consistency',
        'positive-gate-precondition-audit',
        'positive-gate-precondition-consistency',
      ],
      preconditionId: 'formal-production-ownership-transfer',
      productionAuthority: false,
      productionReady: false,
      readyForPositiveGate: false,
    },
    {
      backedByConsistencyCheckpoint: true,
      backedByNegativeGate: true,
      blockedBy: [
        'v3-pilot-shadow-debug-only',
        'agent-session-v2-production-owner-retained',
      ],
      closeoutStatus: 'blocked-and-closed',
      inputEvidence: [
        'full-runtime-preflight-audit',
        'negative-gate-blocker-rollup',
        'negative-gate-consistency',
        'positive-gate-precondition-audit',
        'positive-gate-precondition-consistency',
      ],
      preconditionId: 'non-debug-runtime-attachment',
      productionAuthority: false,
      productionReady: false,
      readyForPositiveGate: false,
    },
    {
      backedByConsistencyCheckpoint: true,
      backedByNegativeGate: true,
      blockedBy: [
        'production-adapter-contracts-missing',
        'missing-real-or-production-like-traces',
      ],
      closeoutStatus: 'blocked-and-closed',
      inputEvidence: [
        'adapter-pre-contract-audit',
        'production-adapter-evidence-pre-contract-closeout',
        'negative-gate-blocker-rollup',
        'negative-gate-consistency',
        'positive-gate-precondition-audit',
        'positive-gate-precondition-consistency',
      ],
      preconditionId: 'production-adapter-contracts',
      productionAuthority: false,
      productionReady: false,
      readyForPositiveGate: false,
    },
    {
      backedByConsistencyCheckpoint: true,
      backedByNegativeGate: true,
      blockedBy: [
        'controller-policy-contracts-missing',
        'broad-stop-payload-contract-promotion-blocked',
      ],
      closeoutStatus: 'blocked-and-closed',
      inputEvidence: [
        'controller-policy-pre-contract-closeout',
        'stop-payload-final-pre-contract-closeout',
        'negative-gate-blocker-rollup',
        'negative-gate-consistency',
        'positive-gate-precondition-audit',
        'positive-gate-precondition-consistency',
      ],
      preconditionId: 'controller-policy-contracts',
      productionAuthority: false,
      productionReady: false,
      readyForPositiveGate: false,
    },
    {
      backedByConsistencyCheckpoint: true,
      backedByNegativeGate: true,
      blockedBy: [
        'broad-stop-payload-contract-promotion-blocked',
        'production-adapter-contracts-missing',
        'controller-policy-contracts-missing',
        'phase-port-payload-contracts-missing',
      ],
      closeoutStatus: 'blocked-and-closed',
      inputEvidence: [
        'payload-closeout-final-preflight-gate',
        'stop-payload-final-pre-contract-closeout',
        'negative-gate-blocker-rollup',
        'negative-gate-consistency',
        'positive-gate-precondition-audit',
        'positive-gate-precondition-consistency',
      ],
      preconditionId: 'broad-stop-payload-contracts',
      productionAuthority: false,
      productionReady: false,
      readyForPositiveGate: false,
    },
    {
      backedByConsistencyCheckpoint: true,
      backedByNegativeGate: true,
      blockedBy: [
        'phase-port-payload-contracts-missing',
        'broad-stop-payload-contract-promotion-blocked',
      ],
      closeoutStatus: 'blocked-and-closed',
      inputEvidence: [
        'phase-port-payload-pre-contract-closeout',
        'stop-payload-final-pre-contract-closeout',
        'negative-gate-blocker-rollup',
        'negative-gate-consistency',
        'positive-gate-precondition-audit',
        'positive-gate-precondition-consistency',
      ],
      preconditionId: 'phase-port-payload-contracts',
      productionAuthority: false,
      productionReady: false,
      readyForPositiveGate: false,
    },
    {
      backedByConsistencyCheckpoint: true,
      backedByNegativeGate: true,
      blockedBy: ['missing-real-or-production-like-traces'],
      closeoutStatus: 'blocked-and-closed',
      inputEvidence: [
        'full-runtime-preflight-audit',
        'production-adapter-evidence-pre-contract-closeout',
        'stop-payload-final-pre-contract-closeout',
        'negative-gate-blocker-rollup',
        'negative-gate-consistency',
        'positive-gate-precondition-audit',
        'positive-gate-precondition-consistency',
      ],
      preconditionId: 'real-production-like-trace-corpus',
      productionAuthority: false,
      productionReady: false,
      readyForPositiveGate: false,
    },
    {
      backedByConsistencyCheckpoint: true,
      backedByNegativeGate: true,
      blockedBy: [
        'permission-routing-ownership-not-delegated',
        'controller-policy-contracts-missing',
      ],
      closeoutStatus: 'blocked-and-closed',
      inputEvidence: [
        'adapter-pre-contract-audit',
        'controller-policy-pre-contract-closeout',
        'negative-gate-blocker-rollup',
        'negative-gate-consistency',
        'positive-gate-precondition-audit',
        'positive-gate-precondition-consistency',
      ],
      preconditionId: 'permission-phase-adapter-contract',
      productionAuthority: false,
      productionReady: false,
      readyForPositiveGate: false,
    },
    {
      backedByConsistencyCheckpoint: true,
      backedByNegativeGate: true,
      blockedBy: [
        'tool-execution-ownership-not-delegated',
        'production-adapter-contracts-missing',
      ],
      closeoutStatus: 'blocked-and-closed',
      inputEvidence: [
        'adapter-pre-contract-audit',
        'production-adapter-evidence-pre-contract-closeout',
        'negative-gate-blocker-rollup',
        'negative-gate-consistency',
        'positive-gate-precondition-audit',
        'positive-gate-precondition-consistency',
      ],
      preconditionId: 'transaction-phase-adapter-contract',
      productionAuthority: false,
      productionReady: false,
      readyForPositiveGate: false,
    },
    {
      backedByConsistencyCheckpoint: true,
      backedByNegativeGate: true,
      blockedBy: [
        'runtime-action-order-not-owned-by-v3',
        'fixed-tool-chain-prohibited',
      ],
      closeoutStatus: 'blocked-and-closed',
      inputEvidence: [
        'full-runtime-preflight-audit',
        'runtime-boundary-contract',
        'negative-gate-blocker-rollup',
        'negative-gate-consistency',
        'positive-gate-precondition-audit',
        'positive-gate-precondition-consistency',
      ],
      preconditionId: 'controller-state-semantics',
      productionAuthority: false,
      productionReady: false,
      readyForPositiveGate: false,
    },
    {
      backedByConsistencyCheckpoint: true,
      backedByNegativeGate: true,
      blockedBy: [
        'runtime-action-order-not-owned-by-v3',
        'fixed-tool-chain-prohibited',
      ],
      closeoutStatus: 'blocked-and-closed',
      inputEvidence: [
        'full-runtime-preflight-audit',
        'runtime-boundary-contract',
        'negative-gate-blocker-rollup',
        'negative-gate-consistency',
        'positive-gate-precondition-audit',
        'positive-gate-precondition-consistency',
      ],
      preconditionId: 'non-fixed-adapter-scheduling-contract',
      productionAuthority: false,
      productionReady: false,
      readyForPositiveGate: false,
    },
    {
      backedByConsistencyCheckpoint: true,
      backedByNegativeGate: true,
      blockedBy: [
        'agent-session-v2-production-owner-retained',
        'v3-pilot-shadow-debug-only',
      ],
      closeoutStatus: 'blocked-and-closed',
      inputEvidence: [
        'full-runtime-preflight-audit',
        'runtime-boundary-contract',
        'negative-gate-blocker-rollup',
        'negative-gate-consistency',
        'positive-gate-precondition-audit',
        'positive-gate-precondition-consistency',
      ],
      preconditionId: 'experimental-authority-switch',
      productionAuthority: false,
      productionReady: false,
      readyForPositiveGate: false,
    },
  ],
} as const satisfies PositiveGatePreconditionCloseoutGate;

function rowsForBlocker(blocker: PositiveGatePreconditionCloseoutBlocker) {
  return positiveGatePreconditionCloseoutGate.rows.filter((row) => row.blockedBy.includes(blocker));
}

function rowById(preconditionId: PositiveGatePreconditionCloseoutId) {
  const row = positiveGatePreconditionCloseoutGate.rows.find((candidate) => candidate.preconditionId === preconditionId);
  assert.ok(row, `${preconditionId} should exist in the positive-gate precondition closeout gate.`);
  return row;
}

function assertSourceContains(source: string, expected: string, label: string) {
  assert.match(source, new RegExp(expected, 'u'), `${label} should contain ${expected}.`);
}

const auditText = readProjectFile('PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md');
const statusText = readProjectFile('PROJECT_AGENT_V2_STATUS.md');
const boundarySource = readProjectFile('src/agent/agentSessionV3RuntimeBoundary.ts');
const closeoutGateSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-production-wiring-positive-gate-precondition-closeout-gate-smoke.ts',
);
const preconditionAuditSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-production-wiring-positive-gate-precondition-audit-smoke.ts',
);
const preconditionConsistencySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-production-wiring-positive-gate-precondition-consistency-checkpoint-smoke.ts',
);
const negativeGateSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-production-wiring-negative-gate-blocker-rollup-checkpoint-smoke.ts',
);
const negativeGateConsistencySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-production-wiring-negative-gate-consistency-checkpoint-smoke.ts',
);
const adapterPreContractSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-adapter-pre-contract-smoke.ts',
);
const controllerPolicyCloseoutSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-controller-policy-pre-contract-closeout-checkpoint-smoke.ts',
);
const productionAdapterCloseoutSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-production-adapter-evidence-pre-contract-closeout-checkpoint-smoke.ts',
);
const payloadFinalGateSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-payload-closeout-final-preflight-gate-smoke.ts',
);
const phasePortCloseoutSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-phase-port-payload-pre-contract-closeout-checkpoint-smoke.ts',
);
const stopPayloadFinalCloseoutSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-stop-payload-final-pre-contract-closeout-alignment-checkpoint-smoke.ts',
);

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');
assert.equal(boundaryContract.mode, 'contract-only');

assert.equal(positiveGatePreconditionCloseoutGate.productionAuthority, false);
assert.equal(positiveGatePreconditionCloseoutGate.productionReady, false);
assert.equal(positiveGatePreconditionCloseoutGate.positiveGateAllowed, false);
assert.equal(positiveGatePreconditionCloseoutGate.isProductionWiringPlan, false);
assert.equal(positiveGatePreconditionCloseoutGate.closeoutDecision, 'positive-gate-remains-closed');

assert.deepEqual(
  positiveGatePreconditionCloseoutGate.rows.map((row) => row.preconditionId).sort(),
  [
    'broad-stop-payload-contracts',
    'controller-policy-contracts',
    'controller-state-semantics',
    'experimental-authority-switch',
    'formal-production-ownership-transfer',
    'non-debug-runtime-attachment',
    'non-fixed-adapter-scheduling-contract',
    'permission-phase-adapter-contract',
    'phase-port-payload-contracts',
    'production-adapter-contracts',
    'real-production-like-trace-corpus',
    'transaction-phase-adapter-contract',
  ],
);

for (const row of positiveGatePreconditionCloseoutGate.rows) {
  assert.equal(row.backedByConsistencyCheckpoint, true);
  assert.equal(row.backedByNegativeGate, true);
  assert.equal(row.closeoutStatus, 'blocked-and-closed');
  assert.equal(row.productionAuthority, false);
  assert.equal(row.productionReady, false);
  assert.equal(row.readyForPositiveGate, false);
  assert.ok(row.inputEvidence.includes('positive-gate-precondition-audit'));
  assert.ok(row.inputEvidence.includes('positive-gate-precondition-consistency'));
  assert.ok(row.inputEvidence.includes('negative-gate-blocker-rollup'));
  assert.ok(row.inputEvidence.includes('negative-gate-consistency'));
  assert.ok(row.blockedBy.length > 0);

  assertSourceContains(preconditionAuditSmokeSource, row.preconditionId, 'positive-gate precondition audit smoke');
  assertSourceContains(
    preconditionConsistencySmokeSource,
    row.preconditionId,
    'positive-gate precondition consistency smoke',
  );

  for (const blocker of row.blockedBy) {
    assertSourceContains(preconditionAuditSmokeSource, blocker, 'positive-gate precondition audit smoke');
    assertSourceContains(preconditionConsistencySmokeSource, blocker, 'positive-gate precondition consistency smoke');
    assertSourceContains(negativeGateSmokeSource, blocker, 'negative gate blocker rollup smoke');
    assertSourceContains(negativeGateConsistencySmokeSource, blocker, 'negative gate consistency smoke');
  }
}

for (const blocker of [
  'agent-session-v2-production-owner-retained',
  'broad-stop-payload-contract-promotion-blocked',
  'controller-policy-contracts-missing',
  'fixed-tool-chain-prohibited',
  'missing-real-or-production-like-traces',
  'permission-routing-ownership-not-delegated',
  'phase-port-payload-contracts-missing',
  'production-adapter-contracts-missing',
  'runtime-action-order-not-owned-by-v3',
  'tool-execution-ownership-not-delegated',
  'v3-pilot-shadow-debug-only',
] as const satisfies readonly PositiveGatePreconditionCloseoutBlocker[]) {
  assert.ok(rowsForBlocker(blocker).length > 0, `${blocker} should remain represented in the closeout gate.`);
}

assert.ok(rowById('formal-production-ownership-transfer').inputEvidence.includes('runtime-boundary-contract'));
assert.ok(rowById('non-debug-runtime-attachment').inputEvidence.includes('full-runtime-preflight-audit'));
assert.ok(rowById('production-adapter-contracts').inputEvidence.includes('production-adapter-evidence-pre-contract-closeout'));
assert.ok(rowById('controller-policy-contracts').inputEvidence.includes('controller-policy-pre-contract-closeout'));
assert.ok(rowById('broad-stop-payload-contracts').inputEvidence.includes('payload-closeout-final-preflight-gate'));
assert.ok(rowById('phase-port-payload-contracts').inputEvidence.includes('phase-port-payload-pre-contract-closeout'));
assert.ok(rowById('real-production-like-trace-corpus').inputEvidence.includes('stop-payload-final-pre-contract-closeout'));
assert.ok(rowById('permission-phase-adapter-contract').inputEvidence.includes('adapter-pre-contract-audit'));
assert.ok(rowById('transaction-phase-adapter-contract').inputEvidence.includes('adapter-pre-contract-audit'));
assert.ok(rowById('controller-state-semantics').inputEvidence.includes('runtime-boundary-contract'));
assert.ok(rowById('non-fixed-adapter-scheduling-contract').inputEvidence.includes('runtime-boundary-contract'));
assert.ok(rowById('experimental-authority-switch').inputEvidence.includes('full-runtime-preflight-audit'));

assert.match(auditText, /Production Wiring Positive-Gate Precondition Audit Status/u);
assert.match(auditText, /Production Wiring Positive-Gate Precondition Consistency Checkpoint Status/u);
assert.match(auditText, /Production Wiring Positive-Gate Precondition Closeout Gate Status/u);
assert.match(auditText, /positive gate remains closed/u);
assert.match(auditText, /blocked closeout gate, not a production wiring plan/u);
assert.match(boundarySource, /productionAuthority: false/u);
assert.match(boundarySource, /contract-only/u);
assert.match(boundarySource, /no required ordered tool workflow/u);
assert.match(adapterPreContractSmokeSource, /AgentSessionV2 remains production owner/u);
assert.match(adapterPreContractSmokeSource, /permission-route-consumption/u);
assert.match(adapterPreContractSmokeSource, /transaction-execution/u);
assert.match(productionAdapterCloseoutSmokeSource, /adapter contracts remain deferred/u);
assert.match(controllerPolicyCloseoutSmokeSource, /controller-policy fields remain smoke-only/u);
assert.match(payloadFinalGateSmokeSource, /payload-contract promotion is not allowed now/u);
assert.match(phasePortCloseoutSmokeSource, /phase-port payload side is internally covered but still pre-contract only/u);
assert.match(stopPayloadFinalCloseoutSmokeSource, /broad stop-payload contract promotion remains blocked/u);
assert.match(stopPayloadFinalCloseoutSmokeSource, /missing-real-or-production-like-traces/u);

const serializedCloseout = JSON.stringify(positiveGatePreconditionCloseoutGate);
assert.doesNotMatch(
  serializedCloseout,
  /productionAuthority":true|productionReady":true|positiveGateAllowed":true|readyForPositiveGate":true/u,
  'Positive-gate precondition closeout gate must not open a positive gate or grant production authority.',
);
assert.doesNotMatch(
  serializedCloseout,
  /isProductionWiringPlan":true|decision":"ready-for-production-wiring/u,
  'Positive-gate precondition closeout gate must not become a production wiring plan.',
);
assert.doesNotMatch(
  serializedCloseout,
  /adapterContractPromotionAllowed|payloadContractPromotionAllowed|formalPolicyContractReady|formalContractReady/u,
  'Positive-gate precondition closeout gate should not promote payload, adapter, or controller contracts.',
);
assert.doesNotMatch(
  serializedCloseout,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Positive-gate precondition closeout gate should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedCloseout,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Positive-gate precondition closeout gate should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedCloseout,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain/iu,
  'Positive-gate precondition closeout gate should not define fixed workflows or fallback chains.',
);
assert.doesNotMatch(
  serializedCloseout,
  /implementationQueue|orderedSteps|runtimeAuthority|experimental-adapter/u,
  'Positive-gate precondition closeout gate should remain a blocked closeout gate.',
);

assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Positive-gate precondition closeout gate must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Positive-gate precondition closeout gate must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  closeoutGateSmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Positive-gate precondition closeout smoke should not call production v2 modules.',
);

assert.match(
  auditText,
  /agent-session-v3-runtime-boundary-production-wiring-positive-gate-precondition-closeout-gate-smoke\.ts/u,
);
assert.match(auditText, /all positive-gate preconditions remain blocked and closed/u);
assert.match(statusText, /V3 runtime boundary production wiring positive-gate precondition closeout gate.*Completed/u);
assert.match(
  statusText,
  /agent-session-v3-runtime-boundary-production-wiring-positive-gate-precondition-closeout-gate-smoke\.ts/u,
);
assert.match(statusText, /Overall practical runtime including v3: about 99\.2%/u);
assert.match(statusText, /v3 full runtime preflight\/pilot: about 99\.2%/u);

console.log('agent session v3 runtime boundary production wiring positive-gate precondition closeout gate smoke ok');
