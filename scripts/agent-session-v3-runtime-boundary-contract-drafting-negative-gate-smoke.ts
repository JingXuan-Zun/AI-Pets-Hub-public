import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { readProjectFile } from './smokeTestHarness.ts';

type GateReason =
  | 'contract-drafting-preconditions-missing'
  | 'future-owner-only'
  | 'no-contract-interface-drafted'
  | 'no-production-adapter-interface'
  | 'no-controller-policy-interface'
  | 'no-production-authority'
  | 'agent-session-v2-remains-owner'
  | 'no-fixed-runtime-action-order';

type Source =
  | 'owner-contract-preconditions'
  | 'owner-consistency'
  | 'owner-consolidation'
  | 'runtime-boundary-contract'
  | 'preflight-audit'
  | 'status-page';

interface NegativeGateRow {
  contractDraftingReady: false;
  gateReason: GateReason;
  isContractDraft: false;
  isExecutionOrder: false;
  isProductionWiringPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  sources: readonly Source[];
  status: 'negative-gate-closed';
}

interface NegativeGateCheckpoint {
  checkpoint: 'future-owner-contract-drafting-readiness-negative-gate';
  contractDraftingReady: false;
  isContractDraft: false;
  isExecutionOrder: false;
  isProductionWiringPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly NegativeGateRow[];
  summaryDecision: 'future-owner-contract-drafting-negative-gate-remains-closed';
}

const sources = [
  'owner-contract-preconditions',
  'owner-consistency',
  'owner-consolidation',
  'runtime-boundary-contract',
  'preflight-audit',
  'status-page',
] as const satisfies readonly Source[];

function row(gateReason: GateReason) {
  return {
    contractDraftingReady: false,
    gateReason,
    isContractDraft: false,
    isExecutionOrder: false,
    isProductionWiringPlan: false,
    positiveGateAllowed: false,
    productionAuthority: false,
    productionReady: false,
    sources,
    status: 'negative-gate-closed',
  } as const satisfies NegativeGateRow;
}

const checkpoint = {
  checkpoint: 'future-owner-contract-drafting-readiness-negative-gate',
  contractDraftingReady: false,
  isContractDraft: false,
  isExecutionOrder: false,
  isProductionWiringPlan: false,
  positiveGateAllowed: false,
  productionAuthority: false,
  productionReady: false,
  rows: [
    row('contract-drafting-preconditions-missing'),
    row('future-owner-only'),
    row('no-contract-interface-drafted'),
    row('no-production-adapter-interface'),
    row('no-controller-policy-interface'),
    row('no-production-authority'),
    row('agent-session-v2-remains-owner'),
    row('no-fixed-runtime-action-order'),
  ],
  summaryDecision: 'future-owner-contract-drafting-negative-gate-remains-closed',
} as const satisfies NegativeGateCheckpoint;

function assertContains(text: string, expected: string, label: string) {
  assert.ok(text.includes(expected), `${label} should include: ${expected}`);
}

function uniqueSorted(values: readonly string[]) {
  return Array.from(new Set(values)).sort();
}

function stripNegativeAssertionBlocks(text: string) {
  const keptLines: string[] = [];
  let skipping = false;

  for (const line of text.split(/\r?\n/u)) {
    if (line.includes('assert.doesNotMatch(')) {
      skipping = true;
      continue;
    }

    if (skipping) {
      if (line.trim() === ');') {
        skipping = false;
      }
      continue;
    }

    keptLines.push(line);
  }

  return keptLines.join('\n');
}

const boundarySource = readProjectFile('src/agent/agentSessionV3RuntimeBoundary.ts');
const auditText = readProjectFile('PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md');
const statusText = readProjectFile('PROJECT_AGENT_V2_STATUS.md');
const preconditionSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-owner-contract-preconditions-checkpoint-smoke.ts',
);
const ownerConsistencySource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-owner-consistency-checkpoint-smoke.ts',
);
const ownerConsolidationSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-remaining-production-blocker-contract-owner-consolidation-checkpoint-smoke.ts',
);

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');
assert.equal(boundaryContract.mode, 'contract-only');
assert.ok(boundaryContract.guardrails.includes('AgentSessionV2 remains the production orchestrator'));
assert.ok(boundaryContract.guardrails.includes('no required ordered tool workflow'));
assert.ok(boundaryContract.guardrails.includes('no evidence adapter gains runtime authority'));

assert.equal(checkpoint.contractDraftingReady, false);
assert.equal(checkpoint.isContractDraft, false);
assert.equal(checkpoint.isExecutionOrder, false);
assert.equal(checkpoint.isProductionWiringPlan, false);
assert.equal(checkpoint.productionAuthority, false);
assert.equal(checkpoint.productionReady, false);
assert.equal(checkpoint.positiveGateAllowed, false);
assert.equal(checkpoint.summaryDecision, 'future-owner-contract-drafting-negative-gate-remains-closed');

assert.deepEqual(
  uniqueSorted(checkpoint.rows.map((candidate) => candidate.gateReason)),
  [
    'agent-session-v2-remains-owner',
    'contract-drafting-preconditions-missing',
    'future-owner-only',
    'no-contract-interface-drafted',
    'no-controller-policy-interface',
    'no-fixed-runtime-action-order',
    'no-production-adapter-interface',
    'no-production-authority',
  ],
);

for (const checkpointRow of checkpoint.rows) {
  assert.equal(checkpointRow.status, 'negative-gate-closed');
  assert.equal(checkpointRow.contractDraftingReady, false);
  assert.equal(checkpointRow.isContractDraft, false);
  assert.equal(checkpointRow.isExecutionOrder, false);
  assert.equal(checkpointRow.isProductionWiringPlan, false);
  assert.equal(checkpointRow.productionAuthority, false);
  assert.equal(checkpointRow.productionReady, false);
  assert.equal(checkpointRow.positiveGateAllowed, false);
  assert.deepEqual(checkpointRow.sources, sources);
}

assertContains(preconditionSource, 'future-owner-contract-drafting-preconditions-listed-positive-gate-closed', 'precondition source');
assertContains(preconditionSource, 'contractDraftingReady: false', 'precondition source');
assertContains(preconditionSource, 'isContractDraft: false', 'precondition source');
assertContains(ownerConsistencySource, 'future-contract-owner-categories-consistent-positive-gate-closed', 'owner consistency source');
assertContains(ownerConsolidationSource, 'remaining-production-blockers-mapped-to-future-contract-owners-positive-gate-closed', 'owner consolidation source');
assertContains(boundarySource, 'AgentSessionV2 remains the production orchestrator', 'runtime boundary');
assertContains(boundarySource, 'no required ordered tool workflow', 'runtime boundary');
assertContains(boundarySource, 'no evidence adapter gains runtime authority', 'runtime boundary');

assertContains(auditText, 'Future Owner Contract Drafting Readiness Negative Gate Checkpoint Status', 'preflight audit');
assertContains(auditText, 'future owner contract drafting negative gate remains closed', 'preflight audit');
assertContains(statusText, 'V3 runtime boundary future owner contract drafting readiness negative gate checkpoint', 'status page');
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-contract-drafting-negative-gate-smoke.ts',
  'status page',
);
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

const guardedSources = [
  ['precondition source', preconditionSource],
  ['owner consistency source', ownerConsistencySource],
  ['owner consolidation source', ownerConsolidationSource],
  ['preflight audit', auditText],
  ['status page', statusText],
  ['runtime boundary', boundarySource],
] as const;

for (const [label, source] of guardedSources) {
  const sourceWithoutNegativeAssertions = stripNegativeAssertionBlocks(source);

  assert.doesNotMatch(
    sourceWithoutNegativeAssertions,
    /ready-for-production-wiring|production-wiring-ready|productionGateCleared|positiveGateAllowed:\s*true|productionAuthority:\s*true|productionReady:\s*true/u,
    `${label} source wording must not claim positive production readiness outside negative assertions.`,
  );
  assert.doesNotMatch(
    sourceWithoutNegativeAssertions,
    /implementationQueue|orderedSteps|requiredReportOrder|nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
    `${label} source wording must not define queues, required order, tool decisions, or controller actions outside negative assertions.`,
  );
  assert.doesNotMatch(
    sourceWithoutNegativeAssertions,
    /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
    `${label} source wording must not prescribe concrete desktop tools outside negative assertions.`,
  );
  assert.doesNotMatch(
    sourceWithoutNegativeAssertions,
    /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain/iu,
    `${label} source wording must not define fixed workflows outside negative assertions.`,
  );
}

const serializedCheckpoint = JSON.stringify(checkpoint);
assert.doesNotMatch(
  serializedCheckpoint,
  /productionAuthority":true|productionReady":true|positiveGateAllowed":true/u,
  'Negative gate must not grant production readiness.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /contractDraftingReady":true|isContractDraft":true|isProductionWiringPlan":true|isExecutionOrder":true/u,
  'Negative gate must not become a contract draft, production wiring plan, or execution order.',
);
assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Negative gate must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Negative gate must not add production runtime calls.',
);

console.log('agent session v3 runtime boundary contract drafting negative gate smoke ok');
