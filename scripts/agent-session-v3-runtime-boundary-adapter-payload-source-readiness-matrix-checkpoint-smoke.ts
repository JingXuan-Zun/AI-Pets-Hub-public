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

interface AdapterPayloadSourceReadinessMatrixRow {
  contractSource: AgentSessionV3RuntimeStopEvidenceSource;
  currentSource: string | null;
  family: AdapterPayloadFamily;
  fieldName: string;
  owner: AdapterPayloadMatrixOwner;
  productionReady: false;
  promotionReady: false;
  readiness: AdapterPayloadSourceReadiness;
  reason: AgentSessionV3RuntimeBoundaryStopReason;
}

const adapterPayloadSourceReadinessMatrix = [
  {
    contractSource: 'phase-port-result',
    currentSource: null,
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
    currentSource: 'AgentSessionV3RuntimePhasePortResult.waiting.reason',
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
    currentSource: null,
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
    currentSource: null,
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
    currentSource: null,
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
    currentSource: null,
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
    currentSource: null,
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
    currentSource: null,
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
    currentSource: null,
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
    currentSource: null,
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
    currentSource: null,
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
    currentSource: null,
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
    currentSource: null,
    family: 'failure',
    fieldName: 'userVisibleFailureReason',
    owner: 'future-production-adapter',
    productionReady: false,
    promotionReady: false,
    readiness: 'missing',
    reason: 'runtime-failed',
  },
] as const satisfies readonly AdapterPayloadSourceReadinessMatrixRow[];

const adapterPayloadMatrixExcludedReasons = [
  'cancelled',
  'continue-with-event',
  'invalid-transition',
  'transition-budget-exhausted',
] as const satisfies readonly AgentSessionV3RuntimeBoundaryStopReason[];

function createFieldKey(reason: AgentSessionV3RuntimeBoundaryStopReason, fieldName: string) {
  return `${reason}.${fieldName}`;
}

function fieldRowsByReason(reason: AgentSessionV3RuntimeBoundaryStopReason) {
  return adapterPayloadSourceReadinessMatrix.filter((row) => row.reason === reason);
}

function fieldKeysByReadiness(readiness: AdapterPayloadSourceReadiness) {
  return adapterPayloadSourceReadinessMatrix
    .filter((row) => row.readiness === readiness)
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
  backlogConsistencySmokeSource,
  boundarySource,
  preflightAuditText,
  promotionBacklogSmokeSource,
  sourceMappingSmokeSource,
  sourceReadinessMatrixSmokeSource,
  statusText,
} = readProjectSources({
  backlogConsistencySmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-payload-backlog-consistency-checkpoint-smoke.ts',
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
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
  adapterPayloadSourceReadinessMatrix
    .map((row) => row.family)
    .filter((family, index, families) => families.indexOf(family) === index)
    .sort(),
  ['blocked', 'failure', 'waiting'],
  'Source-readiness matrix should cover only adapter payload families with stop-payload candidates.',
);

assert.deepEqual(
  fieldRowsByReason('waiting-for-phase-event').map((row) => row.fieldName).sort(),
  [
    'pauseReason',
    'resumeTriggerOwner',
    'waitBudget',
    'waitSource',
  ],
);
assert.deepEqual(
  fieldRowsByReason('blocked-by-phase').map((row) => row.fieldName).sort(),
  [
    'blockerSource',
    'recoverability',
    'terminalStatusCandidate',
    'userActionRequired',
  ],
);
assert.deepEqual(
  fieldRowsByReason('runtime-failed').map((row) => row.fieldName).sort(),
  [
    'errorClass',
    'failureOrigin',
    'retryability',
    'sideEffectCommitted',
    'userVisibleFailureReason',
  ],
);

for (const row of adapterPayloadSourceReadinessMatrix) {
  const contractField = getAgentSessionV3RuntimeStopEvidenceFields(row.reason)
    .find((field) => field.name === row.fieldName);

  assert.ok(contractField, `${row.reason}.${row.fieldName} should exist in the stop evidence contract.`);
  assert.equal(row.contractSource, contractField.source);
  assert.equal(row.productionReady, false);
  assert.equal(row.promotionReady, false);

  if (row.readiness === 'partial') {
    assert.equal(row.contractSource, 'phase-port-result');
    assert.equal(row.owner, 'future-phase-adapter');
    assert.ok(row.currentSource);
  }

  if (row.readiness === 'missing') {
    assert.ok(
      row.contractSource === 'phase-port-result' || row.contractSource === 'future-production-adapter',
      `${row.reason}.${row.fieldName} missing fields should be phase-port or production-adapter-owned.`,
    );
    assert.equal(row.currentSource, null);
  }

  if (row.readiness === 'policy-blocked') {
    assert.equal(row.contractSource, 'future-controller-policy');
    assert.equal(row.owner, 'future-controller-policy');
    assert.equal(row.currentSource, null);
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

for (const excludedReason of adapterPayloadMatrixExcludedReasons) {
  assert.equal(
    adapterPayloadSourceReadinessMatrix.some((row) => row.reason === excludedReason),
    false,
    `${excludedReason} should stay outside the adapter-payload source-readiness matrix.`,
  );
}

assert.deepEqual(fieldsByContractSource('invalid-transition', 'pilot-runner-state'), ['eventType', 'phase']);
assert.deepEqual(fieldsByContractSource('transition-budget-exhausted', 'pilot-runner-state'), [
  'recoveryCount',
  'transitionCount',
]);

assert.match(backlogConsistencySmokeSource, /Adapter-payload backlog should only cover waiting, blocked, and runtime-failed stop reasons/u);
assert.match(promotionBacklogSmokeSource, /blocked-until-owner-evidence-exists/u);
assert.match(sourceMappingSmokeSource, /partial-from-current-phase-port-result/u);
assert.match(sourceMappingSmokeSource, /missing-future-production-adapter/u);
assert.match(sourceMappingSmokeSource, /future-controller-policy-owned/u);

const serializedMatrix = JSON.stringify(adapterPayloadSourceReadinessMatrix);
assert.doesNotMatch(
  serializedMatrix,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Adapter-payload source-readiness matrix should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedMatrix,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Adapter-payload source-readiness matrix should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedMatrix,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain/iu,
  'Adapter-payload source-readiness matrix should not define fixed workflows or fallback chains.',
);
assert.doesNotMatch(
  serializedMatrix,
  /productionReady":true|promotionReady":true|runtimeAuthority|experimental-adapter/u,
  'Adapter-payload source-readiness matrix should not grant runtime authority or promote fields.',
);

assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Adapter-payload source-readiness matrix must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  sourceReadinessMatrixSmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Adapter-payload source-readiness matrix should not call production v2 modules.',
);

assert.match(preflightAuditText, /Adapter-Payload Source-Readiness Matrix Checkpoint Status/u);
assert.match(
  preflightAuditText,
  /agent-session-v3-runtime-boundary-adapter-payload-source-readiness-matrix-checkpoint-smoke\.ts/u,
);
assert.match(preflightAuditText, /missing, partial, or blocked by future controller policy/u);
assert.match(preflightAuditText, /not production wiring/u);
assert.match(statusText, /V3 runtime boundary adapter-payload source-readiness matrix checkpoint.*Completed/u);
assert.match(
  statusText,
  /agent-session-v3-runtime-boundary-adapter-payload-source-readiness-matrix-checkpoint-smoke\.ts/u,
);

console.log('agent session v3 runtime boundary adapter-payload source-readiness matrix checkpoint smoke ok');
