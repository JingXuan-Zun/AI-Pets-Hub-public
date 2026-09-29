import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { readProjectFile } from './smokeTestHarness.ts';

type PostHandoffGateWordingConsistencyInput =
  | 'post-closeout-production-gate-recheck'
  | 'post-recheck-remaining-blocker-handoff'
  | 'preflight-audit'
  | 'runtime-boundary-contract'
  | 'status-page';

type PostHandoffGateWordingConsistencyCheck =
  | 'blocker-readout-language-retained'
  | 'handoff-not-implementation-plan'
  | 'handoff-not-production-wiring-plan'
  | 'no-fixed-tool-chain-language'
  | 'no-positive-gate-language'
  | 'no-runtime-action-order-language';

interface PostHandoffGateWordingConsistencyRow {
  check: PostHandoffGateWordingConsistencyCheck;
  consistencyStatus: 'wording-consistent-and-blocked';
  inputs: readonly PostHandoffGateWordingConsistencyInput[];
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
}

interface PostHandoffGateWordingConsistencyCheckpoint {
  gate: 'post-handoff-gate-wording-consistency';
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly PostHandoffGateWordingConsistencyRow[];
  summaryDecision: 'handoff-wording-consistent-positive-gate-closed';
}

const sharedInputs = [
  'post-recheck-remaining-blocker-handoff',
  'post-closeout-production-gate-recheck',
  'preflight-audit',
  'status-page',
  'runtime-boundary-contract',
] as const satisfies readonly PostHandoffGateWordingConsistencyInput[];

const postHandoffGateWordingConsistencyCheckpoint = {
  gate: 'post-handoff-gate-wording-consistency',
  isImplementationPlan: false,
  isProductionWiringPlan: false,
  positiveGateAllowed: false,
  productionAuthority: false,
  productionReady: false,
  rows: [
    {
      check: 'blocker-readout-language-retained',
      consistencyStatus: 'wording-consistent-and-blocked',
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
    {
      check: 'handoff-not-production-wiring-plan',
      consistencyStatus: 'wording-consistent-and-blocked',
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
    {
      check: 'handoff-not-implementation-plan',
      consistencyStatus: 'wording-consistent-and-blocked',
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
    {
      check: 'no-positive-gate-language',
      consistencyStatus: 'wording-consistent-and-blocked',
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
    {
      check: 'no-runtime-action-order-language',
      consistencyStatus: 'wording-consistent-and-blocked',
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
    {
      check: 'no-fixed-tool-chain-language',
      consistencyStatus: 'wording-consistent-and-blocked',
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
  ],
  summaryDecision: 'handoff-wording-consistent-positive-gate-closed',
} as const satisfies PostHandoffGateWordingConsistencyCheckpoint;

function assertContains(text: string, expected: string, label: string) {
  assert.ok(text.includes(expected), `${label} should include: ${expected}`);
}

function rowForCheck(check: PostHandoffGateWordingConsistencyCheck) {
  const row = postHandoffGateWordingConsistencyCheckpoint.rows.find((candidate) => candidate.check === check);
  assert.ok(row, `${check} should exist in the post-handoff gate wording consistency checkpoint.`);
  return row;
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
const wordingConsistencySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-post-handoff-gate-wording-consistency-checkpoint-smoke.ts',
);
const handoffSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-post-recheck-remaining-blocker-handoff-checkpoint-smoke.ts',
);
const recheckSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-post-closeout-production-gate-recheck-checkpoint-smoke.ts',
);

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');
assert.equal(boundaryContract.mode, 'contract-only');
assert.ok(boundaryContract.guardrails.includes('AgentSessionV2 remains the production orchestrator'));
assert.ok(boundaryContract.guardrails.includes('no required ordered tool workflow'));
assert.ok(boundaryContract.guardrails.includes('no evidence adapter gains runtime authority'));

assert.equal(postHandoffGateWordingConsistencyCheckpoint.productionAuthority, false);
assert.equal(postHandoffGateWordingConsistencyCheckpoint.productionReady, false);
assert.equal(postHandoffGateWordingConsistencyCheckpoint.positiveGateAllowed, false);
assert.equal(postHandoffGateWordingConsistencyCheckpoint.isProductionWiringPlan, false);
assert.equal(postHandoffGateWordingConsistencyCheckpoint.isImplementationPlan, false);
assert.equal(
  postHandoffGateWordingConsistencyCheckpoint.summaryDecision,
  'handoff-wording-consistent-positive-gate-closed',
);

assert.deepEqual(
  postHandoffGateWordingConsistencyCheckpoint.rows.map((row) => row.check).sort(),
  [
    'blocker-readout-language-retained',
    'handoff-not-implementation-plan',
    'handoff-not-production-wiring-plan',
    'no-fixed-tool-chain-language',
    'no-positive-gate-language',
    'no-runtime-action-order-language',
  ],
);

for (const row of postHandoffGateWordingConsistencyCheckpoint.rows) {
  assert.equal(row.consistencyStatus, 'wording-consistent-and-blocked');
  assert.equal(row.isExecutionOrder, false);
  assert.equal(row.isImplementationPlan, false);
  assert.equal(row.isProductionWiringPlan, false);
  assert.equal(row.productionAuthority, false);
  assert.equal(row.productionReady, false);
  assert.equal(row.positiveGateAllowed, false);
  assert.deepEqual(row.inputs, sharedInputs);
}

assert.equal(rowForCheck('blocker-readout-language-retained').isImplementationPlan, false);
assert.equal(rowForCheck('handoff-not-production-wiring-plan').isProductionWiringPlan, false);
assert.equal(rowForCheck('handoff-not-implementation-plan').isImplementationPlan, false);
assert.equal(rowForCheck('no-positive-gate-language').positiveGateAllowed, false);
assert.equal(rowForCheck('no-runtime-action-order-language').isExecutionOrder, false);
assert.equal(rowForCheck('no-fixed-tool-chain-language').isExecutionOrder, false);

assertContains(handoffSmokeSource, 'remaining-blockers-handed-off-positive-gate-closed', 'handoff smoke');
assertContains(handoffSmokeSource, 'handoff-only-still-blocked', 'handoff smoke');
assertContains(handoffSmokeSource, 'non-production-blocker-readout', 'handoff smoke');
assertContains(recheckSmokeSource, 'post-closeout-positive-gate-remains-closed', 'post-closeout recheck smoke');
assertContains(recheckSmokeSource, 'closed-after-recheck', 'post-closeout recheck smoke');
assertContains(auditText, 'Post-Handoff Gate Wording Consistency Checkpoint Status', 'preflight audit');
assertContains(auditText, 'handoff wording remains blocker-readout wording', 'preflight audit');
assertContains(statusText, 'V3 runtime boundary post-handoff gate wording consistency checkpoint', 'status');
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-post-handoff-gate-wording-consistency-checkpoint-smoke.ts',
  'status',
);
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

const handoffSourceWithoutNegativeAssertions = stripNegativeAssertionBlocks(handoffSmokeSource);
assert.doesNotMatch(
  handoffSourceWithoutNegativeAssertions,
  /ready-for-production-wiring|production-wiring-ready|productionGateCleared|positiveGateAllowed:\s*true|productionAuthority:\s*true|productionReady:\s*true/u,
  'Handoff source wording must not claim positive production readiness outside negative assertions.',
);
assert.doesNotMatch(
  handoffSourceWithoutNegativeAssertions,
  /implementationQueue|orderedSteps|requiredReportOrder|nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Handoff source wording must not define queues, required order, tool decisions, or controller actions outside negative assertions.',
);
assert.doesNotMatch(
  handoffSourceWithoutNegativeAssertions,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Handoff source wording must not prescribe concrete desktop tools outside negative assertions.',
);
assert.doesNotMatch(
  handoffSourceWithoutNegativeAssertions,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain/iu,
  'Handoff source wording must not define fixed workflows outside negative assertions.',
);

const serializedCheckpoint = JSON.stringify(postHandoffGateWordingConsistencyCheckpoint);
assert.doesNotMatch(
  serializedCheckpoint,
  /productionAuthority":true|productionReady":true|positiveGateAllowed":true/u,
  'Post-handoff gate wording consistency must not grant production readiness or authority.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /isProductionWiringPlan":true|isImplementationPlan":true|production-wiring-ready|ready-for-production-wiring/u,
  'Post-handoff gate wording consistency must not become an implementation plan or production wiring plan.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Post-handoff gate wording consistency should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Post-handoff gate wording consistency should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain|requiredReportOrder|implementationQueue|orderedSteps/iu,
  'Post-handoff gate wording consistency should not define fixed workflows, required report order, or task queues.',
);

assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Post-handoff gate wording consistency must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Post-handoff gate wording consistency must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  wordingConsistencySmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Post-handoff gate wording consistency smoke should not call production v2 modules.',
);

console.log('agent session v3 runtime boundary post-handoff gate wording consistency checkpoint smoke ok');
