import assert from 'node:assert/strict';
import {
  AGENT_SESSION_V3_RUNTIME_BOUNDARY_PHASE_LIMITS,
  createAgentSessionV3RuntimeBoundaryContract,
  type AgentSessionV3RuntimeDrivenPhase,
  type AgentSessionV3RuntimeSideEffectScope,
} from '../src/agent/agentSessionV3RuntimeBoundary.ts';
import { readProjectSources } from './smokeTestHarness.ts';

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

type MinimalAdapterFamily = 'model-decision' | 'transaction-execution';

type FutureOwnerModule =
  | 'agentSessionV2DecisionContract.ts'
  | 'agentSessionV2ModelDecisionTurn.ts'
  | 'agentSessionV2ParallelToolExecutionTransaction.ts'
  | 'agentSessionV2ToolExecutionTransaction.ts';

type OwnerReviewStatus = 'future-owner-identified-contract-only';

interface MinimalAdapterOwnerReviewRow {
  adapterFamily: MinimalAdapterFamily;
  adapterImplemented: false;
  allowedScopes: readonly AgentSessionV3RuntimeSideEffectScope[];
  futureOwnerModules: readonly FutureOwnerModule[];
  ownerReviewStatus: OwnerReviewStatus;
  phase: AgentSessionV3RuntimeDrivenPhase;
  productionAuthority: false;
  requiredRuntimeOrder: false;
}

interface MinimalAdapterOwnerReview {
  adapterImplemented: false;
  draftFamilyCount: 2;
  ownerReviewOnly: true;
  productionAuthority: false;
  requiredRuntimeOrder: false;
  rows: readonly MinimalAdapterOwnerReviewRow[];
  summaryDecision: 'minimal-adapter-future-owners-identified-contract-only';
}

const ownerReview = {
  adapterImplemented: false,
  draftFamilyCount: 2,
  ownerReviewOnly: true,
  productionAuthority: false,
  requiredRuntimeOrder: false,
  rows: [
    {
      adapterFamily: 'model-decision',
      adapterImplemented: false,
      allowedScopes: AGENT_SESSION_V3_RUNTIME_BOUNDARY_PHASE_LIMITS.model_decision.allowedScopes,
      futureOwnerModules: [
        'agentSessionV2ModelDecisionTurn.ts',
        'agentSessionV2DecisionContract.ts',
      ],
      ownerReviewStatus: 'future-owner-identified-contract-only',
      phase: 'model_decision',
      productionAuthority: false,
      requiredRuntimeOrder: false,
    },
    {
      adapterFamily: 'transaction-execution',
      adapterImplemented: false,
      allowedScopes: AGENT_SESSION_V3_RUNTIME_BOUNDARY_PHASE_LIMITS.execute_transaction.allowedScopes,
      futureOwnerModules: [
        'agentSessionV2ToolExecutionTransaction.ts',
        'agentSessionV2ParallelToolExecutionTransaction.ts',
      ],
      ownerReviewStatus: 'future-owner-identified-contract-only',
      phase: 'execute_transaction',
      productionAuthority: false,
      requiredRuntimeOrder: false,
    },
  ],
  summaryDecision: 'minimal-adapter-future-owners-identified-contract-only',
} as const satisfies MinimalAdapterOwnerReview;

const {
  auditText,
  boundarySource,
  decisionContractSource,
  draftSource,
  finalCloseoutSource,
  modelDecisionSource,
  parallelTransactionSource,
  statusText,
  toolTransactionSource,
} = readProjectSources({
  auditText: 'PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md',
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  decisionContractSource: 'src/agent/runtime/agentDecisionContract.ts',
  draftSource:
    'scripts/agent-session-v3-runtime-boundary-minimal-adapter-contract-draft-smoke.ts',
  finalCloseoutSource:
    'scripts/agent-session-v3-runtime-boundary-source-gap-chain-final-closeout-smoke.ts',
  modelDecisionSource: 'src/agent/runtime/agentModelDecisionRuntime.ts',
  parallelTransactionSource:
    'src/agent/runtime/agentParallelToolTransactionExecutor.ts',
  statusText: 'PROJECT_AGENT_V2_STATUS.md',
  toolTransactionSource: 'src/agent/runtime/agentToolTransactionExecutor.ts',
});

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');
assert.equal(boundaryContract.mode, 'contract-only');
assert.ok(boundaryContract.guardrails.includes('AgentSessionV2 remains the production orchestrator'));
assert.ok(boundaryContract.guardrails.includes('no required ordered tool workflow'));
assert.ok(boundaryContract.guardrails.includes('no evidence adapter gains runtime authority'));

assert.equal(ownerReview.ownerReviewOnly, true);
assert.equal(ownerReview.adapterImplemented, false);
assert.equal(ownerReview.productionAuthority, false);
assert.equal(ownerReview.requiredRuntimeOrder, false);
assert.equal(ownerReview.draftFamilyCount, 2);
assert.equal(ownerReview.summaryDecision, 'minimal-adapter-future-owners-identified-contract-only');
assert.deepEqual(
  ownerReview.rows.map((row) => row.adapterFamily),
  ['model-decision', 'transaction-execution'],
);
assert.deepEqual(
  uniqueSorted(ownerReview.rows.flatMap((row) => row.futureOwnerModules)),
  [
    'agentSessionV2DecisionContract.ts',
    'agentSessionV2ModelDecisionTurn.ts',
    'agentSessionV2ParallelToolExecutionTransaction.ts',
    'agentSessionV2ToolExecutionTransaction.ts',
  ],
);

for (const row of ownerReview.rows) {
  assert.equal(row.ownerReviewStatus, 'future-owner-identified-contract-only');
  assert.equal(row.adapterImplemented, false);
  assert.equal(row.productionAuthority, false);
  assert.equal(row.requiredRuntimeOrder, false);
}

assert.deepEqual(ownerReview.rows[0].allowedScopes, ['model-call', 'trace-recording']);
assert.deepEqual(ownerReview.rows[1].allowedScopes, [
  'transaction-execution',
  'trace-recording',
  'progress-emission',
]);

assertContains(draftSource, "type MinimalAdapterFamily = 'model-decision' | 'transaction-execution'", 'draft source');
assertContains(draftSource, 'adapterImplemented: false', 'draft source');
assertContains(draftSource, 'productionAuthority: false', 'draft source');
assertContains(draftSource, 'requiredRuntimeOrder: false', 'draft source');
assertContains(finalCloseoutSource, 'automaticChainContinuation: false', 'source-gap final closeout');
assertContains(boundarySource, 'AgentSessionV2 remains the production orchestrator', 'runtime boundary');
assertContains(boundarySource, 'no required ordered tool workflow', 'runtime boundary');
assertContains(boundarySource, 'no evidence adapter gains runtime authority', 'runtime boundary');

assertContains(statusText, 'minimal adapter contract draft non-production coverage', 'status page');
assertContains(statusText, 'minimal adapter contract owner review non-production coverage', 'status page');
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-minimal-adapter-contract-owner-review-smoke.ts',
  'status page',
);
assertContains(auditText, '## Minimal Adapter Contract Owner Review Status', 'preflight audit');
assertContains(auditText, 'model-decision future owner modules', 'preflight audit');
assertContains(auditText, 'transaction-execution future owner modules', 'preflight audit');
assertContains(auditText, 'This review does not implement adapters.', 'preflight audit');
assertContains(auditText, 'This review does not create runtime action order.', 'preflight audit');

const guardedSources = [
  ['draft source', draftSource],
  ['source-gap final closeout', finalCloseoutSource],
  ['preflight audit', auditText],
  ['status page', statusText],
  ['runtime boundary', boundarySource],
] as const;

for (const [label, source] of guardedSources) {
  const sourceWithoutNegativeAssertions = stripNegativeAssertionBlocks(source);

  assert.doesNotMatch(
    sourceWithoutNegativeAssertions,
    /ready-for-production-wiring|production-wiring-ready|productionGateCleared|positiveGateAllowed:\s*true|productionAuthority:\s*true|productionReady:\s*true|evidenceSatisfied:\s*true/u,
    `${label} must not claim positive production or evidence readiness outside negative assertions.`,
  );
  assert.doesNotMatch(
    sourceWithoutNegativeAssertions,
    /implementationQueue|orderedSteps|requiredReportOrder|nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
    `${label} must not define queues, required order, tool decisions, or controller actions outside negative assertions.`,
  );
  assert.doesNotMatch(
    sourceWithoutNegativeAssertions,
    /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
    `${label} must not prescribe concrete desktop tools outside negative assertions.`,
  );
  assert.doesNotMatch(
    sourceWithoutNegativeAssertions,
    /source-gap-chain-(guard|summary)-142|guard-142|summary-142/u,
    `${label} must not continue the source-gap guard/summary chain past summary 141.`,
  );
}

const serializedOwnerReview = JSON.stringify(ownerReview);
assert.doesNotMatch(
  serializedOwnerReview,
  /adapterImplemented":true|productionAuthority":true|requiredRuntimeOrder":true/u,
  'Owner review must not implement adapters, grant production authority, or require runtime order.',
);
assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Owner review must not add production controller or adapter contracts to src yet.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Owner review must not add production runtime calls.',
);

console.log('agent session v3 runtime boundary minimal adapter contract owner review smoke ok');
