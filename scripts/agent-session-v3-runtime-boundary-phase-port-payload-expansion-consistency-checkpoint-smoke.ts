import assert from 'node:assert/strict';
import {
  createAgentSessionV3RuntimeBoundaryContract,
  getAgentSessionV3RuntimeStopEvidenceFields,
  type AgentSessionV3RuntimeBoundaryStopReason,
  type AgentSessionV3RuntimeStopEvidenceSource,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

type ExpansionConsistencyFamily =
  | 'blocked'
  | 'failure'
  | 'waiting';

type ExpansionConsistencyOwner =
  | 'future-controller-policy'
  | 'future-phase-adapter'
  | 'future-production-adapter';

type ExpansionConsistencyDecision =
  | 'pre-contract-review-only'
  | 'requires-future-result-kind'
  | 'requires-structured-phase-payload';

type ExpansionConsistencyReadiness =
  | 'diagnostic-only'
  | 'missing'
  | 'partial-diagnostic-only'
  | 'policy-owned';

type SourceMatrixReadiness =
  | 'missing'
  | 'partial'
  | 'policy-blocked';

type FormalGateAlignment =
  | 'candidate-field'
  | 'controller-policy-excluded';

interface PhasePortPayloadExpansionConsistencyRow {
  closeoutDecision: 'pre-contract-deferred';
  contractSource: AgentSessionV3RuntimeStopEvidenceSource;
  decision: ExpansionConsistencyDecision;
  family: ExpansionConsistencyFamily;
  fieldName: string;
  formalContractReady: false;
  formalGateAlignment: FormalGateAlignment;
  owner: ExpansionConsistencyOwner;
  productionReady: false;
  readiness: ExpansionConsistencyReadiness;
  reason: Extract<
    AgentSessionV3RuntimeBoundaryStopReason,
    'blocked-by-phase' | 'runtime-failed' | 'waiting-for-phase-event'
  >;
  sourceMatrixReadiness: SourceMatrixReadiness;
}

const phasePortPayloadExpansionConsistencyRows = [
  {
    closeoutDecision: 'pre-contract-deferred',
    contractSource: 'phase-port-result',
    decision: 'requires-structured-phase-payload',
    family: 'waiting',
    fieldName: 'waitSource',
    formalContractReady: false,
    formalGateAlignment: 'candidate-field',
    owner: 'future-phase-adapter',
    productionReady: false,
    readiness: 'missing',
    reason: 'waiting-for-phase-event',
    sourceMatrixReadiness: 'missing',
  },
  {
    closeoutDecision: 'pre-contract-deferred',
    contractSource: 'phase-port-result',
    decision: 'requires-structured-phase-payload',
    family: 'waiting',
    fieldName: 'pauseReason',
    formalContractReady: false,
    formalGateAlignment: 'candidate-field',
    owner: 'future-phase-adapter',
    productionReady: false,
    readiness: 'partial-diagnostic-only',
    reason: 'waiting-for-phase-event',
    sourceMatrixReadiness: 'partial',
  },
  {
    closeoutDecision: 'pre-contract-deferred',
    contractSource: 'future-controller-policy',
    decision: 'pre-contract-review-only',
    family: 'waiting',
    fieldName: 'resumeTriggerOwner',
    formalContractReady: false,
    formalGateAlignment: 'controller-policy-excluded',
    owner: 'future-controller-policy',
    productionReady: false,
    readiness: 'policy-owned',
    reason: 'waiting-for-phase-event',
    sourceMatrixReadiness: 'policy-blocked',
  },
  {
    closeoutDecision: 'pre-contract-deferred',
    contractSource: 'future-controller-policy',
    decision: 'pre-contract-review-only',
    family: 'waiting',
    fieldName: 'waitBudget',
    formalContractReady: false,
    formalGateAlignment: 'controller-policy-excluded',
    owner: 'future-controller-policy',
    productionReady: false,
    readiness: 'policy-owned',
    reason: 'waiting-for-phase-event',
    sourceMatrixReadiness: 'policy-blocked',
  },
  {
    closeoutDecision: 'pre-contract-deferred',
    contractSource: 'future-production-adapter',
    decision: 'requires-structured-phase-payload',
    family: 'blocked',
    fieldName: 'blockerSource',
    formalContractReady: false,
    formalGateAlignment: 'candidate-field',
    owner: 'future-production-adapter',
    productionReady: false,
    readiness: 'diagnostic-only',
    reason: 'blocked-by-phase',
    sourceMatrixReadiness: 'missing',
  },
  {
    closeoutDecision: 'pre-contract-deferred',
    contractSource: 'future-production-adapter',
    decision: 'requires-structured-phase-payload',
    family: 'blocked',
    fieldName: 'recoverability',
    formalContractReady: false,
    formalGateAlignment: 'candidate-field',
    owner: 'future-production-adapter',
    productionReady: false,
    readiness: 'missing',
    reason: 'blocked-by-phase',
    sourceMatrixReadiness: 'missing',
  },
  {
    closeoutDecision: 'pre-contract-deferred',
    contractSource: 'future-production-adapter',
    decision: 'requires-structured-phase-payload',
    family: 'blocked',
    fieldName: 'userActionRequired',
    formalContractReady: false,
    formalGateAlignment: 'candidate-field',
    owner: 'future-production-adapter',
    productionReady: false,
    readiness: 'missing',
    reason: 'blocked-by-phase',
    sourceMatrixReadiness: 'missing',
  },
  {
    closeoutDecision: 'pre-contract-deferred',
    contractSource: 'future-controller-policy',
    decision: 'pre-contract-review-only',
    family: 'blocked',
    fieldName: 'terminalStatusCandidate',
    formalContractReady: false,
    formalGateAlignment: 'controller-policy-excluded',
    owner: 'future-controller-policy',
    productionReady: false,
    readiness: 'policy-owned',
    reason: 'blocked-by-phase',
    sourceMatrixReadiness: 'policy-blocked',
  },
  {
    closeoutDecision: 'pre-contract-deferred',
    contractSource: 'future-production-adapter',
    decision: 'requires-future-result-kind',
    family: 'failure',
    fieldName: 'failureOrigin',
    formalContractReady: false,
    formalGateAlignment: 'candidate-field',
    owner: 'future-production-adapter',
    productionReady: false,
    readiness: 'diagnostic-only',
    reason: 'runtime-failed',
    sourceMatrixReadiness: 'missing',
  },
  {
    closeoutDecision: 'pre-contract-deferred',
    contractSource: 'future-production-adapter',
    decision: 'requires-future-result-kind',
    family: 'failure',
    fieldName: 'retryability',
    formalContractReady: false,
    formalGateAlignment: 'candidate-field',
    owner: 'future-production-adapter',
    productionReady: false,
    readiness: 'missing',
    reason: 'runtime-failed',
    sourceMatrixReadiness: 'missing',
  },
  {
    closeoutDecision: 'pre-contract-deferred',
    contractSource: 'future-production-adapter',
    decision: 'requires-future-result-kind',
    family: 'failure',
    fieldName: 'sideEffectCommitted',
    formalContractReady: false,
    formalGateAlignment: 'candidate-field',
    owner: 'future-production-adapter',
    productionReady: false,
    readiness: 'missing',
    reason: 'runtime-failed',
    sourceMatrixReadiness: 'missing',
  },
  {
    closeoutDecision: 'pre-contract-deferred',
    contractSource: 'future-production-adapter',
    decision: 'requires-future-result-kind',
    family: 'failure',
    fieldName: 'userVisibleFailureReason',
    formalContractReady: false,
    formalGateAlignment: 'candidate-field',
    owner: 'future-production-adapter',
    productionReady: false,
    readiness: 'diagnostic-only',
    reason: 'runtime-failed',
    sourceMatrixReadiness: 'missing',
  },
  {
    closeoutDecision: 'pre-contract-deferred',
    contractSource: 'future-production-adapter',
    decision: 'requires-future-result-kind',
    family: 'failure',
    fieldName: 'errorClass',
    formalContractReady: false,
    formalGateAlignment: 'candidate-field',
    owner: 'future-production-adapter',
    productionReady: false,
    readiness: 'diagnostic-only',
    reason: 'runtime-failed',
    sourceMatrixReadiness: 'missing',
  },
] as const satisfies readonly PhasePortPayloadExpansionConsistencyRow[];

function createFieldKey(reason: AgentSessionV3RuntimeBoundaryStopReason, fieldName: string) {
  return `${reason}.${fieldName}`;
}

function fieldKeysByFamily(family: ExpansionConsistencyFamily) {
  return phasePortPayloadExpansionConsistencyRows
    .filter((row) => row.family === family)
    .map((row) => createFieldKey(row.reason, row.fieldName))
    .sort();
}

function fieldKeysByFormalGateAlignment(alignment: FormalGateAlignment) {
  return phasePortPayloadExpansionConsistencyRows
    .filter((row) => row.formalGateAlignment === alignment)
    .map((row) => createFieldKey(row.reason, row.fieldName))
    .sort();
}

function fieldKeysBySourceMatrixReadiness(readiness: SourceMatrixReadiness) {
  return phasePortPayloadExpansionConsistencyRows
    .filter((row) => row.sourceMatrixReadiness === readiness)
    .map((row) => createFieldKey(row.reason, row.fieldName))
    .sort();
}

function fieldsByContractSource(
  reason: AgentSessionV3RuntimeBoundaryStopReason,
  source: AgentSessionV3RuntimeStopEvidenceSource,
) {
  return getAgentSessionV3RuntimeStopEvidenceFields(reason)
    .filter((field) => field.source === source)
    .map((field) => field.name)
    .sort();
}

const {
  boundarySource,
  closeoutSmokeSource,
  consistencySmokeSource,
  expansionReviewSmokeSource,
  formalGateSmokeSource,
  phasePortRollupSmokeSource,
  preflightAuditText,
  sourceReadinessMatrixSmokeSource,
  statusText,
} = readProjectSources({
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  closeoutSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-payload-pre-contract-closeout-checkpoint-smoke.ts',
  consistencySmokeSource:
    'scripts/agent-session-v3-runtime-boundary-phase-port-payload-expansion-consistency-checkpoint-smoke.ts',
  expansionReviewSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-phase-port-payload-pre-contract-expansion-review-smoke.ts',
  formalGateSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-payload-formal-contract-gate-checkpoint-smoke.ts',
  phasePortRollupSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-phase-port-payload-contract-readiness-rollup-smoke.ts',
  preflightAuditText: 'PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md',
  sourceReadinessMatrixSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-payload-source-readiness-matrix-checkpoint-smoke.ts',
  statusText: 'PROJECT_AGENT_V2_STATUS.md',
});

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');

assert.deepEqual(
  phasePortPayloadExpansionConsistencyRows
    .map((row) => row.family)
    .filter((family, index, families) => families.indexOf(family) === index)
    .sort(),
  ['blocked', 'failure', 'waiting'],
  'Expansion consistency should cover waiting, blocked, and failure families.',
);

assert.deepEqual(fieldKeysByFamily('waiting'), [
  'waiting-for-phase-event.pauseReason',
  'waiting-for-phase-event.resumeTriggerOwner',
  'waiting-for-phase-event.waitBudget',
  'waiting-for-phase-event.waitSource',
]);
assert.deepEqual(fieldKeysByFamily('blocked'), [
  'blocked-by-phase.blockerSource',
  'blocked-by-phase.recoverability',
  'blocked-by-phase.terminalStatusCandidate',
  'blocked-by-phase.userActionRequired',
]);
assert.deepEqual(fieldKeysByFamily('failure'), [
  'runtime-failed.errorClass',
  'runtime-failed.failureOrigin',
  'runtime-failed.retryability',
  'runtime-failed.sideEffectCommitted',
  'runtime-failed.userVisibleFailureReason',
]);

for (const row of phasePortPayloadExpansionConsistencyRows) {
  const contractField = getAgentSessionV3RuntimeStopEvidenceFields(row.reason)
    .find((field) => field.name === row.fieldName);

  assert.ok(contractField, `${row.reason}.${row.fieldName} should exist in the stop evidence contract.`);
  assert.equal(row.contractSource, contractField.source);
  assert.equal(row.productionReady, false);
  assert.equal(row.formalContractReady, false);
  assert.equal(row.closeoutDecision, 'pre-contract-deferred');

  if (row.owner === 'future-phase-adapter') {
    assert.equal(row.contractSource, 'phase-port-result');
    assert.equal(row.formalGateAlignment, 'candidate-field');
    assert.equal(row.decision, 'requires-structured-phase-payload');
  }

  if (row.owner === 'future-production-adapter') {
    assert.equal(row.contractSource, 'future-production-adapter');
    assert.equal(row.formalGateAlignment, 'candidate-field');
  }

  if (row.owner === 'future-controller-policy') {
    assert.equal(row.contractSource, 'future-controller-policy');
    assert.equal(row.formalGateAlignment, 'controller-policy-excluded');
    assert.equal(row.decision, 'pre-contract-review-only');
    assert.equal(row.sourceMatrixReadiness, 'policy-blocked');
  }

  if (row.family === 'failure') {
    assert.equal(row.decision, 'requires-future-result-kind');
  }
}

assert.deepEqual(fieldKeysByFormalGateAlignment('candidate-field'), [
  'blocked-by-phase.blockerSource',
  'blocked-by-phase.recoverability',
  'blocked-by-phase.userActionRequired',
  'runtime-failed.errorClass',
  'runtime-failed.failureOrigin',
  'runtime-failed.retryability',
  'runtime-failed.sideEffectCommitted',
  'runtime-failed.userVisibleFailureReason',
  'waiting-for-phase-event.pauseReason',
  'waiting-for-phase-event.waitSource',
]);
assert.deepEqual(fieldKeysByFormalGateAlignment('controller-policy-excluded'), [
  'blocked-by-phase.terminalStatusCandidate',
  'waiting-for-phase-event.resumeTriggerOwner',
  'waiting-for-phase-event.waitBudget',
]);

assert.deepEqual(fieldKeysBySourceMatrixReadiness('partial'), ['waiting-for-phase-event.pauseReason']);
assert.deepEqual(fieldKeysBySourceMatrixReadiness('policy-blocked'), [
  'blocked-by-phase.terminalStatusCandidate',
  'waiting-for-phase-event.resumeTriggerOwner',
  'waiting-for-phase-event.waitBudget',
]);
assert.deepEqual(fieldKeysBySourceMatrixReadiness('missing'), [
  'blocked-by-phase.blockerSource',
  'blocked-by-phase.recoverability',
  'blocked-by-phase.userActionRequired',
  'runtime-failed.errorClass',
  'runtime-failed.failureOrigin',
  'runtime-failed.retryability',
  'runtime-failed.sideEffectCommitted',
  'runtime-failed.userVisibleFailureReason',
  'waiting-for-phase-event.waitSource',
]);

assert.deepEqual(fieldsByContractSource('waiting-for-phase-event', 'phase-port-result'), ['pauseReason', 'waitSource']);
assert.deepEqual(fieldsByContractSource('waiting-for-phase-event', 'future-controller-policy'), [
  'resumeTriggerOwner',
  'waitBudget',
]);
assert.deepEqual(fieldsByContractSource('blocked-by-phase', 'future-production-adapter'), [
  'blockerSource',
  'recoverability',
  'userActionRequired',
]);
assert.deepEqual(fieldsByContractSource('blocked-by-phase', 'future-controller-policy'), ['terminalStatusCandidate']);
assert.deepEqual(fieldsByContractSource('runtime-failed', 'future-production-adapter'), [
  'errorClass',
  'failureOrigin',
  'retryability',
  'sideEffectCommitted',
  'userVisibleFailureReason',
]);

assert.match(expansionReviewSmokeSource, /formalContractReady: false/u);
assert.match(expansionReviewSmokeSource, /productionReady: false/u);
assert.match(expansionReviewSmokeSource, /requires-structured-phase-payload/u);
assert.match(expansionReviewSmokeSource, /requires-future-result-kind/u);
assert.match(phasePortRollupSmokeSource, /Only waiting phase-port fields should be phase-port-owned for now/u);
assert.match(sourceReadinessMatrixSmokeSource, /promotionReady: false/u);
assert.match(formalGateSmokeSource, /not sufficient to introduce a formal adapter-payload TypeScript contract/u);
assert.match(closeoutSmokeSource, /pre-contract audit coverage only/u);

const serializedConsistency = JSON.stringify(phasePortPayloadExpansionConsistencyRows);
assert.doesNotMatch(
  serializedConsistency,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Phase-port payload expansion consistency should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedConsistency,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Phase-port payload expansion consistency should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedConsistency,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain/iu,
  'Phase-port payload expansion consistency should not define fixed workflows or fallback chains.',
);
assert.doesNotMatch(
  serializedConsistency,
  /implementationQueue|orderedSteps|runtimeAuthority|productionReady":true|formalContractReady":true|experimental-adapter/u,
  'Phase-port payload expansion consistency should remain pre-contract audit coverage only.',
);

assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(PhasePort|Adapter).*(Payload|Contract)|type AgentSessionV3Runtime(PhasePort|Adapter).*Payload/u,
  'Phase-port payload expansion consistency should not add formal payload types to the production boundary.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Phase-port payload expansion consistency must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  consistencySmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Phase-port payload expansion consistency should not call production v2 modules.',
);

assert.match(preflightAuditText, /Phase-Port Payload Expansion Consistency Checkpoint Status/u);
assert.match(
  preflightAuditText,
  /agent-session-v3-runtime-boundary-phase-port-payload-expansion-consistency-checkpoint-smoke\.ts/u,
);
assert.match(preflightAuditText, /no expansion row becomes formal-contract-ready or production-ready/u);
assert.match(preflightAuditText, /not production wiring/u);
assert.match(statusText, /V3 runtime boundary phase-port payload expansion consistency checkpoint.*Completed/u);
assert.match(
  statusText,
  /agent-session-v3-runtime-boundary-phase-port-payload-expansion-consistency-checkpoint-smoke\.ts/u,
);

console.log('agent session v3 runtime boundary phase-port payload expansion consistency checkpoint smoke ok');
