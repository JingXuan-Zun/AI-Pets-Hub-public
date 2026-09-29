import assert from 'node:assert/strict';
import {
  createAgentSessionV3RuntimeBoundaryContract,
  getAgentSessionV3RuntimeStopEvidenceFields,
  type AgentSessionV3RuntimeBoundaryStopReason,
  type AgentSessionV3RuntimeStopEvidenceSource,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

type AdapterPayloadFamily =
  | 'blocked'
  | 'failure'
  | 'success'
  | 'waiting';

type DeferredContractDecision =
  | 'deferred'
  | 'not-applicable';

type DeferredContractEvidenceCriterion =
  | 'current-phase-port-result-has-structured-payload'
  | 'failure-kind-exists-in-phase-port-result-union'
  | 'future-production-adapter-emits-owned-fields'
  | 'real-or-production-like-traces-cover-field'
  | 'user-visible-semantics-defined';

interface DeferredContractRationaleRow {
  candidateAdapterFields: readonly string[];
  controllerPolicyFieldsExcluded: readonly string[];
  currentRationale: string;
  decision: DeferredContractDecision;
  evidenceThatWouldChangeGate: readonly DeferredContractEvidenceCriterion[];
  family: AdapterPayloadFamily;
  productionReady: false;
  reason: AgentSessionV3RuntimeBoundaryStopReason;
  staysOutsideImplementationQueue: true;
}

const adapterPayloadDeferredContractRationaleRows = [
  {
    candidateAdapterFields: [],
    controllerPolicyFieldsExcluded: [],
    currentRationale: 'success has no stop-payload fields; continue-with-event is an internal continuation, not a payload contract candidate',
    decision: 'not-applicable',
    evidenceThatWouldChangeGate: [],
    family: 'success',
    productionReady: false,
    reason: 'continue-with-event',
    staysOutsideImplementationQueue: true,
  },
  {
    candidateAdapterFields: [
      'pauseReason',
      'waitSource',
    ],
    controllerPolicyFieldsExcluded: [
      'resumeTriggerOwner',
      'waitBudget',
    ],
    currentRationale: 'waiting remains deferred because current waiting phase-port output has only diagnostic reason text; waitSource is missing and pauseReason is only partial',
    decision: 'deferred',
    evidenceThatWouldChangeGate: [
      'current-phase-port-result-has-structured-payload',
      'user-visible-semantics-defined',
      'real-or-production-like-traces-cover-field',
    ],
    family: 'waiting',
    productionReady: false,
    reason: 'waiting-for-phase-event',
    staysOutsideImplementationQueue: true,
  },
  {
    candidateAdapterFields: [
      'blockerSource',
      'recoverability',
      'userActionRequired',
    ],
    controllerPolicyFieldsExcluded: ['terminalStatusCandidate'],
    currentRationale: 'blocked remains deferred because blocker, recoverability, and user-action-required evidence require a future production adapter',
    decision: 'deferred',
    evidenceThatWouldChangeGate: [
      'future-production-adapter-emits-owned-fields',
      'real-or-production-like-traces-cover-field',
      'user-visible-semantics-defined',
    ],
    family: 'blocked',
    productionReady: false,
    reason: 'blocked-by-phase',
    staysOutsideImplementationQueue: true,
  },
  {
    candidateAdapterFields: [
      'errorClass',
      'failureOrigin',
      'retryability',
      'sideEffectCommitted',
      'userVisibleFailureReason',
    ],
    controllerPolicyFieldsExcluded: [],
    currentRationale: 'failure remains deferred because the current phase-port result union has no failure kind and failure evidence requires a future production adapter',
    decision: 'deferred',
    evidenceThatWouldChangeGate: [
      'failure-kind-exists-in-phase-port-result-union',
      'future-production-adapter-emits-owned-fields',
      'real-or-production-like-traces-cover-field',
      'user-visible-semantics-defined',
    ],
    family: 'failure',
    productionReady: false,
    reason: 'runtime-failed',
    staysOutsideImplementationQueue: true,
  },
] as const satisfies readonly DeferredContractRationaleRow[];

const reasonsExcludedFromDeferredContractRationale = [
  'cancelled',
  'invalid-transition',
  'transition-budget-exhausted',
] as const satisfies readonly AgentSessionV3RuntimeBoundaryStopReason[];

function createFieldKey(reason: AgentSessionV3RuntimeBoundaryStopReason, fieldName: string) {
  return `${reason}.${fieldName}`;
}

function adapterCandidateFieldKeys() {
  return adapterPayloadDeferredContractRationaleRows
    .flatMap((row) => row.candidateAdapterFields.map((fieldName) => createFieldKey(row.reason, fieldName)))
    .sort();
}

function controllerPolicyFieldKeysExcludedFromAdapterPayload() {
  return adapterPayloadDeferredContractRationaleRows
    .flatMap((row) => row.controllerPolicyFieldsExcluded.map((fieldName) => createFieldKey(row.reason, fieldName)))
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
  deferredRationaleSmokeSource,
  formalContractGateSmokeSource,
  matrixConsistencySmokeSource,
  preflightAuditText,
  sourceReadinessMatrixSmokeSource,
  statusText,
} = readProjectSources({
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  deferredRationaleSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-payload-deferred-contract-rationale-checkpoint-smoke.ts',
  formalContractGateSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-payload-formal-contract-gate-checkpoint-smoke.ts',
  matrixConsistencySmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-payload-matrix-consistency-checkpoint-smoke.ts',
  preflightAuditText: 'PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md',
  sourceReadinessMatrixSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-payload-source-readiness-matrix-checkpoint-smoke.ts',
  statusText: 'PROJECT_AGENT_V2_STATUS.md',
});

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');

assert.deepEqual(
  adapterPayloadDeferredContractRationaleRows.map((row) => row.family).sort(),
  ['blocked', 'failure', 'success', 'waiting'],
  'Deferred-contract rationale should cover every adapter-payload family exactly once.',
);
assert.deepEqual(
  adapterPayloadDeferredContractRationaleRows
    .filter((row) => row.decision === 'deferred')
    .map((row) => row.family)
    .sort(),
  ['blocked', 'failure', 'waiting'],
);
assert.deepEqual(
  adapterPayloadDeferredContractRationaleRows
    .filter((row) => row.decision === 'not-applicable')
    .map((row) => row.family),
  ['success'],
);

for (const row of adapterPayloadDeferredContractRationaleRows) {
  assert.equal(row.productionReady, false);
  assert.equal(row.staysOutsideImplementationQueue, true);
  assert.ok(row.currentRationale.length > 20);

  if (row.decision === 'not-applicable') {
    assert.deepEqual(row.candidateAdapterFields, []);
    assert.deepEqual(row.controllerPolicyFieldsExcluded, []);
    assert.deepEqual(row.evidenceThatWouldChangeGate, []);
    assert.equal(getAgentSessionV3RuntimeStopEvidenceFields(row.reason).length, 0);
  }

  if (row.decision === 'deferred') {
    assert.ok(row.candidateAdapterFields.length > 0);
    assert.ok(row.evidenceThatWouldChangeGate.includes('real-or-production-like-traces-cover-field'));
  }

  for (const fieldName of row.candidateAdapterFields) {
    const contractField = getAgentSessionV3RuntimeStopEvidenceFields(row.reason)
      .find((candidate) => candidate.name === fieldName);

    assert.ok(contractField, `${row.reason}.${fieldName} should exist in the stop evidence contract.`);
    assert.ok(
      contractField.source === 'phase-port-result' || contractField.source === 'future-production-adapter',
      `${row.reason}.${fieldName} should be adapter/phase payload evidence, got ${contractField.source}.`,
    );
  }

  for (const fieldName of row.controllerPolicyFieldsExcluded) {
    const contractField = getAgentSessionV3RuntimeStopEvidenceFields(row.reason)
      .find((candidate) => candidate.name === fieldName);

    assert.ok(contractField, `${row.reason}.${fieldName} should exist in the stop evidence contract.`);
    assert.equal(contractField.source, 'future-controller-policy');
  }
}

assert.deepEqual(adapterCandidateFieldKeys(), [
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
assert.deepEqual(controllerPolicyFieldKeysExcludedFromAdapterPayload(), [
  'blocked-by-phase.terminalStatusCandidate',
  'waiting-for-phase-event.resumeTriggerOwner',
  'waiting-for-phase-event.waitBudget',
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
assert.deepEqual(fieldsByContractSource('runtime-failed', 'future-production-adapter'), [
  'errorClass',
  'failureOrigin',
  'retryability',
  'sideEffectCommitted',
  'userVisibleFailureReason',
]);

for (const excludedReason of reasonsExcludedFromDeferredContractRationale) {
  assert.equal(
    adapterPayloadDeferredContractRationaleRows.some((row) => row.reason === excludedReason),
    false,
    `${excludedReason} should stay outside adapter-payload deferred-contract rationale.`,
  );
}

assert.match(formalContractGateSmokeSource, /defer-formal-contract/u);
assert.match(formalContractGateSmokeSource, /not-applicable-no-stop-payload/u);
assert.match(matrixConsistencySmokeSource, /no field, readiness, source, or owner drift/u);
assert.match(sourceReadinessMatrixSmokeSource, /promotionReady: false/u);

const serializedRationale = JSON.stringify(adapterPayloadDeferredContractRationaleRows);
assert.doesNotMatch(
  serializedRationale,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Adapter-payload deferred-contract rationale should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedRationale,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Adapter-payload deferred-contract rationale should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedRationale,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain/u,
  'Adapter-payload deferred-contract rationale should not define fixed workflows or fallback chains.',
);
assert.doesNotMatch(
  serializedRationale,
  /implementationQueue|orderedSteps|productionReady":true|runtimeAuthority|experimental-adapter/u,
  'Adapter-payload deferred-contract rationale should not become an implementation queue or runtime authority.',
);

assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Adapter|PhasePort).*(Payload|Contract)|type AgentSessionV3Runtime(Adapter|PhasePort).*Payload/u,
  'Deferred-contract rationale should not add formal adapter payload types to the production boundary.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Deferred-contract rationale must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  deferredRationaleSmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Deferred-contract rationale should not call production v2 modules.',
);

assert.match(preflightAuditText, /Adapter-Payload Deferred-Contract Rationale Checkpoint Status/u);
assert.match(
  preflightAuditText,
  /agent-session-v3-runtime-boundary-adapter-payload-deferred-contract-rationale-checkpoint-smoke\.ts/u,
);
assert.match(preflightAuditText, /evidence criteria, not an implementation queue/u);
assert.match(preflightAuditText, /not production wiring/u);
assert.match(statusText, /V3 runtime boundary adapter-payload deferred-contract rationale checkpoint.*Completed/u);
assert.match(
  statusText,
  /agent-session-v3-runtime-boundary-adapter-payload-deferred-contract-rationale-checkpoint-smoke\.ts/u,
);

console.log('agent session v3 runtime boundary adapter-payload deferred-contract rationale checkpoint smoke ok');
