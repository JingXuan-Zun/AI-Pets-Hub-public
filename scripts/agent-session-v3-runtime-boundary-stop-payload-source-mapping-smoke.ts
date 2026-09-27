import assert from 'node:assert/strict';
import {
  AGENT_SESSION_V3_RUNTIME_STOP_EVIDENCE_CONTRACT,
  createAgentSessionV3RuntimeBoundaryContract,
  type AgentSessionV3RuntimeBoundaryStopReason,
  type AgentSessionV3RuntimeStopEvidenceSource,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

type StopPayloadSourceAvailability =
  | 'available-from-current-pilot-runner'
  | 'partial-from-current-phase-port-result'
  | 'missing-future-phase-port-payload'
  | 'missing-future-production-adapter'
  | 'future-controller-policy-owned';

type StopPayloadFutureOwner =
  | 'current-pilot-runner'
  | 'future-phase-adapter'
  | 'future-production-adapter'
  | 'future-controller-policy';

interface StopPayloadSourceMappingRow {
  contractSource: AgentSessionV3RuntimeStopEvidenceSource;
  currentSource: string | null;
  fieldName: string;
  futureOwner: StopPayloadFutureOwner;
  missingSource: string | null;
  productionReady: false;
  reason: AgentSessionV3RuntimeBoundaryStopReason;
  sourceAvailability: StopPayloadSourceAvailability;
}

const stopPayloadSourceMapping = [
  {
    contractSource: 'phase-port-result',
    currentSource: null,
    fieldName: 'waitSource',
    futureOwner: 'future-phase-adapter',
    missingSource: 'structured wait-source classification on waiting phase-port results',
    productionReady: false,
    reason: 'waiting-for-phase-event',
    sourceAvailability: 'missing-future-phase-port-payload',
  },
  {
    contractSource: 'future-controller-policy',
    currentSource: null,
    fieldName: 'resumeTriggerOwner',
    futureOwner: 'future-controller-policy',
    missingSource: 'controller decision about who may resume the wait',
    productionReady: false,
    reason: 'waiting-for-phase-event',
    sourceAvailability: 'future-controller-policy-owned',
  },
  {
    contractSource: 'future-controller-policy',
    currentSource: null,
    fieldName: 'waitBudget',
    futureOwner: 'future-controller-policy',
    missingSource: 'controller wait, poll, or pause budget',
    productionReady: false,
    reason: 'waiting-for-phase-event',
    sourceAvailability: 'future-controller-policy-owned',
  },
  {
    contractSource: 'phase-port-result',
    currentSource: 'AgentSessionV3RuntimePhasePortResult.waiting.reason',
    fieldName: 'pauseReason',
    futureOwner: 'future-phase-adapter',
    missingSource: 'user-visible pause reason distinct from internal adapter diagnostics',
    productionReady: false,
    reason: 'waiting-for-phase-event',
    sourceAvailability: 'partial-from-current-phase-port-result',
  },
  {
    contractSource: 'future-production-adapter',
    currentSource: null,
    fieldName: 'blockerSource',
    futureOwner: 'future-production-adapter',
    missingSource: 'phase-local blocker source classification',
    productionReady: false,
    reason: 'blocked-by-phase',
    sourceAvailability: 'missing-future-production-adapter',
  },
  {
    contractSource: 'future-production-adapter',
    currentSource: null,
    fieldName: 'recoverability',
    futureOwner: 'future-production-adapter',
    missingSource: 'phase-local recoverability signal',
    productionReady: false,
    reason: 'blocked-by-phase',
    sourceAvailability: 'missing-future-production-adapter',
  },
  {
    contractSource: 'future-production-adapter',
    currentSource: null,
    fieldName: 'userActionRequired',
    futureOwner: 'future-production-adapter',
    missingSource: 'phase-local user-action-required signal',
    productionReady: false,
    reason: 'blocked-by-phase',
    sourceAvailability: 'missing-future-production-adapter',
  },
  {
    contractSource: 'future-controller-policy',
    currentSource: null,
    fieldName: 'terminalStatusCandidate',
    futureOwner: 'future-controller-policy',
    missingSource: 'controller terminal-status mapping if blocked cannot continue',
    productionReady: false,
    reason: 'blocked-by-phase',
    sourceAvailability: 'future-controller-policy-owned',
  },
  {
    contractSource: 'pilot-runner-state',
    currentSource: 'AgentSessionV3PilotRunner invalid transition state.phase',
    fieldName: 'phase',
    futureOwner: 'current-pilot-runner',
    missingSource: null,
    productionReady: false,
    reason: 'invalid-transition',
    sourceAvailability: 'available-from-current-pilot-runner',
  },
  {
    contractSource: 'pilot-runner-state',
    currentSource: 'AgentSessionV3PilotRunner rejected event.type',
    fieldName: 'eventType',
    futureOwner: 'current-pilot-runner',
    missingSource: null,
    productionReady: false,
    reason: 'invalid-transition',
    sourceAvailability: 'available-from-current-pilot-runner',
  },
  {
    contractSource: 'future-production-adapter',
    currentSource: null,
    fieldName: 'adapterSource',
    futureOwner: 'future-production-adapter',
    missingSource: 'phase adapter identity for the emitted event',
    productionReady: false,
    reason: 'invalid-transition',
    sourceAvailability: 'missing-future-production-adapter',
  },
  {
    contractSource: 'future-controller-policy',
    currentSource: null,
    fieldName: 'invalidTransitionKind',
    futureOwner: 'future-controller-policy',
    missingSource: 'controller classification of state corruption, adapter bug, or stale event evidence',
    productionReady: false,
    reason: 'invalid-transition',
    sourceAvailability: 'future-controller-policy-owned',
  },
  {
    contractSource: 'future-production-adapter',
    currentSource: null,
    fieldName: 'retrySafety',
    futureOwner: 'future-production-adapter',
    missingSource: 'phase adapter retry-safety signal',
    productionReady: false,
    reason: 'invalid-transition',
    sourceAvailability: 'missing-future-production-adapter',
  },
  {
    contractSource: 'future-production-adapter',
    currentSource: null,
    fieldName: 'failureOrigin',
    futureOwner: 'future-production-adapter',
    missingSource: 'phase-local failure origin classification',
    productionReady: false,
    reason: 'runtime-failed',
    sourceAvailability: 'missing-future-production-adapter',
  },
  {
    contractSource: 'future-production-adapter',
    currentSource: null,
    fieldName: 'retryability',
    futureOwner: 'future-production-adapter',
    missingSource: 'phase-local retryability signal',
    productionReady: false,
    reason: 'runtime-failed',
    sourceAvailability: 'missing-future-production-adapter',
  },
  {
    contractSource: 'future-production-adapter',
    currentSource: null,
    fieldName: 'sideEffectCommitted',
    futureOwner: 'future-production-adapter',
    missingSource: 'phase-local side-effect commit signal',
    productionReady: false,
    reason: 'runtime-failed',
    sourceAvailability: 'missing-future-production-adapter',
  },
  {
    contractSource: 'future-production-adapter',
    currentSource: null,
    fieldName: 'userVisibleFailureReason',
    futureOwner: 'future-production-adapter',
    missingSource: 'user-visible failure reason from the failing phase',
    productionReady: false,
    reason: 'runtime-failed',
    sourceAvailability: 'missing-future-production-adapter',
  },
  {
    contractSource: 'future-production-adapter',
    currentSource: null,
    fieldName: 'errorClass',
    futureOwner: 'future-production-adapter',
    missingSource: 'normalized error class from the failing phase',
    productionReady: false,
    reason: 'runtime-failed',
    sourceAvailability: 'missing-future-production-adapter',
  },
  {
    contractSource: 'future-controller-policy',
    currentSource: null,
    fieldName: 'budgetOwner',
    futureOwner: 'future-controller-policy',
    missingSource: 'controller budget-owner classification',
    productionReady: false,
    reason: 'transition-budget-exhausted',
    sourceAvailability: 'future-controller-policy-owned',
  },
  {
    contractSource: 'pilot-runner-state',
    currentSource: 'AgentSessionV3PilotRunner transitionCount',
    fieldName: 'transitionCount',
    futureOwner: 'current-pilot-runner',
    missingSource: null,
    productionReady: false,
    reason: 'transition-budget-exhausted',
    sourceAvailability: 'available-from-current-pilot-runner',
  },
  {
    contractSource: 'future-production-adapter',
    currentSource: null,
    fieldName: 'modelBudgetState',
    futureOwner: 'future-production-adapter',
    missingSource: 'model-call budget state at stop point',
    productionReady: false,
    reason: 'transition-budget-exhausted',
    sourceAvailability: 'missing-future-production-adapter',
  },
  {
    contractSource: 'future-production-adapter',
    currentSource: null,
    fieldName: 'toolBudgetState',
    futureOwner: 'future-production-adapter',
    missingSource: 'tool-call budget state at stop point',
    productionReady: false,
    reason: 'transition-budget-exhausted',
    sourceAvailability: 'missing-future-production-adapter',
  },
  {
    contractSource: 'future-production-adapter',
    currentSource: null,
    fieldName: 'taskProgress',
    futureOwner: 'future-production-adapter',
    missingSource: 'phase-local task progress evidence at stop point',
    productionReady: false,
    reason: 'transition-budget-exhausted',
    sourceAvailability: 'missing-future-production-adapter',
  },
  {
    contractSource: 'pilot-runner-state',
    currentSource: 'AgentSessionV3PilotState.recoveryCount',
    fieldName: 'recoveryCount',
    futureOwner: 'current-pilot-runner',
    missingSource: null,
    productionReady: false,
    reason: 'transition-budget-exhausted',
    sourceAvailability: 'available-from-current-pilot-runner',
  },
] as const satisfies readonly StopPayloadSourceMappingRow[];

function createFieldKey(reason: AgentSessionV3RuntimeBoundaryStopReason, fieldName: string) {
  return `${reason}.${fieldName}`;
}

const {
  boundarySource,
  sourceMappingSmokeSource,
  preflightAuditText,
  statusText,
} = readProjectSources({
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  sourceMappingSmokeSource: 'scripts/agent-session-v3-runtime-boundary-stop-payload-source-mapping-smoke.ts',
  preflightAuditText: 'PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md',
  statusText: 'PROJECT_AGENT_V2_STATUS.md',
});

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');

const contractFieldRows = Object.entries(AGENT_SESSION_V3_RUNTIME_STOP_EVIDENCE_CONTRACT)
  .flatMap(([reason, fields]) => (fields ?? []).map((field) => ({
    fieldName: field.name,
    reason: reason as AgentSessionV3RuntimeBoundaryStopReason,
    source: field.source,
  })));

assert.deepEqual(
  stopPayloadSourceMapping.map((row) => createFieldKey(row.reason, row.fieldName)).sort(),
  contractFieldRows.map((row) => createFieldKey(row.reason, row.fieldName)).sort(),
  'Source mapping should cover every stop evidence contract field exactly once.',
);

for (const row of stopPayloadSourceMapping) {
  const contractField = contractFieldRows.find((field) => (
    field.reason === row.reason && field.fieldName === row.fieldName
  ));

  assert.ok(contractField, `${row.reason}.${row.fieldName} should exist in the stop evidence contract.`);
  assert.equal(row.contractSource, contractField.source);
  assert.equal(row.productionReady, false);

  if (row.sourceAvailability === 'available-from-current-pilot-runner') {
    assert.equal(row.contractSource, 'pilot-runner-state');
    assert.equal(row.futureOwner, 'current-pilot-runner');
    assert.ok(row.currentSource);
    assert.equal(row.missingSource, null);
  }

  if (row.sourceAvailability === 'partial-from-current-phase-port-result') {
    assert.equal(row.contractSource, 'phase-port-result');
    assert.equal(row.futureOwner, 'future-phase-adapter');
    assert.ok(row.currentSource);
    assert.ok(row.missingSource);
  }

  if (row.sourceAvailability === 'missing-future-phase-port-payload') {
    assert.equal(row.contractSource, 'phase-port-result');
    assert.equal(row.futureOwner, 'future-phase-adapter');
    assert.equal(row.currentSource, null);
    assert.ok(row.missingSource);
  }

  if (row.sourceAvailability === 'missing-future-production-adapter') {
    assert.equal(row.contractSource, 'future-production-adapter');
    assert.equal(row.futureOwner, 'future-production-adapter');
    assert.equal(row.currentSource, null);
    assert.ok(row.missingSource);
  }

  if (row.sourceAvailability === 'future-controller-policy-owned') {
    assert.equal(row.contractSource, 'future-controller-policy');
    assert.equal(row.futureOwner, 'future-controller-policy');
    assert.equal(row.currentSource, null);
    assert.ok(row.missingSource);
  }
}

assert.deepEqual(
  stopPayloadSourceMapping
    .filter((row) => row.sourceAvailability === 'available-from-current-pilot-runner')
    .map((row) => createFieldKey(row.reason, row.fieldName))
    .sort(),
  [
    'invalid-transition.eventType',
    'invalid-transition.phase',
    'transition-budget-exhausted.recoveryCount',
    'transition-budget-exhausted.transitionCount',
  ],
);

assert.deepEqual(
  stopPayloadSourceMapping
    .filter((row) => row.sourceAvailability === 'partial-from-current-phase-port-result')
    .map((row) => createFieldKey(row.reason, row.fieldName)),
  ['waiting-for-phase-event.pauseReason'],
);

assert.deepEqual(
  stopPayloadSourceMapping
    .filter((row) => row.sourceAvailability === 'missing-future-phase-port-payload')
    .map((row) => createFieldKey(row.reason, row.fieldName)),
  ['waiting-for-phase-event.waitSource'],
);

assert.ok(
  stopPayloadSourceMapping
    .filter((row) => row.sourceAvailability === 'missing-future-production-adapter')
    .length > stopPayloadSourceMapping
    .filter((row) => row.sourceAvailability === 'available-from-current-pilot-runner')
    .length,
  'Most stop-payload fields should still require future production adapters.',
);

assert.deepEqual(
  stopPayloadSourceMapping
    .filter((row) => row.sourceAvailability === 'future-controller-policy-owned')
    .map((row) => createFieldKey(row.reason, row.fieldName))
    .sort(),
  [
    'blocked-by-phase.terminalStatusCandidate',
    'invalid-transition.invalidTransitionKind',
    'transition-budget-exhausted.budgetOwner',
    'waiting-for-phase-event.resumeTriggerOwner',
    'waiting-for-phase-event.waitBudget',
  ],
);

assert.deepEqual(
  Object.keys(AGENT_SESSION_V3_RUNTIME_STOP_EVIDENCE_CONTRACT).sort(),
  [
    'blocked-by-phase',
    'invalid-transition',
    'runtime-failed',
    'transition-budget-exhausted',
    'waiting-for-phase-event',
  ],
  'Only evidence-blocked stop reasons should have source mappings for now.',
);

assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Stop-payload source mapping audit must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  sourceMappingSmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Stop-payload source mapping audit should not call production v2 modules.',
);

const serializedSourceMapping = JSON.stringify(stopPayloadSourceMapping);
assert.doesNotMatch(
  serializedSourceMapping,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Stop-payload source mapping audit should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedSourceMapping,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain|nextTool|nextArgs/iu,
  'Stop-payload source mapping audit should not define fixed workflows or fallback chains.',
);
assert.doesNotMatch(
  serializedSourceMapping,
  /productionReady":true|runtimeAuthority|experimental-adapter/u,
  'Stop-payload source mapping audit should not grant runtime authority.',
);

assert.match(preflightAuditText, /Runtime Stop-Payload Source Mapping Audit Status/u);
assert.match(preflightAuditText, /agent-session-v3-runtime-boundary-stop-payload-source-mapping-smoke\.ts/u);
assert.match(preflightAuditText, /available from the current pilot runner/u);
assert.match(preflightAuditText, /partial current phase-port source/u);
assert.match(preflightAuditText, /future production adapters/u);
assert.match(preflightAuditText, /future controller policy/u);
assert.match(statusText, /V3 runtime boundary stop-payload source mapping audit.*Completed/u);
assert.match(statusText, /agent-session-v3-runtime-boundary-stop-payload-source-mapping-smoke\.ts/u);

console.log('agent session v3 runtime boundary stop-payload source mapping smoke ok');
