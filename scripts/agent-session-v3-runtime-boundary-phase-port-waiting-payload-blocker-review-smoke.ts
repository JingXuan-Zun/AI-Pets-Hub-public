import assert from 'node:assert/strict';
import {
  createAgentSessionV3PilotInitialState,
  createAgentSessionV3RuntimeBoundaryContract,
  createAgentSessionV3RuntimePhasePortContext,
  getAgentSessionV3RuntimeStopEvidenceFields,
  runAgentSessionV3PilotHarness,
  type AgentSessionV3RuntimePhasePortResult,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

type WaitingPayloadField = 'pauseReason' | 'waitSource';
type WaitingPayloadCurrentSupport =
  | 'missing'
  | 'partial-diagnostic-only';
type WaitingPayloadPromotionReadiness =
  | 'keep-smoke-only'
  | 'future-phase-payload-required';

interface WaitingPayloadBlockerReviewRow {
  currentSupport: WaitingPayloadCurrentSupport;
  fieldName: WaitingPayloadField;
  futureOwner: 'future-phase-adapter';
  isControllerDecisionInput: boolean;
  promotionReadiness: WaitingPayloadPromotionReadiness;
  reason: 'waiting-for-phase-event';
}

const waitingPayloadBlockerReview = [
  {
    currentSupport: 'missing',
    fieldName: 'waitSource',
    futureOwner: 'future-phase-adapter',
    isControllerDecisionInput: true,
    promotionReadiness: 'future-phase-payload-required',
    reason: 'waiting-for-phase-event',
  },
  {
    currentSupport: 'partial-diagnostic-only',
    fieldName: 'pauseReason',
    futureOwner: 'future-phase-adapter',
    isControllerDecisionInput: false,
    promotionReadiness: 'keep-smoke-only',
    reason: 'waiting-for-phase-event',
  },
] as const satisfies readonly WaitingPayloadBlockerReviewRow[];

const {
  boundarySource,
  waitingPayloadReviewSmokeSource,
  payloadShapeSmokeSource,
  sourceMappingSmokeSource,
  blockerMapSmokeSource,
  preflightAuditText,
  statusText,
} = readProjectSources({
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  waitingPayloadReviewSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-phase-port-waiting-payload-blocker-review-smoke.ts',
  payloadShapeSmokeSource: 'scripts/agent-session-v3-runtime-boundary-adapter-payload-shape-pre-contract-smoke.ts',
  sourceMappingSmokeSource: 'scripts/agent-session-v3-runtime-boundary-stop-payload-source-mapping-smoke.ts',
  blockerMapSmokeSource: 'scripts/agent-session-v3-runtime-boundary-stop-evidence-blocker-map-smoke.ts',
  preflightAuditText: 'PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md',
  statusText: 'PROJECT_AGENT_V2_STATUS.md',
});

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');

const waitingResult: AgentSessionV3RuntimePhasePortResult = {
  kind: 'waiting',
  reason: 'model output is not available yet',
};
assert.deepEqual(Object.keys(waitingResult).sort(), ['kind', 'reason']);
assert.equal('waitSource' in waitingResult, false);
assert.equal('pauseReason' in waitingResult, false);
assert.equal('resumeTriggerOwner' in waitingResult, false);
assert.equal('waitBudget' in waitingResult, false);

const waitingContext = createAgentSessionV3RuntimePhasePortContext({
  phase: 'model_decision',
  state: createAgentSessionV3PilotInitialState(),
  transitionCount: 0,
  transitions: [],
});
assert.equal(waitingContext.boundaryMode, 'contract-only');
assert.equal(waitingContext.phase, 'model_decision');

const waitingStopEvidenceFields = getAgentSessionV3RuntimeStopEvidenceFields('waiting-for-phase-event');
assert.deepEqual(
  waitingStopEvidenceFields
    .filter((field) => field.source === 'phase-port-result')
    .map((field) => field.name)
    .sort(),
  ['pauseReason', 'waitSource'],
);
assert.deepEqual(
  waitingPayloadBlockerReview.map((row) => row.fieldName).sort(),
  ['pauseReason', 'waitSource'],
);

for (const row of waitingPayloadBlockerReview) {
  const contractField = waitingStopEvidenceFields.find((field) => field.name === row.fieldName);
  assert.ok(contractField, `${row.fieldName} should exist in waiting stop evidence contract.`);
  assert.equal(contractField.source, 'phase-port-result');
  assert.equal(row.futureOwner, 'future-phase-adapter');

  if (row.fieldName === 'waitSource') {
    assert.equal(row.currentSupport, 'missing');
    assert.equal(row.isControllerDecisionInput, true);
    assert.equal(row.promotionReadiness, 'future-phase-payload-required');
  }

  if (row.fieldName === 'pauseReason') {
    assert.equal(row.currentSupport, 'partial-diagnostic-only');
    assert.equal(row.isControllerDecisionInput, false);
    assert.equal(row.promotionReadiness, 'keep-smoke-only');
  }
}

const harnessWaitingResult = await runAgentSessionV3PilotHarness({
  ports: {
    init: () => ({
      event: {
        type: 'start',
      },
      kind: 'pilot-event',
    }),
    modelDecision: () => null,
  },
});
assert.equal(harnessWaitingResult.status, 'waiting-for-event');
assert.equal(harnessWaitingResult.state.phase, 'model_decision');

assert.match(payloadShapeSmokeSource, /adapterMayPopulateFields:[\s\S]*'pauseReason'[\s\S]*'waitSource'/u);
assert.match(sourceMappingSmokeSource, /partial-from-current-phase-port-result/u);
assert.match(sourceMappingSmokeSource, /missing-future-phase-port-payload/u);
assert.match(blockerMapSmokeSource, /partial-now/u);
assert.match(blockerMapSmokeSource, /future-phase-adapter/u);

const serializedReview = JSON.stringify(waitingPayloadBlockerReview);
assert.doesNotMatch(
  serializedReview,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|terminalStatusCandidate/u,
  'Waiting payload blocker review should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedReview,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Waiting payload blocker review should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedReview,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain/iu,
  'Waiting payload blocker review should not define fixed workflows or fallback chains.',
);
assert.doesNotMatch(
  serializedReview,
  /productionReady":true|runtimeAuthority|experimental-adapter/u,
  'Waiting payload blocker review should not grant runtime authority.',
);

assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Waiting payload blocker review must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  waitingPayloadReviewSmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Waiting payload blocker review should not call production v2 modules.',
);

assert.match(preflightAuditText, /Phase-Port Waiting Payload Blocker Review Status/u);
assert.match(
  preflightAuditText,
  /agent-session-v3-runtime-boundary-phase-port-waiting-payload-blocker-review-smoke\.ts/u,
);
assert.match(preflightAuditText, /waitSource/u);
assert.match(preflightAuditText, /pauseReason/u);
assert.match(preflightAuditText, /not production wiring/u);
assert.match(statusText, /V3 runtime boundary phase-port waiting-payload blocker review.*Completed/u);
assert.match(
  statusText,
  /agent-session-v3-runtime-boundary-phase-port-waiting-payload-blocker-review-smoke\.ts/u,
);

console.log('agent session v3 runtime boundary phase-port waiting payload blocker review smoke ok');
