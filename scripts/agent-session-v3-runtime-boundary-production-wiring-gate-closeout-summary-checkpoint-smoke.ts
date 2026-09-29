import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { readProjectFile } from './smokeTestHarness.ts';

type ProductionWiringGateCloseoutSummaryInput =
  | 'negative-gate-blocker-rollup'
  | 'negative-gate-consistency'
  | 'positive-gate-precondition-audit'
  | 'positive-gate-precondition-consistency'
  | 'positive-gate-precondition-closeout';

type ProductionWiringGateCloseoutSummarySignal =
  | 'agent-session-v2-production-owner-retained'
  | 'debug-shadow-attachment-only'
  | 'evidence-adapters-observer-only'
  | 'future-seams-not-production-runtime'
  | 'adapter-contracts-deferred'
  | 'controller-policy-contracts-deferred'
  | 'broad-stop-payload-promotion-blocked'
  | 'phase-port-payload-contracts-deferred'
  | 'production-like-traces-missing'
  | 'permission-routing-not-delegated'
  | 'tool-execution-not-delegated'
  | 'runtime-action-order-not-owned-by-v3'
  | 'fixed-tool-chain-prohibited';

type ProductionWiringGateCloseoutSummaryBlocker =
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

interface ProductionWiringGateCloseoutSummaryRow {
  blockers: readonly ProductionWiringGateCloseoutSummaryBlocker[];
  inputs: readonly ProductionWiringGateCloseoutSummaryInput[];
  productionAuthority: false;
  productionReady: false;
  signal: ProductionWiringGateCloseoutSummarySignal;
  summaryStatus: 'blocked-and-summarized';
}

interface ProductionWiringGateCloseoutSummaryCheckpoint {
  gate: 'production-wiring-gate-closeout-summary';
  isProductionWiringPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly ProductionWiringGateCloseoutSummaryRow[];
  summaryDecision: 'production-wiring-deferred';
}

const productionWiringGateCloseoutSummaryCheckpoint = {
  gate: 'production-wiring-gate-closeout-summary',
  isProductionWiringPlan: false,
  positiveGateAllowed: false,
  productionAuthority: false,
  productionReady: false,
  rows: [
    {
      blockers: ['agent-session-v2-production-owner-retained'],
      inputs: [
        'negative-gate-blocker-rollup',
        'negative-gate-consistency',
        'positive-gate-precondition-audit',
        'positive-gate-precondition-consistency',
        'positive-gate-precondition-closeout',
      ],
      productionAuthority: false,
      productionReady: false,
      signal: 'agent-session-v2-production-owner-retained',
      summaryStatus: 'blocked-and-summarized',
    },
    {
      blockers: [
        'v3-pilot-shadow-debug-only',
        'agent-session-v2-production-owner-retained',
      ],
      inputs: [
        'negative-gate-blocker-rollup',
        'negative-gate-consistency',
        'positive-gate-precondition-audit',
        'positive-gate-precondition-consistency',
        'positive-gate-precondition-closeout',
      ],
      productionAuthority: false,
      productionReady: false,
      signal: 'debug-shadow-attachment-only',
      summaryStatus: 'blocked-and-summarized',
    },
    {
      blockers: ['agent-session-v2-production-owner-retained'],
      inputs: [
        'negative-gate-blocker-rollup',
        'negative-gate-consistency',
        'positive-gate-precondition-audit',
        'positive-gate-precondition-consistency',
        'positive-gate-precondition-closeout',
      ],
      productionAuthority: false,
      productionReady: false,
      signal: 'evidence-adapters-observer-only',
      summaryStatus: 'blocked-and-summarized',
    },
    {
      blockers: ['agent-session-v2-production-owner-retained'],
      inputs: [
        'negative-gate-blocker-rollup',
        'negative-gate-consistency',
        'positive-gate-precondition-audit',
        'positive-gate-precondition-consistency',
        'positive-gate-precondition-closeout',
      ],
      productionAuthority: false,
      productionReady: false,
      signal: 'future-seams-not-production-runtime',
      summaryStatus: 'blocked-and-summarized',
    },
    {
      blockers: [
        'production-adapter-contracts-missing',
        'missing-real-or-production-like-traces',
      ],
      inputs: [
        'negative-gate-blocker-rollup',
        'negative-gate-consistency',
        'positive-gate-precondition-audit',
        'positive-gate-precondition-consistency',
        'positive-gate-precondition-closeout',
      ],
      productionAuthority: false,
      productionReady: false,
      signal: 'adapter-contracts-deferred',
      summaryStatus: 'blocked-and-summarized',
    },
    {
      blockers: [
        'controller-policy-contracts-missing',
        'broad-stop-payload-contract-promotion-blocked',
      ],
      inputs: [
        'negative-gate-blocker-rollup',
        'negative-gate-consistency',
        'positive-gate-precondition-audit',
        'positive-gate-precondition-consistency',
        'positive-gate-precondition-closeout',
      ],
      productionAuthority: false,
      productionReady: false,
      signal: 'controller-policy-contracts-deferred',
      summaryStatus: 'blocked-and-summarized',
    },
    {
      blockers: [
        'broad-stop-payload-contract-promotion-blocked',
        'production-adapter-contracts-missing',
        'controller-policy-contracts-missing',
        'phase-port-payload-contracts-missing',
      ],
      inputs: [
        'negative-gate-blocker-rollup',
        'negative-gate-consistency',
        'positive-gate-precondition-audit',
        'positive-gate-precondition-consistency',
        'positive-gate-precondition-closeout',
      ],
      productionAuthority: false,
      productionReady: false,
      signal: 'broad-stop-payload-promotion-blocked',
      summaryStatus: 'blocked-and-summarized',
    },
    {
      blockers: [
        'phase-port-payload-contracts-missing',
        'broad-stop-payload-contract-promotion-blocked',
      ],
      inputs: [
        'negative-gate-blocker-rollup',
        'negative-gate-consistency',
        'positive-gate-precondition-audit',
        'positive-gate-precondition-consistency',
        'positive-gate-precondition-closeout',
      ],
      productionAuthority: false,
      productionReady: false,
      signal: 'phase-port-payload-contracts-deferred',
      summaryStatus: 'blocked-and-summarized',
    },
    {
      blockers: ['missing-real-or-production-like-traces'],
      inputs: [
        'negative-gate-blocker-rollup',
        'negative-gate-consistency',
        'positive-gate-precondition-audit',
        'positive-gate-precondition-consistency',
        'positive-gate-precondition-closeout',
      ],
      productionAuthority: false,
      productionReady: false,
      signal: 'production-like-traces-missing',
      summaryStatus: 'blocked-and-summarized',
    },
    {
      blockers: [
        'permission-routing-ownership-not-delegated',
        'controller-policy-contracts-missing',
      ],
      inputs: [
        'negative-gate-blocker-rollup',
        'negative-gate-consistency',
        'positive-gate-precondition-audit',
        'positive-gate-precondition-consistency',
        'positive-gate-precondition-closeout',
      ],
      productionAuthority: false,
      productionReady: false,
      signal: 'permission-routing-not-delegated',
      summaryStatus: 'blocked-and-summarized',
    },
    {
      blockers: [
        'tool-execution-ownership-not-delegated',
        'production-adapter-contracts-missing',
      ],
      inputs: [
        'negative-gate-blocker-rollup',
        'negative-gate-consistency',
        'positive-gate-precondition-audit',
        'positive-gate-precondition-consistency',
        'positive-gate-precondition-closeout',
      ],
      productionAuthority: false,
      productionReady: false,
      signal: 'tool-execution-not-delegated',
      summaryStatus: 'blocked-and-summarized',
    },
    {
      blockers: [
        'runtime-action-order-not-owned-by-v3',
        'fixed-tool-chain-prohibited',
      ],
      inputs: [
        'negative-gate-blocker-rollup',
        'negative-gate-consistency',
        'positive-gate-precondition-audit',
        'positive-gate-precondition-consistency',
        'positive-gate-precondition-closeout',
      ],
      productionAuthority: false,
      productionReady: false,
      signal: 'runtime-action-order-not-owned-by-v3',
      summaryStatus: 'blocked-and-summarized',
    },
    {
      blockers: ['fixed-tool-chain-prohibited'],
      inputs: [
        'negative-gate-blocker-rollup',
        'negative-gate-consistency',
        'positive-gate-precondition-audit',
        'positive-gate-precondition-consistency',
        'positive-gate-precondition-closeout',
      ],
      productionAuthority: false,
      productionReady: false,
      signal: 'fixed-tool-chain-prohibited',
      summaryStatus: 'blocked-and-summarized',
    },
  ],
  summaryDecision: 'production-wiring-deferred',
} as const satisfies ProductionWiringGateCloseoutSummaryCheckpoint;

function rowsForBlocker(blocker: ProductionWiringGateCloseoutSummaryBlocker) {
  return productionWiringGateCloseoutSummaryCheckpoint.rows.filter((row) => row.blockers.includes(blocker));
}

function rowForSignal(signal: ProductionWiringGateCloseoutSummarySignal) {
  const row = productionWiringGateCloseoutSummaryCheckpoint.rows.find((candidate) => candidate.signal === signal);
  assert.ok(row, `${signal} should exist in the production wiring gate closeout summary checkpoint.`);
  return row;
}

function assertSourceContains(source: string, expected: string, label: string) {
  assert.match(source, new RegExp(expected, 'u'), `${label} should contain ${expected}.`);
}

const auditText = readProjectFile('PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md');
const statusText = readProjectFile('PROJECT_AGENT_V2_STATUS.md');
const boundarySource = readProjectFile('src/agent/agentSessionV3RuntimeBoundary.ts');
const summarySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-production-wiring-gate-closeout-summary-checkpoint-smoke.ts',
);
const negativeGateSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-production-wiring-negative-gate-blocker-rollup-checkpoint-smoke.ts',
);
const negativeGateConsistencySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-production-wiring-negative-gate-consistency-checkpoint-smoke.ts',
);
const preconditionAuditSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-production-wiring-positive-gate-precondition-audit-smoke.ts',
);
const preconditionConsistencySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-production-wiring-positive-gate-precondition-consistency-checkpoint-smoke.ts',
);
const closeoutGateSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-production-wiring-positive-gate-precondition-closeout-gate-smoke.ts',
);

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');
assert.equal(boundaryContract.mode, 'contract-only');

assert.equal(productionWiringGateCloseoutSummaryCheckpoint.productionAuthority, false);
assert.equal(productionWiringGateCloseoutSummaryCheckpoint.productionReady, false);
assert.equal(productionWiringGateCloseoutSummaryCheckpoint.positiveGateAllowed, false);
assert.equal(productionWiringGateCloseoutSummaryCheckpoint.isProductionWiringPlan, false);
assert.equal(productionWiringGateCloseoutSummaryCheckpoint.summaryDecision, 'production-wiring-deferred');

assert.deepEqual(
  productionWiringGateCloseoutSummaryCheckpoint.rows.map((row) => row.signal).sort(),
  [
    'adapter-contracts-deferred',
    'agent-session-v2-production-owner-retained',
    'broad-stop-payload-promotion-blocked',
    'controller-policy-contracts-deferred',
    'debug-shadow-attachment-only',
    'evidence-adapters-observer-only',
    'fixed-tool-chain-prohibited',
    'future-seams-not-production-runtime',
    'permission-routing-not-delegated',
    'phase-port-payload-contracts-deferred',
    'production-like-traces-missing',
    'runtime-action-order-not-owned-by-v3',
    'tool-execution-not-delegated',
  ],
);

for (const row of productionWiringGateCloseoutSummaryCheckpoint.rows) {
  assert.equal(row.summaryStatus, 'blocked-and-summarized');
  assert.equal(row.productionAuthority, false);
  assert.equal(row.productionReady, false);
  assert.ok(row.inputs.includes('negative-gate-blocker-rollup'));
  assert.ok(row.inputs.includes('negative-gate-consistency'));
  assert.ok(row.inputs.includes('positive-gate-precondition-audit'));
  assert.ok(row.inputs.includes('positive-gate-precondition-consistency'));
  assert.ok(row.inputs.includes('positive-gate-precondition-closeout'));
  assert.ok(row.blockers.length > 0);

  for (const blocker of row.blockers) {
    assertSourceContains(negativeGateSmokeSource, blocker, 'negative gate blocker rollup smoke');
    assertSourceContains(negativeGateConsistencySmokeSource, blocker, 'negative gate consistency smoke');
    assertSourceContains(preconditionAuditSmokeSource, blocker, 'positive-gate precondition audit smoke');
    assertSourceContains(preconditionConsistencySmokeSource, blocker, 'positive-gate precondition consistency smoke');
    assertSourceContains(closeoutGateSmokeSource, blocker, 'positive-gate precondition closeout smoke');
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
] as const satisfies readonly ProductionWiringGateCloseoutSummaryBlocker[]) {
  assert.ok(rowsForBlocker(blocker).length > 0, `${blocker} should remain represented in the closeout summary.`);
}

assert.ok(rowForSignal('agent-session-v2-production-owner-retained').blockers.includes('agent-session-v2-production-owner-retained'));
assert.ok(rowForSignal('debug-shadow-attachment-only').blockers.includes('v3-pilot-shadow-debug-only'));
assert.ok(rowForSignal('adapter-contracts-deferred').blockers.includes('production-adapter-contracts-missing'));
assert.ok(rowForSignal('controller-policy-contracts-deferred').blockers.includes('controller-policy-contracts-missing'));
assert.ok(rowForSignal('broad-stop-payload-promotion-blocked').blockers.includes('broad-stop-payload-contract-promotion-blocked'));
assert.ok(rowForSignal('phase-port-payload-contracts-deferred').blockers.includes('phase-port-payload-contracts-missing'));
assert.ok(rowForSignal('production-like-traces-missing').blockers.includes('missing-real-or-production-like-traces'));
assert.ok(rowForSignal('permission-routing-not-delegated').blockers.includes('permission-routing-ownership-not-delegated'));
assert.ok(rowForSignal('tool-execution-not-delegated').blockers.includes('tool-execution-ownership-not-delegated'));
assert.ok(rowForSignal('runtime-action-order-not-owned-by-v3').blockers.includes('runtime-action-order-not-owned-by-v3'));
assert.ok(rowForSignal('fixed-tool-chain-prohibited').blockers.includes('fixed-tool-chain-prohibited'));

assert.match(boundarySource, /productionAuthority: false/u);
assert.match(boundarySource, /contract-only/u);
assert.match(boundarySource, /AgentSessionV2 remains the production orchestrator/u);
assert.match(boundarySource, /no required ordered tool workflow/u);
assert.match(auditText, /Production Wiring Negative Gate And Blocker Rollup Checkpoint Status/u);
assert.match(auditText, /Production Wiring Negative Gate Consistency Checkpoint Status/u);
assert.match(auditText, /Production Wiring Positive-Gate Precondition Audit Status/u);
assert.match(auditText, /Production Wiring Positive-Gate Precondition Consistency Checkpoint Status/u);
assert.match(auditText, /Production Wiring Positive-Gate Precondition Closeout Gate Status/u);
assert.match(auditText, /Production Wiring Gate Closeout Summary Checkpoint Status/u);
assert.match(auditText, /production wiring remains deferred/u);
assert.match(auditText, /non-production summary, not a production wiring plan/u);

const serializedSummary = JSON.stringify(productionWiringGateCloseoutSummaryCheckpoint);
assert.doesNotMatch(
  serializedSummary,
  /productionAuthority":true|productionReady":true|positiveGateAllowed":true/u,
  'Production wiring gate closeout summary must not open a positive gate or grant production authority.',
);
assert.doesNotMatch(
  serializedSummary,
  /isProductionWiringPlan":true|decision":"ready-for-production-wiring/u,
  'Production wiring gate closeout summary must not become a production wiring plan.',
);
assert.doesNotMatch(
  serializedSummary,
  /adapterContractPromotionAllowed|payloadContractPromotionAllowed|formalPolicyContractReady|formalContractReady/u,
  'Production wiring gate closeout summary should not promote payload, adapter, or controller contracts.',
);
assert.doesNotMatch(
  serializedSummary,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Production wiring gate closeout summary should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedSummary,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Production wiring gate closeout summary should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedSummary,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain/iu,
  'Production wiring gate closeout summary should not define fixed workflows or fallback chains.',
);
assert.doesNotMatch(
  serializedSummary,
  /implementationQueue|orderedSteps|runtimeAuthority|experimental-adapter/u,
  'Production wiring gate closeout summary should remain a non-production summary.',
);

assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Production wiring gate closeout summary must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Production wiring gate closeout summary must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  summarySmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Production wiring gate closeout summary smoke should not call production v2 modules.',
);

assert.match(
  auditText,
  /agent-session-v3-runtime-boundary-production-wiring-gate-closeout-summary-checkpoint-smoke\.ts/u,
);
assert.match(statusText, /V3 runtime boundary production wiring gate closeout summary checkpoint.*Completed/u);
assert.match(
  statusText,
  /agent-session-v3-runtime-boundary-production-wiring-gate-closeout-summary-checkpoint-smoke\.ts/u,
);
assert.match(statusText, /Overall practical runtime including v3: about 99\.2%/u);
assert.match(statusText, /v3 full runtime preflight\/pilot: about 99\.2%/u);

console.log('agent session v3 runtime boundary production wiring gate closeout summary checkpoint smoke ok');
