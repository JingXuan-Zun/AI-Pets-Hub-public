import assert from 'node:assert/strict';
import {
  createAgentSessionV3RuntimeBoundaryContract,
  extractAgentSessionV3RuntimeRunnerDerivedStopMetadata,
  getAgentSessionV3RuntimeRunnerDerivedStopMetadataFields,
  getAgentSessionV3RuntimeStopEvidenceFields,
  runAgentSessionV3PilotRunner,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

type InvalidTransitionPayloadCandidateField =
  | 'adapterSource'
  | 'eventType'
  | 'invalidTransitionKind'
  | 'phase'
  | 'retrySafety';

type InvalidTransitionPayloadPromotionDecision =
  | 'already-covered-by-runner-derived-contract'
  | 'keep-smoke-only';

type InvalidTransitionPayloadPromotionBlocker =
  | 'not-new-payload-contract'
  | 'requires-future-controller-policy'
  | 'requires-future-production-adapter'
  | 'requires-real-production-like-traces';

type InvalidTransitionPayloadPromotionTarget =
  | 'existing-runner-derived-stop-metadata-contract'
  | 'future-controller-policy-contract'
  | 'future-production-adapter-payload-contract';

interface InvalidTransitionPayloadPromotionReadinessRow {
  blockers: readonly InvalidTransitionPayloadPromotionBlocker[];
  currentSource: string | null;
  decision: InvalidTransitionPayloadPromotionDecision;
  fieldName: InvalidTransitionPayloadCandidateField;
  mayPromoteNewPayloadContract: false;
  productionReady: false;
  promotionTarget: InvalidTransitionPayloadPromotionTarget;
  reason: 'invalid-transition';
}

const invalidTransitionPayloadPromotionReadiness = [
  {
    blockers: [
      'not-new-payload-contract',
    ],
    currentSource: 'AgentSessionV3PilotRunner rejected transition.from',
    decision: 'already-covered-by-runner-derived-contract',
    fieldName: 'phase',
    mayPromoteNewPayloadContract: false,
    productionReady: false,
    promotionTarget: 'existing-runner-derived-stop-metadata-contract',
    reason: 'invalid-transition',
  },
  {
    blockers: [
      'not-new-payload-contract',
    ],
    currentSource: 'AgentSessionV3PilotRunner rejected transition.event.type',
    decision: 'already-covered-by-runner-derived-contract',
    fieldName: 'eventType',
    mayPromoteNewPayloadContract: false,
    productionReady: false,
    promotionTarget: 'existing-runner-derived-stop-metadata-contract',
    reason: 'invalid-transition',
  },
  {
    blockers: [
      'requires-future-production-adapter',
      'requires-real-production-like-traces',
    ],
    currentSource: null,
    decision: 'keep-smoke-only',
    fieldName: 'adapterSource',
    mayPromoteNewPayloadContract: false,
    productionReady: false,
    promotionTarget: 'future-production-adapter-payload-contract',
    reason: 'invalid-transition',
  },
  {
    blockers: [
      'requires-future-controller-policy',
      'requires-real-production-like-traces',
    ],
    currentSource: null,
    decision: 'keep-smoke-only',
    fieldName: 'invalidTransitionKind',
    mayPromoteNewPayloadContract: false,
    productionReady: false,
    promotionTarget: 'future-controller-policy-contract',
    reason: 'invalid-transition',
  },
  {
    blockers: [
      'requires-future-production-adapter',
      'requires-real-production-like-traces',
    ],
    currentSource: null,
    decision: 'keep-smoke-only',
    fieldName: 'retrySafety',
    mayPromoteNewPayloadContract: false,
    productionReady: false,
    promotionTarget: 'future-production-adapter-payload-contract',
    reason: 'invalid-transition',
  },
] as const satisfies readonly InvalidTransitionPayloadPromotionReadinessRow[];

const {
  adapterPromotionReadinessSmokeSource,
  boundarySource,
  controllerConsumptionSmokeSource,
  extractionSmokeSource,
  invalidTransitionBlockerReviewSmokeSource,
  invalidTransitionPromotionReadinessSmokeSource,
  preflightAuditText,
  statusText,
} = readProjectSources({
  adapterPromotionReadinessSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-promotion-readiness-smoke.ts',
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  controllerConsumptionSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-runner-derived-stop-metadata-controller-consumption-preflight-smoke.ts',
  extractionSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-runner-derived-stop-metadata-extraction-audit-smoke.ts',
  invalidTransitionBlockerReviewSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-invalid-transition-payload-blocker-review-smoke.ts',
  invalidTransitionPromotionReadinessSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-invalid-transition-payload-promotion-readiness-smoke.ts',
  preflightAuditText: 'PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md',
  statusText: 'PROJECT_AGENT_V2_STATUS.md',
});

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');

const invalidTransitionResult = await runAgentSessionV3PilotRunner({
  driver: () => ({
    reason: 'invalid-transition promotion-readiness rejected event',
    type: 'model-output-invalid',
  }),
});
assert.equal(invalidTransitionResult.status, 'invalid-transition');
assert.equal(invalidTransitionResult.state.phase, 'init');
assert.equal(invalidTransitionResult.transition?.accepted, false);
assert.equal(invalidTransitionResult.transition?.from, 'init');
assert.equal(invalidTransitionResult.transition?.event.type, 'model-output-invalid');

const invalidTransitionMetadata = extractAgentSessionV3RuntimeRunnerDerivedStopMetadata(invalidTransitionResult);
assert.ok(invalidTransitionMetadata);
assert.deepEqual(invalidTransitionMetadata, {
  eventType: 'model-output-invalid',
  phase: 'init',
  reason: 'invalid-transition',
});
assert.deepEqual(
  Object.keys(invalidTransitionMetadata).sort(),
  [...getAgentSessionV3RuntimeRunnerDerivedStopMetadataFields('invalid-transition')].sort(),
);
assert.equal('adapterSource' in invalidTransitionMetadata, false);
assert.equal('invalidTransitionKind' in invalidTransitionMetadata, false);
assert.equal('retrySafety' in invalidTransitionMetadata, false);

const invalidTransitionStopEvidenceFields = getAgentSessionV3RuntimeStopEvidenceFields('invalid-transition');
assert.deepEqual(
  invalidTransitionPayloadPromotionReadiness.map((row) => row.fieldName).sort(),
  invalidTransitionStopEvidenceFields.map((field) => field.name).sort(),
  'Invalid-transition payload promotion-readiness audit should cover every invalid-transition stop-evidence field exactly once.',
);

for (const row of invalidTransitionPayloadPromotionReadiness) {
  const contractField = invalidTransitionStopEvidenceFields.find((field) => field.name === row.fieldName);
  assert.ok(contractField, `${row.fieldName} should exist in invalid-transition stop evidence contract.`);
  assert.equal(row.productionReady, false);
  assert.equal(row.mayPromoteNewPayloadContract, false);

  if (row.decision === 'already-covered-by-runner-derived-contract') {
    assert.equal(contractField.source, 'pilot-runner-state');
    assert.equal(row.promotionTarget, 'existing-runner-derived-stop-metadata-contract');
    assert.ok(row.currentSource);
    assert.deepEqual(row.blockers, ['not-new-payload-contract']);
  }

  if (row.fieldName === 'adapterSource' || row.fieldName === 'retrySafety') {
    assert.equal(contractField.source, 'future-production-adapter');
    assert.equal(row.currentSource, null);
    assert.equal(row.decision, 'keep-smoke-only');
    assert.equal(row.promotionTarget, 'future-production-adapter-payload-contract');
    assert.ok(row.blockers.includes('requires-future-production-adapter'));
    assert.ok(row.blockers.includes('requires-real-production-like-traces'));
  }

  if (row.fieldName === 'invalidTransitionKind') {
    assert.equal(contractField.source, 'future-controller-policy');
    assert.equal(row.currentSource, null);
    assert.equal(row.decision, 'keep-smoke-only');
    assert.equal(row.promotionTarget, 'future-controller-policy-contract');
    assert.ok(row.blockers.includes('requires-future-controller-policy'));
    assert.ok(row.blockers.includes('requires-real-production-like-traces'));
  }
}

assert.deepEqual(
  invalidTransitionPayloadPromotionReadiness
    .filter((row) => row.decision === 'already-covered-by-runner-derived-contract')
    .map((row) => row.fieldName)
    .sort(),
  ['eventType', 'phase'],
  'Runner-derived invalid-transition fields should stay in the existing metadata contract.',
);
assert.deepEqual(
  invalidTransitionPayloadPromotionReadiness
    .filter((row) => row.mayPromoteNewPayloadContract),
  [],
  'No invalid-transition payload field should be promoted into a new payload contract yet.',
);
assert.deepEqual(
  invalidTransitionPayloadPromotionReadiness
    .filter((row) => row.promotionTarget === 'future-production-adapter-payload-contract')
    .map((row) => row.fieldName)
    .sort(),
  ['adapterSource', 'retrySafety'],
);
assert.deepEqual(
  invalidTransitionPayloadPromotionReadiness
    .filter((row) => row.promotionTarget === 'future-controller-policy-contract')
    .map((row) => row.fieldName),
  ['invalidTransitionKind'],
);

assert.match(invalidTransitionBlockerReviewSmokeSource, /runner-derived reporting and classification context/u);
assert.match(invalidTransitionBlockerReviewSmokeSource, /future-production-adapter-required/u);
assert.match(adapterPromotionReadinessSmokeSource, /invalid-transition/u);
assert.match(adapterPromotionReadinessSmokeSource, /runner-derived-stop-metadata-contract/u);
assert.match(extractionSmokeSource, /invalid-transition/u);
assert.match(controllerConsumptionSmokeSource, /must not decide/u);
assert.match(controllerConsumptionSmokeSource, /adapterSource/u);
assert.match(controllerConsumptionSmokeSource, /invalidTransitionKind/u);
assert.match(controllerConsumptionSmokeSource, /retrySafety/u);

const serializedPromotionReadiness = JSON.stringify(invalidTransitionPayloadPromotionReadiness);
assert.doesNotMatch(
  serializedPromotionReadiness,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|terminalStatusCandidate/u,
  'Invalid-transition payload promotion-readiness should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedPromotionReadiness,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Invalid-transition payload promotion-readiness should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedPromotionReadiness,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain/iu,
  'Invalid-transition payload promotion-readiness should not define fixed workflows or fallback chains.',
);
assert.doesNotMatch(
  serializedPromotionReadiness,
  /productionReady":true|runtimeAuthority|experimental-adapter/u,
  'Invalid-transition payload promotion-readiness should not grant runtime authority.',
);

assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Invalid-transition payload promotion-readiness audit must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  invalidTransitionPromotionReadinessSmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Invalid-transition payload promotion-readiness audit should not call production v2 modules.',
);

assert.match(preflightAuditText, /Invalid-Transition Payload Promotion-Readiness Audit Status/u);
assert.match(
  preflightAuditText,
  /agent-session-v3-runtime-boundary-invalid-transition-payload-promotion-readiness-smoke\.ts/u,
);
assert.match(preflightAuditText, /No new structured invalid-transition payload field is formal-contract-ready/u);
assert.match(preflightAuditText, /not production wiring/u);
assert.match(statusText, /V3 runtime boundary invalid-transition payload promotion-readiness audit.*Completed/u);
assert.match(
  statusText,
  /agent-session-v3-runtime-boundary-invalid-transition-payload-promotion-readiness-smoke\.ts/u,
);

console.log('agent session v3 runtime boundary invalid-transition payload promotion-readiness smoke ok');
