import assert from 'node:assert/strict';
import {
  createAgentSessionV3RuntimeBoundaryContract,
  getAgentSessionV3RuntimeStopEvidenceFields,
  type AgentSessionV3RuntimeBoundaryStopReason,
  type AgentSessionV3RuntimePhasePortResult,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

type PhasePortPayloadFamily =
  | 'blocked'
  | 'failure'
  | 'waiting';

type PhasePortPayloadExpansionOwner =
  | 'future-controller-policy'
  | 'future-phase-adapter'
  | 'future-production-adapter';

type PhasePortPayloadExpansionReadiness =
  | 'diagnostic-only'
  | 'missing'
  | 'partial-diagnostic-only'
  | 'policy-owned';

type PhasePortPayloadExpansionDecision =
  | 'pre-contract-review-only'
  | 'requires-future-result-kind'
  | 'requires-structured-phase-payload';

interface PhasePortPayloadExpansionReviewRow {
  currentSource: string | null;
  decision: PhasePortPayloadExpansionDecision;
  family: PhasePortPayloadFamily;
  fieldName: string;
  formalContractReady: false;
  owner: PhasePortPayloadExpansionOwner;
  productionReady: false;
  readiness: PhasePortPayloadExpansionReadiness;
  reason: Extract<
    AgentSessionV3RuntimeBoundaryStopReason,
    'blocked-by-phase' | 'runtime-failed' | 'waiting-for-phase-event'
  >;
}

const phasePortPayloadPreContractExpansionRows = [
  {
    currentSource: null,
    decision: 'requires-structured-phase-payload',
    family: 'waiting',
    fieldName: 'waitSource',
    formalContractReady: false,
    owner: 'future-phase-adapter',
    productionReady: false,
    readiness: 'missing',
    reason: 'waiting-for-phase-event',
  },
  {
    currentSource: 'AgentSessionV3RuntimePhasePortResult.waiting.reason',
    decision: 'requires-structured-phase-payload',
    family: 'waiting',
    fieldName: 'pauseReason',
    formalContractReady: false,
    owner: 'future-phase-adapter',
    productionReady: false,
    readiness: 'partial-diagnostic-only',
    reason: 'waiting-for-phase-event',
  },
  {
    currentSource: null,
    decision: 'pre-contract-review-only',
    family: 'waiting',
    fieldName: 'resumeTriggerOwner',
    formalContractReady: false,
    owner: 'future-controller-policy',
    productionReady: false,
    readiness: 'policy-owned',
    reason: 'waiting-for-phase-event',
  },
  {
    currentSource: null,
    decision: 'pre-contract-review-only',
    family: 'waiting',
    fieldName: 'waitBudget',
    formalContractReady: false,
    owner: 'future-controller-policy',
    productionReady: false,
    readiness: 'policy-owned',
    reason: 'waiting-for-phase-event',
  },
  {
    currentSource: 'AgentSessionV3RuntimePhasePortResult.blocked.reason',
    decision: 'requires-structured-phase-payload',
    family: 'blocked',
    fieldName: 'blockerSource',
    formalContractReady: false,
    owner: 'future-production-adapter',
    productionReady: false,
    readiness: 'diagnostic-only',
    reason: 'blocked-by-phase',
  },
  {
    currentSource: null,
    decision: 'requires-structured-phase-payload',
    family: 'blocked',
    fieldName: 'recoverability',
    formalContractReady: false,
    owner: 'future-production-adapter',
    productionReady: false,
    readiness: 'missing',
    reason: 'blocked-by-phase',
  },
  {
    currentSource: null,
    decision: 'requires-structured-phase-payload',
    family: 'blocked',
    fieldName: 'userActionRequired',
    formalContractReady: false,
    owner: 'future-production-adapter',
    productionReady: false,
    readiness: 'missing',
    reason: 'blocked-by-phase',
  },
  {
    currentSource: null,
    decision: 'pre-contract-review-only',
    family: 'blocked',
    fieldName: 'terminalStatusCandidate',
    formalContractReady: false,
    owner: 'future-controller-policy',
    productionReady: false,
    readiness: 'policy-owned',
    reason: 'blocked-by-phase',
  },
  {
    currentSource: 'AgentSessionV3PilotRunnerResult.errorText',
    decision: 'requires-future-result-kind',
    family: 'failure',
    fieldName: 'failureOrigin',
    formalContractReady: false,
    owner: 'future-production-adapter',
    productionReady: false,
    readiness: 'diagnostic-only',
    reason: 'runtime-failed',
  },
  {
    currentSource: null,
    decision: 'requires-future-result-kind',
    family: 'failure',
    fieldName: 'retryability',
    formalContractReady: false,
    owner: 'future-production-adapter',
    productionReady: false,
    readiness: 'missing',
    reason: 'runtime-failed',
  },
  {
    currentSource: null,
    decision: 'requires-future-result-kind',
    family: 'failure',
    fieldName: 'sideEffectCommitted',
    formalContractReady: false,
    owner: 'future-production-adapter',
    productionReady: false,
    readiness: 'missing',
    reason: 'runtime-failed',
  },
  {
    currentSource: 'AgentSessionV3PilotRunnerResult.reason',
    decision: 'requires-future-result-kind',
    family: 'failure',
    fieldName: 'userVisibleFailureReason',
    formalContractReady: false,
    owner: 'future-production-adapter',
    productionReady: false,
    readiness: 'diagnostic-only',
    reason: 'runtime-failed',
  },
  {
    currentSource: 'AgentSessionV3PilotRunnerResult.errorText',
    decision: 'requires-future-result-kind',
    family: 'failure',
    fieldName: 'errorClass',
    formalContractReady: false,
    owner: 'future-production-adapter',
    productionReady: false,
    readiness: 'diagnostic-only',
    reason: 'runtime-failed',
  },
] as const satisfies readonly PhasePortPayloadExpansionReviewRow[];

function createFieldKey(reason: AgentSessionV3RuntimeBoundaryStopReason, fieldName: string) {
  return `${reason}.${fieldName}`;
}

function rowsForFamily(family: PhasePortPayloadFamily) {
  return phasePortPayloadPreContractExpansionRows.filter((row) => row.family === family);
}

function fieldKeysForFamily(family: PhasePortPayloadFamily) {
  return rowsForFamily(family)
    .map((row) => createFieldKey(row.reason, row.fieldName))
    .sort();
}

const {
  boundarySource,
  expansionReviewSmokeSource,
  phasePortRollupSmokeSource,
  waitingBlockerReviewSmokeSource,
  blockedBlockerReviewSmokeSource,
  failureBlockerReviewSmokeSource,
  adapterPayloadCloseoutSmokeSource,
  sourceReadinessMatrixSmokeSource,
  formalGateSmokeSource,
  preflightAuditText,
  statusText,
} = readProjectSources({
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  expansionReviewSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-phase-port-payload-pre-contract-expansion-review-smoke.ts',
  phasePortRollupSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-phase-port-payload-contract-readiness-rollup-smoke.ts',
  waitingBlockerReviewSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-phase-port-waiting-payload-blocker-review-smoke.ts',
  blockedBlockerReviewSmokeSource: 'scripts/agent-session-v3-runtime-boundary-blocked-payload-blocker-review-smoke.ts',
  failureBlockerReviewSmokeSource: 'scripts/agent-session-v3-runtime-boundary-failure-payload-blocker-review-smoke.ts',
  adapterPayloadCloseoutSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-payload-pre-contract-closeout-checkpoint-smoke.ts',
  sourceReadinessMatrixSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-payload-source-readiness-matrix-checkpoint-smoke.ts',
  formalGateSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-payload-formal-contract-gate-checkpoint-smoke.ts',
  preflightAuditText: 'PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md',
  statusText: 'PROJECT_AGENT_V2_STATUS.md',
});

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');

const currentWaitingResult: AgentSessionV3RuntimePhasePortResult = {
  kind: 'waiting',
  reason: 'phase-port payload expansion diagnostic only',
};
const currentBlockedResult: AgentSessionV3RuntimePhasePortResult = {
  kind: 'blocked',
  reason: 'phase-port payload expansion diagnostic only',
};
assert.deepEqual(Object.keys(currentWaitingResult).sort(), ['kind', 'reason']);
assert.deepEqual(Object.keys(currentBlockedResult).sort(), ['kind', 'reason']);
assert.equal('waitSource' in currentWaitingResult, false);
assert.equal('pauseReason' in currentWaitingResult, false);
assert.equal('blockerSource' in currentBlockedResult, false);
assert.equal('recoverability' in currentBlockedResult, false);
assert.equal('failureOrigin' in currentBlockedResult, false);

assert.deepEqual(
  phasePortPayloadPreContractExpansionRows
    .map((row) => row.family)
    .filter((family, index, families) => families.indexOf(family) === index)
    .sort(),
  ['blocked', 'failure', 'waiting'],
  'Phase-port payload expansion review should cover waiting, blocked, and failure families.',
);

assert.deepEqual(fieldKeysForFamily('waiting'), [
  'waiting-for-phase-event.pauseReason',
  'waiting-for-phase-event.resumeTriggerOwner',
  'waiting-for-phase-event.waitBudget',
  'waiting-for-phase-event.waitSource',
]);
assert.deepEqual(fieldKeysForFamily('blocked'), [
  'blocked-by-phase.blockerSource',
  'blocked-by-phase.recoverability',
  'blocked-by-phase.terminalStatusCandidate',
  'blocked-by-phase.userActionRequired',
]);
assert.deepEqual(fieldKeysForFamily('failure'), [
  'runtime-failed.errorClass',
  'runtime-failed.failureOrigin',
  'runtime-failed.retryability',
  'runtime-failed.sideEffectCommitted',
  'runtime-failed.userVisibleFailureReason',
]);

for (const row of phasePortPayloadPreContractExpansionRows) {
  const contractField = getAgentSessionV3RuntimeStopEvidenceFields(row.reason)
    .find((field) => field.name === row.fieldName);

  assert.ok(contractField, `${row.reason}.${row.fieldName} should exist in the stop evidence contract.`);
  assert.equal(row.productionReady, false);
  assert.equal(row.formalContractReady, false);

  if (row.owner === 'future-controller-policy') {
    assert.equal(contractField.source, 'future-controller-policy');
    assert.equal(row.decision, 'pre-contract-review-only');
    assert.equal(row.readiness, 'policy-owned');
  }

  if (row.family === 'waiting' && row.owner === 'future-phase-adapter') {
    assert.equal(contractField.source, 'phase-port-result');
    assert.equal(row.decision, 'requires-structured-phase-payload');
  }

  if (row.family === 'blocked' && row.owner === 'future-production-adapter') {
    assert.equal(contractField.source, 'future-production-adapter');
    assert.equal(row.decision, 'requires-structured-phase-payload');
  }

  if (row.family === 'failure') {
    assert.equal(contractField.source, 'future-production-adapter');
    assert.equal(row.decision, 'requires-future-result-kind');
  }
}

assert.deepEqual(
  phasePortPayloadPreContractExpansionRows
    .filter((row) => row.formalContractReady)
    .map((row) => row.fieldName),
  [],
  'Phase-port payload expansion review should not promote fields into a formal contract.',
);
assert.deepEqual(
  rowsForFamily('failure')
    .map((row) => row.decision)
    .filter((decision, index, decisions) => decisions.indexOf(decision) === index),
  ['requires-future-result-kind'],
  'Failure payload expansion still needs a future result kind before payload contract promotion.',
);
assert.deepEqual(
  phasePortPayloadPreContractExpansionRows
    .filter((row) => row.readiness === 'policy-owned')
    .map((row) => createFieldKey(row.reason, row.fieldName))
    .sort(),
  [
    'blocked-by-phase.terminalStatusCandidate',
    'waiting-for-phase-event.resumeTriggerOwner',
    'waiting-for-phase-event.waitBudget',
  ],
);
assert.deepEqual(
  phasePortPayloadPreContractExpansionRows
    .filter((row) => row.readiness === 'missing')
    .map((row) => createFieldKey(row.reason, row.fieldName))
    .sort(),
  [
    'blocked-by-phase.recoverability',
    'blocked-by-phase.userActionRequired',
    'runtime-failed.retryability',
    'runtime-failed.sideEffectCommitted',
    'waiting-for-phase-event.waitSource',
  ],
);

assert.match(phasePortRollupSmokeSource, /too shallow for a formal payload contract/u);
assert.match(waitingBlockerReviewSmokeSource, /future-phase-payload-required/u);
assert.match(blockedBlockerReviewSmokeSource, /AgentSessionV3RuntimePhasePortResult\.blocked\.reason/u);
assert.match(failureBlockerReviewSmokeSource, /status: 'driver-failed'/u);
assert.match(failureBlockerReviewSmokeSource, /future-stop-payload-only/u);
assert.match(adapterPayloadCloseoutSmokeSource, /pre-contract audit coverage only/u);
assert.match(sourceReadinessMatrixSmokeSource, /promotionReady: false/u);
assert.match(formalGateSmokeSource, /not sufficient to introduce a formal adapter-payload TypeScript contract/u);

const serializedExpansion = JSON.stringify(phasePortPayloadPreContractExpansionRows);
assert.doesNotMatch(
  serializedExpansion,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Phase-port payload expansion review should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedExpansion,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Phase-port payload expansion review should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedExpansion,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain/iu,
  'Phase-port payload expansion review should not define fixed workflows or fallback chains.',
);
assert.doesNotMatch(
  serializedExpansion,
  /implementationQueue|orderedSteps|runtimeAuthority|productionReady":true|formalContractReady":true|experimental-adapter/u,
  'Phase-port payload expansion review should remain pre-contract audit coverage only.',
);

assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(PhasePort|Adapter).*(Payload|Contract)|type AgentSessionV3Runtime(PhasePort|Adapter).*Payload/u,
  'Phase-port payload expansion review should not add formal payload types to the production boundary.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Phase-port payload expansion review must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  expansionReviewSmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Phase-port payload expansion review should not call production v2 modules.',
);

assert.match(preflightAuditText, /Phase-Port Payload Pre-Contract Expansion Review Status/u);
assert.match(
  preflightAuditText,
  /agent-session-v3-runtime-boundary-phase-port-payload-pre-contract-expansion-review-smoke\.ts/u,
);
assert.match(preflightAuditText, /waiting, blocked, and failure/u);
assert.match(preflightAuditText, /not a formal payload contract/u);
assert.match(preflightAuditText, /not production wiring/u);
assert.match(statusText, /V3 runtime boundary phase-port payload pre-contract expansion review.*Completed/u);
assert.match(
  statusText,
  /agent-session-v3-runtime-boundary-phase-port-payload-pre-contract-expansion-review-smoke\.ts/u,
);

console.log('agent session v3 runtime boundary phase-port payload pre-contract expansion review smoke ok');
