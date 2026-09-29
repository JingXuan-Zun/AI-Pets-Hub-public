import assert from 'node:assert/strict';
import {
  AGENT_SESSION_V3_RUNTIME_STOP_EVIDENCE_CONTRACT,
  createAgentSessionV3RuntimeBoundaryContract,
  type AgentSessionV3RuntimeBoundaryStopReason,
  type AgentSessionV3RuntimeStopEvidenceSource,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

type StopEvidenceBlockerOwner =
  | 'current-pilot-runner'
  | 'future-controller-policy'
  | 'future-phase-adapter'
  | 'future-production-adapter';

type StopEvidenceBlockerImpact =
  | 'decision-blocking'
  | 'reporting-enrichment';

type StopEvidenceBlockerReadiness =
  | 'available-now'
  | 'partial-now'
  | 'missing';

interface StopEvidenceBlockerMapRow {
  contractSource: AgentSessionV3RuntimeStopEvidenceSource;
  fieldName: string;
  impact: StopEvidenceBlockerImpact;
  owner: StopEvidenceBlockerOwner;
  readiness: StopEvidenceBlockerReadiness;
  reason: AgentSessionV3RuntimeBoundaryStopReason;
}

const stopEvidenceBlockerMap = [
  {
    contractSource: 'phase-port-result',
    fieldName: 'waitSource',
    impact: 'decision-blocking',
    owner: 'future-phase-adapter',
    readiness: 'missing',
    reason: 'waiting-for-phase-event',
  },
  {
    contractSource: 'future-controller-policy',
    fieldName: 'resumeTriggerOwner',
    impact: 'decision-blocking',
    owner: 'future-controller-policy',
    readiness: 'missing',
    reason: 'waiting-for-phase-event',
  },
  {
    contractSource: 'future-controller-policy',
    fieldName: 'waitBudget',
    impact: 'decision-blocking',
    owner: 'future-controller-policy',
    readiness: 'missing',
    reason: 'waiting-for-phase-event',
  },
  {
    contractSource: 'phase-port-result',
    fieldName: 'pauseReason',
    impact: 'reporting-enrichment',
    owner: 'future-phase-adapter',
    readiness: 'partial-now',
    reason: 'waiting-for-phase-event',
  },
  {
    contractSource: 'future-production-adapter',
    fieldName: 'blockerSource',
    impact: 'decision-blocking',
    owner: 'future-production-adapter',
    readiness: 'missing',
    reason: 'blocked-by-phase',
  },
  {
    contractSource: 'future-production-adapter',
    fieldName: 'recoverability',
    impact: 'decision-blocking',
    owner: 'future-production-adapter',
    readiness: 'missing',
    reason: 'blocked-by-phase',
  },
  {
    contractSource: 'future-production-adapter',
    fieldName: 'userActionRequired',
    impact: 'decision-blocking',
    owner: 'future-production-adapter',
    readiness: 'missing',
    reason: 'blocked-by-phase',
  },
  {
    contractSource: 'future-controller-policy',
    fieldName: 'terminalStatusCandidate',
    impact: 'decision-blocking',
    owner: 'future-controller-policy',
    readiness: 'missing',
    reason: 'blocked-by-phase',
  },
  {
    contractSource: 'pilot-runner-state',
    fieldName: 'phase',
    impact: 'reporting-enrichment',
    owner: 'current-pilot-runner',
    readiness: 'available-now',
    reason: 'invalid-transition',
  },
  {
    contractSource: 'pilot-runner-state',
    fieldName: 'eventType',
    impact: 'reporting-enrichment',
    owner: 'current-pilot-runner',
    readiness: 'available-now',
    reason: 'invalid-transition',
  },
  {
    contractSource: 'future-production-adapter',
    fieldName: 'adapterSource',
    impact: 'decision-blocking',
    owner: 'future-production-adapter',
    readiness: 'missing',
    reason: 'invalid-transition',
  },
  {
    contractSource: 'future-controller-policy',
    fieldName: 'invalidTransitionKind',
    impact: 'decision-blocking',
    owner: 'future-controller-policy',
    readiness: 'missing',
    reason: 'invalid-transition',
  },
  {
    contractSource: 'future-production-adapter',
    fieldName: 'retrySafety',
    impact: 'decision-blocking',
    owner: 'future-production-adapter',
    readiness: 'missing',
    reason: 'invalid-transition',
  },
  {
    contractSource: 'future-production-adapter',
    fieldName: 'failureOrigin',
    impact: 'decision-blocking',
    owner: 'future-production-adapter',
    readiness: 'missing',
    reason: 'runtime-failed',
  },
  {
    contractSource: 'future-production-adapter',
    fieldName: 'retryability',
    impact: 'decision-blocking',
    owner: 'future-production-adapter',
    readiness: 'missing',
    reason: 'runtime-failed',
  },
  {
    contractSource: 'future-production-adapter',
    fieldName: 'sideEffectCommitted',
    impact: 'decision-blocking',
    owner: 'future-production-adapter',
    readiness: 'missing',
    reason: 'runtime-failed',
  },
  {
    contractSource: 'future-production-adapter',
    fieldName: 'userVisibleFailureReason',
    impact: 'reporting-enrichment',
    owner: 'future-production-adapter',
    readiness: 'missing',
    reason: 'runtime-failed',
  },
  {
    contractSource: 'future-production-adapter',
    fieldName: 'errorClass',
    impact: 'reporting-enrichment',
    owner: 'future-production-adapter',
    readiness: 'missing',
    reason: 'runtime-failed',
  },
  {
    contractSource: 'future-controller-policy',
    fieldName: 'budgetOwner',
    impact: 'decision-blocking',
    owner: 'future-controller-policy',
    readiness: 'missing',
    reason: 'transition-budget-exhausted',
  },
  {
    contractSource: 'pilot-runner-state',
    fieldName: 'transitionCount',
    impact: 'reporting-enrichment',
    owner: 'current-pilot-runner',
    readiness: 'available-now',
    reason: 'transition-budget-exhausted',
  },
  {
    contractSource: 'future-production-adapter',
    fieldName: 'modelBudgetState',
    impact: 'decision-blocking',
    owner: 'future-production-adapter',
    readiness: 'missing',
    reason: 'transition-budget-exhausted',
  },
  {
    contractSource: 'future-production-adapter',
    fieldName: 'toolBudgetState',
    impact: 'decision-blocking',
    owner: 'future-production-adapter',
    readiness: 'missing',
    reason: 'transition-budget-exhausted',
  },
  {
    contractSource: 'future-production-adapter',
    fieldName: 'taskProgress',
    impact: 'decision-blocking',
    owner: 'future-production-adapter',
    readiness: 'missing',
    reason: 'transition-budget-exhausted',
  },
  {
    contractSource: 'pilot-runner-state',
    fieldName: 'recoveryCount',
    impact: 'reporting-enrichment',
    owner: 'current-pilot-runner',
    readiness: 'available-now',
    reason: 'transition-budget-exhausted',
  },
] as const satisfies readonly StopEvidenceBlockerMapRow[];

function createFieldKey(reason: AgentSessionV3RuntimeBoundaryStopReason, fieldName: string) {
  return `${reason}.${fieldName}`;
}

const {
  boundarySource,
  blockerMapSmokeSource,
  sourceMappingSmokeSource,
  promotionReadinessSmokeSource,
  controllerConsumptionSmokeSource,
  preflightAuditText,
  statusText,
} = readProjectSources({
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  blockerMapSmokeSource: 'scripts/agent-session-v3-runtime-boundary-stop-evidence-blocker-map-smoke.ts',
  sourceMappingSmokeSource: 'scripts/agent-session-v3-runtime-boundary-stop-payload-source-mapping-smoke.ts',
  promotionReadinessSmokeSource: 'scripts/agent-session-v3-runtime-boundary-adapter-promotion-readiness-smoke.ts',
  controllerConsumptionSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-runner-derived-stop-metadata-controller-consumption-preflight-smoke.ts',
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
  stopEvidenceBlockerMap.map((row) => createFieldKey(row.reason, row.fieldName)).sort(),
  contractFieldRows.map((row) => createFieldKey(row.reason, row.fieldName)).sort(),
  'Blocker map should cover every stop evidence contract field exactly once.',
);

for (const row of stopEvidenceBlockerMap) {
  const contractField = contractFieldRows.find((field) => (
    field.reason === row.reason && field.fieldName === row.fieldName
  ));

  assert.ok(contractField, `${row.reason}.${row.fieldName} should exist in the stop evidence contract.`);
  assert.equal(row.contractSource, contractField.source);

  if (row.contractSource === 'pilot-runner-state') {
    assert.equal(row.owner, 'current-pilot-runner');
    assert.equal(row.readiness, 'available-now');
    assert.equal(row.impact, 'reporting-enrichment');
  }

  if (row.contractSource === 'phase-port-result') {
    assert.equal(row.owner, 'future-phase-adapter');
    assert.notEqual(row.readiness, 'available-now');
  }

  if (row.contractSource === 'future-production-adapter') {
    assert.equal(row.owner, 'future-production-adapter');
    assert.equal(row.readiness, 'missing');
  }

  if (row.contractSource === 'future-controller-policy') {
    assert.equal(row.owner, 'future-controller-policy');
    assert.equal(row.readiness, 'missing');
    assert.equal(row.impact, 'decision-blocking');
  }
}

assert.deepEqual(
  stopEvidenceBlockerMap
    .filter((row) => row.readiness === 'available-now')
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
  stopEvidenceBlockerMap
    .filter((row) => row.readiness === 'partial-now')
    .map((row) => createFieldKey(row.reason, row.fieldName)),
  ['waiting-for-phase-event.pauseReason'],
);
assert.ok(
  stopEvidenceBlockerMap.filter((row) => row.impact === 'decision-blocking').length
    > stopEvidenceBlockerMap.filter((row) => row.impact === 'reporting-enrichment').length,
  'Most missing stop-evidence fields should still block future controller decisions.',
);
assert.deepEqual(
  stopEvidenceBlockerMap
    .filter((row) => row.owner === 'future-controller-policy')
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
  stopEvidenceBlockerMap
    .filter((row) => row.owner === 'future-phase-adapter')
    .map((row) => createFieldKey(row.reason, row.fieldName))
    .sort(),
  ['waiting-for-phase-event.pauseReason', 'waiting-for-phase-event.waitSource'],
);
assert.ok(
  stopEvidenceBlockerMap
    .filter((row) => row.owner === 'future-production-adapter')
    .length > stopEvidenceBlockerMap
    .filter((row) => row.owner === 'future-controller-policy')
    .length,
  'Most missing evidence should still belong to future production adapters.',
);

assert.match(sourceMappingSmokeSource, /StopPayloadSourceMappingRow/u);
assert.match(promotionReadinessSmokeSource, /AdapterPromotionReadinessRow/u);
assert.match(controllerConsumptionSmokeSource, /RunnerDerivedControllerConsumptionRow/u);

const serializedBlockerMap = JSON.stringify(stopEvidenceBlockerMap);
assert.doesNotMatch(
  serializedBlockerMap,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction/u,
  'Blocker map should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedBlockerMap,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Blocker map should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedBlockerMap,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain/iu,
  'Blocker map should not define fixed workflows or fallback chains.',
);
assert.doesNotMatch(
  serializedBlockerMap,
  /productionReady":true|runtimeAuthority|experimental-adapter/u,
  'Blocker map should not grant runtime authority.',
);

assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Stop-evidence blocker map audit must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  blockerMapSmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Stop-evidence blocker map audit should not call production v2 modules.',
);

assert.match(preflightAuditText, /Stop-Evidence Blocker Map Audit Status/u);
assert.match(preflightAuditText, /agent-session-v3-runtime-boundary-stop-evidence-blocker-map-smoke\.ts/u);
assert.match(preflightAuditText, /decision-blocking/u);
assert.match(preflightAuditText, /future production adapters/u);
assert.match(preflightAuditText, /future controller policy/u);
assert.match(preflightAuditText, /not production wiring/u);
assert.match(statusText, /V3 runtime boundary stop-evidence blocker map audit.*Completed/u);
assert.match(statusText, /agent-session-v3-runtime-boundary-stop-evidence-blocker-map-smoke\.ts/u);

console.log('agent session v3 runtime boundary stop-evidence blocker map smoke ok');
