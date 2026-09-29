import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

type ProductionWiringPositiveGatePreconditionInput =
  | 'adapter-pre-contract-audit'
  | 'controller-policy-pre-contract-closeout'
  | 'full-runtime-preflight-audit'
  | 'negative-gate-blocker-rollup'
  | 'negative-gate-consistency'
  | 'payload-closeout-final-preflight-gate'
  | 'phase-port-payload-pre-contract-closeout'
  | 'production-adapter-evidence-pre-contract-closeout'
  | 'runtime-boundary-contract'
  | 'stop-payload-final-pre-contract-closeout';

type ProductionWiringPositiveGatePreconditionArea =
  | 'adapter-contract'
  | 'attachment'
  | 'controller-policy'
  | 'evidence'
  | 'ownership'
  | 'permission'
  | 'runtime-control'
  | 'stop-payload'
  | 'tool-transaction';

type ProductionWiringPositiveGateBlockedBy =
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

interface ProductionWiringPositiveGatePreconditionRow {
  area: ProductionWiringPositiveGatePreconditionArea;
  blockedBy: readonly ProductionWiringPositiveGateBlockedBy[];
  currentStatus: 'blocked';
  inputEvidence: readonly ProductionWiringPositiveGatePreconditionInput[];
  preconditionId:
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
  productionAuthority: false;
  productionReady: false;
  readyForPositiveGate: false;
}

interface ProductionWiringPositiveGatePreconditionAudit {
  gate: 'production-wiring-positive-gate-precondition-audit';
  isProductionWiringPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly ProductionWiringPositiveGatePreconditionRow[];
}

const productionWiringPositiveGatePreconditionAudit = {
  gate: 'production-wiring-positive-gate-precondition-audit',
  isProductionWiringPlan: false,
  positiveGateAllowed: false,
  productionAuthority: false,
  productionReady: false,
  rows: [
    {
      area: 'ownership',
      blockedBy: ['agent-session-v2-production-owner-retained'],
      currentStatus: 'blocked',
      inputEvidence: [
        'full-runtime-preflight-audit',
        'runtime-boundary-contract',
        'negative-gate-blocker-rollup',
        'negative-gate-consistency',
      ],
      preconditionId: 'formal-production-ownership-transfer',
      productionAuthority: false,
      productionReady: false,
      readyForPositiveGate: false,
    },
    {
      area: 'attachment',
      blockedBy: [
        'v3-pilot-shadow-debug-only',
        'agent-session-v2-production-owner-retained',
      ],
      currentStatus: 'blocked',
      inputEvidence: [
        'full-runtime-preflight-audit',
        'negative-gate-blocker-rollup',
        'negative-gate-consistency',
      ],
      preconditionId: 'non-debug-runtime-attachment',
      productionAuthority: false,
      productionReady: false,
      readyForPositiveGate: false,
    },
    {
      area: 'adapter-contract',
      blockedBy: [
        'production-adapter-contracts-missing',
        'missing-real-or-production-like-traces',
      ],
      currentStatus: 'blocked',
      inputEvidence: [
        'adapter-pre-contract-audit',
        'production-adapter-evidence-pre-contract-closeout',
        'negative-gate-blocker-rollup',
        'negative-gate-consistency',
      ],
      preconditionId: 'production-adapter-contracts',
      productionAuthority: false,
      productionReady: false,
      readyForPositiveGate: false,
    },
    {
      area: 'controller-policy',
      blockedBy: [
        'controller-policy-contracts-missing',
        'broad-stop-payload-contract-promotion-blocked',
      ],
      currentStatus: 'blocked',
      inputEvidence: [
        'controller-policy-pre-contract-closeout',
        'stop-payload-final-pre-contract-closeout',
        'negative-gate-blocker-rollup',
        'negative-gate-consistency',
      ],
      preconditionId: 'controller-policy-contracts',
      productionAuthority: false,
      productionReady: false,
      readyForPositiveGate: false,
    },
    {
      area: 'stop-payload',
      blockedBy: [
        'broad-stop-payload-contract-promotion-blocked',
        'production-adapter-contracts-missing',
        'controller-policy-contracts-missing',
        'phase-port-payload-contracts-missing',
      ],
      currentStatus: 'blocked',
      inputEvidence: [
        'payload-closeout-final-preflight-gate',
        'stop-payload-final-pre-contract-closeout',
        'negative-gate-blocker-rollup',
        'negative-gate-consistency',
      ],
      preconditionId: 'broad-stop-payload-contracts',
      productionAuthority: false,
      productionReady: false,
      readyForPositiveGate: false,
    },
    {
      area: 'stop-payload',
      blockedBy: [
        'phase-port-payload-contracts-missing',
        'broad-stop-payload-contract-promotion-blocked',
      ],
      currentStatus: 'blocked',
      inputEvidence: [
        'phase-port-payload-pre-contract-closeout',
        'stop-payload-final-pre-contract-closeout',
        'negative-gate-blocker-rollup',
        'negative-gate-consistency',
      ],
      preconditionId: 'phase-port-payload-contracts',
      productionAuthority: false,
      productionReady: false,
      readyForPositiveGate: false,
    },
    {
      area: 'evidence',
      blockedBy: ['missing-real-or-production-like-traces'],
      currentStatus: 'blocked',
      inputEvidence: [
        'full-runtime-preflight-audit',
        'production-adapter-evidence-pre-contract-closeout',
        'stop-payload-final-pre-contract-closeout',
        'negative-gate-blocker-rollup',
        'negative-gate-consistency',
      ],
      preconditionId: 'real-production-like-trace-corpus',
      productionAuthority: false,
      productionReady: false,
      readyForPositiveGate: false,
    },
    {
      area: 'permission',
      blockedBy: [
        'permission-routing-ownership-not-delegated',
        'controller-policy-contracts-missing',
      ],
      currentStatus: 'blocked',
      inputEvidence: [
        'adapter-pre-contract-audit',
        'controller-policy-pre-contract-closeout',
        'negative-gate-blocker-rollup',
        'negative-gate-consistency',
      ],
      preconditionId: 'permission-phase-adapter-contract',
      productionAuthority: false,
      productionReady: false,
      readyForPositiveGate: false,
    },
    {
      area: 'tool-transaction',
      blockedBy: [
        'tool-execution-ownership-not-delegated',
        'production-adapter-contracts-missing',
      ],
      currentStatus: 'blocked',
      inputEvidence: [
        'adapter-pre-contract-audit',
        'production-adapter-evidence-pre-contract-closeout',
        'negative-gate-blocker-rollup',
        'negative-gate-consistency',
      ],
      preconditionId: 'transaction-phase-adapter-contract',
      productionAuthority: false,
      productionReady: false,
      readyForPositiveGate: false,
    },
    {
      area: 'runtime-control',
      blockedBy: [
        'runtime-action-order-not-owned-by-v3',
        'fixed-tool-chain-prohibited',
      ],
      currentStatus: 'blocked',
      inputEvidence: [
        'full-runtime-preflight-audit',
        'runtime-boundary-contract',
        'negative-gate-blocker-rollup',
        'negative-gate-consistency',
      ],
      preconditionId: 'controller-state-semantics',
      productionAuthority: false,
      productionReady: false,
      readyForPositiveGate: false,
    },
    {
      area: 'runtime-control',
      blockedBy: [
        'runtime-action-order-not-owned-by-v3',
        'fixed-tool-chain-prohibited',
      ],
      currentStatus: 'blocked',
      inputEvidence: [
        'full-runtime-preflight-audit',
        'runtime-boundary-contract',
        'negative-gate-blocker-rollup',
        'negative-gate-consistency',
      ],
      preconditionId: 'non-fixed-adapter-scheduling-contract',
      productionAuthority: false,
      productionReady: false,
      readyForPositiveGate: false,
    },
    {
      area: 'runtime-control',
      blockedBy: [
        'agent-session-v2-production-owner-retained',
        'v3-pilot-shadow-debug-only',
      ],
      currentStatus: 'blocked',
      inputEvidence: [
        'full-runtime-preflight-audit',
        'runtime-boundary-contract',
        'negative-gate-blocker-rollup',
        'negative-gate-consistency',
      ],
      preconditionId: 'experimental-authority-switch',
      productionAuthority: false,
      productionReady: false,
      readyForPositiveGate: false,
    },
  ],
} as const satisfies ProductionWiringPositiveGatePreconditionAudit;

function rowsForBlocker(blocker: ProductionWiringPositiveGateBlockedBy) {
  return productionWiringPositiveGatePreconditionAudit.rows.filter((row) => row.blockedBy.includes(blocker));
}

function rowById(preconditionId: ProductionWiringPositiveGatePreconditionRow['preconditionId']) {
  const row = productionWiringPositiveGatePreconditionAudit.rows.find((candidate) => (
    candidate.preconditionId === preconditionId
  ));
  assert.ok(row, `${preconditionId} should exist in the positive-gate precondition audit.`);
  return row;
}

const {
  adapterPreContractSmokeSource,
  auditText,
  boundarySource,
  controllerPolicyCloseoutSmokeSource,
  negativeGateConsistencySmokeSource,
  negativeGateSmokeSource,
  payloadFinalGateSmokeSource,
  phasePortCloseoutSmokeSource,
  preconditionSmokeSource,
  productionAdapterCloseoutSmokeSource,
  statusText,
  stopPayloadFinalCloseoutSmokeSource,
} = readProjectSources({
  adapterPreContractSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-pre-contract-smoke.ts',
  auditText: 'PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md',
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  controllerPolicyCloseoutSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-controller-policy-pre-contract-closeout-checkpoint-smoke.ts',
  negativeGateConsistencySmokeSource:
    'scripts/agent-session-v3-runtime-boundary-production-wiring-negative-gate-consistency-checkpoint-smoke.ts',
  negativeGateSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-production-wiring-negative-gate-blocker-rollup-checkpoint-smoke.ts',
  payloadFinalGateSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-payload-closeout-final-preflight-gate-smoke.ts',
  phasePortCloseoutSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-phase-port-payload-pre-contract-closeout-checkpoint-smoke.ts',
  preconditionSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-production-wiring-positive-gate-precondition-audit-smoke.ts',
  productionAdapterCloseoutSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-production-adapter-evidence-pre-contract-closeout-checkpoint-smoke.ts',
  statusText: 'PROJECT_AGENT_V2_STATUS.md',
  stopPayloadFinalCloseoutSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-stop-payload-final-pre-contract-closeout-alignment-checkpoint-smoke.ts',
});

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');
assert.equal(boundaryContract.mode, 'contract-only');

assert.equal(productionWiringPositiveGatePreconditionAudit.productionAuthority, false);
assert.equal(productionWiringPositiveGatePreconditionAudit.productionReady, false);
assert.equal(productionWiringPositiveGatePreconditionAudit.positiveGateAllowed, false);
assert.equal(productionWiringPositiveGatePreconditionAudit.isProductionWiringPlan, false);

assert.deepEqual(
  productionWiringPositiveGatePreconditionAudit.rows.map((row) => row.preconditionId).sort(),
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

for (const row of productionWiringPositiveGatePreconditionAudit.rows) {
  assert.equal(row.currentStatus, 'blocked');
  assert.equal(row.productionAuthority, false);
  assert.equal(row.productionReady, false);
  assert.equal(row.readyForPositiveGate, false);
  assert.ok(row.inputEvidence.includes('negative-gate-blocker-rollup'));
  assert.ok(row.inputEvidence.includes('negative-gate-consistency'));
  assert.ok(row.blockedBy.length > 0);
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
] as const satisfies readonly ProductionWiringPositiveGateBlockedBy[]) {
  assert.ok(rowsForBlocker(blocker).length > 0, `${blocker} should block at least one positive-gate precondition.`);
  assert.match(negativeGateSmokeSource, new RegExp(blocker, 'u'));
  assert.match(negativeGateConsistencySmokeSource, new RegExp(blocker, 'u'));
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

assert.match(auditText, /Production Wiring Negative Gate Consistency Checkpoint Status/u);
assert.match(auditText, /positive production-wiring gate can be considered/u);
assert.match(auditText, /blocked precondition list, not a production wiring plan/u);
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

const serializedAudit = JSON.stringify(productionWiringPositiveGatePreconditionAudit);
assert.doesNotMatch(
  serializedAudit,
  /productionAuthority":true|productionReady":true|positiveGateAllowed":true|readyForPositiveGate":true/u,
  'Positive-gate precondition audit must not open a positive gate or grant runtime authority.',
);
assert.doesNotMatch(
  serializedAudit,
  /isProductionWiringPlan":true|decision":"ready-for-production-wiring/u,
  'Positive-gate precondition audit must not become a production wiring plan.',
);
assert.doesNotMatch(
  serializedAudit,
  /adapterContractPromotionAllowed|payloadContractPromotionAllowed|formalPolicyContractReady|formalContractReady/u,
  'Positive-gate precondition audit should not promote payload, adapter, or controller contracts.',
);
assert.doesNotMatch(
  serializedAudit,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Positive-gate precondition audit should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedAudit,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Positive-gate precondition audit should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedAudit,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain/iu,
  'Positive-gate precondition audit should not define fixed workflows or fallback chains.',
);
assert.doesNotMatch(
  serializedAudit,
  /implementationQueue|orderedSteps|runtimeAuthority|experimental-adapter/u,
  'Positive-gate precondition audit should remain a blocked precondition list.',
);

assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Positive-gate precondition audit must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Positive-gate precondition audit must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  preconditionSmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Positive-gate precondition smoke should not call production v2 modules.',
);

assert.match(auditText, /Production Wiring Positive-Gate Precondition Audit Status/u);
assert.match(
  auditText,
  /agent-session-v3-runtime-boundary-production-wiring-positive-gate-precondition-audit-smoke\.ts/u,
);
assert.match(auditText, /all positive-gate preconditions remain blocked/u);
assert.match(auditText, /blocked precondition list, not a production wiring plan/u);
assert.match(statusText, /V3 runtime boundary production wiring positive-gate precondition audit.*Completed/u);
assert.match(
  statusText,
  /agent-session-v3-runtime-boundary-production-wiring-positive-gate-precondition-audit-smoke\.ts/u,
);

console.log('agent session v3 runtime boundary production wiring positive-gate precondition audit smoke ok');
