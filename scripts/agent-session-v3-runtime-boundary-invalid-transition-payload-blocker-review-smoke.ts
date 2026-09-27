import assert from 'node:assert/strict';
import {
  createAgentSessionV3RuntimeBoundaryContract,
  extractAgentSessionV3RuntimeRunnerDerivedStopMetadata,
  getAgentSessionV3RuntimeRunnerDerivedStopMetadataFields,
  getAgentSessionV3RuntimeStopEvidenceFields,
  runAgentSessionV3PilotRunner,
  type AgentSessionV3RuntimeInvalidTransitionStopMetadata,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

type InvalidTransitionPayloadField =
  | 'adapterSource'
  | 'eventType'
  | 'invalidTransitionKind'
  | 'phase'
  | 'retrySafety';

type InvalidTransitionPayloadCurrentSupport =
  | 'available-runner-derived'
  | 'missing';

type InvalidTransitionPayloadPromotionReadiness =
  | 'future-controller-policy-required'
  | 'future-production-adapter-required'
  | 'runner-derived-only';

interface InvalidTransitionPayloadBlockerReviewRow {
  currentSource: string | null;
  currentSupport: InvalidTransitionPayloadCurrentSupport;
  fieldName: InvalidTransitionPayloadField;
  futureOwner: 'current-pilot-runner' | 'future-controller-policy' | 'future-production-adapter';
  isControllerDecisionInput: boolean;
  promotionReadiness: InvalidTransitionPayloadPromotionReadiness;
  reason: 'invalid-transition';
  reportingContext: boolean;
}

const invalidTransitionPayloadBlockerReview = [
  {
    currentSource: 'AgentSessionV3PilotRunner rejected transition.from',
    currentSupport: 'available-runner-derived',
    fieldName: 'phase',
    futureOwner: 'current-pilot-runner',
    isControllerDecisionInput: false,
    promotionReadiness: 'runner-derived-only',
    reason: 'invalid-transition',
    reportingContext: true,
  },
  {
    currentSource: 'AgentSessionV3PilotRunner rejected transition.event.type',
    currentSupport: 'available-runner-derived',
    fieldName: 'eventType',
    futureOwner: 'current-pilot-runner',
    isControllerDecisionInput: false,
    promotionReadiness: 'runner-derived-only',
    reason: 'invalid-transition',
    reportingContext: true,
  },
  {
    currentSource: null,
    currentSupport: 'missing',
    fieldName: 'adapterSource',
    futureOwner: 'future-production-adapter',
    isControllerDecisionInput: true,
    promotionReadiness: 'future-production-adapter-required',
    reason: 'invalid-transition',
    reportingContext: false,
  },
  {
    currentSource: null,
    currentSupport: 'missing',
    fieldName: 'invalidTransitionKind',
    futureOwner: 'future-controller-policy',
    isControllerDecisionInput: true,
    promotionReadiness: 'future-controller-policy-required',
    reason: 'invalid-transition',
    reportingContext: false,
  },
  {
    currentSource: null,
    currentSupport: 'missing',
    fieldName: 'retrySafety',
    futureOwner: 'future-production-adapter',
    isControllerDecisionInput: true,
    promotionReadiness: 'future-production-adapter-required',
    reason: 'invalid-transition',
    reportingContext: false,
  },
] as const satisfies readonly InvalidTransitionPayloadBlockerReviewRow[];

function assertInvalidTransitionMetadataShape(
  metadata: AgentSessionV3RuntimeInvalidTransitionStopMetadata,
) {
  assert.deepEqual(
    Object.keys(metadata).sort(),
    [...getAgentSessionV3RuntimeRunnerDerivedStopMetadataFields(metadata.reason)].sort(),
  );
  assert.deepEqual(Object.keys(metadata).sort(), ['eventType', 'phase', 'reason']);
}

const {
  blockerMapSmokeSource,
  boundarySource,
  controllerConsumptionSmokeSource,
  extractionSmokeSource,
  invalidTransitionPayloadReviewSmokeSource,
  preflightAuditText,
  sourceMappingSmokeSource,
  statusText,
} = readProjectSources({
  blockerMapSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-stop-evidence-blocker-map-smoke.ts',
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  controllerConsumptionSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-runner-derived-stop-metadata-controller-consumption-preflight-smoke.ts',
  extractionSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-runner-derived-stop-metadata-extraction-audit-smoke.ts',
  invalidTransitionPayloadReviewSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-invalid-transition-payload-blocker-review-smoke.ts',
  preflightAuditText: 'PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md',
  sourceMappingSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-stop-payload-source-mapping-smoke.ts',
  statusText: 'PROJECT_AGENT_V2_STATUS.md',
});

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');

const invalidTransitionResult = await runAgentSessionV3PilotRunner({
  driver: () => ({
    reason: 'invalid-transition payload blocker review rejected event',
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
assert.equal(invalidTransitionMetadata.reason, 'invalid-transition');
assert.deepEqual(invalidTransitionMetadata, {
  eventType: 'model-output-invalid',
  phase: 'init',
  reason: 'invalid-transition',
});
assertInvalidTransitionMetadataShape(invalidTransitionMetadata);
assert.equal('adapterSource' in invalidTransitionMetadata, false);
assert.equal('invalidTransitionKind' in invalidTransitionMetadata, false);
assert.equal('retrySafety' in invalidTransitionMetadata, false);

const invalidTransitionStopEvidenceFields = getAgentSessionV3RuntimeStopEvidenceFields('invalid-transition');
assert.deepEqual(
  invalidTransitionPayloadBlockerReview.map((row) => row.fieldName).sort(),
  invalidTransitionStopEvidenceFields.map((field) => field.name).sort(),
  'Invalid-transition payload blocker review should cover every invalid-transition stop-evidence field exactly once.',
);

for (const row of invalidTransitionPayloadBlockerReview) {
  const contractField = invalidTransitionStopEvidenceFields.find((field) => field.name === row.fieldName);
  assert.ok(contractField, `${row.fieldName} should exist in invalid-transition stop evidence contract.`);
  assert.equal(row.reason, 'invalid-transition');

  if (row.fieldName === 'phase') {
    assert.equal(contractField.source, 'pilot-runner-state');
    assert.equal(row.currentSource, 'AgentSessionV3PilotRunner rejected transition.from');
    assert.equal(row.currentSupport, 'available-runner-derived');
    assert.equal(row.futureOwner, 'current-pilot-runner');
    assert.equal(row.promotionReadiness, 'runner-derived-only');
    assert.equal(row.isControllerDecisionInput, false);
    assert.equal(row.reportingContext, true);
  }

  if (row.fieldName === 'eventType') {
    assert.equal(contractField.source, 'pilot-runner-state');
    assert.equal(row.currentSource, 'AgentSessionV3PilotRunner rejected transition.event.type');
    assert.equal(row.currentSupport, 'available-runner-derived');
    assert.equal(row.futureOwner, 'current-pilot-runner');
    assert.equal(row.promotionReadiness, 'runner-derived-only');
    assert.equal(row.isControllerDecisionInput, false);
    assert.equal(row.reportingContext, true);
  }

  if (row.fieldName === 'adapterSource' || row.fieldName === 'retrySafety') {
    assert.equal(contractField.source, 'future-production-adapter');
    assert.equal(row.currentSource, null);
    assert.equal(row.currentSupport, 'missing');
    assert.equal(row.futureOwner, 'future-production-adapter');
    assert.equal(row.promotionReadiness, 'future-production-adapter-required');
    assert.equal(row.isControllerDecisionInput, true);
  }

  if (row.fieldName === 'invalidTransitionKind') {
    assert.equal(contractField.source, 'future-controller-policy');
    assert.equal(row.currentSource, null);
    assert.equal(row.currentSupport, 'missing');
    assert.equal(row.futureOwner, 'future-controller-policy');
    assert.equal(row.promotionReadiness, 'future-controller-policy-required');
    assert.equal(row.isControllerDecisionInput, true);
  }
}

assert.deepEqual(
  invalidTransitionPayloadBlockerReview
    .filter((row) => row.currentSupport === 'available-runner-derived')
    .map((row) => row.fieldName)
    .sort(),
  ['eventType', 'phase'],
);
assert.deepEqual(
  invalidTransitionPayloadBlockerReview
    .filter((row) => row.isControllerDecisionInput)
    .map((row) => row.fieldName)
    .sort(),
  ['adapterSource', 'invalidTransitionKind', 'retrySafety'],
);
assert.deepEqual(
  invalidTransitionPayloadBlockerReview
    .filter((row) => row.futureOwner === 'future-production-adapter')
    .map((row) => row.fieldName)
    .sort(),
  ['adapterSource', 'retrySafety'],
);
assert.deepEqual(
  invalidTransitionPayloadBlockerReview
    .filter((row) => row.futureOwner === 'future-controller-policy')
    .map((row) => row.fieldName),
  ['invalidTransitionKind'],
);

assert.match(extractionSmokeSource, /invalid-transition/u);
assert.match(controllerConsumptionSmokeSource, /adapterSource/u);
assert.match(controllerConsumptionSmokeSource, /invalidTransitionKind/u);
assert.match(controllerConsumptionSmokeSource, /retrySafety/u);
assert.match(sourceMappingSmokeSource, /invalid-transition[\s\S]*available-from-current-pilot-runner/u);
assert.match(sourceMappingSmokeSource, /invalid-transition[\s\S]*missing-future-production-adapter/u);
assert.match(sourceMappingSmokeSource, /invalid-transition[\s\S]*future-controller-policy-owned/u);
assert.match(blockerMapSmokeSource, /invalid-transition[\s\S]*reporting-enrichment/u);
assert.match(blockerMapSmokeSource, /invalid-transition[\s\S]*decision-blocking/u);

const serializedReview = JSON.stringify(invalidTransitionPayloadBlockerReview);
assert.doesNotMatch(
  serializedReview,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|terminalStatusCandidate/u,
  'Invalid-transition payload blocker review should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedReview,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Invalid-transition payload blocker review should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedReview,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain/iu,
  'Invalid-transition payload blocker review should not define fixed workflows or fallback chains.',
);
assert.doesNotMatch(
  serializedReview,
  /productionReady":true|runtimeAuthority|experimental-adapter/u,
  'Invalid-transition payload blocker review should not grant runtime authority.',
);

assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Invalid-transition payload blocker review must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  invalidTransitionPayloadReviewSmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Invalid-transition payload blocker review should not call production v2 modules.',
);

assert.match(preflightAuditText, /Invalid-Transition Payload Blocker Review Status/u);
assert.match(
  preflightAuditText,
  /agent-session-v3-runtime-boundary-invalid-transition-payload-blocker-review-smoke\.ts/u,
);
assert.match(preflightAuditText, /runner-derived reporting and classification context/u);
assert.match(preflightAuditText, /not production wiring/u);
assert.match(statusText, /V3 runtime boundary invalid-transition payload blocker review.*Completed/u);
assert.match(
  statusText,
  /agent-session-v3-runtime-boundary-invalid-transition-payload-blocker-review-smoke\.ts/u,
);

console.log('agent session v3 runtime boundary invalid-transition payload blocker review smoke ok');
