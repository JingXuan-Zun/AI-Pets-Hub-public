import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { readProjectFile } from './smokeTestHarness.ts';

type ProductionWiringNegativeGateConsistencyInput =
  | 'adapter-pre-contract-audit'
  | 'controller-policy-pre-contract-closeout'
  | 'full-runtime-preflight-audit'
  | 'negative-gate-blocker-rollup'
  | 'payload-closeout-final-preflight-gate'
  | 'phase-port-payload-pre-contract-closeout'
  | 'production-adapter-evidence-pre-contract-closeout'
  | 'runtime-boundary-contract'
  | 'stop-payload-final-pre-contract-closeout';

type ProductionWiringNegativeGateConsistencySignal =
  | 'adapter-contracts-deferred'
  | 'agent-session-v2-production-owner-retained'
  | 'broad-stop-payload-promotion-blocked'
  | 'controller-policy-contracts-deferred'
  | 'evidence-adapters-remain-observers'
  | 'fixed-tool-chain-prohibited'
  | 'future-seams-not-production-runtime'
  | 'permission-routing-not-delegated'
  | 'phase-port-payload-contracts-deferred'
  | 'production-like-traces-missing'
  | 'runtime-action-order-not-owned-by-v3'
  | 'tool-execution-not-delegated'
  | 'v3-pilot-shadow-debug-only';

type ProductionWiringNegativeGateConsistencyBlocker =
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

interface ProductionWiringNegativeGateConsistencyRow {
  aligned: true;
  blockers: readonly ProductionWiringNegativeGateConsistencyBlocker[];
  decision: 'keep-negative-gate';
  inputs: readonly ProductionWiringNegativeGateConsistencyInput[];
  productionAuthority: false;
  productionReady: false;
  signal: ProductionWiringNegativeGateConsistencySignal;
}

interface ProductionWiringNegativeGateConsistencyCheckpoint {
  gate: 'production-wiring-negative-gate-consistency';
  isProductionWiringPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly ProductionWiringNegativeGateConsistencyRow[];
}

const productionWiringNegativeGateConsistencyCheckpoint = {
  gate: 'production-wiring-negative-gate-consistency',
  isProductionWiringPlan: false,
  positiveGateAllowed: false,
  productionAuthority: false,
  productionReady: false,
  rows: [
    {
      aligned: true,
      blockers: ['agent-session-v2-production-owner-retained'],
      decision: 'keep-negative-gate',
      inputs: [
        'full-runtime-preflight-audit',
        'runtime-boundary-contract',
        'negative-gate-blocker-rollup',
      ],
      productionAuthority: false,
      productionReady: false,
      signal: 'agent-session-v2-production-owner-retained',
    },
    {
      aligned: true,
      blockers: ['v3-pilot-shadow-debug-only'],
      decision: 'keep-negative-gate',
      inputs: [
        'full-runtime-preflight-audit',
        'negative-gate-blocker-rollup',
      ],
      productionAuthority: false,
      productionReady: false,
      signal: 'v3-pilot-shadow-debug-only',
    },
    {
      aligned: true,
      blockers: ['agent-session-v2-production-owner-retained'],
      decision: 'keep-negative-gate',
      inputs: [
        'full-runtime-preflight-audit',
        'negative-gate-blocker-rollup',
      ],
      productionAuthority: false,
      productionReady: false,
      signal: 'evidence-adapters-remain-observers',
    },
    {
      aligned: true,
      blockers: ['agent-session-v2-production-owner-retained'],
      decision: 'keep-negative-gate',
      inputs: [
        'full-runtime-preflight-audit',
        'runtime-boundary-contract',
        'negative-gate-blocker-rollup',
      ],
      productionAuthority: false,
      productionReady: false,
      signal: 'future-seams-not-production-runtime',
    },
    {
      aligned: true,
      blockers: [
        'production-adapter-contracts-missing',
        'missing-real-or-production-like-traces',
      ],
      decision: 'keep-negative-gate',
      inputs: [
        'adapter-pre-contract-audit',
        'production-adapter-evidence-pre-contract-closeout',
        'negative-gate-blocker-rollup',
      ],
      productionAuthority: false,
      productionReady: false,
      signal: 'adapter-contracts-deferred',
    },
    {
      aligned: true,
      blockers: [
        'controller-policy-contracts-missing',
        'broad-stop-payload-contract-promotion-blocked',
      ],
      decision: 'keep-negative-gate',
      inputs: [
        'controller-policy-pre-contract-closeout',
        'stop-payload-final-pre-contract-closeout',
        'negative-gate-blocker-rollup',
      ],
      productionAuthority: false,
      productionReady: false,
      signal: 'controller-policy-contracts-deferred',
    },
    {
      aligned: true,
      blockers: [
        'broad-stop-payload-contract-promotion-blocked',
      ],
      decision: 'keep-negative-gate',
      inputs: [
        'payload-closeout-final-preflight-gate',
        'stop-payload-final-pre-contract-closeout',
        'negative-gate-blocker-rollup',
      ],
      productionAuthority: false,
      productionReady: false,
      signal: 'broad-stop-payload-promotion-blocked',
    },
    {
      aligned: true,
      blockers: [
        'phase-port-payload-contracts-missing',
        'broad-stop-payload-contract-promotion-blocked',
      ],
      decision: 'keep-negative-gate',
      inputs: [
        'phase-port-payload-pre-contract-closeout',
        'stop-payload-final-pre-contract-closeout',
        'negative-gate-blocker-rollup',
      ],
      productionAuthority: false,
      productionReady: false,
      signal: 'phase-port-payload-contracts-deferred',
    },
    {
      aligned: true,
      blockers: [
        'missing-real-or-production-like-traces',
      ],
      decision: 'keep-negative-gate',
      inputs: [
        'full-runtime-preflight-audit',
        'production-adapter-evidence-pre-contract-closeout',
        'stop-payload-final-pre-contract-closeout',
        'negative-gate-blocker-rollup',
      ],
      productionAuthority: false,
      productionReady: false,
      signal: 'production-like-traces-missing',
    },
    {
      aligned: true,
      blockers: [
        'permission-routing-ownership-not-delegated',
        'controller-policy-contracts-missing',
      ],
      decision: 'keep-negative-gate',
      inputs: [
        'adapter-pre-contract-audit',
        'controller-policy-pre-contract-closeout',
        'negative-gate-blocker-rollup',
      ],
      productionAuthority: false,
      productionReady: false,
      signal: 'permission-routing-not-delegated',
    },
    {
      aligned: true,
      blockers: [
        'tool-execution-ownership-not-delegated',
        'production-adapter-contracts-missing',
      ],
      decision: 'keep-negative-gate',
      inputs: [
        'adapter-pre-contract-audit',
        'production-adapter-evidence-pre-contract-closeout',
        'negative-gate-blocker-rollup',
      ],
      productionAuthority: false,
      productionReady: false,
      signal: 'tool-execution-not-delegated',
    },
    {
      aligned: true,
      blockers: [
        'runtime-action-order-not-owned-by-v3',
      ],
      decision: 'keep-negative-gate',
      inputs: [
        'full-runtime-preflight-audit',
        'runtime-boundary-contract',
        'negative-gate-blocker-rollup',
      ],
      productionAuthority: false,
      productionReady: false,
      signal: 'runtime-action-order-not-owned-by-v3',
    },
    {
      aligned: true,
      blockers: [
        'fixed-tool-chain-prohibited',
      ],
      decision: 'keep-negative-gate',
      inputs: [
        'full-runtime-preflight-audit',
        'runtime-boundary-contract',
        'negative-gate-blocker-rollup',
      ],
      productionAuthority: false,
      productionReady: false,
      signal: 'fixed-tool-chain-prohibited',
    },
  ],
} as const satisfies ProductionWiringNegativeGateConsistencyCheckpoint;

function rowForSignal(signal: ProductionWiringNegativeGateConsistencySignal) {
  const row = productionWiringNegativeGateConsistencyCheckpoint.rows.find((candidate) => candidate.signal === signal);
  assert.ok(row, `${signal} should exist in the production wiring negative gate consistency checkpoint.`);
  return row;
}

function assertRollupContainsBlocker(
  rollupSource: string,
  blocker: ProductionWiringNegativeGateConsistencyBlocker,
) {
  assert.match(rollupSource, new RegExp(blocker, 'u'), `Negative gate rollup should include ${blocker}.`);
}

const auditText = readProjectFile('PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md');
const statusText = readProjectFile('PROJECT_AGENT_V2_STATUS.md');
const boundarySource = readProjectFile('src/agent/agentSessionV3RuntimeBoundary.ts');
const negativeGateSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-production-wiring-negative-gate-blocker-rollup-checkpoint-smoke.ts',
);
const consistencySmokeSource = readProjectFile(
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

assert.equal(productionWiringNegativeGateConsistencyCheckpoint.productionAuthority, false);
assert.equal(productionWiringNegativeGateConsistencyCheckpoint.productionReady, false);
assert.equal(productionWiringNegativeGateConsistencyCheckpoint.positiveGateAllowed, false);
assert.equal(productionWiringNegativeGateConsistencyCheckpoint.isProductionWiringPlan, false);

assert.deepEqual(
  productionWiringNegativeGateConsistencyCheckpoint.rows.map((row) => row.signal).sort(),
  [
    'adapter-contracts-deferred',
    'agent-session-v2-production-owner-retained',
    'broad-stop-payload-promotion-blocked',
    'controller-policy-contracts-deferred',
    'evidence-adapters-remain-observers',
    'fixed-tool-chain-prohibited',
    'future-seams-not-production-runtime',
    'permission-routing-not-delegated',
    'phase-port-payload-contracts-deferred',
    'production-like-traces-missing',
    'runtime-action-order-not-owned-by-v3',
    'tool-execution-not-delegated',
    'v3-pilot-shadow-debug-only',
  ],
);

for (const row of productionWiringNegativeGateConsistencyCheckpoint.rows) {
  assert.equal(row.aligned, true);
  assert.equal(row.decision, 'keep-negative-gate');
  assert.equal(row.productionAuthority, false);
  assert.equal(row.productionReady, false);
  assert.ok(row.inputs.includes('negative-gate-blocker-rollup'));
  assert.ok(row.blockers.length > 0);

  for (const blocker of row.blockers) {
    assertRollupContainsBlocker(negativeGateSmokeSource, blocker);
  }
}

assert.match(auditText, /This means the v3 experimental runtime is now the staged configured default/u);
assert.match(auditText, /v2 remains an explicit fallback route and selectable runtime mode/u);
assert.match(auditText, /RunAgentSessionV2Options\.v3PilotShadow/u);
assert.match(auditText, /Do not make v3 replace `AgentSessionV2` yet/u);
assert.match(auditText, /Do not let evidence adapters choose tools, route permissions, execute tools, or decide recovery/u);
assert.match(auditText, /current evidence adapters remain evidence adapters/u);
assert.match(auditText, /future runtime seam candidates, not production runtime/u);
assert.match(auditText, /fixed tool chains remain prohibited/u);
assert.match(boundarySource, /productionAuthority: false/u);
assert.match(boundarySource, /AgentSessionV2 remains the production orchestrator/u);
assert.match(boundarySource, /no required ordered tool workflow/u);
assert.match(negativeGateSmokeSource, /blocked-before-production-wiring/u);
assert.match(negativeGateSmokeSource, /isProductionWiringPlan: false/u);

assert.match(adapterPreContractSmokeSource, /AgentSessionV2 remains production owner/u);
assert.match(adapterPreContractSmokeSource, /agentPermissionRouter\.ts/u);
assert.match(adapterPreContractSmokeSource, /agentRuntimeExecutor\.ts/u);
assert.match(adapterPreContractSmokeSource, /side-effect commit boundary/u);
assert.match(productionAdapterCloseoutSmokeSource, /adapter contracts remain deferred/u);
assert.match(productionAdapterCloseoutSmokeSource, /future-production-adapter-evidence-missing/u);
assert.match(controllerPolicyCloseoutSmokeSource, /controller-policy fields remain smoke-only/u);
assert.match(controllerPolicyCloseoutSmokeSource, /requires-controller-policy-contract/u);
assert.match(payloadFinalGateSmokeSource, /payload-contract promotion is not allowed now/u);
assert.match(phasePortCloseoutSmokeSource, /phase-port payload side is internally covered but still pre-contract only/u);
assert.match(stopPayloadFinalCloseoutSmokeSource, /broad stop-payload contract promotion remains blocked/u);
assert.match(stopPayloadFinalCloseoutSmokeSource, /missing-real-or-production-like-traces/u);

assert.ok(rowForSignal('agent-session-v2-production-owner-retained').inputs.includes('runtime-boundary-contract'));
assert.ok(rowForSignal('v3-pilot-shadow-debug-only').inputs.includes('full-runtime-preflight-audit'));
assert.ok(rowForSignal('adapter-contracts-deferred').inputs.includes('production-adapter-evidence-pre-contract-closeout'));
assert.ok(rowForSignal('controller-policy-contracts-deferred').inputs.includes('controller-policy-pre-contract-closeout'));
assert.ok(rowForSignal('phase-port-payload-contracts-deferred').inputs.includes('phase-port-payload-pre-contract-closeout'));
assert.ok(rowForSignal('production-like-traces-missing').inputs.includes('stop-payload-final-pre-contract-closeout'));
assert.ok(rowForSignal('permission-routing-not-delegated').inputs.includes('adapter-pre-contract-audit'));
assert.ok(rowForSignal('tool-execution-not-delegated').inputs.includes('adapter-pre-contract-audit'));
assert.ok(rowForSignal('runtime-action-order-not-owned-by-v3').inputs.includes('runtime-boundary-contract'));
assert.ok(rowForSignal('fixed-tool-chain-prohibited').inputs.includes('runtime-boundary-contract'));

const serializedCheckpoint = JSON.stringify(productionWiringNegativeGateConsistencyCheckpoint);
assert.doesNotMatch(
  serializedCheckpoint,
  /productionAuthority":true|productionReady":true|positiveGateAllowed":true|isProductionWiringPlan":true/u,
  'Production wiring negative gate consistency checkpoint must not grant runtime authority or open a positive gate.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /adapterContractPromotionAllowed|payloadContractPromotionAllowed|formalPolicyContractReady|formalContractReady/u,
  'Production wiring negative gate consistency checkpoint should not promote payload, adapter, or controller contracts.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Production wiring negative gate consistency checkpoint should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Production wiring negative gate consistency checkpoint should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain/iu,
  'Production wiring negative gate consistency checkpoint should not define fixed workflows or fallback chains.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /implementationQueue|orderedSteps|runtimeAuthority|experimental-adapter/u,
  'Production wiring negative gate consistency checkpoint should remain a consistency audit, not a production wiring plan.',
);

assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Production wiring negative gate consistency checkpoint must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Production wiring negative gate consistency checkpoint must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  consistencySmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Production wiring negative gate consistency smoke should not call production v2 modules.',
);

assert.match(auditText, /Production Wiring Negative Gate Consistency Checkpoint Status/u);
assert.match(
  auditText,
  /agent-session-v3-runtime-boundary-production-wiring-negative-gate-consistency-checkpoint-smoke\.ts/u,
);
assert.match(auditText, /negative gate remains aligned with its upstream evidence/u);
assert.match(auditText, /consistency evidence, not a production wiring plan/u);
assert.match(statusText, /V3 runtime boundary production wiring negative gate consistency checkpoint.*Completed/u);
assert.match(
  statusText,
  /agent-session-v3-runtime-boundary-production-wiring-negative-gate-consistency-checkpoint-smoke\.ts/u,
);

console.log('agent session v3 runtime boundary production wiring negative gate consistency checkpoint smoke ok');
