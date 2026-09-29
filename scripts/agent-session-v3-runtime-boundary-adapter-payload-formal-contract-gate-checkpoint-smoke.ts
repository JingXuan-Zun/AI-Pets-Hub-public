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

type FormalContractGateDecision =
  | 'defer-formal-contract'
  | 'not-applicable-no-stop-payload';

type FormalContractGateBlocker =
  | 'controller-policy-fields-excluded-from-adapter-payload'
  | 'current-phase-port-result-too-shallow'
  | 'missing-future-production-adapter-evidence'
  | 'missing-real-or-production-like-traces'
  | 'no-current-phase-port-failure-kind'
  | 'no-stop-payload-fields'
  | 'partial-current-phase-port-source';

type AdapterPayloadContractCandidateFieldSource =
  | 'future-phase-adapter'
  | 'future-production-adapter';

interface AdapterPayloadContractCandidateField {
  contractSource: Extract<AgentSessionV3RuntimeStopEvidenceSource, 'phase-port-result' | 'future-production-adapter'>;
  fieldName: string;
  promotionReady: false;
  source: AdapterPayloadContractCandidateFieldSource;
}

interface AdapterPayloadFormalContractGateRow {
  blockers: readonly FormalContractGateBlocker[];
  candidateFields: readonly AdapterPayloadContractCandidateField[];
  controllerPolicyFieldsExcluded: readonly string[];
  decision: FormalContractGateDecision;
  family: AdapterPayloadFamily;
  productionReady: false;
  reason: AgentSessionV3RuntimeBoundaryStopReason;
}

const adapterPayloadFormalContractGateRows = [
  {
    blockers: ['no-stop-payload-fields'],
    candidateFields: [],
    controllerPolicyFieldsExcluded: [],
    decision: 'not-applicable-no-stop-payload',
    family: 'success',
    productionReady: false,
    reason: 'continue-with-event',
  },
  {
    blockers: [
      'current-phase-port-result-too-shallow',
      'partial-current-phase-port-source',
      'controller-policy-fields-excluded-from-adapter-payload',
      'missing-real-or-production-like-traces',
    ],
    candidateFields: [
      {
        contractSource: 'phase-port-result',
        fieldName: 'waitSource',
        promotionReady: false,
        source: 'future-phase-adapter',
      },
      {
        contractSource: 'phase-port-result',
        fieldName: 'pauseReason',
        promotionReady: false,
        source: 'future-phase-adapter',
      },
    ],
    controllerPolicyFieldsExcluded: [
      'resumeTriggerOwner',
      'waitBudget',
    ],
    decision: 'defer-formal-contract',
    family: 'waiting',
    productionReady: false,
    reason: 'waiting-for-phase-event',
  },
  {
    blockers: [
      'missing-future-production-adapter-evidence',
      'controller-policy-fields-excluded-from-adapter-payload',
      'missing-real-or-production-like-traces',
    ],
    candidateFields: [
      {
        contractSource: 'future-production-adapter',
        fieldName: 'blockerSource',
        promotionReady: false,
        source: 'future-production-adapter',
      },
      {
        contractSource: 'future-production-adapter',
        fieldName: 'recoverability',
        promotionReady: false,
        source: 'future-production-adapter',
      },
      {
        contractSource: 'future-production-adapter',
        fieldName: 'userActionRequired',
        promotionReady: false,
        source: 'future-production-adapter',
      },
    ],
    controllerPolicyFieldsExcluded: ['terminalStatusCandidate'],
    decision: 'defer-formal-contract',
    family: 'blocked',
    productionReady: false,
    reason: 'blocked-by-phase',
  },
  {
    blockers: [
      'no-current-phase-port-failure-kind',
      'missing-future-production-adapter-evidence',
      'missing-real-or-production-like-traces',
    ],
    candidateFields: [
      {
        contractSource: 'future-production-adapter',
        fieldName: 'errorClass',
        promotionReady: false,
        source: 'future-production-adapter',
      },
      {
        contractSource: 'future-production-adapter',
        fieldName: 'failureOrigin',
        promotionReady: false,
        source: 'future-production-adapter',
      },
      {
        contractSource: 'future-production-adapter',
        fieldName: 'retryability',
        promotionReady: false,
        source: 'future-production-adapter',
      },
      {
        contractSource: 'future-production-adapter',
        fieldName: 'sideEffectCommitted',
        promotionReady: false,
        source: 'future-production-adapter',
      },
      {
        contractSource: 'future-production-adapter',
        fieldName: 'userVisibleFailureReason',
        promotionReady: false,
        source: 'future-production-adapter',
      },
    ],
    controllerPolicyFieldsExcluded: [],
    decision: 'defer-formal-contract',
    family: 'failure',
    productionReady: false,
    reason: 'runtime-failed',
  },
] as const satisfies readonly AdapterPayloadFormalContractGateRow[];

const reasonsExcludedFromAdapterPayloadFormalContractGate = [
  'cancelled',
  'invalid-transition',
  'transition-budget-exhausted',
] as const satisfies readonly AgentSessionV3RuntimeBoundaryStopReason[];

function createFieldKey(reason: AgentSessionV3RuntimeBoundaryStopReason, fieldName: string) {
  return `${reason}.${fieldName}`;
}

function candidateFieldKeys() {
  return adapterPayloadFormalContractGateRows
    .flatMap((row) => row.candidateFields.map((field) => createFieldKey(row.reason, field.fieldName)))
    .sort();
}

function controllerPolicyFieldKeysExcludedFromAdapterPayload() {
  return adapterPayloadFormalContractGateRows
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

function rowForFamily(family: AdapterPayloadFamily) {
  return adapterPayloadFormalContractGateRows.find((row) => row.family === family);
}

const {
  boundarySource,
  formalContractGateSmokeSource,
  matrixConsistencySmokeSource,
  phasePortPayloadReadinessSmokeSource,
  preflightAuditText,
  promotionReadinessSmokeSource,
  sourceReadinessMatrixSmokeSource,
  statusText,
} = readProjectSources({
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  formalContractGateSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-payload-formal-contract-gate-checkpoint-smoke.ts',
  matrixConsistencySmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-payload-matrix-consistency-checkpoint-smoke.ts',
  phasePortPayloadReadinessSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-phase-port-payload-contract-readiness-rollup-smoke.ts',
  preflightAuditText: 'PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md',
  promotionReadinessSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-promotion-readiness-smoke.ts',
  sourceReadinessMatrixSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-payload-source-readiness-matrix-checkpoint-smoke.ts',
  statusText: 'PROJECT_AGENT_V2_STATUS.md',
});

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');

assert.deepEqual(
  adapterPayloadFormalContractGateRows.map((row) => row.family).sort(),
  ['blocked', 'failure', 'success', 'waiting'],
  'Adapter-payload formal contract gate should cover all four adapter-payload families.',
);
assert.deepEqual(
  adapterPayloadFormalContractGateRows
    .filter((row) => row.decision === 'defer-formal-contract')
    .map((row) => row.family)
    .sort(),
  ['blocked', 'failure', 'waiting'],
);
assert.deepEqual(
  adapterPayloadFormalContractGateRows
    .filter((row) => row.decision === 'not-applicable-no-stop-payload')
    .map((row) => row.family),
  ['success'],
);

for (const row of adapterPayloadFormalContractGateRows) {
  assert.equal(row.productionReady, false);

  if (row.decision === 'defer-formal-contract') {
    assert.ok(row.blockers.length > 0);
    assert.ok(row.candidateFields.every((field) => field.promotionReady === false));
  }

  if (row.decision === 'not-applicable-no-stop-payload') {
    assert.deepEqual(row.candidateFields, []);
    assert.deepEqual(row.controllerPolicyFieldsExcluded, []);
    assert.ok(row.blockers.includes('no-stop-payload-fields'));
    assert.equal(getAgentSessionV3RuntimeStopEvidenceFields(row.reason).length, 0);
  }

  for (const field of row.candidateFields) {
    const contractField = getAgentSessionV3RuntimeStopEvidenceFields(row.reason)
      .find((candidate) => candidate.name === field.fieldName);

    assert.ok(contractField, `${row.reason}.${field.fieldName} should exist in the stop evidence contract.`);
    assert.equal(contractField.source, field.contractSource);
    assert.notEqual(contractField.source, 'future-controller-policy');
    assert.notEqual(contractField.source, 'pilot-runner-state');
    assert.equal(field.promotionReady, false);
  }

  for (const fieldName of row.controllerPolicyFieldsExcluded) {
    const contractField = getAgentSessionV3RuntimeStopEvidenceFields(row.reason)
      .find((candidate) => candidate.name === fieldName);

    assert.ok(contractField, `${row.reason}.${fieldName} should exist in the stop evidence contract.`);
    assert.equal(contractField.source, 'future-controller-policy');
  }
}

assert.deepEqual(candidateFieldKeys(), [
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
assert.deepEqual(fieldsByContractSource('blocked-by-phase', 'future-controller-policy'), ['terminalStatusCandidate']);
assert.deepEqual(fieldsByContractSource('runtime-failed', 'future-production-adapter'), [
  'errorClass',
  'failureOrigin',
  'retryability',
  'sideEffectCommitted',
  'userVisibleFailureReason',
]);

assert.ok(rowForFamily('waiting')?.blockers.includes('current-phase-port-result-too-shallow'));
assert.ok(rowForFamily('waiting')?.blockers.includes('partial-current-phase-port-source'));
assert.ok(rowForFamily('blocked')?.blockers.includes('missing-future-production-adapter-evidence'));
assert.ok(rowForFamily('failure')?.blockers.includes('no-current-phase-port-failure-kind'));
assert.ok(rowForFamily('failure')?.blockers.includes('missing-future-production-adapter-evidence'));

for (const excludedReason of reasonsExcludedFromAdapterPayloadFormalContractGate) {
  assert.equal(
    adapterPayloadFormalContractGateRows.some((row) => row.reason === excludedReason),
    false,
    `${excludedReason} should stay outside the adapter-payload formal contract gate.`,
  );
}

assert.match(matrixConsistencySmokeSource, /no field, readiness, source, or owner drift/u);
assert.match(sourceReadinessMatrixSmokeSource, /promotionReady: false/u);
assert.match(phasePortPayloadReadinessSmokeSource, /too shallow for a formal payload contract/u);
assert.match(promotionReadinessSmokeSource, /No adapter-owned stop-payload field should be promoted/u);

const serializedGate = JSON.stringify(adapterPayloadFormalContractGateRows);
assert.doesNotMatch(
  serializedGate,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Adapter-payload formal contract gate should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedGate,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Adapter-payload formal contract gate should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedGate,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain/iu,
  'Adapter-payload formal contract gate should not define fixed workflows or fallback chains.',
);
assert.doesNotMatch(
  serializedGate,
  /productionReady":true|promotionReady":true|runtimeAuthority|experimental-adapter/u,
  'Adapter-payload formal contract gate should not grant runtime authority or promote fields.',
);

assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Adapter|PhasePort).*(Payload|Contract)|type AgentSessionV3Runtime(Adapter|PhasePort).*Payload/u,
  'Formal adapter payload types should not be added to the production boundary by this gate.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Adapter-payload formal contract gate must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  formalContractGateSmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Adapter-payload formal contract gate should not call production v2 modules.',
);

assert.match(preflightAuditText, /Adapter-Payload Formal Contract Gate Checkpoint Status/u);
assert.match(
  preflightAuditText,
  /agent-session-v3-runtime-boundary-adapter-payload-formal-contract-gate-checkpoint-smoke\.ts/u,
);
assert.match(preflightAuditText, /not sufficient to introduce a formal adapter-payload TypeScript contract/u);
assert.match(preflightAuditText, /not production wiring/u);
assert.match(statusText, /V3 runtime boundary adapter-payload formal contract gate checkpoint.*Completed/u);
assert.match(
  statusText,
  /agent-session-v3-runtime-boundary-adapter-payload-formal-contract-gate-checkpoint-smoke\.ts/u,
);

console.log('agent session v3 runtime boundary adapter-payload formal contract gate checkpoint smoke ok');
