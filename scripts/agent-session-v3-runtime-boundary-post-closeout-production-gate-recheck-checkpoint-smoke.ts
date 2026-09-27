import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { readProjectFile } from './smokeTestHarness.ts';

type PostCloseoutProductionGateRecheckInput =
  | 'non-evidence-blocker-pre-contract-evidence-requirement-mapping'
  | 'positive-gate-precondition-closeout'
  | 'pre-contract-evidence-requirement-closeout'
  | 'pre-contract-evidence-requirement-consistency'
  | 'production-authority-drift-final-guard'
  | 'production-wiring-gate-closeout-summary'
  | 'runtime-boundary-contract';

type PostCloseoutProductionGateRecheckCheck =
  | 'agent-session-v2-production-owner-retained'
  | 'contract-promotion-remains-blocked'
  | 'fixed-tool-chain-prohibition-preserved'
  | 'no-controller-or-adapter-contract-promotion'
  | 'no-production-authority-drift'
  | 'no-production-wiring-plan'
  | 'positive-gate-remains-closed'
  | 'runtime-action-order-not-defined';

interface PostCloseoutProductionGateRecheckRow {
  check: PostCloseoutProductionGateRecheckCheck;
  contractPromotionAllowed: false;
  gateStatus: 'closed-after-recheck';
  inputs: readonly PostCloseoutProductionGateRecheckInput[];
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
}

interface PostCloseoutProductionGateRecheckCheckpoint {
  gate: 'post-closeout-production-gate-recheck';
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly PostCloseoutProductionGateRecheckRow[];
  summaryDecision: 'post-closeout-positive-gate-remains-closed';
}

const sharedInputs = [
  'pre-contract-evidence-requirement-closeout',
  'pre-contract-evidence-requirement-consistency',
  'non-evidence-blocker-pre-contract-evidence-requirement-mapping',
  'production-wiring-gate-closeout-summary',
  'production-authority-drift-final-guard',
  'positive-gate-precondition-closeout',
  'runtime-boundary-contract',
] as const satisfies readonly PostCloseoutProductionGateRecheckInput[];

const postCloseoutProductionGateRecheckCheckpoint = {
  gate: 'post-closeout-production-gate-recheck',
  isImplementationPlan: false,
  isProductionWiringPlan: false,
  positiveGateAllowed: false,
  productionAuthority: false,
  productionReady: false,
  rows: [
    {
      check: 'positive-gate-remains-closed',
      contractPromotionAllowed: false,
      gateStatus: 'closed-after-recheck',
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
    {
      check: 'no-production-authority-drift',
      contractPromotionAllowed: false,
      gateStatus: 'closed-after-recheck',
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
    {
      check: 'contract-promotion-remains-blocked',
      contractPromotionAllowed: false,
      gateStatus: 'closed-after-recheck',
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
    {
      check: 'agent-session-v2-production-owner-retained',
      contractPromotionAllowed: false,
      gateStatus: 'closed-after-recheck',
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
    {
      check: 'no-controller-or-adapter-contract-promotion',
      contractPromotionAllowed: false,
      gateStatus: 'closed-after-recheck',
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
    {
      check: 'runtime-action-order-not-defined',
      contractPromotionAllowed: false,
      gateStatus: 'closed-after-recheck',
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
    {
      check: 'fixed-tool-chain-prohibition-preserved',
      contractPromotionAllowed: false,
      gateStatus: 'closed-after-recheck',
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
    {
      check: 'no-production-wiring-plan',
      contractPromotionAllowed: false,
      gateStatus: 'closed-after-recheck',
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
  ],
  summaryDecision: 'post-closeout-positive-gate-remains-closed',
} as const satisfies PostCloseoutProductionGateRecheckCheckpoint;

function assertContains(text: string, expected: string, label: string) {
  assert.ok(text.includes(expected), `${label} should include: ${expected}`);
}

function rowForCheck(check: PostCloseoutProductionGateRecheckCheck) {
  const row = postCloseoutProductionGateRecheckCheckpoint.rows.find((candidate) => candidate.check === check);
  assert.ok(row, `${check} should exist in the post-closeout production gate recheck checkpoint.`);
  return row;
}

const boundarySource = readProjectFile('src/agent/agentSessionV3RuntimeBoundary.ts');
const auditText = readProjectFile('PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md');
const statusText = readProjectFile('PROJECT_AGENT_V2_STATUS.md');
const recheckSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-post-closeout-production-gate-recheck-checkpoint-smoke.ts',
);
const closeoutSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-pre-contract-evidence-requirement-closeout-checkpoint-smoke.ts',
);
const consistencySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-pre-contract-evidence-requirement-consistency-checkpoint-smoke.ts',
);
const requirementMappingSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-non-evidence-blocker-pre-contract-evidence-requirement-mapping-checkpoint-smoke.ts',
);
const gateCloseoutSummarySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-production-wiring-gate-closeout-summary-checkpoint-smoke.ts',
);
const authorityDriftSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-production-authority-drift-final-guard-smoke.ts',
);
const positiveGateCloseoutSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-production-wiring-positive-gate-precondition-closeout-gate-smoke.ts',
);

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');
assert.equal(boundaryContract.mode, 'contract-only');
assert.ok(boundaryContract.guardrails.includes('AgentSessionV2 remains the production orchestrator'));
assert.ok(boundaryContract.guardrails.includes('no required ordered tool workflow'));
assert.ok(boundaryContract.guardrails.includes('no evidence adapter gains runtime authority'));

assert.equal(postCloseoutProductionGateRecheckCheckpoint.productionAuthority, false);
assert.equal(postCloseoutProductionGateRecheckCheckpoint.productionReady, false);
assert.equal(postCloseoutProductionGateRecheckCheckpoint.positiveGateAllowed, false);
assert.equal(postCloseoutProductionGateRecheckCheckpoint.isProductionWiringPlan, false);
assert.equal(postCloseoutProductionGateRecheckCheckpoint.isImplementationPlan, false);
assert.equal(
  postCloseoutProductionGateRecheckCheckpoint.summaryDecision,
  'post-closeout-positive-gate-remains-closed',
);

assert.deepEqual(
  postCloseoutProductionGateRecheckCheckpoint.rows.map((row) => row.check).sort(),
  [
    'agent-session-v2-production-owner-retained',
    'contract-promotion-remains-blocked',
    'fixed-tool-chain-prohibition-preserved',
    'no-controller-or-adapter-contract-promotion',
    'no-production-authority-drift',
    'no-production-wiring-plan',
    'positive-gate-remains-closed',
    'runtime-action-order-not-defined',
  ],
);

for (const row of postCloseoutProductionGateRecheckCheckpoint.rows) {
  assert.equal(row.gateStatus, 'closed-after-recheck');
  assert.equal(row.contractPromotionAllowed, false);
  assert.equal(row.isExecutionOrder, false);
  assert.equal(row.isImplementationPlan, false);
  assert.equal(row.isProductionWiringPlan, false);
  assert.equal(row.productionAuthority, false);
  assert.equal(row.productionReady, false);
  assert.equal(row.positiveGateAllowed, false);
  assert.deepEqual(row.inputs, sharedInputs);
}

assert.equal(rowForCheck('positive-gate-remains-closed').positiveGateAllowed, false);
assert.equal(rowForCheck('no-production-authority-drift').productionAuthority, false);
assert.equal(rowForCheck('contract-promotion-remains-blocked').contractPromotionAllowed, false);
assert.equal(rowForCheck('no-production-wiring-plan').isProductionWiringPlan, false);
assert.equal(rowForCheck('runtime-action-order-not-defined').isExecutionOrder, false);

assertContains(closeoutSmokeSource, 'requirements-closeout-positive-gate-closed', 'closeout smoke');
assertContains(closeoutSmokeSource, 'mapped-consistent-and-blocked', 'closeout smoke');
assertContains(consistencySmokeSource, 'requirements-consistent-positive-gate-closed', 'consistency smoke');
assertContains(requirementMappingSmokeSource, 'requirements-mapped-positive-gate-closed', 'requirement mapping smoke');
assertContains(gateCloseoutSummarySmokeSource, 'production-wiring-deferred', 'gate closeout summary smoke');
assertContains(authorityDriftSmokeSource, 'no-production-authority-drift-detected', 'authority drift smoke');
assertContains(positiveGateCloseoutSmokeSource, 'positive-gate-remains-closed', 'positive gate closeout smoke');
assertContains(boundarySource, 'AgentSessionV2 remains the production orchestrator', 'runtime boundary');
assertContains(boundarySource, 'no required ordered tool workflow', 'runtime boundary');

assertContains(auditText, 'Post-Closeout Production Gate Recheck Checkpoint Status', 'preflight audit');
assertContains(auditText, 'post-closeout positive gate remains closed', 'preflight audit');
assertContains(statusText, 'V3 runtime boundary post-closeout production gate recheck checkpoint', 'status');
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-post-closeout-production-gate-recheck-checkpoint-smoke.ts',
  'status',
);
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

const serializedCheckpoint = JSON.stringify(postCloseoutProductionGateRecheckCheckpoint);
assert.doesNotMatch(
  serializedCheckpoint,
  /productionAuthority":true|productionReady":true|positiveGateAllowed":true|contractPromotionAllowed":true/u,
  'Post-closeout production gate recheck must not grant production readiness, contract promotion, or authority.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /isProductionWiringPlan":true|isImplementationPlan":true|production-wiring-ready|ready-for-production-wiring/u,
  'Post-closeout production gate recheck must not become an implementation plan or production wiring plan.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /adapterContractPromotionAllowed|payloadContractPromotionAllowed|formalPolicyContractReady|formalContractReady/u,
  'Post-closeout production gate recheck should not promote payload, adapter, or controller contracts.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Post-closeout production gate recheck should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Post-closeout production gate recheck should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain|requiredReportOrder|implementationQueue|orderedSteps/iu,
  'Post-closeout production gate recheck should not define fixed workflows, required report order, or task queues.',
);

assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Post-closeout production gate recheck must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Post-closeout production gate recheck must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  recheckSmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Post-closeout production gate recheck smoke should not call production v2 modules.',
);

console.log('agent session v3 runtime boundary post-closeout production gate recheck checkpoint smoke ok');
