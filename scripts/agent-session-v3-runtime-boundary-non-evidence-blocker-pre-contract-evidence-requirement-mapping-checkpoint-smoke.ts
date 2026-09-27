import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { readProjectFile } from './smokeTestHarness.ts';

type PreContractEvidenceRequirementInput =
  | 'adapter-pre-contract-audit'
  | 'controller-policy-pre-contract-closeout'
  | 'evidence-interpretation-to-production-gate-mapping'
  | 'negative-gate-blocker-rollup'
  | 'payload-closeout-final-preflight-gate'
  | 'phase-port-payload-pre-contract-closeout'
  | 'positive-gate-precondition-closeout'
  | 'production-adapter-evidence-pre-contract-closeout'
  | 'production-wiring-gate-closeout-summary'
  | 'remaining-non-evidence-production-blocker-inventory'
  | 'runtime-boundary-contract'
  | 'stop-payload-final-pre-contract-closeout';

type NonEvidenceBlockerGroup =
  | 'production-ownership'
  | 'debug-shadow-attachment'
  | 'production-adapter-contracts'
  | 'controller-policy-contracts'
  | 'payload-contracts'
  | 'runtime-action-semantics';

type NonEvidenceProductionBlocker =
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

interface NonEvidenceBlockerPreContractEvidenceRequirementRow {
  blockers: readonly NonEvidenceProductionBlocker[];
  contractPromotionAllowed: false;
  currentEvidencePackageReady: false;
  futureEvidenceRequirements: readonly FuturePreContractEvidenceRequirement[];
  group: NonEvidenceBlockerGroup;
  inputs: readonly PreContractEvidenceRequirementInput[];
  isExecutionOrder: false;
  isImplementationPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  requirementStatus: 'future-pre-contract-evidence-required';
}

interface NonEvidenceBlockerPreContractEvidenceRequirementMappingCheckpoint {
  evidencePackageAssumption: 'hypothetical-accepted-evidence-does-not-clear-non-evidence-blockers';
  gate: 'non-evidence-blocker-pre-contract-evidence-requirement-mapping';
  isProductionWiringPlan: false;
  mappingAuthority: 'non-authoritative-requirement-inventory';
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly NonEvidenceBlockerPreContractEvidenceRequirementRow[];
  summaryDecision: 'requirements-mapped-positive-gate-closed';
}

const nonEvidenceBlockerPreContractEvidenceRequirementMappingCheckpoint = {
  evidencePackageAssumption: 'hypothetical-accepted-evidence-does-not-clear-non-evidence-blockers',
  gate: 'non-evidence-blocker-pre-contract-evidence-requirement-mapping',
  isProductionWiringPlan: false,
  mappingAuthority: 'non-authoritative-requirement-inventory',
  positiveGateAllowed: false,
  productionAuthority: false,
  productionReady: false,
  rows: [
    {
      blockers: ['agent-session-v2-production-owner-retained'],
      contractPromotionAllowed: false,
      currentEvidencePackageReady: false,
      futureEvidenceRequirements: ['production-ownership-decision-evidence'],
      group: 'production-ownership',
      inputs: [
        'runtime-boundary-contract',
        'positive-gate-precondition-closeout',
        'production-wiring-gate-closeout-summary',
        'remaining-non-evidence-production-blocker-inventory',
      ],
      isExecutionOrder: false,
      isImplementationPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      requirementStatus: 'future-pre-contract-evidence-required',
    },
    {
      blockers: ['v3-pilot-shadow-debug-only'],
      contractPromotionAllowed: false,
      currentEvidencePackageReady: false,
      futureEvidenceRequirements: ['non-debug-attachment-scope-evidence'],
      group: 'debug-shadow-attachment',
      inputs: [
        'runtime-boundary-contract',
        'positive-gate-precondition-closeout',
        'production-wiring-gate-closeout-summary',
        'remaining-non-evidence-production-blocker-inventory',
      ],
      isExecutionOrder: false,
      isImplementationPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      requirementStatus: 'future-pre-contract-evidence-required',
    },
    {
      blockers: [
        'production-adapter-contracts-missing',
        'tool-execution-ownership-not-delegated',
      ],
      contractPromotionAllowed: false,
      currentEvidencePackageReady: false,
      futureEvidenceRequirements: [
        'adapter-responsibility-evidence',
        'tool-execution-delegation-evidence',
      ],
      group: 'production-adapter-contracts',
      inputs: [
        'adapter-pre-contract-audit',
        'production-adapter-evidence-pre-contract-closeout',
        'positive-gate-precondition-closeout',
        'production-wiring-gate-closeout-summary',
        'remaining-non-evidence-production-blocker-inventory',
      ],
      isExecutionOrder: false,
      isImplementationPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      requirementStatus: 'future-pre-contract-evidence-required',
    },
    {
      blockers: [
        'controller-policy-contracts-missing',
        'permission-routing-ownership-not-delegated',
      ],
      contractPromotionAllowed: false,
      currentEvidencePackageReady: false,
      futureEvidenceRequirements: [
        'controller-policy-field-source-evidence',
        'permission-routing-delegation-evidence',
      ],
      group: 'controller-policy-contracts',
      inputs: [
        'controller-policy-pre-contract-closeout',
        'positive-gate-precondition-closeout',
        'production-wiring-gate-closeout-summary',
        'remaining-non-evidence-production-blocker-inventory',
      ],
      isExecutionOrder: false,
      isImplementationPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      requirementStatus: 'future-pre-contract-evidence-required',
    },
    {
      blockers: [
        'broad-stop-payload-contract-promotion-blocked',
        'phase-port-payload-contracts-missing',
      ],
      contractPromotionAllowed: false,
      currentEvidencePackageReady: false,
      futureEvidenceRequirements: [
        'payload-contract-shape-evidence',
        'phase-port-payload-source-evidence',
      ],
      group: 'payload-contracts',
      inputs: [
        'payload-closeout-final-preflight-gate',
        'phase-port-payload-pre-contract-closeout',
        'stop-payload-final-pre-contract-closeout',
        'positive-gate-precondition-closeout',
        'remaining-non-evidence-production-blocker-inventory',
      ],
      isExecutionOrder: false,
      isImplementationPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      requirementStatus: 'future-pre-contract-evidence-required',
    },
    {
      blockers: [
        'runtime-action-order-not-owned-by-v3',
        'fixed-tool-chain-prohibited',
      ],
      contractPromotionAllowed: false,
      currentEvidencePackageReady: false,
      futureEvidenceRequirements: [
        'runtime-action-semantics-evidence',
        'fixed-tool-chain-prohibition-preservation-evidence',
      ],
      group: 'runtime-action-semantics',
      inputs: [
        'runtime-boundary-contract',
        'negative-gate-blocker-rollup',
        'positive-gate-precondition-closeout',
        'remaining-non-evidence-production-blocker-inventory',
      ],
      isExecutionOrder: false,
      isImplementationPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      requirementStatus: 'future-pre-contract-evidence-required',
    },
  ],
  summaryDecision: 'requirements-mapped-positive-gate-closed',
} as const satisfies NonEvidenceBlockerPreContractEvidenceRequirementMappingCheckpoint;

function rowForGroup(group: NonEvidenceBlockerGroup) {
  const row = nonEvidenceBlockerPreContractEvidenceRequirementMappingCheckpoint.rows.find((candidate) => (
    candidate.group === group
  ));
  assert.ok(row, `${group} should exist in the pre-contract evidence requirement mapping.`);
  return row;
}

function rowsForBlocker(blocker: NonEvidenceProductionBlocker) {
  return nonEvidenceBlockerPreContractEvidenceRequirementMappingCheckpoint.rows
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
const requirementMappingSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-non-evidence-blocker-pre-contract-evidence-requirement-mapping-checkpoint-smoke.ts',
);
const inventorySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-remaining-non-evidence-production-blocker-inventory-checkpoint-smoke.ts',
);
const evidenceGateMappingSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-evidence-interpretation-to-production-gate-mapping-checkpoint-smoke.ts',
);
const positiveGateCloseoutSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-production-wiring-positive-gate-precondition-closeout-gate-smoke.ts',
);
const gateCloseoutSummarySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-production-wiring-gate-closeout-summary-checkpoint-smoke.ts',
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

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');
assert.equal(boundaryContract.mode, 'contract-only');

assert.equal(
  nonEvidenceBlockerPreContractEvidenceRequirementMappingCheckpoint.evidencePackageAssumption,
  'hypothetical-accepted-evidence-does-not-clear-non-evidence-blockers',
);
assert.equal(
  nonEvidenceBlockerPreContractEvidenceRequirementMappingCheckpoint.mappingAuthority,
  'non-authoritative-requirement-inventory',
);
assert.equal(nonEvidenceBlockerPreContractEvidenceRequirementMappingCheckpoint.productionAuthority, false);
assert.equal(nonEvidenceBlockerPreContractEvidenceRequirementMappingCheckpoint.productionReady, false);
assert.equal(nonEvidenceBlockerPreContractEvidenceRequirementMappingCheckpoint.positiveGateAllowed, false);
assert.equal(nonEvidenceBlockerPreContractEvidenceRequirementMappingCheckpoint.isProductionWiringPlan, false);
assert.equal(
  nonEvidenceBlockerPreContractEvidenceRequirementMappingCheckpoint.summaryDecision,
  'requirements-mapped-positive-gate-closed',
);

assert.deepEqual(
  nonEvidenceBlockerPreContractEvidenceRequirementMappingCheckpoint.rows.map((row) => row.group).sort(),
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
  nonEvidenceBlockerPreContractEvidenceRequirementMappingCheckpoint.rows.flatMap((row) => row.blockers),
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

assert.deepEqual(
  uniqueSorted(nonEvidenceBlockerPreContractEvidenceRequirementMappingCheckpoint.rows.flatMap((row) => (
    row.futureEvidenceRequirements
  ))),
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

for (const row of nonEvidenceBlockerPreContractEvidenceRequirementMappingCheckpoint.rows) {
  assert.equal(row.contractPromotionAllowed, false);
  assert.equal(row.currentEvidencePackageReady, false);
  assert.equal(row.isExecutionOrder, false);
  assert.equal(row.isImplementationPlan, false);
  assert.equal(row.productionAuthority, false);
  assert.equal(row.productionReady, false);
  assert.equal(row.positiveGateAllowed, false);
  assert.equal(row.requirementStatus, 'future-pre-contract-evidence-required');
  assert.ok(row.inputs.includes('remaining-non-evidence-production-blocker-inventory'));
  assert.ok(row.futureEvidenceRequirements.length > 0);
  assert.ok(row.blockers.length > 0);
}

for (const blocker of flattenedBlockers as NonEvidenceProductionBlocker[]) {
  assert.equal(rowsForBlocker(blocker).length, 1, `${blocker} should appear exactly once in requirement mapping.`);
  assertContains(inventorySmokeSource, blocker, 'remaining non-evidence inventory smoke');
  assertContains(evidenceGateMappingSmokeSource, blocker, 'evidence-to-gate mapping smoke');
  assertContains(positiveGateCloseoutSmokeSource, blocker, 'positive gate closeout smoke');
  assertContains(gateCloseoutSummarySmokeSource, blocker, 'gate closeout summary smoke');
}

assert.deepEqual(rowForGroup('production-ownership').futureEvidenceRequirements, [
  'production-ownership-decision-evidence',
]);
assert.deepEqual(rowForGroup('debug-shadow-attachment').futureEvidenceRequirements, [
  'non-debug-attachment-scope-evidence',
]);
assert.deepEqual(rowForGroup('production-adapter-contracts').futureEvidenceRequirements, [
  'adapter-responsibility-evidence',
  'tool-execution-delegation-evidence',
]);
assert.deepEqual(rowForGroup('controller-policy-contracts').futureEvidenceRequirements, [
  'controller-policy-field-source-evidence',
  'permission-routing-delegation-evidence',
]);
assert.deepEqual(rowForGroup('payload-contracts').futureEvidenceRequirements, [
  'payload-contract-shape-evidence',
  'phase-port-payload-source-evidence',
]);
assert.deepEqual(rowForGroup('runtime-action-semantics').futureEvidenceRequirements, [
  'runtime-action-semantics-evidence',
  'fixed-tool-chain-prohibition-preservation-evidence',
]);

assertContains(inventorySmokeSource, 'remaining-after-hypothetical-evidence-acceptance', 'remaining blocker inventory smoke');
assertContains(inventorySmokeSource, 'non-evidence-blockers-remain-positive-gate-closed', 'remaining blocker inventory smoke');
assertContains(evidenceGateMappingSmokeSource, 'does-not-clear-non-evidence-blockers', 'evidence-to-gate mapping smoke');
assertContains(adapterCloseoutSmokeSource, 'future-production-adapter-evidence-missing', 'adapter closeout smoke');
assertContains(controllerPolicyCloseoutSmokeSource, 'requires-controller-policy-contract', 'controller policy closeout smoke');
assertContains(payloadFinalGateSmokeSource, 'payload-contract promotion is not allowed now', 'payload final gate smoke');
assertContains(boundarySource, 'AgentSessionV2 remains the production orchestrator', 'runtime boundary');
assertContains(boundarySource, 'no required ordered tool workflow', 'runtime boundary');

assertContains(auditText, 'Non-Evidence Blocker To Future Pre-Contract Evidence Requirement Mapping Checkpoint Status', 'preflight audit');
assertContains(auditText, 'requirements are mapped, but contract promotion remains blocked', 'preflight audit');
assertContains(statusText, 'V3 runtime boundary non-evidence blocker to future pre-contract evidence requirement mapping checkpoint', 'status');
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-non-evidence-blocker-pre-contract-evidence-requirement-mapping-checkpoint-smoke.ts',
  'status',
);
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

const serializedCheckpoint = JSON.stringify(nonEvidenceBlockerPreContractEvidenceRequirementMappingCheckpoint);
assert.doesNotMatch(
  serializedCheckpoint,
  /productionAuthority":true|productionReady":true|positiveGateAllowed":true|contractPromotionAllowed":true/u,
  'Pre-contract evidence requirement mapping must not grant production readiness, contract promotion, or authority.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /isProductionWiringPlan":true|ready-for-production-wiring|production-wiring-ready|productionGateCleared":true/u,
  'Pre-contract evidence requirement mapping must not become a production wiring plan or clear the gate.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /adapterContractPromotionAllowed|payloadContractPromotionAllowed|formalPolicyContractReady|formalContractReady/u,
  'Pre-contract evidence requirement mapping should not promote payload, adapter, or controller contracts.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Pre-contract evidence requirement mapping should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Pre-contract evidence requirement mapping should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain|requiredReportOrder|implementationQueue|orderedSteps/iu,
  'Pre-contract evidence requirement mapping should not define fixed workflows, required report order, or task queues.',
);

assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Pre-contract evidence requirement mapping must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Pre-contract evidence requirement mapping must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  requirementMappingSmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Pre-contract evidence requirement mapping smoke should not call production v2 modules.',
);

console.log('agent session v3 runtime boundary non-evidence blocker pre-contract evidence requirement mapping checkpoint smoke ok');
