import assert from 'node:assert/strict';
import {
  AGENT_SESSION_V3_RUNTIME_BOUNDARY_GUARDRAILS,
  AGENT_SESSION_V3_RUNTIME_BOUNDARY_PHASE_LIMITS,
  createAgentSessionV3RuntimeBoundaryContract,
  type AgentSessionV3RuntimeDrivenPhase,
  type AgentSessionV3RuntimeSideEffectScope,
} from '../src/agent/agentSessionV3RuntimeBoundary.ts';
import { readProjectSources } from './smokeTestHarness.ts';

function assertContains(text: string, expected: string, label: string) {
  assert.ok(text.includes(expected), `${label} should include: ${expected}`);
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

interface MinimalAdapterContractDraft {
  adapterFamily: MinimalAdapterFamily;
  adapterImplemented: false;
  allowedScopes: readonly AgentSessionV3RuntimeSideEffectScope[];
  contractDraftOnly: true;
  forbiddenAuthority: readonly string[];
  futureAdapterOnly: true;
  phase: AgentSessionV3RuntimeDrivenPhase;
  productionAuthority: false;
  requiredRuntimeOrder: false;
}

const minimalAdapterContractDrafts = [
  {
    adapterFamily: 'model-decision',
    adapterImplemented: false,
    allowedScopes: AGENT_SESSION_V3_RUNTIME_BOUNDARY_PHASE_LIMITS.model_decision.allowedScopes,
    contractDraftOnly: true,
    forbiddenAuthority: AGENT_SESSION_V3_RUNTIME_BOUNDARY_PHASE_LIMITS.model_decision.forbiddenAuthority,
    futureAdapterOnly: true,
    phase: 'model_decision',
    productionAuthority: false,
    requiredRuntimeOrder: false,
  },
  {
    adapterFamily: 'transaction-execution',
    adapterImplemented: false,
    allowedScopes: AGENT_SESSION_V3_RUNTIME_BOUNDARY_PHASE_LIMITS.execute_transaction.allowedScopes,
    contractDraftOnly: true,
    forbiddenAuthority: AGENT_SESSION_V3_RUNTIME_BOUNDARY_PHASE_LIMITS.execute_transaction.forbiddenAuthority,
    futureAdapterOnly: true,
    phase: 'execute_transaction',
    productionAuthority: false,
    requiredRuntimeOrder: false,
  },
] as const satisfies readonly MinimalAdapterContractDraft[];

const {
  auditText,
  boundarySource,
  finalCloseoutSource,
  statusText,
} = readProjectSources({
  auditText: 'PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md',
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  finalCloseoutSource:
    'scripts/agent-session-v3-runtime-boundary-source-gap-chain-final-closeout-smoke.ts',
  statusText: 'PROJECT_AGENT_V2_STATUS.md',
});

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');
assert.equal(boundaryContract.mode, 'contract-only');
assert.deepEqual(boundaryContract.guardrails, AGENT_SESSION_V3_RUNTIME_BOUNDARY_GUARDRAILS);

assert.equal(minimalAdapterContractDrafts.length, 2);
assert.deepEqual(
  minimalAdapterContractDrafts.map((draft) => draft.adapterFamily),
  ['model-decision', 'transaction-execution'],
);

for (const draft of minimalAdapterContractDrafts) {
  assert.equal(draft.adapterImplemented, false);
  assert.equal(draft.contractDraftOnly, true);
  assert.equal(draft.futureAdapterOnly, true);
  assert.equal(draft.productionAuthority, false);
  assert.equal(draft.requiredRuntimeOrder, false);
  assert.ok(draft.forbiddenAuthority.includes('replace AgentSessionV2'));
  assert.ok(draft.forbiddenAuthority.includes('define a required ordered tool workflow'));
}

assert.deepEqual(minimalAdapterContractDrafts[0].allowedScopes, ['model-call', 'trace-recording']);
assert.deepEqual(minimalAdapterContractDrafts[1].allowedScopes, [
  'transaction-execution',
  'trace-recording',
  'progress-emission',
]);

assertContains(finalCloseoutSource, 'minimal-production-adapter-contract-draft', 'source-gap final closeout');
assertContains(finalCloseoutSource, 'automaticChainContinuation: false', 'source-gap final closeout');
assertContains(statusText, 'source-gap final closeout non-production chain stop coverage', 'status page');
assertContains(statusText, 'minimal adapter contract draft', 'status page');
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-minimal-adapter-contract-draft-smoke.ts',
  'status page',
);
assertContains(statusText, 'minimal adapter contract draft non-production coverage', 'status page');
assertContains(auditText, '## Minimal Adapter Contract Draft Status', 'preflight audit');
assertContains(auditText, 'model-decision and transaction-execution adapter families', 'preflight audit');
assertContains(auditText, 'This is a contract draft only, not implemented adapters.', 'preflight audit');
assertContains(auditText, 'This draft does not create runtime action order.', 'preflight audit');
assertContains(boundarySource, 'AgentSessionV2 remains the production orchestrator', 'runtime boundary');
assertContains(boundarySource, 'no required ordered tool workflow', 'runtime boundary');
assertContains(boundarySource, 'no evidence adapter gains runtime authority', 'runtime boundary');

const guardedSources = [
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

const serializedDrafts = JSON.stringify(minimalAdapterContractDrafts);
assert.doesNotMatch(
  serializedDrafts,
  /adapterImplemented":true|productionAuthority":true|requiredRuntimeOrder":true/u,
  'Minimal adapter contract draft must not implement adapters, grant production authority, or require runtime order.',
);
assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Minimal adapter contract draft must not add production controller or adapter contracts to src yet.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Minimal adapter contract draft must not add production runtime calls.',
);

console.log('agent session v3 runtime boundary minimal adapter contract draft smoke ok');
