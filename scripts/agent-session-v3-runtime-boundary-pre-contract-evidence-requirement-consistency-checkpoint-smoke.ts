import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { readProjectFile } from './smokeTestHarness.ts';

type PreContractEvidenceRequirementConsistencyInput =
  | 'adapter-pre-contract-audit'
  | 'controller-policy-pre-contract-closeout'
  | 'non-evidence-blocker-pre-contract-evidence-requirement-mapping'
  | 'payload-closeout-final-preflight-gate'
  | 'phase-port-payload-pre-contract-closeout'
  | 'positive-gate-precondition-closeout'
  | 'production-adapter-evidence-pre-contract-closeout'
  | 'production-wiring-gate-closeout-summary'
  | 'remaining-non-evidence-production-blocker-inventory'
  | 'runtime-boundary-contract'
  | 'stop-payload-final-pre-contract-closeout';

type FuturePreContractEvidenceRequirement =
  | 'adapter-responsibility-evidence'
  | 'controller-policy-field-source-evidence'
  | 'fixed-tool-chain-prohibition-preservation-evidence'
  | 'non-debug-attachment-scope-evidence'
  | 'payload-contract-shape-evidence'
  | 'permission-routing-delegation-evidence'
  | 'phase-port-payload-source-evidence'
  | 'production-ownership-decision-evidence'
  | 'runtime-action-semantics-evidence'
  | 'tool-execution-delegation-evidence';

type ConsistencyCoverageAnchor =
  | 'adapter-pre-contract-retains-agent-session-v2-owner'
  | 'controller-policy-fields-remain-smoke-only'
  | 'fixed-tool-chain-prohibited'
  | 'non-debug-runtime-attachment-blocked'
  | 'payload-contract-promotion-blocked'
  | 'permission-routing-not-delegated'
  | 'phase-port-payload-pre-contract-only'
  | 'positive-gate-remains-closed'
  | 'production-ownership-retained-by-agent-session-v2'
  | 'runtime-action-order-not-owned-by-v3'
  | 'tool-execution-not-delegated';

interface PreContractEvidenceRequirementConsistencyRow {
  anchor: ConsistencyCoverageAnchor;
  consistencyStatus: 'aligned-and-blocked';
  contractPromotionAllowed: false;
  evidenceRequirement: FuturePreContractEvidenceRequirement;
  inputs: readonly PreContractEvidenceRequirementConsistencyInput[];
  isExecutionOrder: false;
  isImplementationPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
}

interface PreContractEvidenceRequirementConsistencyCheckpoint {
  gate: 'pre-contract-evidence-requirement-consistency';
  isProductionWiringPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly PreContractEvidenceRequirementConsistencyRow[];
  summaryDecision: 'requirements-consistent-positive-gate-closed';
}

const preContractEvidenceRequirementConsistencyCheckpoint = {
  gate: 'pre-contract-evidence-requirement-consistency',
  isProductionWiringPlan: false,
  positiveGateAllowed: false,
  productionAuthority: false,
  productionReady: false,
  rows: [
    {
      anchor: 'production-ownership-retained-by-agent-session-v2',
      consistencyStatus: 'aligned-and-blocked',
      contractPromotionAllowed: false,
      evidenceRequirement: 'production-ownership-decision-evidence',
      inputs: [
        'runtime-boundary-contract',
        'positive-gate-precondition-closeout',
        'production-wiring-gate-closeout-summary',
        'non-evidence-blocker-pre-contract-evidence-requirement-mapping',
      ],
      isExecutionOrder: false,
      isImplementationPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
    {
      anchor: 'non-debug-runtime-attachment-blocked',
      consistencyStatus: 'aligned-and-blocked',
      contractPromotionAllowed: false,
      evidenceRequirement: 'non-debug-attachment-scope-evidence',
      inputs: [
        'runtime-boundary-contract',
        'positive-gate-precondition-closeout',
        'production-wiring-gate-closeout-summary',
        'non-evidence-blocker-pre-contract-evidence-requirement-mapping',
      ],
      isExecutionOrder: false,
      isImplementationPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
    {
      anchor: 'adapter-pre-contract-retains-agent-session-v2-owner',
      consistencyStatus: 'aligned-and-blocked',
      contractPromotionAllowed: false,
      evidenceRequirement: 'adapter-responsibility-evidence',
      inputs: [
        'adapter-pre-contract-audit',
        'production-adapter-evidence-pre-contract-closeout',
        'positive-gate-precondition-closeout',
        'non-evidence-blocker-pre-contract-evidence-requirement-mapping',
      ],
      isExecutionOrder: false,
      isImplementationPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
    {
      anchor: 'tool-execution-not-delegated',
      consistencyStatus: 'aligned-and-blocked',
      contractPromotionAllowed: false,
      evidenceRequirement: 'tool-execution-delegation-evidence',
      inputs: [
        'adapter-pre-contract-audit',
        'positive-gate-precondition-closeout',
        'production-wiring-gate-closeout-summary',
        'non-evidence-blocker-pre-contract-evidence-requirement-mapping',
      ],
      isExecutionOrder: false,
      isImplementationPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
    {
      anchor: 'controller-policy-fields-remain-smoke-only',
      consistencyStatus: 'aligned-and-blocked',
      contractPromotionAllowed: false,
      evidenceRequirement: 'controller-policy-field-source-evidence',
      inputs: [
        'controller-policy-pre-contract-closeout',
        'positive-gate-precondition-closeout',
        'non-evidence-blocker-pre-contract-evidence-requirement-mapping',
      ],
      isExecutionOrder: false,
      isImplementationPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
    {
      anchor: 'permission-routing-not-delegated',
      consistencyStatus: 'aligned-and-blocked',
      contractPromotionAllowed: false,
      evidenceRequirement: 'permission-routing-delegation-evidence',
      inputs: [
        'controller-policy-pre-contract-closeout',
        'positive-gate-precondition-closeout',
        'production-wiring-gate-closeout-summary',
        'non-evidence-blocker-pre-contract-evidence-requirement-mapping',
      ],
      isExecutionOrder: false,
      isImplementationPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
    {
      anchor: 'payload-contract-promotion-blocked',
      consistencyStatus: 'aligned-and-blocked',
      contractPromotionAllowed: false,
      evidenceRequirement: 'payload-contract-shape-evidence',
      inputs: [
        'payload-closeout-final-preflight-gate',
        'stop-payload-final-pre-contract-closeout',
        'positive-gate-precondition-closeout',
        'non-evidence-blocker-pre-contract-evidence-requirement-mapping',
      ],
      isExecutionOrder: false,
      isImplementationPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
    {
      anchor: 'phase-port-payload-pre-contract-only',
      consistencyStatus: 'aligned-and-blocked',
      contractPromotionAllowed: false,
      evidenceRequirement: 'phase-port-payload-source-evidence',
      inputs: [
        'phase-port-payload-pre-contract-closeout',
        'payload-closeout-final-preflight-gate',
        'non-evidence-blocker-pre-contract-evidence-requirement-mapping',
      ],
      isExecutionOrder: false,
      isImplementationPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
    {
      anchor: 'runtime-action-order-not-owned-by-v3',
      consistencyStatus: 'aligned-and-blocked',
      contractPromotionAllowed: false,
      evidenceRequirement: 'runtime-action-semantics-evidence',
      inputs: [
        'runtime-boundary-contract',
        'positive-gate-precondition-closeout',
        'production-wiring-gate-closeout-summary',
        'non-evidence-blocker-pre-contract-evidence-requirement-mapping',
      ],
      isExecutionOrder: false,
      isImplementationPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
    {
      anchor: 'fixed-tool-chain-prohibited',
      consistencyStatus: 'aligned-and-blocked',
      contractPromotionAllowed: false,
      evidenceRequirement: 'fixed-tool-chain-prohibition-preservation-evidence',
      inputs: [
        'runtime-boundary-contract',
        'positive-gate-precondition-closeout',
        'production-wiring-gate-closeout-summary',
        'non-evidence-blocker-pre-contract-evidence-requirement-mapping',
      ],
      isExecutionOrder: false,
      isImplementationPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
  ],
  summaryDecision: 'requirements-consistent-positive-gate-closed',
} as const satisfies PreContractEvidenceRequirementConsistencyCheckpoint;

function rowForRequirement(requirement: FuturePreContractEvidenceRequirement) {
  const row = preContractEvidenceRequirementConsistencyCheckpoint.rows.find((candidate) => (
    candidate.evidenceRequirement === requirement
  ));
  assert.ok(row, `${requirement} should exist in the pre-contract evidence requirement consistency checkpoint.`);
  return row;
}

function assertContains(text: string, expected: string, label: string) {
  assert.ok(text.includes(expected), `${label} should include: ${expected}`);
}

const boundarySource = readProjectFile('src/agent/agentSessionV3RuntimeBoundary.ts');
const auditText = readProjectFile('PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md');
const statusText = readProjectFile('PROJECT_AGENT_V2_STATUS.md');
const consistencySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-pre-contract-evidence-requirement-consistency-checkpoint-smoke.ts',
);
const requirementMappingSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-non-evidence-blocker-pre-contract-evidence-requirement-mapping-checkpoint-smoke.ts',
);
const inventorySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-remaining-non-evidence-production-blocker-inventory-checkpoint-smoke.ts',
);
const positiveGateCloseoutSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-production-wiring-positive-gate-precondition-closeout-gate-smoke.ts',
);
const gateCloseoutSummarySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-production-wiring-gate-closeout-summary-checkpoint-smoke.ts',
);
const adapterPreContractSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-adapter-pre-contract-smoke.ts',
);
const adapterCloseoutSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-production-adapter-evidence-pre-contract-closeout-checkpoint-smoke.ts',
);
const controllerPolicyCloseoutSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-controller-policy-pre-contract-closeout-checkpoint-smoke.ts',
);
const payloadFinalGateSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-payload-closeout-final-preflight-gate-smoke.ts',
);
const phasePortPayloadCloseoutSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-phase-port-payload-pre-contract-closeout-checkpoint-smoke.ts',
);
const stopPayloadFinalCloseoutSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-stop-payload-final-pre-contract-closeout-alignment-checkpoint-smoke.ts',
);

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');
assert.equal(boundaryContract.mode, 'contract-only');

assert.equal(preContractEvidenceRequirementConsistencyCheckpoint.productionAuthority, false);
assert.equal(preContractEvidenceRequirementConsistencyCheckpoint.productionReady, false);
assert.equal(preContractEvidenceRequirementConsistencyCheckpoint.positiveGateAllowed, false);
assert.equal(preContractEvidenceRequirementConsistencyCheckpoint.isProductionWiringPlan, false);
assert.equal(
  preContractEvidenceRequirementConsistencyCheckpoint.summaryDecision,
  'requirements-consistent-positive-gate-closed',
);

assert.deepEqual(
  preContractEvidenceRequirementConsistencyCheckpoint.rows.map((row) => row.evidenceRequirement).sort(),
  [
    'adapter-responsibility-evidence',
    'controller-policy-field-source-evidence',
    'fixed-tool-chain-prohibition-preservation-evidence',
    'non-debug-attachment-scope-evidence',
    'payload-contract-shape-evidence',
    'permission-routing-delegation-evidence',
    'phase-port-payload-source-evidence',
    'production-ownership-decision-evidence',
    'runtime-action-semantics-evidence',
    'tool-execution-delegation-evidence',
  ],
);

for (const row of preContractEvidenceRequirementConsistencyCheckpoint.rows) {
  assert.equal(row.consistencyStatus, 'aligned-and-blocked');
  assert.equal(row.contractPromotionAllowed, false);
  assert.equal(row.isExecutionOrder, false);
  assert.equal(row.isImplementationPlan, false);
  assert.equal(row.productionAuthority, false);
  assert.equal(row.productionReady, false);
  assert.equal(row.positiveGateAllowed, false);
  assert.ok(row.inputs.includes('non-evidence-blocker-pre-contract-evidence-requirement-mapping'));
  assertContains(requirementMappingSmokeSource, row.evidenceRequirement, 'requirement mapping smoke');
}

assert.equal(rowForRequirement('production-ownership-decision-evidence').anchor, 'production-ownership-retained-by-agent-session-v2');
assert.equal(rowForRequirement('non-debug-attachment-scope-evidence').anchor, 'non-debug-runtime-attachment-blocked');
assert.equal(rowForRequirement('adapter-responsibility-evidence').anchor, 'adapter-pre-contract-retains-agent-session-v2-owner');
assert.equal(rowForRequirement('tool-execution-delegation-evidence').anchor, 'tool-execution-not-delegated');
assert.equal(rowForRequirement('controller-policy-field-source-evidence').anchor, 'controller-policy-fields-remain-smoke-only');
assert.equal(rowForRequirement('permission-routing-delegation-evidence').anchor, 'permission-routing-not-delegated');
assert.equal(rowForRequirement('payload-contract-shape-evidence').anchor, 'payload-contract-promotion-blocked');
assert.equal(rowForRequirement('phase-port-payload-source-evidence').anchor, 'phase-port-payload-pre-contract-only');
assert.equal(rowForRequirement('runtime-action-semantics-evidence').anchor, 'runtime-action-order-not-owned-by-v3');
assert.equal(rowForRequirement('fixed-tool-chain-prohibition-preservation-evidence').anchor, 'fixed-tool-chain-prohibited');

assertContains(inventorySmokeSource, 'non-evidence-blockers-remain-positive-gate-closed', 'remaining blocker inventory smoke');
assertContains(requirementMappingSmokeSource, 'requirements-mapped-positive-gate-closed', 'requirement mapping smoke');
assertContains(positiveGateCloseoutSmokeSource, 'positive-gate-remains-closed', 'positive gate closeout smoke');
assertContains(gateCloseoutSummarySmokeSource, 'production-wiring-deferred', 'gate closeout summary smoke');
assertContains(adapterPreContractSmokeSource, 'AgentSessionV2 remains production owner', 'adapter pre-contract smoke');
assertContains(adapterCloseoutSmokeSource, 'future-production-adapter-evidence-missing', 'adapter closeout smoke');
assertContains(controllerPolicyCloseoutSmokeSource, 'controller-policy fields remain smoke-only', 'controller-policy closeout smoke');
assertContains(controllerPolicyCloseoutSmokeSource, 'requires-controller-policy-contract', 'controller-policy closeout smoke');
assertContains(payloadFinalGateSmokeSource, 'payload-contract promotion is not allowed now', 'payload final gate smoke');
assertContains(phasePortPayloadCloseoutSmokeSource, 'phase-port payload side is internally covered but still pre-contract only', 'phase-port payload closeout smoke');
assertContains(stopPayloadFinalCloseoutSmokeSource, 'broad stop-payload contract promotion remains blocked', 'stop payload final closeout smoke');
assertContains(boundarySource, 'AgentSessionV2 remains the production orchestrator', 'runtime boundary');
assertContains(boundarySource, 'no required ordered tool workflow', 'runtime boundary');

assertContains(auditText, 'Pre-Contract Evidence Requirement Consistency Checkpoint Status', 'preflight audit');
assertContains(auditText, 'future evidence requirements remain consistent with the current blocked audits', 'preflight audit');
assertContains(statusText, 'V3 runtime boundary pre-contract evidence requirement consistency checkpoint', 'status');
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-pre-contract-evidence-requirement-consistency-checkpoint-smoke.ts',
  'status',
);
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

const serializedCheckpoint = JSON.stringify(preContractEvidenceRequirementConsistencyCheckpoint);
assert.doesNotMatch(
  serializedCheckpoint,
  /productionAuthority":true|productionReady":true|positiveGateAllowed":true|contractPromotionAllowed":true/u,
  'Pre-contract evidence requirement consistency must not grant production readiness, contract promotion, or authority.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /isProductionWiringPlan":true|ready-for-production-wiring|production-wiring-ready|productionGateCleared":true/u,
  'Pre-contract evidence requirement consistency must not become a production wiring plan or clear the gate.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /adapterContractPromotionAllowed|payloadContractPromotionAllowed|formalPolicyContractReady|formalContractReady/u,
  'Pre-contract evidence requirement consistency should not promote payload, adapter, or controller contracts.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Pre-contract evidence requirement consistency should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Pre-contract evidence requirement consistency should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain|requiredReportOrder|implementationQueue|orderedSteps/iu,
  'Pre-contract evidence requirement consistency should not define fixed workflows, required report order, or task queues.',
);

assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Pre-contract evidence requirement consistency must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Pre-contract evidence requirement consistency must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  consistencySmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Pre-contract evidence requirement consistency smoke should not call production v2 modules.',
);

console.log('agent session v3 runtime boundary pre-contract evidence requirement consistency checkpoint smoke ok');
