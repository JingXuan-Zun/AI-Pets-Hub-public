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

type ControllerPolicyPayloadPromotionDecision =
  | 'formal-contract-ready'
  | 'keep-smoke-only';

type ControllerPolicyPayloadPromotionBlocker =
  | 'no-current-source'
  | 'requires-adapter-evidence-first'
  | 'requires-controller-policy-contract'
  | 'requires-formal-terminal-status-map'
  | 'requires-formal-wait-budget-semantics'
  | 'requires-real-production-like-traces';

interface ControllerPolicyPayloadPromotionReadinessRow {
  blockers: readonly ControllerPolicyPayloadPromotionBlocker[];
  currentSource: null;
  decision: ControllerPolicyPayloadPromotionDecision;
  fieldName: ControllerPolicyPayloadField;
  productionReady: false;
  reason: Extract<
    AgentSessionV3RuntimeBoundaryStopReason,
    | 'blocked-by-phase'
    | 'invalid-transition'
    | 'transition-budget-exhausted'
    | 'waiting-for-phase-event'
  >;
}

const controllerPolicyPayloadPromotionReadiness = [
  {
    blockers: [
      'no-current-source',
      'requires-adapter-evidence-first',
      'requires-controller-policy-contract',
      'requires-real-production-like-traces',
    ],
    currentSource: null,
    decision: 'keep-smoke-only',
    fieldName: 'resumeTriggerOwner',
    productionReady: false,
    reason: 'waiting-for-phase-event',
  },
  {
    blockers: [
      'no-current-source',
      'requires-adapter-evidence-first',
      'requires-controller-policy-contract',
      'requires-formal-wait-budget-semantics',
      'requires-real-production-like-traces',
    ],
    currentSource: null,
    decision: 'keep-smoke-only',
    fieldName: 'waitBudget',
    productionReady: false,
    reason: 'waiting-for-phase-event',
  },
  {
    blockers: [
      'no-current-source',
      'requires-adapter-evidence-first',
      'requires-controller-policy-contract',
      'requires-formal-terminal-status-map',
      'requires-real-production-like-traces',
    ],
    currentSource: null,
    decision: 'keep-smoke-only',
    fieldName: 'terminalStatusCandidate',
    productionReady: false,
    reason: 'blocked-by-phase',
  },
  {
    blockers: [
      'no-current-source',
      'requires-adapter-evidence-first',
      'requires-controller-policy-contract',
      'requires-real-production-like-traces',
    ],
    currentSource: null,
    decision: 'keep-smoke-only',
    fieldName: 'invalidTransitionKind',
    productionReady: false,
    reason: 'invalid-transition',
  },
  {
    blockers: [
      'no-current-source',
      'requires-adapter-evidence-first',
      'requires-controller-policy-contract',
      'requires-real-production-like-traces',
    ],
    currentSource: null,
    decision: 'keep-smoke-only',
    fieldName: 'budgetOwner',
    productionReady: false,
    reason: 'transition-budget-exhausted',
  },
] as const satisfies readonly ControllerPolicyPayloadPromotionReadinessRow[];

function createFieldKey(reason: AgentSessionV3RuntimeBoundaryStopReason, fieldName: string) {
  return `${reason}.${fieldName}`;
}

const {
  adapterPromotionReadinessSmokeSource,
  blockerMapSmokeSource,
  boundarySource,
  controllerPolicyOwnershipSmokeSource,
  controllerPolicyPromotionReadinessSmokeSource,
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
  controllerPolicyOwnershipSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-controller-policy-payload-ownership-pre-contract-smoke.ts',
  controllerPolicyPromotionReadinessSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-controller-policy-payload-promotion-readiness-smoke.ts',
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
  controllerPolicyPayloadPromotionReadiness
    .map((row) => createFieldKey(row.reason, row.fieldName))
    .sort(),
  controllerPolicyContractFields.map((field) => field.fieldKey).sort(),
  'Controller-policy promotion-readiness audit should cover every controller-policy stop-payload field exactly once.',
);

for (const row of controllerPolicyPayloadPromotionReadiness) {
  const contractField = controllerPolicyContractFields.find((field) => (
    field.reason === row.reason && field.fieldName === row.fieldName
  ));

  assert.ok(contractField, `${row.reason}.${row.fieldName} should exist as a controller-policy contract field.`);
  assert.equal(row.currentSource, null);
  assert.equal(row.decision, 'keep-smoke-only');
  assert.equal(row.productionReady, false);
  assert.ok(row.blockers.includes('no-current-source'));
  assert.ok(row.blockers.includes('requires-adapter-evidence-first'));
  assert.ok(row.blockers.includes('requires-controller-policy-contract'));
  assert.ok(row.blockers.includes('requires-real-production-like-traces'));

  if (row.fieldName === 'waitBudget') {
    assert.ok(row.blockers.includes('requires-formal-wait-budget-semantics'));
  }

  if (row.fieldName === 'terminalStatusCandidate') {
    assert.ok(row.blockers.includes('requires-formal-terminal-status-map'));
  }
}

assert.deepEqual(
  controllerPolicyPayloadPromotionReadiness
    .filter((row) => row.decision === 'formal-contract-ready'),
  [],
  'No controller-policy-owned stop-payload field should be promoted to a formal policy contract yet.',
);

assert.deepEqual(
  controllerPolicyPayloadPromotionReadiness
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
  controllerPolicyPayloadPromotionReadiness
    .filter((row) => row.reason === 'runtime-failed'),
  [],
  'Runtime-failed currently has no controller-policy-owned promotion candidate.',
);
assert.deepEqual(
  controllerPolicyPayloadPromotionReadiness
    .filter((row) => row.reason === 'cancelled' || row.reason === 'continue-with-event'),
  [],
  'Cancelled and continue-with-event should not become controller-policy payload promotion candidates yet.',
);

assert.match(controllerPolicyOwnershipSmokeSource, /ControllerPolicyPayloadOwnershipRow/u);
assert.match(sourceMappingSmokeSource, /future-controller-policy-owned/u);
assert.match(blockerMapSmokeSource, /future-controller-policy/u);
assert.match(adapterPromotionReadinessSmokeSource, /future-controller-policy-contract/u);
assert.match(readoutSummarySmokeSource, /future-controller-policy/u);
assert.match(productionStopPolicyGapSmokeSource, /missingPolicyDecision/u);

const serializedPromotionReadiness = JSON.stringify(controllerPolicyPayloadPromotionReadiness);
assert.doesNotMatch(
  serializedPromotionReadiness,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Controller-policy promotion-readiness should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedPromotionReadiness,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Controller-policy promotion-readiness should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedPromotionReadiness,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain/iu,
  'Controller-policy promotion-readiness should not define fixed workflows or fallback chains.',
);
assert.doesNotMatch(
  serializedPromotionReadiness,
  /productionReady":true|runtimeAuthority|experimental-adapter/u,
  'Controller-policy promotion-readiness should not grant runtime authority.',
);

assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Controller-policy promotion-readiness audit must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  controllerPolicyPromotionReadinessSmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Controller-policy promotion-readiness audit should not call production v2 modules.',
);

assert.match(preflightAuditText, /Controller-Policy Payload Promotion-Readiness Audit Status/u);
assert.match(
  preflightAuditText,
  /agent-session-v3-runtime-boundary-controller-policy-payload-promotion-readiness-smoke\.ts/u,
);
assert.match(preflightAuditText, /No controller-policy-owned stop-payload field is formal-contract-ready/u);
assert.match(preflightAuditText, /not production wiring/u);
assert.match(statusText, /V3 runtime boundary controller-policy payload promotion-readiness audit.*Completed/u);
assert.match(
  statusText,
  /agent-session-v3-runtime-boundary-controller-policy-payload-promotion-readiness-smoke\.ts/u,
);

console.log('agent session v3 runtime boundary controller-policy payload promotion-readiness smoke ok');
