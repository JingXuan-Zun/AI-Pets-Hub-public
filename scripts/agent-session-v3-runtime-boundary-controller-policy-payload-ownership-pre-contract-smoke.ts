import assert from 'node:assert/strict';
import {
  AGENT_SESSION_V3_RUNTIME_STOP_EVIDENCE_CONTRACT,
  createAgentSessionV3RuntimeBoundaryContract,
  type AgentSessionV3RuntimeBoundaryStopReason,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

type ControllerPolicyPayloadField =
  | 'budgetOwner'
  | 'invalidTransitionKind'
  | 'resumeTriggerOwner'
  | 'terminalStatusCandidate'
  | 'waitBudget';

type ControllerPolicyPayloadReadiness =
  | 'missing-policy-contract';

type ControllerPolicyPayloadOwnership =
  | 'future-controller-policy-owned';

type ControllerPolicyPayloadPromotionBlocker =
  | 'requires-adapter-evidence-first'
  | 'requires-controller-policy-contract'
  | 'requires-terminal-status-mapping'
  | 'requires-wait-budget-semantics'
  | 'requires-real-production-like-traces';

interface ControllerPolicyPayloadOwnershipRow {
  adapterOwnedInputsRequired: readonly string[];
  fieldName: ControllerPolicyPayloadField;
  missingPolicySemantics: string;
  ownership: ControllerPolicyPayloadOwnership;
  productionReady: false;
  promotionBlockers: readonly ControllerPolicyPayloadPromotionBlocker[];
  readiness: ControllerPolicyPayloadReadiness;
  reason: Extract<
    AgentSessionV3RuntimeBoundaryStopReason,
    | 'blocked-by-phase'
    | 'invalid-transition'
    | 'transition-budget-exhausted'
    | 'waiting-for-phase-event'
  >;
}

const controllerPolicyPayloadOwnership = [
  {
    adapterOwnedInputsRequired: ['waitSource', 'pauseReason'],
    fieldName: 'resumeTriggerOwner',
    missingPolicySemantics: 'Who can resume a waiting phase after the future controller has enough wait evidence.',
    ownership: 'future-controller-policy-owned',
    productionReady: false,
    promotionBlockers: [
      'requires-controller-policy-contract',
      'requires-adapter-evidence-first',
      'requires-real-production-like-traces',
    ],
    readiness: 'missing-policy-contract',
    reason: 'waiting-for-phase-event',
  },
  {
    adapterOwnedInputsRequired: ['waitSource', 'pauseReason'],
    fieldName: 'waitBudget',
    missingPolicySemantics: 'How a future controller represents wait, poll, or pause budget without encoding an action order.',
    ownership: 'future-controller-policy-owned',
    productionReady: false,
    promotionBlockers: [
      'requires-controller-policy-contract',
      'requires-wait-budget-semantics',
      'requires-adapter-evidence-first',
      'requires-real-production-like-traces',
    ],
    readiness: 'missing-policy-contract',
    reason: 'waiting-for-phase-event',
  },
  {
    adapterOwnedInputsRequired: ['blockerSource', 'recoverability', 'userActionRequired'],
    fieldName: 'terminalStatusCandidate',
    missingPolicySemantics: 'Which terminal status a future controller may report if a blocked phase cannot continue.',
    ownership: 'future-controller-policy-owned',
    productionReady: false,
    promotionBlockers: [
      'requires-controller-policy-contract',
      'requires-terminal-status-mapping',
      'requires-adapter-evidence-first',
      'requires-real-production-like-traces',
    ],
    readiness: 'missing-policy-contract',
    reason: 'blocked-by-phase',
  },
  {
    adapterOwnedInputsRequired: ['adapterSource', 'retrySafety'],
    fieldName: 'invalidTransitionKind',
    missingPolicySemantics: 'How a future controller classifies rejected events without treating runner metadata as a recovery decision.',
    ownership: 'future-controller-policy-owned',
    productionReady: false,
    promotionBlockers: [
      'requires-controller-policy-contract',
      'requires-adapter-evidence-first',
      'requires-real-production-like-traces',
    ],
    readiness: 'missing-policy-contract',
    reason: 'invalid-transition',
  },
  {
    adapterOwnedInputsRequired: ['modelBudgetState', 'toolBudgetState', 'taskProgress'],
    fieldName: 'budgetOwner',
    missingPolicySemantics: 'Which exhausted budget family a future controller reports after runtime evidence is available.',
    ownership: 'future-controller-policy-owned',
    productionReady: false,
    promotionBlockers: [
      'requires-controller-policy-contract',
      'requires-adapter-evidence-first',
      'requires-real-production-like-traces',
    ],
    readiness: 'missing-policy-contract',
    reason: 'transition-budget-exhausted',
  },
] as const satisfies readonly ControllerPolicyPayloadOwnershipRow[];

function createFieldKey(reason: AgentSessionV3RuntimeBoundaryStopReason, fieldName: string) {
  return `${reason}.${fieldName}`;
}

const {
  adapterPromotionReadinessSmokeSource,
  blockerMapSmokeSource,
  boundarySource,
  controllerConsumptionSmokeSource,
  controllerPolicyOwnershipSmokeSource,
  preflightAuditText,
  productionStopPolicyGapSmokeSource,
  readoutSummarySmokeSource,
  sourceMappingSmokeSource,
  statusText,
} = readProjectSources({
  adapterPromotionReadinessSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-promotion-readiness-smoke.ts',
  blockerMapSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-stop-evidence-blocker-map-smoke.ts',
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  controllerConsumptionSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-runner-derived-stop-metadata-controller-consumption-preflight-smoke.ts',
  controllerPolicyOwnershipSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-controller-policy-payload-ownership-pre-contract-smoke.ts',
  preflightAuditText: 'PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md',
  productionStopPolicyGapSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-production-stop-policy-gap-smoke.ts',
  readoutSummarySmokeSource:
    'scripts/agent-session-v3-runtime-boundary-stop-payload-readout-summary-audit-smoke.ts',
  sourceMappingSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-stop-payload-source-mapping-smoke.ts',
  statusText: 'PROJECT_AGENT_V2_STATUS.md',
});

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');

const controllerPolicyContractFields = Object.entries(AGENT_SESSION_V3_RUNTIME_STOP_EVIDENCE_CONTRACT)
  .flatMap(([reason, fields]) => (fields ?? [])
    .filter((field) => field.source === 'future-controller-policy')
    .map((field) => ({
      fieldKey: createFieldKey(reason as AgentSessionV3RuntimeBoundaryStopReason, field.name),
      fieldName: field.name,
      reason: reason as AgentSessionV3RuntimeBoundaryStopReason,
    })));

assert.deepEqual(
  controllerPolicyPayloadOwnership
    .map((row) => createFieldKey(row.reason, row.fieldName))
    .sort(),
  controllerPolicyContractFields.map((field) => field.fieldKey).sort(),
  'Controller-policy ownership audit should cover every controller-policy stop-payload field exactly once.',
);

for (const row of controllerPolicyPayloadOwnership) {
  const contractField = controllerPolicyContractFields.find((field) => (
    field.reason === row.reason && field.fieldName === row.fieldName
  ));

  assert.ok(contractField, `${row.reason}.${row.fieldName} should exist as a controller-policy contract field.`);
  assert.equal(row.ownership, 'future-controller-policy-owned');
  assert.equal(row.readiness, 'missing-policy-contract');
  assert.equal(row.productionReady, false);
  assert.ok(row.missingPolicySemantics.length > 40);
  assert.ok(row.promotionBlockers.includes('requires-controller-policy-contract'));
  assert.ok(row.promotionBlockers.includes('requires-real-production-like-traces'));

  if (row.fieldName === 'resumeTriggerOwner') {
    assert.equal(row.reason, 'waiting-for-phase-event');
    assert.deepEqual(row.adapterOwnedInputsRequired, ['waitSource', 'pauseReason']);
  }

  if (row.fieldName === 'waitBudget') {
    assert.equal(row.reason, 'waiting-for-phase-event');
    assert.deepEqual(row.adapterOwnedInputsRequired, ['waitSource', 'pauseReason']);
    assert.ok(row.promotionBlockers.includes('requires-wait-budget-semantics'));
  }

  if (row.fieldName === 'terminalStatusCandidate') {
    assert.equal(row.reason, 'blocked-by-phase');
    assert.deepEqual(row.adapterOwnedInputsRequired, ['blockerSource', 'recoverability', 'userActionRequired']);
    assert.ok(row.promotionBlockers.includes('requires-terminal-status-mapping'));
  }

  if (row.fieldName === 'invalidTransitionKind') {
    assert.equal(row.reason, 'invalid-transition');
    assert.deepEqual(row.adapterOwnedInputsRequired, ['adapterSource', 'retrySafety']);
  }

  if (row.fieldName === 'budgetOwner') {
    assert.equal(row.reason, 'transition-budget-exhausted');
    assert.deepEqual(row.adapterOwnedInputsRequired, ['modelBudgetState', 'toolBudgetState', 'taskProgress']);
  }
}

assert.deepEqual(
  controllerPolicyPayloadOwnership.map((row) => createFieldKey(row.reason, row.fieldName)).sort(),
  [
    'blocked-by-phase.terminalStatusCandidate',
    'invalid-transition.invalidTransitionKind',
    'transition-budget-exhausted.budgetOwner',
    'waiting-for-phase-event.resumeTriggerOwner',
    'waiting-for-phase-event.waitBudget',
  ],
);

assert.deepEqual(
  controllerPolicyPayloadOwnership
    .filter((row) => row.reason === 'runtime-failed'),
  [],
  'Runtime-failed currently has no controller-policy-owned stop-payload field.',
);
assert.deepEqual(
  controllerPolicyPayloadOwnership
    .filter((row) => row.reason === 'cancelled' || row.reason === 'continue-with-event'),
  [],
  'Cancelled and continue-with-event should not be part of stop-payload controller-policy ownership yet.',
);

assert.match(sourceMappingSmokeSource, /future-controller-policy-owned/u);
assert.match(blockerMapSmokeSource, /future-controller-policy/u);
assert.match(adapterPromotionReadinessSmokeSource, /future-controller-policy-contract/u);
assert.match(readoutSummarySmokeSource, /future-controller-policy/u);
assert.match(productionStopPolicyGapSmokeSource, /missingPolicyDecision/u);
assert.match(controllerConsumptionSmokeSource, /must not decide/u);

const serializedOwnership = JSON.stringify(controllerPolicyPayloadOwnership);
assert.doesNotMatch(
  serializedOwnership,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Controller-policy ownership pre-contract should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedOwnership,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Controller-policy ownership pre-contract should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedOwnership,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain/iu,
  'Controller-policy ownership pre-contract should not define fixed workflows or fallback chains.',
);
assert.doesNotMatch(
  serializedOwnership,
  /productionReady":true|runtimeAuthority|experimental-adapter/u,
  'Controller-policy ownership pre-contract should not grant runtime authority.',
);

assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Controller-policy ownership pre-contract must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  controllerPolicyOwnershipSmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Controller-policy ownership pre-contract should not call production v2 modules.',
);

assert.match(preflightAuditText, /Controller-Policy Payload Ownership Pre-Contract Audit Status/u);
assert.match(
  preflightAuditText,
  /agent-session-v3-runtime-boundary-controller-policy-payload-ownership-pre-contract-smoke\.ts/u,
);
assert.match(preflightAuditText, /wait resume owner/u);
assert.match(preflightAuditText, /blocked terminal status candidate/u);
assert.match(preflightAuditText, /invalid-transition kind/u);
assert.match(preflightAuditText, /budget owner/u);
assert.match(preflightAuditText, /not production wiring/u);
assert.match(statusText, /V3 runtime boundary controller-policy payload ownership pre-contract audit.*Completed/u);
assert.match(
  statusText,
  /agent-session-v3-runtime-boundary-controller-policy-payload-ownership-pre-contract-smoke\.ts/u,
);

console.log('agent session v3 runtime boundary controller-policy payload ownership pre-contract smoke ok');
