import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { readProjectFile } from './smokeTestHarness.ts';

type PreContractEvidenceRequirementCloseoutInput =
  | 'non-evidence-blocker-pre-contract-evidence-requirement-mapping'
  | 'pre-contract-evidence-requirement-consistency'
  | 'positive-gate-precondition-closeout'
  | 'production-wiring-gate-closeout-summary'
  | 'remaining-non-evidence-production-blocker-inventory'
  | 'runtime-boundary-contract';

type PreContractEvidenceRequirementCloseoutGroup =
  | 'production-ownership'
  | 'debug-shadow-attachment'
  | 'production-adapter-contracts'
  | 'controller-policy-contracts'
  | 'payload-contracts'
  | 'runtime-action-semantics';

type PreContractEvidenceRequirementCloseoutRequirement =
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

interface PreContractEvidenceRequirementCloseoutRow {
  closeoutStatus: 'mapped-consistent-and-blocked';
  contractPromotionAllowed: false;
  group: PreContractEvidenceRequirementCloseoutGroup;
  inputs: readonly PreContractEvidenceRequirementCloseoutInput[];
  isExecutionOrder: false;
  isImplementationPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  requirements: readonly PreContractEvidenceRequirementCloseoutRequirement[];
}

interface PreContractEvidenceRequirementCloseoutCheckpoint {
  gate: 'pre-contract-evidence-requirement-closeout';
  isProductionWiringPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly PreContractEvidenceRequirementCloseoutRow[];
  summaryDecision: 'requirements-closeout-positive-gate-closed';
}

const preContractEvidenceRequirementCloseoutCheckpoint = {
  gate: 'pre-contract-evidence-requirement-closeout',
  isProductionWiringPlan: false,
  positiveGateAllowed: false,
  productionAuthority: false,
  productionReady: false,
  rows: [
    {
      closeoutStatus: 'mapped-consistent-and-blocked',
      contractPromotionAllowed: false,
      group: 'production-ownership',
      inputs: [
        'non-evidence-blocker-pre-contract-evidence-requirement-mapping',
        'pre-contract-evidence-requirement-consistency',
        'positive-gate-precondition-closeout',
        'production-wiring-gate-closeout-summary',
        'runtime-boundary-contract',
      ],
      isExecutionOrder: false,
      isImplementationPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      requirements: ['production-ownership-decision-evidence'],
    },
    {
      closeoutStatus: 'mapped-consistent-and-blocked',
      contractPromotionAllowed: false,
      group: 'debug-shadow-attachment',
      inputs: [
        'non-evidence-blocker-pre-contract-evidence-requirement-mapping',
        'pre-contract-evidence-requirement-consistency',
        'positive-gate-precondition-closeout',
        'production-wiring-gate-closeout-summary',
        'runtime-boundary-contract',
      ],
      isExecutionOrder: false,
      isImplementationPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      requirements: ['non-debug-attachment-scope-evidence'],
    },
    {
      closeoutStatus: 'mapped-consistent-and-blocked',
      contractPromotionAllowed: false,
      group: 'production-adapter-contracts',
      inputs: [
        'non-evidence-blocker-pre-contract-evidence-requirement-mapping',
        'pre-contract-evidence-requirement-consistency',
        'positive-gate-precondition-closeout',
        'production-wiring-gate-closeout-summary',
        'remaining-non-evidence-production-blocker-inventory',
      ],
      isExecutionOrder: false,
      isImplementationPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      requirements: [
        'adapter-responsibility-evidence',
        'tool-execution-delegation-evidence',
      ],
    },
    {
      closeoutStatus: 'mapped-consistent-and-blocked',
      contractPromotionAllowed: false,
      group: 'controller-policy-contracts',
      inputs: [
        'non-evidence-blocker-pre-contract-evidence-requirement-mapping',
        'pre-contract-evidence-requirement-consistency',
        'positive-gate-precondition-closeout',
        'production-wiring-gate-closeout-summary',
        'remaining-non-evidence-production-blocker-inventory',
      ],
      isExecutionOrder: false,
      isImplementationPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      requirements: [
        'controller-policy-field-source-evidence',
        'permission-routing-delegation-evidence',
      ],
    },
    {
      closeoutStatus: 'mapped-consistent-and-blocked',
      contractPromotionAllowed: false,
      group: 'payload-contracts',
      inputs: [
        'non-evidence-blocker-pre-contract-evidence-requirement-mapping',
        'pre-contract-evidence-requirement-consistency',
        'positive-gate-precondition-closeout',
        'remaining-non-evidence-production-blocker-inventory',
      ],
      isExecutionOrder: false,
      isImplementationPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      requirements: [
        'payload-contract-shape-evidence',
        'phase-port-payload-source-evidence',
      ],
    },
    {
      closeoutStatus: 'mapped-consistent-and-blocked',
      contractPromotionAllowed: false,
      group: 'runtime-action-semantics',
      inputs: [
        'non-evidence-blocker-pre-contract-evidence-requirement-mapping',
        'pre-contract-evidence-requirement-consistency',
        'positive-gate-precondition-closeout',
        'production-wiring-gate-closeout-summary',
        'runtime-boundary-contract',
      ],
      isExecutionOrder: false,
      isImplementationPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      requirements: [
        'runtime-action-semantics-evidence',
        'fixed-tool-chain-prohibition-preservation-evidence',
      ],
    },
  ],
  summaryDecision: 'requirements-closeout-positive-gate-closed',
} as const satisfies PreContractEvidenceRequirementCloseoutCheckpoint;

function rowForGroup(group: PreContractEvidenceRequirementCloseoutGroup) {
  const row = preContractEvidenceRequirementCloseoutCheckpoint.rows.find((candidate) => candidate.group === group);
  assert.ok(row, `${group} should exist in the pre-contract evidence requirement closeout checkpoint.`);
  return row;
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
const closeoutSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-pre-contract-evidence-requirement-closeout-checkpoint-smoke.ts',
);
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

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');
assert.equal(boundaryContract.mode, 'contract-only');

assert.equal(preContractEvidenceRequirementCloseoutCheckpoint.productionAuthority, false);
assert.equal(preContractEvidenceRequirementCloseoutCheckpoint.productionReady, false);
assert.equal(preContractEvidenceRequirementCloseoutCheckpoint.positiveGateAllowed, false);
assert.equal(preContractEvidenceRequirementCloseoutCheckpoint.isProductionWiringPlan, false);
assert.equal(
  preContractEvidenceRequirementCloseoutCheckpoint.summaryDecision,
  'requirements-closeout-positive-gate-closed',
);

assert.deepEqual(
  preContractEvidenceRequirementCloseoutCheckpoint.rows.map((row) => row.group).sort(),
  [
    'controller-policy-contracts',
    'debug-shadow-attachment',
    'payload-contracts',
    'production-adapter-contracts',
    'production-ownership',
    'runtime-action-semantics',
  ],
);
assert.deepEqual(
  uniqueSorted(preContractEvidenceRequirementCloseoutCheckpoint.rows.flatMap((row) => row.requirements)),
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

for (const row of preContractEvidenceRequirementCloseoutCheckpoint.rows) {
  assert.equal(row.closeoutStatus, 'mapped-consistent-and-blocked');
  assert.equal(row.contractPromotionAllowed, false);
  assert.equal(row.isExecutionOrder, false);
  assert.equal(row.isImplementationPlan, false);
  assert.equal(row.productionAuthority, false);
  assert.equal(row.productionReady, false);
  assert.equal(row.positiveGateAllowed, false);
  assert.ok(row.inputs.includes('non-evidence-blocker-pre-contract-evidence-requirement-mapping'));
  assert.ok(row.inputs.includes('pre-contract-evidence-requirement-consistency'));
  assert.ok(row.inputs.includes('positive-gate-precondition-closeout'));

  for (const requirement of row.requirements) {
    assertContains(requirementMappingSmokeSource, requirement, 'requirement mapping smoke');
    assertContains(consistencySmokeSource, requirement, 'consistency smoke');
  }
}

assert.deepEqual(rowForGroup('production-ownership').requirements, ['production-ownership-decision-evidence']);
assert.deepEqual(rowForGroup('debug-shadow-attachment').requirements, ['non-debug-attachment-scope-evidence']);
assert.deepEqual(rowForGroup('production-adapter-contracts').requirements, [
  'adapter-responsibility-evidence',
  'tool-execution-delegation-evidence',
]);
assert.deepEqual(rowForGroup('controller-policy-contracts').requirements, [
  'controller-policy-field-source-evidence',
  'permission-routing-delegation-evidence',
]);
assert.deepEqual(rowForGroup('payload-contracts').requirements, [
  'payload-contract-shape-evidence',
  'phase-port-payload-source-evidence',
]);
assert.deepEqual(rowForGroup('runtime-action-semantics').requirements, [
  'runtime-action-semantics-evidence',
  'fixed-tool-chain-prohibition-preservation-evidence',
]);

assertContains(requirementMappingSmokeSource, 'requirements-mapped-positive-gate-closed', 'requirement mapping smoke');
assertContains(consistencySmokeSource, 'requirements-consistent-positive-gate-closed', 'consistency smoke');
assertContains(inventorySmokeSource, 'non-evidence-blockers-remain-positive-gate-closed', 'remaining blocker inventory smoke');
assertContains(positiveGateCloseoutSmokeSource, 'positive-gate-remains-closed', 'positive gate closeout smoke');
assertContains(gateCloseoutSummarySmokeSource, 'production-wiring-deferred', 'gate closeout summary smoke');
assertContains(boundarySource, 'AgentSessionV2 remains the production orchestrator', 'runtime boundary');
assertContains(boundarySource, 'no required ordered tool workflow', 'runtime boundary');

assertContains(auditText, 'Pre-Contract Evidence Requirement Closeout Checkpoint Status', 'preflight audit');
assertContains(auditText, 'requirement mapping and consistency coverage are closed out but contract promotion remains blocked', 'preflight audit');
assertContains(statusText, 'V3 runtime boundary pre-contract evidence requirement closeout checkpoint', 'status');
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-pre-contract-evidence-requirement-closeout-checkpoint-smoke.ts',
  'status',
);
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

const serializedCheckpoint = JSON.stringify(preContractEvidenceRequirementCloseoutCheckpoint);
assert.doesNotMatch(
  serializedCheckpoint,
  /productionAuthority":true|productionReady":true|positiveGateAllowed":true|contractPromotionAllowed":true/u,
  'Pre-contract evidence requirement closeout must not grant production readiness, contract promotion, or authority.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /isProductionWiringPlan":true|ready-for-production-wiring|production-wiring-ready|productionGateCleared":true/u,
  'Pre-contract evidence requirement closeout must not become a production wiring plan or clear the gate.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /adapterContractPromotionAllowed|payloadContractPromotionAllowed|formalPolicyContractReady|formalContractReady/u,
  'Pre-contract evidence requirement closeout should not promote payload, adapter, or controller contracts.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Pre-contract evidence requirement closeout should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Pre-contract evidence requirement closeout should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain|requiredReportOrder|implementationQueue|orderedSteps/iu,
  'Pre-contract evidence requirement closeout should not define fixed workflows, required report order, or task queues.',
);

assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Pre-contract evidence requirement closeout must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Pre-contract evidence requirement closeout must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  closeoutSmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Pre-contract evidence requirement closeout smoke should not call production v2 modules.',
);

console.log('agent session v3 runtime boundary pre-contract evidence requirement closeout checkpoint smoke ok');
