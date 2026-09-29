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
  | 'waiting';

type AdapterPayloadSourceReadiness =
  | 'missing'
  | 'partial'
  | 'policy-blocked';

type AdapterPayloadMatrixOwner =
  | 'future-controller-policy'
  | 'future-phase-adapter'
  | 'future-production-adapter';

type StopPayloadSourceAvailability =
  | 'future-controller-policy-owned'
  | 'missing-future-phase-port-payload'
  | 'missing-future-production-adapter'
  | 'partial-from-current-phase-port-result';

type AdapterPayloadBacklogOwner =
  | 'future-controller-policy-fields'
  | 'future-production-adapter-evidence'
  | 'phase-port-payload-shape'
  | 'real-or-production-like-trace-evidence';

interface AdapterPayloadMatrixConsistencyRow {
  contractSource: AgentSessionV3RuntimeStopEvidenceSource;
  family: AdapterPayloadFamily;
  fieldName: string;
  owner: AdapterPayloadMatrixOwner;
  productionReady: false;
  promotionReady: false;
  readiness: AdapterPayloadSourceReadiness;
  reason: AgentSessionV3RuntimeBoundaryStopReason;
}

interface StopPayloadSourceMappingSubsetRow {
  contractSource: AgentSessionV3RuntimeStopEvidenceSource;
  fieldName: string;
  futureOwner: AdapterPayloadMatrixOwner;
  reason: AgentSessionV3RuntimeBoundaryStopReason;
  sourceAvailability: StopPayloadSourceAvailability;
}

interface AdapterPayloadBacklogCoverageRow {
  family: AdapterPayloadFamily;
  fieldNames: readonly string[];
  owner: AdapterPayloadBacklogOwner;
  reason: AgentSessionV3RuntimeBoundaryStopReason;
}

const adapterPayloadMatrixConsistencyRows = [
  {
    contractSource: 'phase-port-result',
    family: 'waiting',
    fieldName: 'waitSource',
    owner: 'future-phase-adapter',
    productionReady: false,
    promotionReady: false,
    readiness: 'missing',
    reason: 'waiting-for-phase-event',
  },
  {
    contractSource: 'phase-port-result',
    family: 'waiting',
    fieldName: 'pauseReason',
    owner: 'future-phase-adapter',
    productionReady: false,
    promotionReady: false,
    readiness: 'partial',
    reason: 'waiting-for-phase-event',
  },
  {
    contractSource: 'future-controller-policy',
    family: 'waiting',
    fieldName: 'resumeTriggerOwner',
    owner: 'future-controller-policy',
    productionReady: false,
    promotionReady: false,
    readiness: 'policy-blocked',
    reason: 'waiting-for-phase-event',
  },
  {
    contractSource: 'future-controller-policy',
    family: 'waiting',
    fieldName: 'waitBudget',
    owner: 'future-controller-policy',
    productionReady: false,
    promotionReady: false,
    readiness: 'policy-blocked',
    reason: 'waiting-for-phase-event',
  },
  {
    contractSource: 'future-production-adapter',
    family: 'blocked',
    fieldName: 'blockerSource',
    owner: 'future-production-adapter',
    productionReady: false,
    promotionReady: false,
    readiness: 'missing',
    reason: 'blocked-by-phase',
  },
  {
    contractSource: 'future-production-adapter',
    family: 'blocked',
    fieldName: 'recoverability',
    owner: 'future-production-adapter',
    productionReady: false,
    promotionReady: false,
    readiness: 'missing',
    reason: 'blocked-by-phase',
  },
  {
    contractSource: 'future-production-adapter',
    family: 'blocked',
    fieldName: 'userActionRequired',
    owner: 'future-production-adapter',
    productionReady: false,
    promotionReady: false,
    readiness: 'missing',
    reason: 'blocked-by-phase',
  },
  {
    contractSource: 'future-controller-policy',
    family: 'blocked',
    fieldName: 'terminalStatusCandidate',
    owner: 'future-controller-policy',
    productionReady: false,
    promotionReady: false,
    readiness: 'policy-blocked',
    reason: 'blocked-by-phase',
  },
  {
    contractSource: 'future-production-adapter',
    family: 'failure',
    fieldName: 'errorClass',
    owner: 'future-production-adapter',
    productionReady: false,
    promotionReady: false,
    readiness: 'missing',
    reason: 'runtime-failed',
  },
  {
    contractSource: 'future-production-adapter',
    family: 'failure',
    fieldName: 'failureOrigin',
    owner: 'future-production-adapter',
    productionReady: false,
    promotionReady: false,
    readiness: 'missing',
    reason: 'runtime-failed',
  },
  {
    contractSource: 'future-production-adapter',
    family: 'failure',
    fieldName: 'retryability',
    owner: 'future-production-adapter',
    productionReady: false,
    promotionReady: false,
    readiness: 'missing',
    reason: 'runtime-failed',
  },
  {
    contractSource: 'future-production-adapter',
    family: 'failure',
    fieldName: 'sideEffectCommitted',
    owner: 'future-production-adapter',
    productionReady: false,
    promotionReady: false,
    readiness: 'missing',
    reason: 'runtime-failed',
  },
  {
    contractSource: 'future-production-adapter',
    family: 'failure',
    fieldName: 'userVisibleFailureReason',
    owner: 'future-production-adapter',
    productionReady: false,
    promotionReady: false,
    readiness: 'missing',
    reason: 'runtime-failed',
  },
] as const satisfies readonly AdapterPayloadMatrixConsistencyRow[];

const stopPayloadSourceMappingSubset = [
  {
    contractSource: 'phase-port-result',
    fieldName: 'waitSource',
    futureOwner: 'future-phase-adapter',
    reason: 'waiting-for-phase-event',
    sourceAvailability: 'missing-future-phase-port-payload',
  },
  {
    contractSource: 'phase-port-result',
    fieldName: 'pauseReason',
    futureOwner: 'future-phase-adapter',
    reason: 'waiting-for-phase-event',
    sourceAvailability: 'partial-from-current-phase-port-result',
  },
  {
    contractSource: 'future-controller-policy',
    fieldName: 'resumeTriggerOwner',
    futureOwner: 'future-controller-policy',
    reason: 'waiting-for-phase-event',
    sourceAvailability: 'future-controller-policy-owned',
  },
  {
    contractSource: 'future-controller-policy',
    fieldName: 'waitBudget',
    futureOwner: 'future-controller-policy',
    reason: 'waiting-for-phase-event',
    sourceAvailability: 'future-controller-policy-owned',
  },
  {
    contractSource: 'future-production-adapter',
    fieldName: 'blockerSource',
    futureOwner: 'future-production-adapter',
    reason: 'blocked-by-phase',
    sourceAvailability: 'missing-future-production-adapter',
  },
  {
    contractSource: 'future-production-adapter',
    fieldName: 'recoverability',
    futureOwner: 'future-production-adapter',
    reason: 'blocked-by-phase',
    sourceAvailability: 'missing-future-production-adapter',
  },
  {
    contractSource: 'future-production-adapter',
    fieldName: 'userActionRequired',
    futureOwner: 'future-production-adapter',
    reason: 'blocked-by-phase',
    sourceAvailability: 'missing-future-production-adapter',
  },
  {
    contractSource: 'future-controller-policy',
    fieldName: 'terminalStatusCandidate',
    futureOwner: 'future-controller-policy',
    reason: 'blocked-by-phase',
    sourceAvailability: 'future-controller-policy-owned',
  },
  {
    contractSource: 'future-production-adapter',
    fieldName: 'errorClass',
    futureOwner: 'future-production-adapter',
    reason: 'runtime-failed',
    sourceAvailability: 'missing-future-production-adapter',
  },
  {
    contractSource: 'future-production-adapter',
    fieldName: 'failureOrigin',
    futureOwner: 'future-production-adapter',
    reason: 'runtime-failed',
    sourceAvailability: 'missing-future-production-adapter',
  },
  {
    contractSource: 'future-production-adapter',
    fieldName: 'retryability',
    futureOwner: 'future-production-adapter',
    reason: 'runtime-failed',
    sourceAvailability: 'missing-future-production-adapter',
  },
  {
    contractSource: 'future-production-adapter',
    fieldName: 'sideEffectCommitted',
    futureOwner: 'future-production-adapter',
    reason: 'runtime-failed',
    sourceAvailability: 'missing-future-production-adapter',
  },
  {
    contractSource: 'future-production-adapter',
    fieldName: 'userVisibleFailureReason',
    futureOwner: 'future-production-adapter',
    reason: 'runtime-failed',
    sourceAvailability: 'missing-future-production-adapter',
  },
] as const satisfies readonly StopPayloadSourceMappingSubsetRow[];

const adapterPayloadBacklogCoverageRows = [
  {
    family: 'waiting',
    fieldNames: [
      'pauseReason',
      'waitSource',
    ],
    owner: 'phase-port-payload-shape',
    reason: 'waiting-for-phase-event',
  },
  {
    family: 'waiting',
    fieldNames: [
      'resumeTriggerOwner',
      'waitBudget',
    ],
    owner: 'future-controller-policy-fields',
    reason: 'waiting-for-phase-event',
  },
  {
    family: 'waiting',
    fieldNames: [
      'pauseReason',
      'resumeTriggerOwner',
      'waitBudget',
      'waitSource',
    ],
    owner: 'real-or-production-like-trace-evidence',
    reason: 'waiting-for-phase-event',
  },
  {
    family: 'blocked',
    fieldNames: [
      'blockerSource',
      'recoverability',
      'userActionRequired',
    ],
    owner: 'future-production-adapter-evidence',
    reason: 'blocked-by-phase',
  },
  {
    family: 'blocked',
    fieldNames: [
      'terminalStatusCandidate',
    ],
    owner: 'future-controller-policy-fields',
    reason: 'blocked-by-phase',
  },
  {
    family: 'blocked',
    fieldNames: [
      'blockerSource',
      'recoverability',
      'terminalStatusCandidate',
      'userActionRequired',
    ],
    owner: 'real-or-production-like-trace-evidence',
    reason: 'blocked-by-phase',
  },
  {
    family: 'failure',
    fieldNames: [],
    owner: 'phase-port-payload-shape',
    reason: 'runtime-failed',
  },
  {
    family: 'failure',
    fieldNames: [
      'errorClass',
      'failureOrigin',
      'retryability',
      'sideEffectCommitted',
      'userVisibleFailureReason',
    ],
    owner: 'future-production-adapter-evidence',
    reason: 'runtime-failed',
  },
  {
    family: 'failure',
    fieldNames: [
      'errorClass',
      'failureOrigin',
      'retryability',
      'sideEffectCommitted',
      'userVisibleFailureReason',
    ],
    owner: 'real-or-production-like-trace-evidence',
    reason: 'runtime-failed',
  },
] as const satisfies readonly AdapterPayloadBacklogCoverageRow[];

const reasonsExcludedFromAdapterPayloadMatrix = [
  'cancelled',
  'continue-with-event',
  'invalid-transition',
  'transition-budget-exhausted',
] as const satisfies readonly AgentSessionV3RuntimeBoundaryStopReason[];

function createFieldKey(reason: AgentSessionV3RuntimeBoundaryStopReason, fieldName: string) {
  return `${reason}.${fieldName}`;
}

function matrixFieldKeys() {
  return adapterPayloadMatrixConsistencyRows
    .map((row) => createFieldKey(row.reason, row.fieldName))
    .sort();
}

function sourceMappingSubsetFieldKeys() {
  return stopPayloadSourceMappingSubset
    .map((row) => createFieldKey(row.reason, row.fieldName))
    .sort();
}

function backlogFieldKeys() {
  return adapterPayloadBacklogCoverageRows
    .flatMap((row) => row.fieldNames.map((fieldName) => createFieldKey(row.reason, fieldName)))
    .filter((fieldKey, index, fieldKeys) => fieldKeys.indexOf(fieldKey) === index)
    .sort();
}

function rowsForReason(reason: AgentSessionV3RuntimeBoundaryStopReason) {
  return adapterPayloadMatrixConsistencyRows.filter((row) => row.reason === reason);
}

function fieldKeysByReadiness(readiness: AdapterPayloadSourceReadiness) {
  return adapterPayloadMatrixConsistencyRows
    .filter((row) => row.readiness === readiness)
    .map((row) => createFieldKey(row.reason, row.fieldName))
    .sort();
}

function fieldKeysByOwner(owner: AdapterPayloadMatrixOwner) {
  return adapterPayloadMatrixConsistencyRows
    .filter((row) => row.owner === owner)
    .map((row) => createFieldKey(row.reason, row.fieldName))
    .sort();
}

function contractFieldKeysByReason(reason: AgentSessionV3RuntimeBoundaryStopReason) {
  return getAgentSessionV3RuntimeStopEvidenceFields(reason)
    .map((field) => createFieldKey(reason, field.name))
    .sort();
}

function expectedReadinessFromSourceAvailability(
  availability: StopPayloadSourceAvailability,
): AdapterPayloadSourceReadiness {
  if (availability === 'partial-from-current-phase-port-result') {
    return 'partial';
  }

  if (availability === 'future-controller-policy-owned') {
    return 'policy-blocked';
  }

  return 'missing';
}

const {
  backlogConsistencySmokeSource,
  boundarySource,
  matrixConsistencySmokeSource,
  phasePortPayloadReadinessSmokeSource,
  preflightAuditText,
  promotionBacklogSmokeSource,
  sourceMappingSmokeSource,
  sourceReadinessMatrixSmokeSource,
  statusText,
} = readProjectSources({
  backlogConsistencySmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-payload-backlog-consistency-checkpoint-smoke.ts',
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  matrixConsistencySmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-payload-matrix-consistency-checkpoint-smoke.ts',
  phasePortPayloadReadinessSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-phase-port-payload-contract-readiness-rollup-smoke.ts',
  preflightAuditText: 'PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md',
  promotionBacklogSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-payload-promotion-blocker-backlog-checkpoint-smoke.ts',
  sourceMappingSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-stop-payload-source-mapping-smoke.ts',
  sourceReadinessMatrixSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-payload-source-readiness-matrix-checkpoint-smoke.ts',
  statusText: 'PROJECT_AGENT_V2_STATUS.md',
});

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');

assert.deepEqual(
  adapterPayloadMatrixConsistencyRows
    .map((row) => row.family)
    .filter((family, index, families) => families.indexOf(family) === index)
    .sort(),
  ['blocked', 'failure', 'waiting'],
  'Adapter-payload matrix consistency should cover only stop-payload adapter families.',
);

assert.deepEqual(
  matrixFieldKeys(),
  sourceMappingSubsetFieldKeys(),
  'Adapter-payload matrix fields should match the source-mapping subset exactly.',
);
assert.deepEqual(
  matrixFieldKeys(),
  backlogFieldKeys(),
  'Adapter-payload matrix fields should match the union of adapter-payload backlog fields exactly.',
);
assert.deepEqual(
  matrixFieldKeys(),
  [
    ...contractFieldKeysByReason('blocked-by-phase'),
    ...contractFieldKeysByReason('runtime-failed'),
    ...contractFieldKeysByReason('waiting-for-phase-event'),
  ].sort(),
  'Adapter-payload matrix fields should match current waiting, blocked, and runtime-failed stop evidence fields.',
);

assert.deepEqual(
  rowsForReason('waiting-for-phase-event').map((row) => row.fieldName).sort(),
  [
    'pauseReason',
    'resumeTriggerOwner',
    'waitBudget',
    'waitSource',
  ],
);
assert.deepEqual(
  rowsForReason('blocked-by-phase').map((row) => row.fieldName).sort(),
  [
    'blockerSource',
    'recoverability',
    'terminalStatusCandidate',
    'userActionRequired',
  ],
);
assert.deepEqual(
  rowsForReason('runtime-failed').map((row) => row.fieldName).sort(),
  [
    'errorClass',
    'failureOrigin',
    'retryability',
    'sideEffectCommitted',
    'userVisibleFailureReason',
  ],
);

for (const row of adapterPayloadMatrixConsistencyRows) {
  const contractField = getAgentSessionV3RuntimeStopEvidenceFields(row.reason)
    .find((field) => field.name === row.fieldName);
  const sourceMappingRow = stopPayloadSourceMappingSubset
    .find((mappingRow) => (
      mappingRow.reason === row.reason
      && mappingRow.fieldName === row.fieldName
    ));

  assert.ok(contractField, `${row.reason}.${row.fieldName} should exist in the stop evidence contract.`);
  assert.ok(sourceMappingRow, `${row.reason}.${row.fieldName} should exist in the source-mapping subset.`);
  assert.equal(row.contractSource, contractField.source);
  assert.equal(row.contractSource, sourceMappingRow.contractSource);
  assert.equal(row.owner, sourceMappingRow.futureOwner);
  assert.equal(row.readiness, expectedReadinessFromSourceAvailability(sourceMappingRow.sourceAvailability));
  assert.equal(row.productionReady, false);
  assert.equal(row.promotionReady, false);

  if (row.contractSource === 'future-controller-policy') {
    assert.equal(row.owner, 'future-controller-policy');
    assert.equal(row.readiness, 'policy-blocked');
  }

  if (row.contractSource === 'future-production-adapter') {
    assert.equal(row.owner, 'future-production-adapter');
    assert.equal(row.readiness, 'missing');
  }

  if (row.contractSource === 'phase-port-result' && row.fieldName === 'pauseReason') {
    assert.equal(row.owner, 'future-phase-adapter');
    assert.equal(row.readiness, 'partial');
  }

  if (row.contractSource === 'phase-port-result' && row.fieldName === 'waitSource') {
    assert.equal(row.owner, 'future-phase-adapter');
    assert.equal(row.readiness, 'missing');
  }
}

assert.deepEqual(fieldKeysByReadiness('partial'), ['waiting-for-phase-event.pauseReason']);
assert.deepEqual(
  fieldKeysByReadiness('policy-blocked'),
  [
    'blocked-by-phase.terminalStatusCandidate',
    'waiting-for-phase-event.resumeTriggerOwner',
    'waiting-for-phase-event.waitBudget',
  ],
);
assert.deepEqual(
  fieldKeysByReadiness('missing'),
  [
    'blocked-by-phase.blockerSource',
    'blocked-by-phase.recoverability',
    'blocked-by-phase.userActionRequired',
    'runtime-failed.errorClass',
    'runtime-failed.failureOrigin',
    'runtime-failed.retryability',
    'runtime-failed.sideEffectCommitted',
    'runtime-failed.userVisibleFailureReason',
    'waiting-for-phase-event.waitSource',
  ],
);

assert.deepEqual(
  fieldKeysByOwner('future-controller-policy'),
  [
    'blocked-by-phase.terminalStatusCandidate',
    'waiting-for-phase-event.resumeTriggerOwner',
    'waiting-for-phase-event.waitBudget',
  ],
);
assert.deepEqual(fieldKeysByOwner('future-phase-adapter'), [
  'waiting-for-phase-event.pauseReason',
  'waiting-for-phase-event.waitSource',
]);
assert.deepEqual(
  fieldKeysByOwner('future-production-adapter'),
  [
    'blocked-by-phase.blockerSource',
    'blocked-by-phase.recoverability',
    'blocked-by-phase.userActionRequired',
    'runtime-failed.errorClass',
    'runtime-failed.failureOrigin',
    'runtime-failed.retryability',
    'runtime-failed.sideEffectCommitted',
    'runtime-failed.userVisibleFailureReason',
  ],
);

for (const row of adapterPayloadBacklogCoverageRows) {
  for (const fieldName of row.fieldNames) {
    const matchingMatrixRow = adapterPayloadMatrixConsistencyRows.find((matrixRow) => (
      matrixRow.reason === row.reason
      && matrixRow.fieldName === fieldName
    ));

    assert.ok(matchingMatrixRow, `${row.reason}.${fieldName} should not be dropped from the matrix.`);

    if (row.owner === 'future-controller-policy-fields') {
      assert.equal(matchingMatrixRow.owner, 'future-controller-policy');
      assert.equal(matchingMatrixRow.readiness, 'policy-blocked');
    }

    if (row.owner === 'future-production-adapter-evidence') {
      assert.equal(matchingMatrixRow.owner, 'future-production-adapter');
      assert.equal(matchingMatrixRow.readiness, 'missing');
    }
  }
}

for (const excludedReason of reasonsExcludedFromAdapterPayloadMatrix) {
  assert.equal(
    adapterPayloadMatrixConsistencyRows.some((row) => row.reason === excludedReason),
    false,
    `${excludedReason} should stay outside the adapter-payload matrix consistency checkpoint.`,
  );
}

assert.equal(
  getAgentSessionV3RuntimeStopEvidenceFields('continue-with-event').length,
  0,
  'continue-with-event should still have no stop-payload fields.',
);
assert.deepEqual(contractFieldKeysByReason('invalid-transition'), [
  'invalid-transition.adapterSource',
  'invalid-transition.eventType',
  'invalid-transition.invalidTransitionKind',
  'invalid-transition.phase',
  'invalid-transition.retrySafety',
]);
assert.deepEqual(contractFieldKeysByReason('transition-budget-exhausted'), [
  'transition-budget-exhausted.budgetOwner',
  'transition-budget-exhausted.modelBudgetState',
  'transition-budget-exhausted.recoveryCount',
  'transition-budget-exhausted.taskProgress',
  'transition-budget-exhausted.toolBudgetState',
  'transition-budget-exhausted.transitionCount',
]);

assert.match(sourceReadinessMatrixSmokeSource, /adapterPayloadSourceReadinessMatrix/u);
assert.match(backlogConsistencySmokeSource, /Adapter-payload backlog should only cover waiting, blocked, and runtime-failed stop reasons/u);
assert.match(promotionBacklogSmokeSource, /blocked-until-owner-evidence-exists/u);
assert.match(sourceMappingSmokeSource, /partial-from-current-phase-port-result/u);
assert.match(sourceMappingSmokeSource, /missing-future-production-adapter/u);
assert.match(sourceMappingSmokeSource, /future-controller-policy-owned/u);
assert.match(phasePortPayloadReadinessSmokeSource, /too shallow for a formal payload contract/u);

const serializedConsistency = JSON.stringify({
  adapterPayloadBacklogCoverageRows,
  adapterPayloadMatrixConsistencyRows,
  reasonsExcludedFromAdapterPayloadMatrix,
  stopPayloadSourceMappingSubset,
});
assert.doesNotMatch(
  serializedConsistency,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Adapter-payload matrix consistency checkpoint should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedConsistency,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Adapter-payload matrix consistency checkpoint should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedConsistency,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain/iu,
  'Adapter-payload matrix consistency checkpoint should not define fixed workflows or fallback chains.',
);
assert.doesNotMatch(
  serializedConsistency,
  /productionReady":true|promotionReady":true|runtimeAuthority|experimental-adapter/u,
  'Adapter-payload matrix consistency checkpoint should not grant runtime authority or promote fields.',
);

assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Adapter-payload matrix consistency checkpoint must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  matrixConsistencySmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Adapter-payload matrix consistency checkpoint should not call production v2 modules.',
);

assert.match(preflightAuditText, /Adapter-Payload Matrix Consistency Checkpoint Status/u);
assert.match(
  preflightAuditText,
  /agent-session-v3-runtime-boundary-adapter-payload-matrix-consistency-checkpoint-smoke\.ts/u,
);
assert.match(preflightAuditText, /source-readiness matrix, stop-payload source mapping, and adapter-payload backlog/u);
assert.match(preflightAuditText, /no field, readiness, source, or owner drift/u);
assert.match(preflightAuditText, /not production wiring/u);
assert.match(statusText, /V3 runtime boundary adapter-payload matrix consistency checkpoint.*Completed/u);
assert.match(
  statusText,
  /agent-session-v3-runtime-boundary-adapter-payload-matrix-consistency-checkpoint-smoke\.ts/u,
);

console.log('agent session v3 runtime boundary adapter-payload matrix consistency checkpoint smoke ok');
