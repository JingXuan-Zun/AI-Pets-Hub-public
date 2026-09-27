import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

type ProductionWiringNegativeGateInput =
  | 'adapter-pre-contract-audit'
  | 'controller-policy-pre-contract-closeout'
  | 'full-runtime-preflight-audit'
  | 'payload-closeout-final-preflight-gate'
  | 'phase-port-payload-pre-contract-closeout'
  | 'production-adapter-evidence-pre-contract-closeout'
  | 'runtime-boundary-contract'
  | 'stop-payload-final-pre-contract-closeout';

type ProductionWiringNegativeGateArea =
  | 'adapter-contracts'
  | 'controller-policy'
  | 'debug-attachment'
  | 'permission-routing'
  | 'production-evidence'
  | 'production-owner'
  | 'runtime-order'
  | 'stop-payload'
  | 'tool-execution';

type ProductionWiringNegativeGateBlocker =
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

interface ProductionWiringNegativeGateRow {
  area: ProductionWiringNegativeGateArea;
  blockers: readonly ProductionWiringNegativeGateBlocker[];
  currentProductionOwner: 'AgentSessionV2' | 'existing-v2-module' | 'none-yet';
  decision: 'blocked-before-production-wiring';
  inputs: readonly ProductionWiringNegativeGateInput[];
  productionAuthority: false;
  productionReady: false;
  requiredBeforePositiveGate: readonly string[];
}

interface RuntimeBoundaryAttachmentClassification {
  canReceiveProductionAuthorityNow: false;
  classification: 'evidence-adapter' | 'future-runtime-seam-candidate';
  moduleName: string;
  reason: string;
}

interface ProductionWiringNegativeGateBlockerRollupCheckpoint {
  attachmentClassifications: readonly RuntimeBoundaryAttachmentClassification[];
  gate: 'production-wiring-negative-gate-blocker-rollup';
  isProductionWiringPlan: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly ProductionWiringNegativeGateRow[];
}

const productionWiringNegativeGateBlockerRollupCheckpoint = {
  attachmentClassifications: [
    {
      canReceiveProductionAuthorityNow: false,
      classification: 'evidence-adapter',
      moduleName: 'agentSessionV3PilotShadowInputCollector.ts',
      reason: 'Samples already produced AgentSessionV2 outcomes and translates them into pilot events.',
    },
    {
      canReceiveProductionAuthorityNow: false,
      classification: 'evidence-adapter',
      moduleName: 'agentSessionV3PilotEventAdapters.ts',
      reason: 'Maps completed v2 outcome objects into replayable pilot events.',
    },
    {
      canReceiveProductionAuthorityNow: false,
      classification: 'evidence-adapter',
      moduleName: 'agentSessionV3PilotShadowMode.ts',
      reason: 'Runs explicit debug shadow event lists without command, permission, or execution ports.',
    },
    {
      canReceiveProductionAuthorityNow: false,
      classification: 'evidence-adapter',
      moduleName: 'agentSessionV3PilotShadowAgreement.ts',
      reason: 'Compares completed result status with attached debug shadow output.',
    },
    {
      canReceiveProductionAuthorityNow: false,
      classification: 'future-runtime-seam-candidate',
      moduleName: 'agentSessionV3PilotStateMachine.ts',
      reason: 'Owns phase transition mechanics, but not production policy, permissions, or execution.',
    },
    {
      canReceiveProductionAuthorityNow: false,
      classification: 'future-runtime-seam-candidate',
      moduleName: 'agentSessionV3PilotRunner.ts',
      reason: 'Owns injected-event loop mechanics, but not production phase adapters or controller policy.',
    },
    {
      canReceiveProductionAuthorityNow: false,
      classification: 'future-runtime-seam-candidate',
      moduleName: 'agentSessionV3PilotPhaseDriver.ts',
      reason: 'Can host phase-owned ports later, but current handlers are not production adapters.',
    },
    {
      canReceiveProductionAuthorityNow: false,
      classification: 'future-runtime-seam-candidate',
      moduleName: 'agentSessionV3PilotHarness.ts',
      reason: 'Sketches injected-port composition without production ownership transfer.',
    },
    {
      canReceiveProductionAuthorityNow: false,
      classification: 'future-runtime-seam-candidate',
      moduleName: 'agentSessionV3RuntimeBoundary.ts',
      reason: 'Defines a contract-only boundary with productionAuthority=false.',
    },
  ],
  gate: 'production-wiring-negative-gate-blocker-rollup',
  isProductionWiringPlan: false,
  productionAuthority: false,
  productionReady: false,
  rows: [
    {
      area: 'production-owner',
      blockers: [
        'agent-session-v2-production-owner-retained',
      ],
      currentProductionOwner: 'AgentSessionV2',
      decision: 'blocked-before-production-wiring',
      inputs: [
        'full-runtime-preflight-audit',
        'runtime-boundary-contract',
      ],
      productionAuthority: false,
      productionReady: false,
      requiredBeforePositiveGate: [
        'formal production ownership transfer gate',
        'production controller contract',
        'real or production-like comparison evidence',
      ],
    },
    {
      area: 'debug-attachment',
      blockers: [
        'v3-pilot-shadow-debug-only',
        'agent-session-v2-production-owner-retained',
      ],
      currentProductionOwner: 'AgentSessionV2',
      decision: 'blocked-before-production-wiring',
      inputs: [
        'full-runtime-preflight-audit',
      ],
      productionAuthority: false,
      productionReady: false,
      requiredBeforePositiveGate: [
        'non-debug runtime attachment contract',
        'continuation and history isolation review',
        'explicit experimental switch semantics',
      ],
    },
    {
      area: 'adapter-contracts',
      blockers: [
        'production-adapter-contracts-missing',
        'missing-real-or-production-like-traces',
      ],
      currentProductionOwner: 'existing-v2-module',
      decision: 'blocked-before-production-wiring',
      inputs: [
        'adapter-pre-contract-audit',
        'production-adapter-evidence-pre-contract-closeout',
      ],
      productionAuthority: false,
      productionReady: false,
      requiredBeforePositiveGate: [
        'formal production adapter contracts',
        'adapter evidence payload contracts',
        'production-like adapter trace coverage',
      ],
    },
    {
      area: 'controller-policy',
      blockers: [
        'controller-policy-contracts-missing',
        'broad-stop-payload-contract-promotion-blocked',
      ],
      currentProductionOwner: 'existing-v2-module',
      decision: 'blocked-before-production-wiring',
      inputs: [
        'controller-policy-pre-contract-closeout',
        'stop-payload-final-pre-contract-closeout',
      ],
      productionAuthority: false,
      productionReady: false,
      requiredBeforePositiveGate: [
        'formal controller-policy contract',
        'terminal-status semantics',
        'pause, fail, retry, and recovery ownership rules',
      ],
    },
    {
      area: 'stop-payload',
      blockers: [
        'broad-stop-payload-contract-promotion-blocked',
        'phase-port-payload-contracts-missing',
        'production-adapter-contracts-missing',
        'controller-policy-contracts-missing',
      ],
      currentProductionOwner: 'none-yet',
      decision: 'blocked-before-production-wiring',
      inputs: [
        'payload-closeout-final-preflight-gate',
        'phase-port-payload-pre-contract-closeout',
        'production-adapter-evidence-pre-contract-closeout',
        'controller-policy-pre-contract-closeout',
        'stop-payload-final-pre-contract-closeout',
      ],
      productionAuthority: false,
      productionReady: false,
      requiredBeforePositiveGate: [
        'formal phase-port payload contracts',
        'formal production-adapter evidence contracts',
        'formal controller-policy payload contracts',
      ],
    },
    {
      area: 'production-evidence',
      blockers: [
        'missing-real-or-production-like-traces',
      ],
      currentProductionOwner: 'none-yet',
      decision: 'blocked-before-production-wiring',
      inputs: [
        'full-runtime-preflight-audit',
        'production-adapter-evidence-pre-contract-closeout',
      ],
      productionAuthority: false,
      productionReady: false,
      requiredBeforePositiveGate: [
        'caller-owned real or production-like shadow/debug corpus',
        'phase coverage for model decision, command preparation, permission, execution, evaluation, and recovery',
        'agreement reports without major runtime mismatch',
      ],
    },
    {
      area: 'permission-routing',
      blockers: [
        'permission-routing-ownership-not-delegated',
        'controller-policy-contracts-missing',
      ],
      currentProductionOwner: 'existing-v2-module',
      decision: 'blocked-before-production-wiring',
      inputs: [
        'adapter-pre-contract-audit',
        'controller-policy-pre-contract-closeout',
      ],
      productionAuthority: false,
      productionReady: false,
      requiredBeforePositiveGate: [
        'permission phase adapter contract',
        'policy-consumption contract',
        'approval pause and denial semantics',
      ],
    },
    {
      area: 'tool-execution',
      blockers: [
        'tool-execution-ownership-not-delegated',
        'production-adapter-contracts-missing',
      ],
      currentProductionOwner: 'existing-v2-module',
      decision: 'blocked-before-production-wiring',
      inputs: [
        'adapter-pre-contract-audit',
        'production-adapter-evidence-pre-contract-closeout',
      ],
      productionAuthority: false,
      productionReady: false,
      requiredBeforePositiveGate: [
        'transaction phase adapter contract',
        'side-effect commit boundary evidence',
        'production-like execution trace coverage',
      ],
    },
    {
      area: 'runtime-order',
      blockers: [
        'runtime-action-order-not-owned-by-v3',
        'fixed-tool-chain-prohibited',
      ],
      currentProductionOwner: 'AgentSessionV2',
      decision: 'blocked-before-production-wiring',
      inputs: [
        'full-runtime-preflight-audit',
        'runtime-boundary-contract',
      ],
      productionAuthority: false,
      productionReady: false,
      requiredBeforePositiveGate: [
        'controller state semantics',
        'phase transition invariants',
        'explicit non-fixed adapter scheduling contract',
      ],
    },
  ],
} as const satisfies ProductionWiringNegativeGateBlockerRollupCheckpoint;

function rowsWithBlocker(blocker: ProductionWiringNegativeGateBlocker) {
  return productionWiringNegativeGateBlockerRollupCheckpoint.rows.filter((row) => row.blockers.includes(blocker));
}

const {
  auditText,
  statusText,
  sessionSource,
  boundarySource,
  adapterPreContractSmokeSource,
  controllerPolicyCloseoutSmokeSource,
  productionAdapterCloseoutSmokeSource,
  payloadFinalGateSmokeSource,
  phasePortCloseoutSmokeSource,
  stopPayloadFinalCloseoutSmokeSource,
  productionWiringNegativeGateSmokeSource,
} = readProjectSources({
  auditText: 'PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md',
  statusText: 'PROJECT_AGENT_V2_STATUS.md',
  sessionSource: 'src/agent/agentProductionSessionImplementation.ts',
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  adapterPreContractSmokeSource: 'scripts/agent-session-v3-runtime-boundary-adapter-pre-contract-smoke.ts',
  controllerPolicyCloseoutSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-controller-policy-pre-contract-closeout-checkpoint-smoke.ts',
  productionAdapterCloseoutSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-production-adapter-evidence-pre-contract-closeout-checkpoint-smoke.ts',
  payloadFinalGateSmokeSource: 'scripts/agent-session-v3-runtime-boundary-payload-closeout-final-preflight-gate-smoke.ts',
  phasePortCloseoutSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-phase-port-payload-pre-contract-closeout-checkpoint-smoke.ts',
  stopPayloadFinalCloseoutSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-stop-payload-final-pre-contract-closeout-alignment-checkpoint-smoke.ts',
  productionWiringNegativeGateSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-production-wiring-negative-gate-blocker-rollup-checkpoint-smoke.ts',
});

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');
assert.equal(boundaryContract.mode, 'contract-only');

assert.equal(productionWiringNegativeGateBlockerRollupCheckpoint.productionAuthority, false);
assert.equal(productionWiringNegativeGateBlockerRollupCheckpoint.productionReady, false);
assert.equal(productionWiringNegativeGateBlockerRollupCheckpoint.isProductionWiringPlan, false);
assert.deepEqual(
  productionWiringNegativeGateBlockerRollupCheckpoint.rows.map((row) => row.area).sort(),
  [
    'adapter-contracts',
    'controller-policy',
    'debug-attachment',
    'permission-routing',
    'production-evidence',
    'production-owner',
    'runtime-order',
    'stop-payload',
    'tool-execution',
  ],
);

for (const row of productionWiringNegativeGateBlockerRollupCheckpoint.rows) {
  assert.equal(row.decision, 'blocked-before-production-wiring');
  assert.equal(row.productionAuthority, false);
  assert.equal(row.productionReady, false);
  assert.ok(row.blockers.length > 0);
  assert.ok(row.inputs.length > 0);
  assert.ok(row.requiredBeforePositiveGate.length > 0);
}

assert.deepEqual(
  productionWiringNegativeGateBlockerRollupCheckpoint.attachmentClassifications
    .filter((entry) => entry.classification === 'evidence-adapter')
    .map((entry) => entry.moduleName)
    .sort(),
  [
    'agentSessionV3PilotEventAdapters.ts',
    'agentSessionV3PilotShadowAgreement.ts',
    'agentSessionV3PilotShadowInputCollector.ts',
    'agentSessionV3PilotShadowMode.ts',
  ],
);
assert.deepEqual(
  productionWiringNegativeGateBlockerRollupCheckpoint.attachmentClassifications
    .filter((entry) => entry.classification === 'future-runtime-seam-candidate')
    .map((entry) => entry.moduleName)
    .sort(),
  [
    'agentSessionV3PilotHarness.ts',
    'agentSessionV3PilotPhaseDriver.ts',
    'agentSessionV3PilotRunner.ts',
    'agentSessionV3PilotStateMachine.ts',
    'agentSessionV3RuntimeBoundary.ts',
  ],
);

for (const classification of productionWiringNegativeGateBlockerRollupCheckpoint.attachmentClassifications) {
  assert.equal(classification.canReceiveProductionAuthorityNow, false);
  assert.match(auditText, new RegExp(classification.moduleName.replace('.', '\\.'), 'u'));
}

assert.ok(rowsWithBlocker('agent-session-v2-production-owner-retained').length >= 2);
assert.ok(rowsWithBlocker('v3-pilot-shadow-debug-only').length === 1);
assert.ok(rowsWithBlocker('production-adapter-contracts-missing').length >= 3);
assert.ok(rowsWithBlocker('controller-policy-contracts-missing').length >= 3);
assert.ok(rowsWithBlocker('broad-stop-payload-contract-promotion-blocked').length >= 2);
assert.ok(rowsWithBlocker('phase-port-payload-contracts-missing').length >= 1);
assert.ok(rowsWithBlocker('missing-real-or-production-like-traces').length >= 2);
assert.ok(rowsWithBlocker('permission-routing-ownership-not-delegated').length === 1);
assert.ok(rowsWithBlocker('tool-execution-ownership-not-delegated').length === 1);
assert.ok(rowsWithBlocker('runtime-action-order-not-owned-by-v3').length === 1);
assert.ok(rowsWithBlocker('fixed-tool-chain-prohibited').length === 1);

assert.match(sessionSource, /v3PilotShadow\?: AgentSessionV2V3PilotShadowOptions/u);
assert.match(sessionSource, /debug: resultOptions\.debug \?\? createAgentSessionV2DebugInfo\(\)/u);
assert.doesNotMatch(
  sessionSource,
  /v3PilotShadow[\s\S]{0,120}historyLines|historyLines[\s\S]{0,120}v3PilotShadow/u,
  'Production wiring negative gate expects v3 pilot shadow to stay out of history wiring.',
);

assert.match(adapterPreContractSmokeSource, /AgentSessionV2 remains production owner/u);
assert.match(controllerPolicyCloseoutSmokeSource, /controller-policy fields remain smoke-only/u);
assert.match(productionAdapterCloseoutSmokeSource, /adapter contracts remain deferred/u);
assert.match(payloadFinalGateSmokeSource, /payload-contract promotion is not allowed now/u);
assert.match(phasePortCloseoutSmokeSource, /phase-port payload side is internally covered but still pre-contract only/u);
assert.match(stopPayloadFinalCloseoutSmokeSource, /broad stop-payload contract promotion remains blocked/u);

const serializedGate = JSON.stringify(productionWiringNegativeGateBlockerRollupCheckpoint);
assert.doesNotMatch(
  serializedGate,
  /productionAuthority":true|productionReady":true|isProductionWiringPlan":true|decision":"ready-for-production-wiring/u,
  'Production wiring negative gate must not grant runtime authority or claim production readiness.',
);
assert.doesNotMatch(
  serializedGate,
  /adapterContractPromotionAllowed|payloadContractPromotionAllowed|formalPolicyContractReady|formalContractReady/u,
  'Production wiring negative gate should not promote payload, adapter, or controller contracts.',
);
assert.doesNotMatch(
  serializedGate,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Production wiring negative gate should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedGate,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Production wiring negative gate should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedGate,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain/iu,
  'Production wiring negative gate should not define fixed workflows or fallback chains.',
);
assert.doesNotMatch(
  serializedGate,
  /implementationQueue|orderedSteps|runtimeAuthority|experimental-adapter/u,
  'Production wiring negative gate should remain a blocker rollup, not a production wiring plan.',
);

assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Production wiring negative gate must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Production wiring negative gate must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  productionWiringNegativeGateSmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Production wiring negative gate smoke should not call production v2 modules.',
);

assert.match(auditText, /Production Wiring Negative Gate And Blocker Rollup Checkpoint Status/u);
assert.match(
  auditText,
  /agent-session-v3-runtime-boundary-production-wiring-negative-gate-blocker-rollup-checkpoint-smoke\.ts/u,
);
assert.match(auditText, /v3 cannot replace `AgentSessionV2` or receive production runtime authority yet/u);
assert.match(auditText, /negative gate, not a production wiring plan/u);
assert.match(statusText, /V3 runtime boundary production wiring negative gate and blocker rollup checkpoint.*Completed/u);
assert.match(
  statusText,
  /agent-session-v3-runtime-boundary-production-wiring-negative-gate-blocker-rollup-checkpoint-smoke\.ts/u,
);

console.log('agent session v3 runtime boundary production wiring negative gate blocker rollup checkpoint smoke ok');
