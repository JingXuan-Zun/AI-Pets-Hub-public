import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { readProjectFile } from './smokeTestHarness.ts';

type PostRecheckRemainingBlockerHandoffInput =
  | 'evidence-interpretation-to-production-gate-mapping'
  | 'post-closeout-production-gate-recheck'
  | 'pre-contract-evidence-requirement-closeout'
  | 'production-authority-drift-final-guard'
  | 'production-wiring-gate-closeout-summary'
  | 'remaining-non-evidence-production-blocker-inventory'
  | 'runtime-boundary-contract';

type PostRecheckRemainingBlockerHandoffGroup =
  | 'real-trace-evidence'
  | 'production-ownership'
  | 'debug-shadow-attachment'
  | 'production-adapter-contracts'
  | 'controller-policy-contracts'
  | 'payload-contracts'
  | 'runtime-action-semantics';

type PostRecheckRemainingBlocker =
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

type PostRecheckRemainingBlockerSource =
  | 'current-evidence-blocker'
  | 'remaining-non-evidence-blocker';

interface PostRecheckRemainingBlockerHandoffRow {
  blockers: readonly PostRecheckRemainingBlocker[];
  blockerSource: PostRecheckRemainingBlockerSource;
  contractPromotionAllowed: false;
  group: PostRecheckRemainingBlockerHandoffGroup;
  handoffStatus: 'handoff-only-still-blocked';
  inputs: readonly PostRecheckRemainingBlockerHandoffInput[];
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
}

interface PostRecheckRemainingBlockerHandoffCheckpoint {
  gate: 'post-recheck-remaining-blocker-handoff';
  handoffScope: 'non-production-blocker-readout';
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly PostRecheckRemainingBlockerHandoffRow[];
  summaryDecision: 'remaining-blockers-handed-off-positive-gate-closed';
}

const sharedInputs = [
  'post-closeout-production-gate-recheck',
  'remaining-non-evidence-production-blocker-inventory',
  'evidence-interpretation-to-production-gate-mapping',
  'pre-contract-evidence-requirement-closeout',
  'production-wiring-gate-closeout-summary',
  'production-authority-drift-final-guard',
  'runtime-boundary-contract',
] as const satisfies readonly PostRecheckRemainingBlockerHandoffInput[];

const postRecheckRemainingBlockerHandoffCheckpoint = {
  gate: 'post-recheck-remaining-blocker-handoff',
  handoffScope: 'non-production-blocker-readout',
  isImplementationPlan: false,
  isProductionWiringPlan: false,
  positiveGateAllowed: false,
  productionAuthority: false,
  productionReady: false,
  rows: [
    {
      blockers: ['missing-real-or-production-like-traces'],
      blockerSource: 'current-evidence-blocker',
      contractPromotionAllowed: false,
      group: 'real-trace-evidence',
      handoffStatus: 'handoff-only-still-blocked',
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
    {
      blockers: ['agent-session-v2-production-owner-retained'],
      blockerSource: 'remaining-non-evidence-blocker',
      contractPromotionAllowed: false,
      group: 'production-ownership',
      handoffStatus: 'handoff-only-still-blocked',
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
    {
      blockers: ['v3-pilot-shadow-debug-only'],
      blockerSource: 'remaining-non-evidence-blocker',
      contractPromotionAllowed: false,
      group: 'debug-shadow-attachment',
      handoffStatus: 'handoff-only-still-blocked',
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
    {
      blockers: [
        'production-adapter-contracts-missing',
        'tool-execution-ownership-not-delegated',
      ],
      blockerSource: 'remaining-non-evidence-blocker',
      contractPromotionAllowed: false,
      group: 'production-adapter-contracts',
      handoffStatus: 'handoff-only-still-blocked',
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
    {
      blockers: [
        'controller-policy-contracts-missing',
        'permission-routing-ownership-not-delegated',
      ],
      blockerSource: 'remaining-non-evidence-blocker',
      contractPromotionAllowed: false,
      group: 'controller-policy-contracts',
      handoffStatus: 'handoff-only-still-blocked',
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
    {
      blockers: [
        'broad-stop-payload-contract-promotion-blocked',
        'phase-port-payload-contracts-missing',
      ],
      blockerSource: 'remaining-non-evidence-blocker',
      contractPromotionAllowed: false,
      group: 'payload-contracts',
      handoffStatus: 'handoff-only-still-blocked',
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
    {
      blockers: [
        'runtime-action-order-not-owned-by-v3',
        'fixed-tool-chain-prohibited',
      ],
      blockerSource: 'remaining-non-evidence-blocker',
      contractPromotionAllowed: false,
      group: 'runtime-action-semantics',
      handoffStatus: 'handoff-only-still-blocked',
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
  ],
  summaryDecision: 'remaining-blockers-handed-off-positive-gate-closed',
} as const satisfies PostRecheckRemainingBlockerHandoffCheckpoint;

function assertContains(text: string, expected: string, label: string) {
  assert.ok(text.includes(expected), `${label} should include: ${expected}`);
}

function rowForGroup(group: PostRecheckRemainingBlockerHandoffGroup) {
  const row = postRecheckRemainingBlockerHandoffCheckpoint.rows.find((candidate) => candidate.group === group);
  assert.ok(row, `${group} should exist in the post-recheck remaining blocker handoff checkpoint.`);
  return row;
}

function rowsForBlocker(blocker: PostRecheckRemainingBlocker) {
  return postRecheckRemainingBlockerHandoffCheckpoint.rows.filter((row) => row.blockers.includes(blocker));
}

function uniqueSorted(values: readonly string[]) {
  return Array.from(new Set(values)).sort();
}

const boundarySource = readProjectFile('src/agent/agentSessionV3RuntimeBoundary.ts');
const auditText = readProjectFile('PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md');
const statusText = readProjectFile('PROJECT_AGENT_V2_STATUS.md');
const handoffSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-post-recheck-remaining-blocker-handoff-checkpoint-smoke.ts',
);
const recheckSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-post-closeout-production-gate-recheck-checkpoint-smoke.ts',
);
const inventorySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-remaining-non-evidence-production-blocker-inventory-checkpoint-smoke.ts',
);
const evidenceMappingSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-evidence-interpretation-to-production-gate-mapping-checkpoint-smoke.ts',
);
const closeoutSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-pre-contract-evidence-requirement-closeout-checkpoint-smoke.ts',
);
const gateCloseoutSummarySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-production-wiring-gate-closeout-summary-checkpoint-smoke.ts',
);
const authorityDriftSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-production-authority-drift-final-guard-smoke.ts',
);

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');
assert.equal(boundaryContract.mode, 'contract-only');
assert.ok(boundaryContract.guardrails.includes('AgentSessionV2 remains the production orchestrator'));
assert.ok(boundaryContract.guardrails.includes('no required ordered tool workflow'));
assert.ok(boundaryContract.guardrails.includes('no evidence adapter gains runtime authority'));

assert.equal(postRecheckRemainingBlockerHandoffCheckpoint.productionAuthority, false);
assert.equal(postRecheckRemainingBlockerHandoffCheckpoint.productionReady, false);
assert.equal(postRecheckRemainingBlockerHandoffCheckpoint.positiveGateAllowed, false);
assert.equal(postRecheckRemainingBlockerHandoffCheckpoint.isProductionWiringPlan, false);
assert.equal(postRecheckRemainingBlockerHandoffCheckpoint.isImplementationPlan, false);
assert.equal(postRecheckRemainingBlockerHandoffCheckpoint.handoffScope, 'non-production-blocker-readout');
assert.equal(
  postRecheckRemainingBlockerHandoffCheckpoint.summaryDecision,
  'remaining-blockers-handed-off-positive-gate-closed',
);

assert.deepEqual(
  postRecheckRemainingBlockerHandoffCheckpoint.rows.map((row) => row.group).sort(),
  [
    'controller-policy-contracts',
    'debug-shadow-attachment',
    'payload-contracts',
    'production-adapter-contracts',
    'production-ownership',
    'real-trace-evidence',
    'runtime-action-semantics',
  ],
);

const flattenedBlockers = uniqueSorted(
  postRecheckRemainingBlockerHandoffCheckpoint.rows.flatMap((row) => row.blockers),
);
assert.deepEqual(
  flattenedBlockers,
  [
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
  ],
);

for (const row of postRecheckRemainingBlockerHandoffCheckpoint.rows) {
  assert.equal(row.handoffStatus, 'handoff-only-still-blocked');
  assert.equal(row.contractPromotionAllowed, false);
  assert.equal(row.isExecutionOrder, false);
  assert.equal(row.isImplementationPlan, false);
  assert.equal(row.isProductionWiringPlan, false);
  assert.equal(row.productionAuthority, false);
  assert.equal(row.productionReady, false);
  assert.equal(row.positiveGateAllowed, false);
  assert.deepEqual(row.inputs, sharedInputs);
  assert.ok(row.blockers.length > 0);
}

assert.equal(rowForGroup('real-trace-evidence').blockerSource, 'current-evidence-blocker');
assert.ok(rowForGroup('real-trace-evidence').blockers.includes('missing-real-or-production-like-traces'));
assert.equal(rowForGroup('production-ownership').blockerSource, 'remaining-non-evidence-blocker');
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

for (const blocker of flattenedBlockers as PostRecheckRemainingBlocker[]) {
  assert.equal(rowsForBlocker(blocker).length, 1, `${blocker} should appear exactly once in the handoff rows.`);
  assertContains(evidenceMappingSmokeSource, blocker, 'evidence interpretation mapping smoke');
}

for (const blocker of flattenedBlockers.filter((blocker) => blocker !== 'missing-real-or-production-like-traces')) {
  assertContains(inventorySmokeSource, blocker, 'remaining non-evidence blocker inventory smoke');
}

assertContains(recheckSmokeSource, 'post-closeout-positive-gate-remains-closed', 'post-closeout recheck smoke');
assertContains(recheckSmokeSource, 'closed-after-recheck', 'post-closeout recheck smoke');
assertContains(inventorySmokeSource, 'non-evidence-blockers-remain-positive-gate-closed', 'remaining blocker inventory smoke');
assertContains(evidenceMappingSmokeSource, 'mapping-only-positive-gate-remains-closed', 'evidence interpretation mapping smoke');
assertContains(evidenceMappingSmokeSource, 'missing-real-or-production-like-traces', 'evidence interpretation mapping smoke');
assertContains(closeoutSmokeSource, 'requirements-closeout-positive-gate-closed', 'closeout smoke');
assertContains(gateCloseoutSummarySmokeSource, 'production-wiring-deferred', 'gate closeout summary smoke');
assertContains(authorityDriftSmokeSource, 'no-production-authority-drift-detected', 'authority drift smoke');
assertContains(boundarySource, 'AgentSessionV2 remains the production orchestrator', 'runtime boundary');
assertContains(boundarySource, 'no required ordered tool workflow', 'runtime boundary');

assertContains(auditText, 'Post-Recheck Remaining Blocker Handoff Checkpoint Status', 'preflight audit');
assertContains(auditText, 'remaining blockers are handed off while the positive gate stays closed', 'preflight audit');
assertContains(statusText, 'V3 runtime boundary post-recheck remaining blocker handoff checkpoint', 'status');
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-post-recheck-remaining-blocker-handoff-checkpoint-smoke.ts',
  'status',
);
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

const serializedCheckpoint = JSON.stringify(postRecheckRemainingBlockerHandoffCheckpoint);
assert.doesNotMatch(
  serializedCheckpoint,
  /productionAuthority":true|productionReady":true|positiveGateAllowed":true|contractPromotionAllowed":true/u,
  'Post-recheck remaining blocker handoff must not grant production readiness, contract promotion, or authority.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /isProductionWiringPlan":true|isImplementationPlan":true|production-wiring-ready|ready-for-production-wiring/u,
  'Post-recheck remaining blocker handoff must not become an implementation plan or production wiring plan.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /adapterContractPromotionAllowed|payloadContractPromotionAllowed|formalPolicyContractReady|formalContractReady/u,
  'Post-recheck remaining blocker handoff should not promote payload, adapter, or controller contracts.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Post-recheck remaining blocker handoff should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Post-recheck remaining blocker handoff should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain|requiredReportOrder|implementationQueue|orderedSteps/iu,
  'Post-recheck remaining blocker handoff should not define fixed workflows, required report order, or task queues.',
);

assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Post-recheck remaining blocker handoff must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Post-recheck remaining blocker handoff must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  handoffSmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Post-recheck remaining blocker handoff smoke should not call production v2 modules.',
);

console.log('agent session v3 runtime boundary post-recheck remaining blocker handoff checkpoint smoke ok');
