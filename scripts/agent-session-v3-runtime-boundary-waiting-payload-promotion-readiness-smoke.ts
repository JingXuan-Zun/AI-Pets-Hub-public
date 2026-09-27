import assert from 'node:assert/strict';
import {
  createAgentSessionV3RuntimeBoundaryContract,
  getAgentSessionV3RuntimeStopEvidenceFields,
  type AgentSessionV3RuntimePhasePortResult,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

type WaitingPayloadCandidateField =
  | 'pauseReason'
  | 'resumeTriggerOwner'
  | 'waitBudget'
  | 'waitSource';

type WaitingPayloadPromotionDecision =
  | 'formal-contract-ready'
  | 'keep-smoke-only';

type WaitingPayloadPromotionBlocker =
  | 'partial-current-source'
  | 'requires-future-controller-policy'
  | 'requires-future-phase-payload'
  | 'requires-user-visible-semantics';

interface WaitingPayloadPromotionReadinessRow {
  blockers: readonly WaitingPayloadPromotionBlocker[];
  currentSource: string | null;
  decision: WaitingPayloadPromotionDecision;
  fieldName: WaitingPayloadCandidateField;
  productionReady: false;
  reason: 'waiting-for-phase-event';
}

const waitingPayloadPromotionReadiness = [
  {
    blockers: [
      'requires-future-phase-payload',
    ],
    currentSource: null,
    decision: 'keep-smoke-only',
    fieldName: 'waitSource',
    productionReady: false,
    reason: 'waiting-for-phase-event',
  },
  {
    blockers: [
      'partial-current-source',
      'requires-user-visible-semantics',
    ],
    currentSource: 'AgentSessionV3RuntimePhasePortResult.waiting.reason',
    decision: 'keep-smoke-only',
    fieldName: 'pauseReason',
    productionReady: false,
    reason: 'waiting-for-phase-event',
  },
  {
    blockers: [
      'requires-future-controller-policy',
    ],
    currentSource: null,
    decision: 'keep-smoke-only',
    fieldName: 'resumeTriggerOwner',
    productionReady: false,
    reason: 'waiting-for-phase-event',
  },
  {
    blockers: [
      'requires-future-controller-policy',
    ],
    currentSource: null,
    decision: 'keep-smoke-only',
    fieldName: 'waitBudget',
    productionReady: false,
    reason: 'waiting-for-phase-event',
  },
] as const satisfies readonly WaitingPayloadPromotionReadinessRow[];

const {
  boundarySource,
  waitingPayloadPromotionReadinessSmokeSource,
  waitingPayloadBlockerReviewSmokeSource,
  sourceMappingSmokeSource,
  blockerMapSmokeSource,
  preflightAuditText,
  statusText,
} = readProjectSources({
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  waitingPayloadPromotionReadinessSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-waiting-payload-promotion-readiness-smoke.ts',
  waitingPayloadBlockerReviewSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-phase-port-waiting-payload-blocker-review-smoke.ts',
  sourceMappingSmokeSource: 'scripts/agent-session-v3-runtime-boundary-stop-payload-source-mapping-smoke.ts',
  blockerMapSmokeSource: 'scripts/agent-session-v3-runtime-boundary-stop-evidence-blocker-map-smoke.ts',
  preflightAuditText: 'PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md',
  statusText: 'PROJECT_AGENT_V2_STATUS.md',
});

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');

const currentWaitingResult: AgentSessionV3RuntimePhasePortResult = {
  kind: 'waiting',
  reason: 'phase adapter is waiting for more evidence',
};
assert.deepEqual(Object.keys(currentWaitingResult).sort(), ['kind', 'reason']);
assert.equal('waitSource' in currentWaitingResult, false);
assert.equal('pauseReason' in currentWaitingResult, false);
assert.equal('resumeTriggerOwner' in currentWaitingResult, false);
assert.equal('waitBudget' in currentWaitingResult, false);

const waitingStopEvidenceFields = getAgentSessionV3RuntimeStopEvidenceFields('waiting-for-phase-event');
assert.deepEqual(
  waitingPayloadPromotionReadiness.map((row) => row.fieldName).sort(),
  waitingStopEvidenceFields.map((field) => field.name).sort(),
  'Waiting payload promotion-readiness audit should cover every waiting stop-evidence field exactly once.',
);

for (const row of waitingPayloadPromotionReadiness) {
  const contractField = waitingStopEvidenceFields.find((field) => field.name === row.fieldName);
  assert.ok(contractField, `${row.fieldName} should exist in the waiting stop evidence contract.`);
  assert.equal(row.productionReady, false);
  assert.equal(row.decision, 'keep-smoke-only');
  assert.ok(row.blockers.length > 0);

  if (row.fieldName === 'waitSource') {
    assert.equal(contractField.source, 'phase-port-result');
    assert.equal(row.currentSource, null);
    assert.ok(row.blockers.includes('requires-future-phase-payload'));
  }

  if (row.fieldName === 'pauseReason') {
    assert.equal(contractField.source, 'phase-port-result');
    assert.equal(row.currentSource, 'AgentSessionV3RuntimePhasePortResult.waiting.reason');
    assert.ok(row.blockers.includes('partial-current-source'));
    assert.ok(row.blockers.includes('requires-user-visible-semantics'));
  }

  if (row.fieldName === 'resumeTriggerOwner' || row.fieldName === 'waitBudget') {
    assert.equal(contractField.source, 'future-controller-policy');
    assert.equal(row.currentSource, null);
    assert.ok(row.blockers.includes('requires-future-controller-policy'));
  }
}

assert.deepEqual(
  waitingPayloadPromotionReadiness
    .filter((row) => row.decision === 'formal-contract-ready'),
  [],
  'No structured waiting payload field should be promoted into the formal boundary type yet.',
);
assert.deepEqual(
  waitingPayloadPromotionReadiness
    .filter((row) => row.currentSource === 'AgentSessionV3RuntimePhasePortResult.waiting.reason')
    .map((row) => row.fieldName),
  ['pauseReason'],
  'Current waiting.reason may only inform future pauseReason, and only as partial diagnostic input.',
);
assert.deepEqual(
  waitingPayloadPromotionReadiness
    .filter((row) => row.blockers.includes('requires-future-controller-policy'))
    .map((row) => row.fieldName)
    .sort(),
  ['resumeTriggerOwner', 'waitBudget'],
);

assert.match(waitingPayloadBlockerReviewSmokeSource, /partial-diagnostic-only/u);
assert.match(waitingPayloadBlockerReviewSmokeSource, /future-phase-payload-required/u);
assert.match(sourceMappingSmokeSource, /missing-future-phase-port-payload/u);
assert.match(sourceMappingSmokeSource, /future-controller-policy-owned/u);
assert.match(blockerMapSmokeSource, /partial-now/u);
assert.match(blockerMapSmokeSource, /decision-blocking/u);

const serializedPromotionReadiness = JSON.stringify(waitingPayloadPromotionReadiness);
assert.doesNotMatch(
  serializedPromotionReadiness,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|terminalStatusCandidate/u,
  'Waiting payload promotion-readiness should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedPromotionReadiness,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Waiting payload promotion-readiness should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedPromotionReadiness,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain/iu,
  'Waiting payload promotion-readiness should not define fixed workflows or fallback chains.',
);
assert.doesNotMatch(
  serializedPromotionReadiness,
  /productionReady":true|runtimeAuthority|experimental-adapter/u,
  'Waiting payload promotion-readiness should not grant runtime authority.',
);

assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Waiting payload promotion-readiness audit must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  waitingPayloadPromotionReadinessSmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Waiting payload promotion-readiness audit should not call production v2 modules.',
);

assert.match(preflightAuditText, /Waiting Payload Promotion-Readiness Audit Status/u);
assert.match(
  preflightAuditText,
  /agent-session-v3-runtime-boundary-waiting-payload-promotion-readiness-smoke\.ts/u,
);
assert.match(preflightAuditText, /No structured waiting payload field is formal-contract-ready/u);
assert.match(preflightAuditText, /not production wiring/u);
assert.match(statusText, /V3 runtime boundary waiting-payload promotion-readiness audit.*Completed/u);
assert.match(
  statusText,
  /agent-session-v3-runtime-boundary-waiting-payload-promotion-readiness-smoke\.ts/u,
);

console.log('agent session v3 runtime boundary waiting payload promotion-readiness smoke ok');
