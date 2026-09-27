import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

type PositiveGatePreconditionConsistencyInput =
  | 'adapter-pre-contract-audit'
  | 'controller-policy-pre-contract-closeout'
  | 'full-runtime-preflight-audit'
  | 'negative-gate-blocker-rollup'
  | 'negative-gate-consistency'
  | 'payload-closeout-final-preflight-gate'
  | 'phase-port-payload-pre-contract-closeout'
  | 'positive-gate-precondition-audit'
  | 'production-adapter-evidence-pre-contract-closeout'
  | 'runtime-boundary-contract'
  | 'stop-payload-final-pre-contract-closeout';

type PositiveGatePreconditionConsistencyBlocker =
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

type PositiveGatePreconditionConsistencyId =
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

interface PositiveGatePreconditionConsistencyRow {
  alignedWithNegativeGate: true;
  alignedWithPreconditionAudit: true;
  blockedBy: readonly PositiveGatePreconditionConsistencyBlocker[];
  consistencyStatus: 'blocked-and-aligned';
  inputEvidence: readonly PositiveGatePreconditionConsistencyInput[];
  preconditionId: PositiveGatePreconditionConsistencyId;
  productionAuthority: false;
  productionReady: false;
  readyForPositiveGate: false;
}

interface PositiveGatePreconditionConsistencyCheckpoint {
  gate: 'production-wiring-positive-gate-precondition-consistency';
  isProductionWiringPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly PositiveGatePreconditionConsistencyRow[];
}

const positiveGatePreconditionConsistencyCheckpoint = {
  gate: 'production-wiring-positive-gate-precondition-consistency',
  isProductionWiringPlan: false,
  positiveGateAllowed: false,
  productionAuthority: false,
  productionReady: false,
  rows: [
    {
      alignedWithNegativeGate: true,
      alignedWithPreconditionAudit: true,
      blockedBy: ['agent-session-v2-production-owner-retained'],
      consistencyStatus: 'blocked-and-aligned',
      inputEvidence: [
        'full-runtime-preflight-audit',
        'runtime-boundary-contract',
        'negative-gate-blocker-rollup',
        'negative-gate-consistency',
        'positive-gate-precondition-audit',
      ],
      preconditionId: 'formal-production-ownership-transfer',
      productionAuthority: false,
      productionReady: false,
      readyForPositiveGate: false,
    },
    {
      alignedWithNegativeGate: true,
      alignedWithPreconditionAudit: true,
      blockedBy: [
        'v3-pilot-shadow-debug-only',
        'agent-session-v2-production-owner-retained',
      ],
      consistencyStatus: 'blocked-and-aligned',
      inputEvidence: [
        'full-runtime-preflight-audit',
        'negative-gate-blocker-rollup',
        'negative-gate-consistency',
        'positive-gate-precondition-audit',
      ],
      preconditionId: 'non-debug-runtime-attachment',
      productionAuthority: false,
      productionReady: false,
      readyForPositiveGate: false,
    },
    {
      alignedWithNegativeGate: true,
      alignedWithPreconditionAudit: true,
      blockedBy: [
        'production-adapter-contracts-missing',
        'missing-real-or-production-like-traces',
      ],
      consistencyStatus: 'blocked-and-aligned',
      inputEvidence: [
        'adapter-pre-contract-audit',
        'production-adapter-evidence-pre-contract-closeout',
        'negative-gate-blocker-rollup',
        'negative-gate-consistency',
        'positive-gate-precondition-audit',
      ],
      preconditionId: 'production-adapter-contracts',
      productionAuthority: false,
      productionReady: false,
      readyForPositiveGate: false,
    },
    {
      alignedWithNegativeGate: true,
      alignedWithPreconditionAudit: true,
      blockedBy: [
        'controller-policy-contracts-missing',
        'broad-stop-payload-contract-promotion-blocked',
      ],
      consistencyStatus: 'blocked-and-aligned',
      inputEvidence: [
        'controller-policy-pre-contract-closeout',
        'stop-payload-final-pre-contract-closeout',
        'negative-gate-blocker-rollup',
        'negative-gate-consistency',
        'positive-gate-precondition-audit',
      ],
      preconditionId: 'controller-policy-contracts',
      productionAuthority: false,
      productionReady: false,
      readyForPositiveGate: false,
    },
    {
      alignedWithNegativeGate: true,
      alignedWithPreconditionAudit: true,
      blockedBy: [
        'broad-stop-payload-contract-promotion-blocked',
        'production-adapter-contracts-missing',
        'controller-policy-contracts-missing',
        'phase-port-payload-contracts-missing',
      ],
      consistencyStatus: 'blocked-and-aligned',
      inputEvidence: [
        'payload-closeout-final-preflight-gate',
        'stop-payload-final-pre-contract-closeout',
        'negative-gate-blocker-rollup',
        'negative-gate-consistency',
        'positive-gate-precondition-audit',
      ],
      preconditionId: 'broad-stop-payload-contracts',
      productionAuthority: false,
      productionReady: false,
      readyForPositiveGate: false,
    },
    {
      alignedWithNegativeGate: true,
      alignedWithPreconditionAudit: true,
      blockedBy: [
        'phase-port-payload-contracts-missing',
        'broad-stop-payload-contract-promotion-blocked',
      ],
      consistencyStatus: 'blocked-and-aligned',
      inputEvidence: [
        'phase-port-payload-pre-contract-closeout',
        'stop-payload-final-pre-contract-closeout',
        'negative-gate-blocker-rollup',
        'negative-gate-consistency',
        'positive-gate-precondition-audit',
      ],
      preconditionId: 'phase-port-payload-contracts',
      productionAuthority: false,
      productionReady: false,
      readyForPositiveGate: false,
    },
    {
      alignedWithNegativeGate: true,
      alignedWithPreconditionAudit: true,
      blockedBy: ['missing-real-or-production-like-traces'],
      consistencyStatus: 'blocked-and-aligned',
      inputEvidence: [
        'full-runtime-preflight-audit',
        'production-adapter-evidence-pre-contract-closeout',
        'stop-payload-final-pre-contract-closeout',
        'negative-gate-blocker-rollup',
        'negative-gate-consistency',
        'positive-gate-precondition-audit',
      ],
      preconditionId: 'real-production-like-trace-corpus',
      productionAuthority: false,
      productionReady: false,
      readyForPositiveGate: false,
    },
    {
      alignedWithNegativeGate: true,
      alignedWithPreconditionAudit: true,
      blockedBy: [
        'permission-routing-ownership-not-delegated',
        'controller-policy-contracts-missing',
      ],
      consistencyStatus: 'blocked-and-aligned',
      inputEvidence: [
        'adapter-pre-contract-audit',
        'controller-policy-pre-contract-closeout',
        'negative-gate-blocker-rollup',
        'negative-gate-consistency',
        'positive-gate-precondition-audit',
      ],
      preconditionId: 'permission-phase-adapter-contract',
      productionAuthority: false,
      productionReady: false,
      readyForPositiveGate: false,
    },
    {
      alignedWithNegativeGate: true,
      alignedWithPreconditionAudit: true,
      blockedBy: [
        'tool-execution-ownership-not-delegated',
        'production-adapter-contracts-missing',
      ],
      consistencyStatus: 'blocked-and-aligned',
      inputEvidence: [
        'adapter-pre-contract-audit',
        'production-adapter-evidence-pre-contract-closeout',
        'negative-gate-blocker-rollup',
        'negative-gate-consistency',
        'positive-gate-precondition-audit',
      ],
      preconditionId: 'transaction-phase-adapter-contract',
      productionAuthority: false,
      productionReady: false,
      readyForPositiveGate: false,
    },
    {
      alignedWithNegativeGate: true,
      alignedWithPreconditionAudit: true,
      blockedBy: [
        'runtime-action-order-not-owned-by-v3',
        'fixed-tool-chain-prohibited',
      ],
      consistencyStatus: 'blocked-and-aligned',
      inputEvidence: [
        'full-runtime-preflight-audit',
        'runtime-boundary-contract',
        'negative-gate-blocker-rollup',
        'negative-gate-consistency',
        'positive-gate-precondition-audit',
      ],
      preconditionId: 'controller-state-semantics',
      productionAuthority: false,
      productionReady: false,
      readyForPositiveGate: false,
    },
    {
      alignedWithNegativeGate: true,
      alignedWithPreconditionAudit: true,
      blockedBy: [
        'runtime-action-order-not-owned-by-v3',
        'fixed-tool-chain-prohibited',
      ],
      consistencyStatus: 'blocked-and-aligned',
      inputEvidence: [
        'full-runtime-preflight-audit',
        'runtime-boundary-contract',
        'negative-gate-blocker-rollup',
        'negative-gate-consistency',
        'positive-gate-precondition-audit',
      ],
      preconditionId: 'non-fixed-adapter-scheduling-contract',
      productionAuthority: false,
      productionReady: false,
      readyForPositiveGate: false,
    },
    {
      alignedWithNegativeGate: true,
      alignedWithPreconditionAudit: true,
      blockedBy: [
        'agent-session-v2-production-owner-retained',
        'v3-pilot-shadow-debug-only',
      ],
      consistencyStatus: 'blocked-and-aligned',
      inputEvidence: [
        'full-runtime-preflight-audit',
        'runtime-boundary-contract',
        'negative-gate-blocker-rollup',
        'negative-gate-consistency',
        'positive-gate-precondition-audit',
      ],
      preconditionId: 'experimental-authority-switch',
      productionAuthority: false,
      productionReady: false,
      readyForPositiveGate: false,
    },
  ],
} as const satisfies PositiveGatePreconditionConsistencyCheckpoint;

function rowsForBlocker(blocker: PositiveGatePreconditionConsistencyBlocker) {
  return positiveGatePreconditionConsistencyCheckpoint.rows.filter((row) => row.blockedBy.includes(blocker));
}

function rowById(preconditionId: PositiveGatePreconditionConsistencyId) {
  const row = positiveGatePreconditionConsistencyCheckpoint.rows.find((candidate) => (
    candidate.preconditionId === preconditionId
  ));
  assert.ok(row, `${preconditionId} should exist in the positive-gate precondition consistency checkpoint.`);
  return row;
}

function assertSourceContains(source: string, expected: string, label: string) {
  assert.match(source, new RegExp(expected, 'u'), `${label} should contain ${expected}.`);
}

const {
  adapterPreContractSmokeSource,
  auditText,
  boundarySource,
  consistencySmokeSource,
  controllerPolicyCloseoutSmokeSource,
  negativeGateConsistencySmokeSource,
  negativeGateSmokeSource,
  payloadFinalGateSmokeSource,
  phasePortCloseoutSmokeSource,
  preconditionAuditSmokeSource,
  productionAdapterCloseoutSmokeSource,
  statusText,
  stopPayloadFinalCloseoutSmokeSource,
} = readProjectSources({
  adapterPreContractSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-pre-contract-smoke.ts',
  auditText: 'PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md',
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  consistencySmokeSource:
    'scripts/agent-session-v3-runtime-boundary-production-wiring-positive-gate-precondition-consistency-checkpoint-smoke.ts',
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
  preconditionAuditSmokeSource:
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

assert.equal(positiveGatePreconditionConsistencyCheckpoint.productionAuthority, false);
assert.equal(positiveGatePreconditionConsistencyCheckpoint.productionReady, false);
assert.equal(positiveGatePreconditionConsistencyCheckpoint.positiveGateAllowed, false);
assert.equal(positiveGatePreconditionConsistencyCheckpoint.isProductionWiringPlan, false);

assert.deepEqual(
  positiveGatePreconditionConsistencyCheckpoint.rows.map((row) => row.preconditionId).sort(),
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

for (const row of positiveGatePreconditionConsistencyCheckpoint.rows) {
  assert.equal(row.alignedWithNegativeGate, true);
  assert.equal(row.alignedWithPreconditionAudit, true);
  assert.equal(row.consistencyStatus, 'blocked-and-aligned');
  assert.equal(row.productionAuthority, false);
  assert.equal(row.productionReady, false);
  assert.equal(row.readyForPositiveGate, false);
  assert.ok(row.inputEvidence.includes('positive-gate-precondition-audit'));
  assert.ok(row.inputEvidence.includes('negative-gate-blocker-rollup'));
  assert.ok(row.inputEvidence.includes('negative-gate-consistency'));
  assert.ok(row.blockedBy.length > 0);

  assertSourceContains(preconditionAuditSmokeSource, row.preconditionId, 'positive-gate precondition audit smoke');

  for (const blocker of row.blockedBy) {
    assertSourceContains(preconditionAuditSmokeSource, blocker, 'positive-gate precondition audit smoke');
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
] as const satisfies readonly PositiveGatePreconditionConsistencyBlocker[]) {
  assert.ok(rowsForBlocker(blocker).length > 0, `${blocker} should remain represented in the consistency checkpoint.`);
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
assert.match(auditText, /all positive-gate preconditions remain blocked/u);
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

const serializedCheckpoint = JSON.stringify(positiveGatePreconditionConsistencyCheckpoint);
assert.doesNotMatch(
  serializedCheckpoint,
  /productionAuthority":true|productionReady":true|positiveGateAllowed":true|readyForPositiveGate":true/u,
  'Positive-gate precondition consistency checkpoint must not open a positive gate or grant runtime authority.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /isProductionWiringPlan":true|decision":"ready-for-production-wiring/u,
  'Positive-gate precondition consistency checkpoint must not become a production wiring plan.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /adapterContractPromotionAllowed|payloadContractPromotionAllowed|formalPolicyContractReady|formalContractReady/u,
  'Positive-gate precondition consistency checkpoint should not promote payload, adapter, or controller contracts.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Positive-gate precondition consistency checkpoint should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Positive-gate precondition consistency checkpoint should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain/iu,
  'Positive-gate precondition consistency checkpoint should not define fixed workflows or fallback chains.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /implementationQueue|orderedSteps|runtimeAuthority|experimental-adapter/u,
  'Positive-gate precondition consistency checkpoint should remain a consistency audit.',
);

assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Positive-gate precondition consistency checkpoint must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Positive-gate precondition consistency checkpoint must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  consistencySmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Positive-gate precondition consistency smoke should not call production v2 modules.',
);

assert.match(auditText, /Production Wiring Positive-Gate Precondition Consistency Checkpoint Status/u);
assert.match(
  auditText,
  /agent-session-v3-runtime-boundary-production-wiring-positive-gate-precondition-consistency-checkpoint-smoke\.ts/u,
);
assert.match(auditText, /positive-gate preconditions remain blocked and aligned/u);
assert.match(auditText, /consistency evidence, not a production wiring plan/u);
assert.match(statusText, /V3 runtime boundary production wiring positive-gate precondition consistency checkpoint.*Completed/u);
assert.match(
  statusText,
  /agent-session-v3-runtime-boundary-production-wiring-positive-gate-precondition-consistency-checkpoint-smoke\.ts/u,
);

console.log('agent session v3 runtime boundary production wiring positive-gate precondition consistency checkpoint smoke ok');
