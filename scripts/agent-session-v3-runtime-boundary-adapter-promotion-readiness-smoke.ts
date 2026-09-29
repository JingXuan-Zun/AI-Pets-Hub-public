import assert from 'node:assert/strict';
import {
  AGENT_SESSION_V3_RUNTIME_STOP_EVIDENCE_CONTRACT,
  createAgentSessionV3RuntimeBoundaryContract,
  type AgentSessionV3RuntimeBoundaryStopReason,
  type AgentSessionV3RuntimeStopEvidenceSource,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

type PromotionDecision =
  | 'formal-contract-ready'
  | 'keep-smoke-only';

type PromotionTarget =
  | 'runner-derived-stop-metadata-contract'
  | 'future-phase-adapter-payload-contract'
  | 'future-production-adapter-payload-contract'
  | 'future-controller-policy-contract';

type PromotionBlocker =
  | 'no-current-source'
  | 'partial-current-source'
  | 'requires-future-phase-payload'
  | 'requires-future-production-adapter'
  | 'requires-future-controller-policy'
  | 'requires-real-production-like-traces';

interface AdapterPromotionReadinessRow {
  blockers: readonly PromotionBlocker[];
  contractSource: AgentSessionV3RuntimeStopEvidenceSource;
  currentSource: string | null;
  decision: PromotionDecision;
  fieldName: string;
  productionReady: false;
  promotionTarget: PromotionTarget;
  reason: AgentSessionV3RuntimeBoundaryStopReason;
}

const adapterPromotionReadinessAudit = [
  {
    blockers: [
      'no-current-source',
      'requires-future-phase-payload',
      'requires-real-production-like-traces',
    ],
    contractSource: 'phase-port-result',
    currentSource: null,
    decision: 'keep-smoke-only',
    fieldName: 'waitSource',
    productionReady: false,
    promotionTarget: 'future-phase-adapter-payload-contract',
    reason: 'waiting-for-phase-event',
  },
  {
    blockers: [
      'requires-future-controller-policy',
      'requires-real-production-like-traces',
    ],
    contractSource: 'future-controller-policy',
    currentSource: null,
    decision: 'keep-smoke-only',
    fieldName: 'resumeTriggerOwner',
    productionReady: false,
    promotionTarget: 'future-controller-policy-contract',
    reason: 'waiting-for-phase-event',
  },
  {
    blockers: [
      'requires-future-controller-policy',
      'requires-real-production-like-traces',
    ],
    contractSource: 'future-controller-policy',
    currentSource: null,
    decision: 'keep-smoke-only',
    fieldName: 'waitBudget',
    productionReady: false,
    promotionTarget: 'future-controller-policy-contract',
    reason: 'waiting-for-phase-event',
  },
  {
    blockers: [
      'partial-current-source',
      'requires-future-phase-payload',
      'requires-real-production-like-traces',
    ],
    contractSource: 'phase-port-result',
    currentSource: 'AgentSessionV3RuntimePhasePortResult.waiting.reason',
    decision: 'keep-smoke-only',
    fieldName: 'pauseReason',
    productionReady: false,
    promotionTarget: 'future-phase-adapter-payload-contract',
    reason: 'waiting-for-phase-event',
  },
  {
    blockers: [
      'no-current-source',
      'requires-future-production-adapter',
      'requires-real-production-like-traces',
    ],
    contractSource: 'future-production-adapter',
    currentSource: null,
    decision: 'keep-smoke-only',
    fieldName: 'blockerSource',
    productionReady: false,
    promotionTarget: 'future-production-adapter-payload-contract',
    reason: 'blocked-by-phase',
  },
  {
    blockers: [
      'no-current-source',
      'requires-future-production-adapter',
      'requires-real-production-like-traces',
    ],
    contractSource: 'future-production-adapter',
    currentSource: null,
    decision: 'keep-smoke-only',
    fieldName: 'recoverability',
    productionReady: false,
    promotionTarget: 'future-production-adapter-payload-contract',
    reason: 'blocked-by-phase',
  },
  {
    blockers: [
      'no-current-source',
      'requires-future-production-adapter',
      'requires-real-production-like-traces',
    ],
    contractSource: 'future-production-adapter',
    currentSource: null,
    decision: 'keep-smoke-only',
    fieldName: 'userActionRequired',
    productionReady: false,
    promotionTarget: 'future-production-adapter-payload-contract',
    reason: 'blocked-by-phase',
  },
  {
    blockers: [
      'requires-future-controller-policy',
      'requires-real-production-like-traces',
    ],
    contractSource: 'future-controller-policy',
    currentSource: null,
    decision: 'keep-smoke-only',
    fieldName: 'terminalStatusCandidate',
    productionReady: false,
    promotionTarget: 'future-controller-policy-contract',
    reason: 'blocked-by-phase',
  },
  {
    blockers: [],
    contractSource: 'pilot-runner-state',
    currentSource: 'AgentSessionV3PilotRunner invalid transition state.phase',
    decision: 'formal-contract-ready',
    fieldName: 'phase',
    productionReady: false,
    promotionTarget: 'runner-derived-stop-metadata-contract',
    reason: 'invalid-transition',
  },
  {
    blockers: [],
    contractSource: 'pilot-runner-state',
    currentSource: 'AgentSessionV3PilotRunner rejected event.type',
    decision: 'formal-contract-ready',
    fieldName: 'eventType',
    productionReady: false,
    promotionTarget: 'runner-derived-stop-metadata-contract',
    reason: 'invalid-transition',
  },
  {
    blockers: [
      'no-current-source',
      'requires-future-production-adapter',
      'requires-real-production-like-traces',
    ],
    contractSource: 'future-production-adapter',
    currentSource: null,
    decision: 'keep-smoke-only',
    fieldName: 'adapterSource',
    productionReady: false,
    promotionTarget: 'future-production-adapter-payload-contract',
    reason: 'invalid-transition',
  },
  {
    blockers: [
      'requires-future-controller-policy',
      'requires-real-production-like-traces',
    ],
    contractSource: 'future-controller-policy',
    currentSource: null,
    decision: 'keep-smoke-only',
    fieldName: 'invalidTransitionKind',
    productionReady: false,
    promotionTarget: 'future-controller-policy-contract',
    reason: 'invalid-transition',
  },
  {
    blockers: [
      'no-current-source',
      'requires-future-production-adapter',
      'requires-real-production-like-traces',
    ],
    contractSource: 'future-production-adapter',
    currentSource: null,
    decision: 'keep-smoke-only',
    fieldName: 'retrySafety',
    productionReady: false,
    promotionTarget: 'future-production-adapter-payload-contract',
    reason: 'invalid-transition',
  },
  {
    blockers: [
      'no-current-source',
      'requires-future-production-adapter',
      'requires-real-production-like-traces',
    ],
    contractSource: 'future-production-adapter',
    currentSource: null,
    decision: 'keep-smoke-only',
    fieldName: 'failureOrigin',
    productionReady: false,
    promotionTarget: 'future-production-adapter-payload-contract',
    reason: 'runtime-failed',
  },
  {
    blockers: [
      'no-current-source',
      'requires-future-production-adapter',
      'requires-real-production-like-traces',
    ],
    contractSource: 'future-production-adapter',
    currentSource: null,
    decision: 'keep-smoke-only',
    fieldName: 'retryability',
    productionReady: false,
    promotionTarget: 'future-production-adapter-payload-contract',
    reason: 'runtime-failed',
  },
  {
    blockers: [
      'no-current-source',
      'requires-future-production-adapter',
      'requires-real-production-like-traces',
    ],
    contractSource: 'future-production-adapter',
    currentSource: null,
    decision: 'keep-smoke-only',
    fieldName: 'sideEffectCommitted',
    productionReady: false,
    promotionTarget: 'future-production-adapter-payload-contract',
    reason: 'runtime-failed',
  },
  {
    blockers: [
      'no-current-source',
      'requires-future-production-adapter',
      'requires-real-production-like-traces',
    ],
    contractSource: 'future-production-adapter',
    currentSource: null,
    decision: 'keep-smoke-only',
    fieldName: 'userVisibleFailureReason',
    productionReady: false,
    promotionTarget: 'future-production-adapter-payload-contract',
    reason: 'runtime-failed',
  },
  {
    blockers: [
      'no-current-source',
      'requires-future-production-adapter',
      'requires-real-production-like-traces',
    ],
    contractSource: 'future-production-adapter',
    currentSource: null,
    decision: 'keep-smoke-only',
    fieldName: 'errorClass',
    productionReady: false,
    promotionTarget: 'future-production-adapter-payload-contract',
    reason: 'runtime-failed',
  },
  {
    blockers: [
      'requires-future-controller-policy',
      'requires-real-production-like-traces',
    ],
    contractSource: 'future-controller-policy',
    currentSource: null,
    decision: 'keep-smoke-only',
    fieldName: 'budgetOwner',
    productionReady: false,
    promotionTarget: 'future-controller-policy-contract',
    reason: 'transition-budget-exhausted',
  },
  {
    blockers: [],
    contractSource: 'pilot-runner-state',
    currentSource: 'AgentSessionV3PilotRunner transitionCount',
    decision: 'formal-contract-ready',
    fieldName: 'transitionCount',
    productionReady: false,
    promotionTarget: 'runner-derived-stop-metadata-contract',
    reason: 'transition-budget-exhausted',
  },
  {
    blockers: [
      'no-current-source',
      'requires-future-production-adapter',
      'requires-real-production-like-traces',
    ],
    contractSource: 'future-production-adapter',
    currentSource: null,
    decision: 'keep-smoke-only',
    fieldName: 'modelBudgetState',
    productionReady: false,
    promotionTarget: 'future-production-adapter-payload-contract',
    reason: 'transition-budget-exhausted',
  },
  {
    blockers: [
      'no-current-source',
      'requires-future-production-adapter',
      'requires-real-production-like-traces',
    ],
    contractSource: 'future-production-adapter',
    currentSource: null,
    decision: 'keep-smoke-only',
    fieldName: 'toolBudgetState',
    productionReady: false,
    promotionTarget: 'future-production-adapter-payload-contract',
    reason: 'transition-budget-exhausted',
  },
  {
    blockers: [
      'no-current-source',
      'requires-future-production-adapter',
      'requires-real-production-like-traces',
    ],
    contractSource: 'future-production-adapter',
    currentSource: null,
    decision: 'keep-smoke-only',
    fieldName: 'taskProgress',
    productionReady: false,
    promotionTarget: 'future-production-adapter-payload-contract',
    reason: 'transition-budget-exhausted',
  },
  {
    blockers: [],
    contractSource: 'pilot-runner-state',
    currentSource: 'AgentSessionV3PilotState.recoveryCount',
    decision: 'formal-contract-ready',
    fieldName: 'recoveryCount',
    productionReady: false,
    promotionTarget: 'runner-derived-stop-metadata-contract',
    reason: 'transition-budget-exhausted',
  },
] as const satisfies readonly AdapterPromotionReadinessRow[];

function createFieldKey(reason: AgentSessionV3RuntimeBoundaryStopReason, fieldName: string) {
  return `${reason}.${fieldName}`;
}

const {
  boundarySource,
  preflightAuditText,
  promotionReadinessSmokeSource,
  sourceMappingSmokeSource,
  statusText,
} = readProjectSources({
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  preflightAuditText: 'PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md',
  promotionReadinessSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-promotion-readiness-smoke.ts',
  sourceMappingSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-stop-payload-source-mapping-smoke.ts',
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
  adapterPromotionReadinessAudit.map((row) => createFieldKey(row.reason, row.fieldName)).sort(),
  contractFieldRows.map((row) => createFieldKey(row.reason, row.fieldName)).sort(),
  'Promotion-readiness audit should cover every stop evidence contract field exactly once.',
);

for (const row of adapterPromotionReadinessAudit) {
  const contractField = contractFieldRows.find((field) => (
    field.reason === row.reason && field.fieldName === row.fieldName
  ));

  assert.ok(contractField, `${row.reason}.${row.fieldName} should exist in the stop evidence contract.`);
  assert.equal(row.contractSource, contractField.source);
  assert.equal(row.productionReady, false);

  if (row.decision === 'formal-contract-ready') {
    assert.equal(row.contractSource, 'pilot-runner-state');
    assert.equal(row.promotionTarget, 'runner-derived-stop-metadata-contract');
    assert.ok(row.currentSource);
    assert.deepEqual(row.blockers, []);
  }

  if (row.decision === 'keep-smoke-only') {
    assert.ok(row.blockers.length > 0);
    assert.notEqual(row.promotionTarget, 'runner-derived-stop-metadata-contract');
  }

  if (row.contractSource === 'future-production-adapter') {
    assert.equal(row.decision, 'keep-smoke-only');
    assert.equal(row.promotionTarget, 'future-production-adapter-payload-contract');
    assert.ok(row.blockers.includes('requires-future-production-adapter'));
    assert.ok(row.blockers.includes('requires-real-production-like-traces'));
  }

  if (row.contractSource === 'future-controller-policy') {
    assert.equal(row.decision, 'keep-smoke-only');
    assert.equal(row.promotionTarget, 'future-controller-policy-contract');
    assert.ok(row.blockers.includes('requires-future-controller-policy'));
  }

  if (row.contractSource === 'phase-port-result') {
    assert.equal(row.decision, 'keep-smoke-only');
    assert.equal(row.promotionTarget, 'future-phase-adapter-payload-contract');
    assert.ok(
      row.blockers.includes('requires-future-phase-payload')
      || row.blockers.includes('partial-current-source'),
    );
  }
}

const formalReadyFieldKeys = adapterPromotionReadinessAudit
  .filter((row) => row.decision === 'formal-contract-ready')
  .map((row) => createFieldKey(row.reason, row.fieldName))
  .sort();

assert.deepEqual(formalReadyFieldKeys, [
  'invalid-transition.eventType',
  'invalid-transition.phase',
  'transition-budget-exhausted.recoveryCount',
  'transition-budget-exhausted.transitionCount',
]);

const adapterOwnedFormalReadyFields = adapterPromotionReadinessAudit
  .filter((row) => row.decision === 'formal-contract-ready' && row.contractSource !== 'pilot-runner-state');
assert.deepEqual(
  adapterOwnedFormalReadyFields,
  [],
  'No adapter-owned stop-payload field should be promoted to a formal contract yet.',
);

assert.deepEqual(
  adapterPromotionReadinessAudit
    .filter((row) => row.contractSource === 'phase-port-result')
    .map((row) => createFieldKey(row.reason, row.fieldName))
    .sort(),
  ['waiting-for-phase-event.pauseReason', 'waiting-for-phase-event.waitSource'],
);

assert.ok(
  adapterPromotionReadinessAudit
    .filter((row) => row.blockers.includes('requires-real-production-like-traces'))
    .length > formalReadyFieldKeys.length,
  'Most candidate payload fields should still require real or production-like traces before promotion.',
);

assert.match(sourceMappingSmokeSource, /available-from-current-pilot-runner/u);
assert.match(sourceMappingSmokeSource, /partial-from-current-phase-port-result/u);
assert.match(sourceMappingSmokeSource, /missing-future-production-adapter/u);
assert.match(sourceMappingSmokeSource, /future-controller-policy-owned/u);

assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Promotion-readiness audit must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  promotionReadinessSmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Promotion-readiness audit should not call production v2 modules.',
);

const serializedPromotionReadiness = JSON.stringify(adapterPromotionReadinessAudit);
assert.doesNotMatch(
  serializedPromotionReadiness,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Promotion-readiness audit should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedPromotionReadiness,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain|nextTool|nextArgs/iu,
  'Promotion-readiness audit should not define fixed workflows or fallback chains.',
);
assert.doesNotMatch(
  serializedPromotionReadiness,
  /productionReady":true|runtimeAuthority|experimental-adapter/u,
  'Promotion-readiness audit should not grant runtime authority.',
);

assert.match(preflightAuditText, /Runtime Adapter Promotion-Readiness Audit Status/u);
assert.match(preflightAuditText, /agent-session-v3-runtime-boundary-adapter-promotion-readiness-smoke\.ts/u);
assert.match(preflightAuditText, /No adapter-owned stop-payload field is ready/u);
assert.match(preflightAuditText, /runner-derived-stop-metadata contract/u);
assert.match(preflightAuditText, /not production wiring/u);
assert.match(statusText, /V3 runtime boundary adapter promotion-readiness audit.*Completed/u);
assert.match(statusText, /agent-session-v3-runtime-boundary-adapter-promotion-readiness-smoke\.ts/u);

console.log('agent session v3 runtime boundary adapter promotion-readiness smoke ok');
