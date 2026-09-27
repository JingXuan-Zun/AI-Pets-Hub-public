import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { readProjectFile } from './smokeTestHarness.ts';

type FinalGuardCloseoutSummaryInput =
  | 'post-closeout-production-gate-recheck'
  | 'post-handoff-gate-wording-consistency'
  | 'post-recheck-remaining-blocker-handoff'
  | 'production-readiness-language-final-guard'
  | 'runtime-boundary-contract';

type FinalGuardCloseoutSummarySignal =
  | 'positive-gate-closed-after-recheck'
  | 'remaining-blockers-handed-off'
  | 'handoff-wording-still-non-production'
  | 'production-readiness-language-still-negative'
  | 'runtime-authority-still-absent';

interface FinalGuardCloseoutSummaryRow {
  inputs: readonly FinalGuardCloseoutSummaryInput[];
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  signal: FinalGuardCloseoutSummarySignal;
  summaryStatus: 'closed-out-non-production';
}

interface FinalGuardCloseoutSummaryCheckpoint {
  gate: 'final-guard-closeout-summary';
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly FinalGuardCloseoutSummaryRow[];
  summaryDecision: 'final-guard-closeout-positive-gate-closed';
}

const sharedInputs = [
  'post-closeout-production-gate-recheck',
  'post-recheck-remaining-blocker-handoff',
  'post-handoff-gate-wording-consistency',
  'production-readiness-language-final-guard',
  'runtime-boundary-contract',
] as const satisfies readonly FinalGuardCloseoutSummaryInput[];

const finalGuardCloseoutSummaryCheckpoint = {
  gate: 'final-guard-closeout-summary',
  isImplementationPlan: false,
  isProductionWiringPlan: false,
  positiveGateAllowed: false,
  productionAuthority: false,
  productionReady: false,
  rows: [
    {
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'positive-gate-closed-after-recheck',
      summaryStatus: 'closed-out-non-production',
    },
    {
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'remaining-blockers-handed-off',
      summaryStatus: 'closed-out-non-production',
    },
    {
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'handoff-wording-still-non-production',
      summaryStatus: 'closed-out-non-production',
    },
    {
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'production-readiness-language-still-negative',
      summaryStatus: 'closed-out-non-production',
    },
    {
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'runtime-authority-still-absent',
      summaryStatus: 'closed-out-non-production',
    },
  ],
  summaryDecision: 'final-guard-closeout-positive-gate-closed',
} as const satisfies FinalGuardCloseoutSummaryCheckpoint;

function assertContains(text: string, expected: string, label: string) {
  assert.ok(text.includes(expected), `${label} should include: ${expected}`);
}

function rowForSignal(signal: FinalGuardCloseoutSummarySignal) {
  const row = finalGuardCloseoutSummaryCheckpoint.rows.find((candidate) => candidate.signal === signal);
  assert.ok(row, `${signal} should exist in the final guard closeout summary checkpoint.`);
  return row;
}

const boundarySource = readProjectFile('src/agent/agentSessionV3RuntimeBoundary.ts');
const auditText = readProjectFile('PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md');
const statusText = readProjectFile('PROJECT_AGENT_V2_STATUS.md');
const closeoutSummarySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-final-guard-closeout-summary-checkpoint-smoke.ts',
);
const recheckSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-post-closeout-production-gate-recheck-checkpoint-smoke.ts',
);
const handoffSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-post-recheck-remaining-blocker-handoff-checkpoint-smoke.ts',
);
const wordingConsistencySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-post-handoff-gate-wording-consistency-checkpoint-smoke.ts',
);
const finalGuardSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-production-readiness-language-final-guard-smoke.ts',
);

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');
assert.equal(boundaryContract.mode, 'contract-only');
assert.ok(boundaryContract.guardrails.includes('AgentSessionV2 remains the production orchestrator'));
assert.ok(boundaryContract.guardrails.includes('no required ordered tool workflow'));
assert.ok(boundaryContract.guardrails.includes('no evidence adapter gains runtime authority'));

assert.equal(finalGuardCloseoutSummaryCheckpoint.productionAuthority, false);
assert.equal(finalGuardCloseoutSummaryCheckpoint.productionReady, false);
assert.equal(finalGuardCloseoutSummaryCheckpoint.positiveGateAllowed, false);
assert.equal(finalGuardCloseoutSummaryCheckpoint.isProductionWiringPlan, false);
assert.equal(finalGuardCloseoutSummaryCheckpoint.isImplementationPlan, false);
assert.equal(finalGuardCloseoutSummaryCheckpoint.summaryDecision, 'final-guard-closeout-positive-gate-closed');

assert.deepEqual(
  finalGuardCloseoutSummaryCheckpoint.rows.map((row) => row.signal).sort(),
  [
    'handoff-wording-still-non-production',
    'positive-gate-closed-after-recheck',
    'production-readiness-language-still-negative',
    'remaining-blockers-handed-off',
    'runtime-authority-still-absent',
  ],
);

for (const row of finalGuardCloseoutSummaryCheckpoint.rows) {
  assert.equal(row.summaryStatus, 'closed-out-non-production');
  assert.equal(row.isExecutionOrder, false);
  assert.equal(row.isImplementationPlan, false);
  assert.equal(row.isProductionWiringPlan, false);
  assert.equal(row.productionAuthority, false);
  assert.equal(row.productionReady, false);
  assert.equal(row.positiveGateAllowed, false);
  assert.deepEqual(row.inputs, sharedInputs);
}

assert.equal(rowForSignal('positive-gate-closed-after-recheck').positiveGateAllowed, false);
assert.equal(rowForSignal('remaining-blockers-handed-off').isImplementationPlan, false);
assert.equal(rowForSignal('handoff-wording-still-non-production').isProductionWiringPlan, false);
assert.equal(rowForSignal('production-readiness-language-still-negative').productionReady, false);
assert.equal(rowForSignal('runtime-authority-still-absent').productionAuthority, false);

assertContains(recheckSmokeSource, 'post-closeout-positive-gate-remains-closed', 'post-closeout recheck smoke');
assertContains(recheckSmokeSource, 'closed-after-recheck', 'post-closeout recheck smoke');
assertContains(handoffSmokeSource, 'remaining-blockers-handed-off-positive-gate-closed', 'handoff smoke');
assertContains(handoffSmokeSource, 'handoff-only-still-blocked', 'handoff smoke');
assertContains(wordingConsistencySmokeSource, 'handoff-wording-consistent-positive-gate-closed', 'wording consistency smoke');
assertContains(wordingConsistencySmokeSource, 'wording-consistent-and-blocked', 'wording consistency smoke');
assertContains(finalGuardSmokeSource, 'no-production-readiness-language-drift', 'production-readiness final guard smoke');
assertContains(finalGuardSmokeSource, 'guarded-negative-language', 'production-readiness final guard smoke');
assertContains(boundarySource, 'AgentSessionV2 remains the production orchestrator', 'runtime boundary');
assertContains(boundarySource, 'no required ordered tool workflow', 'runtime boundary');
assertContains(auditText, 'Final Guard Closeout Summary Checkpoint Status', 'preflight audit');
assertContains(auditText, 'final guard closeout keeps the positive gate closed', 'preflight audit');
assertContains(statusText, 'V3 runtime boundary final guard closeout summary checkpoint', 'status');
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-final-guard-closeout-summary-checkpoint-smoke.ts',
  'status',
);
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

const serializedCheckpoint = JSON.stringify(finalGuardCloseoutSummaryCheckpoint);
assert.doesNotMatch(
  serializedCheckpoint,
  /productionAuthority":true|productionReady":true|positiveGateAllowed":true/u,
  'Final guard closeout summary must not grant production readiness or authority.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /isProductionWiringPlan":true|isImplementationPlan":true|production-wiring-ready|ready-for-production-wiring/u,
  'Final guard closeout summary must not become an implementation plan or production wiring plan.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Final guard closeout summary should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Final guard closeout summary should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain|requiredReportOrder|implementationQueue|orderedSteps/iu,
  'Final guard closeout summary should not define fixed workflows, required report order, or task queues.',
);

assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Final guard closeout summary must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Final guard closeout summary must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  closeoutSummarySmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Final guard closeout summary smoke should not call production v2 modules.',
);

console.log('agent session v3 runtime boundary final guard closeout summary checkpoint smoke ok');
