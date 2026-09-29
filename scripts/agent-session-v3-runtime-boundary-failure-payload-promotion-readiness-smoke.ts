import assert from 'node:assert/strict';
import {
  createAgentSessionV3RuntimeBoundaryContract,
  getAgentSessionV3RuntimeStopEvidenceFields,
  runAgentSessionV3PilotRunner,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

type FailurePayloadCandidateField =
  | 'errorClass'
  | 'failureOrigin'
  | 'retryability'
  | 'sideEffectCommitted'
  | 'userVisibleFailureReason';

type FailurePayloadPromotionDecision =
  | 'formal-contract-ready'
  | 'keep-smoke-only';

type FailurePayloadPromotionBlocker =
  | 'diagnostic-only-current-source'
  | 'requires-future-production-adapter'
  | 'requires-normalized-error-taxonomy'
  | 'requires-real-production-like-traces'
  | 'requires-side-effect-commit-evidence'
  | 'requires-user-visible-semantics';

interface FailurePayloadPromotionReadinessRow {
  blockers: readonly FailurePayloadPromotionBlocker[];
  currentSource: string | null;
  decision: FailurePayloadPromotionDecision;
  fieldName: FailurePayloadCandidateField;
  productionReady: false;
  reason: 'runtime-failed';
}

const failurePayloadPromotionReadiness = [
  {
    blockers: [
      'diagnostic-only-current-source',
      'requires-future-production-adapter',
      'requires-real-production-like-traces',
    ],
    currentSource: 'AgentSessionV3PilotRunnerResult.errorText',
    decision: 'keep-smoke-only',
    fieldName: 'failureOrigin',
    productionReady: false,
    reason: 'runtime-failed',
  },
  {
    blockers: [
      'requires-future-production-adapter',
      'requires-real-production-like-traces',
    ],
    currentSource: null,
    decision: 'keep-smoke-only',
    fieldName: 'retryability',
    productionReady: false,
    reason: 'runtime-failed',
  },
  {
    blockers: [
      'requires-side-effect-commit-evidence',
      'requires-future-production-adapter',
      'requires-real-production-like-traces',
    ],
    currentSource: null,
    decision: 'keep-smoke-only',
    fieldName: 'sideEffectCommitted',
    productionReady: false,
    reason: 'runtime-failed',
  },
  {
    blockers: [
      'diagnostic-only-current-source',
      'requires-user-visible-semantics',
      'requires-future-production-adapter',
      'requires-real-production-like-traces',
    ],
    currentSource: 'AgentSessionV3PilotRunnerResult.reason',
    decision: 'keep-smoke-only',
    fieldName: 'userVisibleFailureReason',
    productionReady: false,
    reason: 'runtime-failed',
  },
  {
    blockers: [
      'diagnostic-only-current-source',
      'requires-normalized-error-taxonomy',
      'requires-future-production-adapter',
      'requires-real-production-like-traces',
    ],
    currentSource: 'AgentSessionV3PilotRunnerResult.errorText',
    decision: 'keep-smoke-only',
    fieldName: 'errorClass',
    productionReady: false,
    reason: 'runtime-failed',
  },
] as const satisfies readonly FailurePayloadPromotionReadinessRow[];

const {
  adapterPromotionReadinessSmokeSource,
  blockerMapSmokeSource,
  boundarySource,
  failurePayloadBlockerReviewSmokeSource,
  failurePayloadPromotionReadinessSmokeSource,
  preflightAuditText,
  sourceMappingSmokeSource,
  statusText,
} = readProjectSources({
  adapterPromotionReadinessSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-promotion-readiness-smoke.ts',
  blockerMapSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-stop-evidence-blocker-map-smoke.ts',
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  failurePayloadBlockerReviewSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-failure-payload-blocker-review-smoke.ts',
  failurePayloadPromotionReadinessSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-failure-payload-promotion-readiness-smoke.ts',
  preflightAuditText: 'PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md',
  sourceMappingSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-stop-payload-source-mapping-smoke.ts',
  statusText: 'PROJECT_AGENT_V2_STATUS.md',
});

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');

const driverFailedResult = await runAgentSessionV3PilotRunner({
  driver: () => {
    throw new Error('failure payload promotion-readiness driver failed');
  },
});
assert.equal(driverFailedResult.status, 'driver-failed');
assert.equal(driverFailedResult.errorText, 'failure payload promotion-readiness driver failed');
assert.equal(driverFailedResult.reason, 'failure payload promotion-readiness driver failed');
assert.equal('failureOrigin' in driverFailedResult, false);
assert.equal('retryability' in driverFailedResult, false);
assert.equal('sideEffectCommitted' in driverFailedResult, false);
assert.equal('userVisibleFailureReason' in driverFailedResult, false);
assert.equal('errorClass' in driverFailedResult, false);

const runtimeFailedStopEvidenceFields = getAgentSessionV3RuntimeStopEvidenceFields('runtime-failed');
assert.deepEqual(
  failurePayloadPromotionReadiness.map((row) => row.fieldName).sort(),
  runtimeFailedStopEvidenceFields.map((field) => field.name).sort(),
  'Failure payload promotion-readiness audit should cover every runtime-failed stop-evidence field exactly once.',
);

for (const row of failurePayloadPromotionReadiness) {
  const contractField = runtimeFailedStopEvidenceFields.find((field) => field.name === row.fieldName);
  assert.ok(contractField, `${row.fieldName} should exist in runtime-failed stop evidence contract.`);
  assert.equal(contractField.source, 'future-production-adapter');
  assert.equal(row.productionReady, false);
  assert.equal(row.decision, 'keep-smoke-only');
  assert.ok(row.blockers.includes('requires-future-production-adapter'));
  assert.ok(row.blockers.includes('requires-real-production-like-traces'));

  if (row.fieldName === 'failureOrigin') {
    assert.equal(row.currentSource, 'AgentSessionV3PilotRunnerResult.errorText');
    assert.ok(row.blockers.includes('diagnostic-only-current-source'));
  }

  if (row.fieldName === 'retryability') {
    assert.equal(row.currentSource, null);
  }

  if (row.fieldName === 'sideEffectCommitted') {
    assert.equal(row.currentSource, null);
    assert.ok(row.blockers.includes('requires-side-effect-commit-evidence'));
  }

  if (row.fieldName === 'userVisibleFailureReason') {
    assert.equal(row.currentSource, 'AgentSessionV3PilotRunnerResult.reason');
    assert.ok(row.blockers.includes('requires-user-visible-semantics'));
  }

  if (row.fieldName === 'errorClass') {
    assert.equal(row.currentSource, 'AgentSessionV3PilotRunnerResult.errorText');
    assert.ok(row.blockers.includes('requires-normalized-error-taxonomy'));
  }
}

assert.deepEqual(
  failurePayloadPromotionReadiness
    .filter((row) => row.decision === 'formal-contract-ready'),
  [],
  'No structured failure payload field should be promoted into the formal boundary type yet.',
);
assert.deepEqual(
  failurePayloadPromotionReadiness
    .filter((row) => row.currentSource === 'AgentSessionV3PilotRunnerResult.errorText')
    .map((row) => row.fieldName)
    .sort(),
  ['errorClass', 'failureOrigin'],
);
assert.deepEqual(
  failurePayloadPromotionReadiness
    .filter((row) => row.currentSource === null)
    .map((row) => row.fieldName)
    .sort(),
  ['retryability', 'sideEffectCommitted'],
);

assert.match(failurePayloadBlockerReviewSmokeSource, /diagnostic-only/u);
assert.match(failurePayloadBlockerReviewSmokeSource, /future-production-adapter-required/u);
assert.match(adapterPromotionReadinessSmokeSource, /runtime-failed/u);
assert.match(adapterPromotionReadinessSmokeSource, /failureOrigin/u);
assert.match(sourceMappingSmokeSource, /runtime-failed[\s\S]*missing-future-production-adapter/u);
assert.match(blockerMapSmokeSource, /runtime-failed[\s\S]*decision-blocking/u);

const serializedPromotionReadiness = JSON.stringify(failurePayloadPromotionReadiness);
assert.doesNotMatch(
  serializedPromotionReadiness,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|terminalStatusCandidate/u,
  'Failure payload promotion-readiness should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedPromotionReadiness,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Failure payload promotion-readiness should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedPromotionReadiness,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain/iu,
  'Failure payload promotion-readiness should not define fixed workflows or fallback chains.',
);
assert.doesNotMatch(
  serializedPromotionReadiness,
  /productionReady":true|runtimeAuthority|experimental-adapter/u,
  'Failure payload promotion-readiness should not grant runtime authority.',
);

assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Failure payload promotion-readiness audit must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  failurePayloadPromotionReadinessSmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Failure payload promotion-readiness audit should not call production v2 modules.',
);

assert.match(preflightAuditText, /Failure Payload Promotion-Readiness Audit Status/u);
assert.match(
  preflightAuditText,
  /agent-session-v3-runtime-boundary-failure-payload-promotion-readiness-smoke\.ts/u,
);
assert.match(preflightAuditText, /No structured failure payload field is formal-contract-ready/u);
assert.match(preflightAuditText, /not production wiring/u);
assert.match(statusText, /V3 runtime boundary failure-payload promotion-readiness audit.*Completed/u);
assert.match(
  statusText,
  /agent-session-v3-runtime-boundary-failure-payload-promotion-readiness-smoke\.ts/u,
);

console.log('agent session v3 runtime boundary failure payload promotion-readiness smoke ok');
