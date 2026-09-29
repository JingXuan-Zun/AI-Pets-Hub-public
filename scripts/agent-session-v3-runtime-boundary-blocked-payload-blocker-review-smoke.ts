import assert from 'node:assert/strict';
import {
  createAgentSessionV3RuntimeBoundaryContract,
  getAgentSessionV3RuntimeStopEvidenceFields,
  type AgentSessionV3RuntimePhasePortResult,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

type BlockedPayloadField =
  | 'blockerSource'
  | 'recoverability'
  | 'terminalStatusCandidate'
  | 'userActionRequired';

type BlockedPayloadCurrentSupport =
  | 'diagnostic-only'
  | 'missing';

type BlockedPayloadPromotionReadiness =
  | 'future-controller-policy-required'
  | 'future-production-adapter-required'
  | 'keep-smoke-only';

interface BlockedPayloadBlockerReviewRow {
  currentDiagnosticSource: string | null;
  currentSupport: BlockedPayloadCurrentSupport;
  fieldName: BlockedPayloadField;
  futureOwner: 'future-controller-policy' | 'future-production-adapter';
  isControllerDecisionInput: boolean;
  promotionReadiness: BlockedPayloadPromotionReadiness;
  reason: 'blocked-by-phase';
}

const blockedPayloadBlockerReview = [
  {
    currentDiagnosticSource: 'AgentSessionV3RuntimePhasePortResult.blocked.reason',
    currentSupport: 'diagnostic-only',
    fieldName: 'blockerSource',
    futureOwner: 'future-production-adapter',
    isControllerDecisionInput: true,
    promotionReadiness: 'future-production-adapter-required',
    reason: 'blocked-by-phase',
  },
  {
    currentDiagnosticSource: null,
    currentSupport: 'missing',
    fieldName: 'recoverability',
    futureOwner: 'future-production-adapter',
    isControllerDecisionInput: true,
    promotionReadiness: 'future-production-adapter-required',
    reason: 'blocked-by-phase',
  },
  {
    currentDiagnosticSource: null,
    currentSupport: 'missing',
    fieldName: 'userActionRequired',
    futureOwner: 'future-production-adapter',
    isControllerDecisionInput: true,
    promotionReadiness: 'future-production-adapter-required',
    reason: 'blocked-by-phase',
  },
  {
    currentDiagnosticSource: null,
    currentSupport: 'missing',
    fieldName: 'terminalStatusCandidate',
    futureOwner: 'future-controller-policy',
    isControllerDecisionInput: true,
    promotionReadiness: 'future-controller-policy-required',
    reason: 'blocked-by-phase',
  },
] as const satisfies readonly BlockedPayloadBlockerReviewRow[];

const {
  blockedPayloadReviewSmokeSource,
  blockerMapSmokeSource,
  boundarySource,
  payloadShapeSmokeSource,
  preflightAuditText,
  sourceMappingSmokeSource,
  statusText,
  waitingPromotionReadinessSmokeSource,
} = readProjectSources({
  blockedPayloadReviewSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-blocked-payload-blocker-review-smoke.ts',
  blockerMapSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-stop-evidence-blocker-map-smoke.ts',
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  payloadShapeSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-payload-shape-pre-contract-smoke.ts',
  preflightAuditText: 'PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md',
  sourceMappingSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-stop-payload-source-mapping-smoke.ts',
  statusText: 'PROJECT_AGENT_V2_STATUS.md',
  waitingPromotionReadinessSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-waiting-payload-promotion-readiness-smoke.ts',
});

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');

const blockedResult: AgentSessionV3RuntimePhasePortResult = {
  kind: 'blocked',
  reason: 'phase adapter could not safely emit an event',
};
assert.deepEqual(Object.keys(blockedResult).sort(), ['kind', 'reason']);
assert.equal('blockerSource' in blockedResult, false);
assert.equal('recoverability' in blockedResult, false);
assert.equal('userActionRequired' in blockedResult, false);
assert.equal('terminalStatusCandidate' in blockedResult, false);

const blockedStopEvidenceFields = getAgentSessionV3RuntimeStopEvidenceFields('blocked-by-phase');
assert.deepEqual(
  blockedPayloadBlockerReview.map((row) => row.fieldName).sort(),
  blockedStopEvidenceFields.map((field) => field.name).sort(),
  'Blocked payload blocker review should cover every blocked stop-evidence field exactly once.',
);

for (const row of blockedPayloadBlockerReview) {
  const contractField = blockedStopEvidenceFields.find((field) => field.name === row.fieldName);
  assert.ok(contractField, `${row.fieldName} should exist in blocked stop evidence contract.`);
  assert.equal(row.reason, 'blocked-by-phase');
  assert.equal(row.isControllerDecisionInput, true);

  if (row.fieldName === 'blockerSource') {
    assert.equal(contractField.source, 'future-production-adapter');
    assert.equal(row.currentSupport, 'diagnostic-only');
    assert.equal(row.currentDiagnosticSource, 'AgentSessionV3RuntimePhasePortResult.blocked.reason');
    assert.equal(row.promotionReadiness, 'future-production-adapter-required');
  }

  if (row.fieldName === 'recoverability' || row.fieldName === 'userActionRequired') {
    assert.equal(contractField.source, 'future-production-adapter');
    assert.equal(row.currentSupport, 'missing');
    assert.equal(row.currentDiagnosticSource, null);
    assert.equal(row.promotionReadiness, 'future-production-adapter-required');
  }

  if (row.fieldName === 'terminalStatusCandidate') {
    assert.equal(contractField.source, 'future-controller-policy');
    assert.equal(row.futureOwner, 'future-controller-policy');
    assert.equal(row.currentSupport, 'missing');
    assert.equal(row.currentDiagnosticSource, null);
    assert.equal(row.promotionReadiness, 'future-controller-policy-required');
  }
}

assert.deepEqual(
  blockedPayloadBlockerReview
    .filter((row) => row.currentSupport === 'diagnostic-only')
    .map((row) => row.fieldName),
  ['blockerSource'],
  'Current blocked.reason may only be treated as diagnostic blocker context, not structured stop evidence.',
);
assert.deepEqual(
  blockedPayloadBlockerReview
    .filter((row) => row.futureOwner === 'future-production-adapter')
    .map((row) => row.fieldName)
    .sort(),
  ['blockerSource', 'recoverability', 'userActionRequired'],
);
assert.deepEqual(
  blockedPayloadBlockerReview
    .filter((row) => row.futureOwner === 'future-controller-policy')
    .map((row) => row.fieldName),
  ['terminalStatusCandidate'],
);

assert.match(payloadShapeSmokeSource, /adapterMayPopulateFields:[\s\S]*'blockerSource'[\s\S]*'recoverability'[\s\S]*'userActionRequired'/u);
assert.match(payloadShapeSmokeSource, /controllerOwnedFields:[\s\S]*'terminalStatusCandidate'/u);
assert.match(sourceMappingSmokeSource, /blocked-by-phase[\s\S]*missing-future-production-adapter/u);
assert.match(sourceMappingSmokeSource, /blocked-by-phase[\s\S]*future-controller-policy-owned/u);
assert.match(blockerMapSmokeSource, /blocked-by-phase[\s\S]*decision-blocking/u);
assert.match(waitingPromotionReadinessSmokeSource, /AgentSessionV3RuntimePhasePortResult\.waiting\.reason/u);

const serializedReview = JSON.stringify(blockedPayloadBlockerReview);
assert.doesNotMatch(
  serializedReview,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction/u,
  'Blocked payload blocker review should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedReview,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Blocked payload blocker review should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedReview,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain/iu,
  'Blocked payload blocker review should not define fixed workflows or fallback chains.',
);
assert.doesNotMatch(
  serializedReview,
  /productionReady":true|runtimeAuthority|experimental-adapter/u,
  'Blocked payload blocker review should not grant runtime authority.',
);

assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Blocked payload blocker review must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  blockedPayloadReviewSmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Blocked payload blocker review should not call production v2 modules.',
);

assert.match(preflightAuditText, /Blocked Payload Blocker Review Status/u);
assert.match(
  preflightAuditText,
  /agent-session-v3-runtime-boundary-blocked-payload-blocker-review-smoke\.ts/u,
);
assert.match(preflightAuditText, /blocked\.reason/u);
assert.match(preflightAuditText, /not production wiring/u);
assert.match(statusText, /V3 runtime boundary blocked-payload blocker review.*Completed/u);
assert.match(
  statusText,
  /agent-session-v3-runtime-boundary-blocked-payload-blocker-review-smoke\.ts/u,
);

console.log('agent session v3 runtime boundary blocked payload blocker review smoke ok');
