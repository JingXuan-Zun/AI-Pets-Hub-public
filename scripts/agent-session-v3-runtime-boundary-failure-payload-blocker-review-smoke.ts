import assert from 'node:assert/strict';
import {
  createAgentSessionV3RuntimeBoundaryContract,
  getAgentSessionV3RuntimeStopEvidenceFields,
  runAgentSessionV3PilotRunner,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

type FailurePayloadField =
  | 'errorClass'
  | 'failureOrigin'
  | 'retryability'
  | 'sideEffectCommitted'
  | 'userVisibleFailureReason';

type FailurePayloadCurrentSupport =
  | 'diagnostic-only'
  | 'missing';

type FailurePayloadPromotionReadiness =
  | 'future-production-adapter-required'
  | 'keep-smoke-only';

interface FailurePayloadBlockerReviewRow {
  currentDiagnosticSource: string | null;
  currentSupport: FailurePayloadCurrentSupport;
  fieldName: FailurePayloadField;
  futureOwner: 'future-production-adapter';
  isControllerDecisionInput: boolean;
  promotionReadiness: FailurePayloadPromotionReadiness;
  reason: 'runtime-failed';
}

const failurePayloadBlockerReview = [
  {
    currentDiagnosticSource: 'AgentSessionV3PilotRunnerResult.errorText',
    currentSupport: 'diagnostic-only',
    fieldName: 'failureOrigin',
    futureOwner: 'future-production-adapter',
    isControllerDecisionInput: true,
    promotionReadiness: 'future-production-adapter-required',
    reason: 'runtime-failed',
  },
  {
    currentDiagnosticSource: null,
    currentSupport: 'missing',
    fieldName: 'retryability',
    futureOwner: 'future-production-adapter',
    isControllerDecisionInput: true,
    promotionReadiness: 'future-production-adapter-required',
    reason: 'runtime-failed',
  },
  {
    currentDiagnosticSource: null,
    currentSupport: 'missing',
    fieldName: 'sideEffectCommitted',
    futureOwner: 'future-production-adapter',
    isControllerDecisionInput: true,
    promotionReadiness: 'future-production-adapter-required',
    reason: 'runtime-failed',
  },
  {
    currentDiagnosticSource: 'AgentSessionV3PilotRunnerResult.reason',
    currentSupport: 'diagnostic-only',
    fieldName: 'userVisibleFailureReason',
    futureOwner: 'future-production-adapter',
    isControllerDecisionInput: false,
    promotionReadiness: 'keep-smoke-only',
    reason: 'runtime-failed',
  },
  {
    currentDiagnosticSource: 'AgentSessionV3PilotRunnerResult.errorText',
    currentSupport: 'diagnostic-only',
    fieldName: 'errorClass',
    futureOwner: 'future-production-adapter',
    isControllerDecisionInput: false,
    promotionReadiness: 'future-production-adapter-required',
    reason: 'runtime-failed',
  },
] as const satisfies readonly FailurePayloadBlockerReviewRow[];

const {
  blockerMapSmokeSource,
  boundarySource,
  failurePayloadReviewSmokeSource,
  payloadShapeSmokeSource,
  policyGapSmokeSource,
  preflightAuditText,
  runnerSource,
  sourceMappingSmokeSource,
  statusText,
} = readProjectSources({
  blockerMapSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-stop-evidence-blocker-map-smoke.ts',
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  failurePayloadReviewSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-failure-payload-blocker-review-smoke.ts',
  payloadShapeSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-payload-shape-pre-contract-smoke.ts',
  policyGapSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-production-stop-policy-gap-smoke.ts',
  preflightAuditText: 'PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md',
  runnerSource: 'src/agent/agentSessionV3PilotRunner.ts',
  sourceMappingSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-stop-payload-source-mapping-smoke.ts',
  statusText: 'PROJECT_AGENT_V2_STATUS.md',
});

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');

const driverFailedResult = await runAgentSessionV3PilotRunner({
  driver: () => {
    throw new Error('failure payload blocker review driver failed');
  },
});
assert.equal(driverFailedResult.status, 'driver-failed');
assert.equal(driverFailedResult.errorText, 'failure payload blocker review driver failed');
assert.equal(driverFailedResult.reason, 'failure payload blocker review driver failed');
assert.deepEqual(
  Object.keys(driverFailedResult).sort(),
  ['errorText', 'reason', 'state', 'status', 'transition', 'transitions'].sort(),
);
assert.equal('failureOrigin' in driverFailedResult, false);
assert.equal('retryability' in driverFailedResult, false);
assert.equal('sideEffectCommitted' in driverFailedResult, false);
assert.equal('userVisibleFailureReason' in driverFailedResult, false);
assert.equal('errorClass' in driverFailedResult, false);

const runtimeFailedStopEvidenceFields = getAgentSessionV3RuntimeStopEvidenceFields('runtime-failed');
assert.deepEqual(
  failurePayloadBlockerReview.map((row) => row.fieldName).sort(),
  runtimeFailedStopEvidenceFields.map((field) => field.name).sort(),
  'Failure payload blocker review should cover every runtime-failed stop-evidence field exactly once.',
);

for (const row of failurePayloadBlockerReview) {
  const contractField = runtimeFailedStopEvidenceFields.find((field) => field.name === row.fieldName);
  assert.ok(contractField, `${row.fieldName} should exist in runtime-failed stop evidence contract.`);
  assert.equal(contractField.source, 'future-production-adapter');
  assert.equal(row.futureOwner, 'future-production-adapter');
  assert.equal(row.reason, 'runtime-failed');

  if (row.fieldName === 'failureOrigin') {
    assert.equal(row.currentSupport, 'diagnostic-only');
    assert.equal(row.currentDiagnosticSource, 'AgentSessionV3PilotRunnerResult.errorText');
    assert.equal(row.isControllerDecisionInput, true);
    assert.equal(row.promotionReadiness, 'future-production-adapter-required');
  }

  if (row.fieldName === 'retryability' || row.fieldName === 'sideEffectCommitted') {
    assert.equal(row.currentSupport, 'missing');
    assert.equal(row.currentDiagnosticSource, null);
    assert.equal(row.isControllerDecisionInput, true);
    assert.equal(row.promotionReadiness, 'future-production-adapter-required');
  }

  if (row.fieldName === 'userVisibleFailureReason') {
    assert.equal(row.currentSupport, 'diagnostic-only');
    assert.equal(row.currentDiagnosticSource, 'AgentSessionV3PilotRunnerResult.reason');
    assert.equal(row.isControllerDecisionInput, false);
    assert.equal(row.promotionReadiness, 'keep-smoke-only');
  }

  if (row.fieldName === 'errorClass') {
    assert.equal(row.currentSupport, 'diagnostic-only');
    assert.equal(row.currentDiagnosticSource, 'AgentSessionV3PilotRunnerResult.errorText');
    assert.equal(row.isControllerDecisionInput, false);
    assert.equal(row.promotionReadiness, 'future-production-adapter-required');
  }
}

assert.deepEqual(
  failurePayloadBlockerReview
    .filter((row) => row.isControllerDecisionInput)
    .map((row) => row.fieldName)
    .sort(),
  ['failureOrigin', 'retryability', 'sideEffectCommitted'],
);
assert.deepEqual(
  failurePayloadBlockerReview
    .filter((row) => row.currentSupport === 'missing')
    .map((row) => row.fieldName)
    .sort(),
  ['retryability', 'sideEffectCommitted'],
);
assert.deepEqual(
  failurePayloadBlockerReview
    .filter((row) => row.currentSupport === 'diagnostic-only')
    .map((row) => row.fieldName)
    .sort(),
  ['errorClass', 'failureOrigin', 'userVisibleFailureReason'],
);

assert.match(runnerSource, /status: 'driver-failed'/u);
assert.match(runnerSource, /errorText/u);
assert.match(payloadShapeSmokeSource, /kind: 'failure'[\s\S]*future-stop-payload-only/u);
assert.match(sourceMappingSmokeSource, /runtime-failed[\s\S]*missing-future-production-adapter/u);
assert.match(blockerMapSmokeSource, /runtime-failed[\s\S]*decision-blocking/u);
assert.match(policyGapSmokeSource, /runtime-failed[\s\S]*failure origin classification/u);

const serializedReview = JSON.stringify(failurePayloadBlockerReview);
assert.doesNotMatch(
  serializedReview,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|terminalStatusCandidate/u,
  'Failure payload blocker review should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedReview,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Failure payload blocker review should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedReview,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain/iu,
  'Failure payload blocker review should not define fixed workflows or fallback chains.',
);
assert.doesNotMatch(
  serializedReview,
  /productionReady":true|runtimeAuthority|experimental-adapter/u,
  'Failure payload blocker review should not grant runtime authority.',
);

assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Failure payload blocker review must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  failurePayloadReviewSmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Failure payload blocker review should not call production v2 modules.',
);

assert.match(preflightAuditText, /Failure Payload Blocker Review Status/u);
assert.match(
  preflightAuditText,
  /agent-session-v3-runtime-boundary-failure-payload-blocker-review-smoke\.ts/u,
);
assert.match(preflightAuditText, /driver-failed/u);
assert.match(preflightAuditText, /not production wiring/u);
assert.match(statusText, /V3 runtime boundary failure-payload blocker review.*Completed/u);
assert.match(
  statusText,
  /agent-session-v3-runtime-boundary-failure-payload-blocker-review-smoke\.ts/u,
);

console.log('agent session v3 runtime boundary failure payload blocker review smoke ok');
