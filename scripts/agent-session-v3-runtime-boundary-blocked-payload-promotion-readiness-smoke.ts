import assert from 'node:assert/strict';
import {
  createAgentSessionV3RuntimeBoundaryContract,
  getAgentSessionV3RuntimeStopEvidenceFields,
  type AgentSessionV3RuntimePhasePortResult,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

type BlockedPayloadCandidateField =
  | 'blockerSource'
  | 'recoverability'
  | 'terminalStatusCandidate'
  | 'userActionRequired';

type BlockedPayloadPromotionDecision =
  | 'formal-contract-ready'
  | 'keep-smoke-only';

type BlockedPayloadPromotionBlocker =
  | 'diagnostic-only-current-source'
  | 'requires-future-controller-policy'
  | 'requires-future-production-adapter'
  | 'requires-real-production-like-traces'
  | 'requires-structured-blocked-semantics';

interface BlockedPayloadPromotionReadinessRow {
  blockers: readonly BlockedPayloadPromotionBlocker[];
  currentSource: string | null;
  decision: BlockedPayloadPromotionDecision;
  fieldName: BlockedPayloadCandidateField;
  productionReady: false;
  reason: 'blocked-by-phase';
}

const blockedPayloadPromotionReadiness = [
  {
    blockers: [
      'diagnostic-only-current-source',
      'requires-structured-blocked-semantics',
      'requires-future-production-adapter',
      'requires-real-production-like-traces',
    ],
    currentSource: 'AgentSessionV3RuntimePhasePortResult.blocked.reason',
    decision: 'keep-smoke-only',
    fieldName: 'blockerSource',
    productionReady: false,
    reason: 'blocked-by-phase',
  },
  {
    blockers: [
      'requires-structured-blocked-semantics',
      'requires-future-production-adapter',
      'requires-real-production-like-traces',
    ],
    currentSource: null,
    decision: 'keep-smoke-only',
    fieldName: 'recoverability',
    productionReady: false,
    reason: 'blocked-by-phase',
  },
  {
    blockers: [
      'requires-structured-blocked-semantics',
      'requires-future-production-adapter',
      'requires-real-production-like-traces',
    ],
    currentSource: null,
    decision: 'keep-smoke-only',
    fieldName: 'userActionRequired',
    productionReady: false,
    reason: 'blocked-by-phase',
  },
  {
    blockers: [
      'requires-future-controller-policy',
      'requires-real-production-like-traces',
    ],
    currentSource: null,
    decision: 'keep-smoke-only',
    fieldName: 'terminalStatusCandidate',
    productionReady: false,
    reason: 'blocked-by-phase',
  },
] as const satisfies readonly BlockedPayloadPromotionReadinessRow[];

const {
  adapterPromotionReadinessSmokeSource,
  blockedPayloadBlockerReviewSmokeSource,
  blockedPayloadPromotionReadinessSmokeSource,
  blockerMapSmokeSource,
  boundarySource,
  preflightAuditText,
  sourceMappingSmokeSource,
  statusText,
} = readProjectSources({
  adapterPromotionReadinessSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-promotion-readiness-smoke.ts',
  blockedPayloadBlockerReviewSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-blocked-payload-blocker-review-smoke.ts',
  blockedPayloadPromotionReadinessSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-blocked-payload-promotion-readiness-smoke.ts',
  blockerMapSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-stop-evidence-blocker-map-smoke.ts',
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  preflightAuditText: 'PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md',
  sourceMappingSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-stop-payload-source-mapping-smoke.ts',
  statusText: 'PROJECT_AGENT_V2_STATUS.md',
});

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');

const currentBlockedResult: AgentSessionV3RuntimePhasePortResult = {
  kind: 'blocked',
  reason: 'phase adapter is blocked by incomplete evidence',
};
assert.deepEqual(Object.keys(currentBlockedResult).sort(), ['kind', 'reason']);
assert.equal('blockerSource' in currentBlockedResult, false);
assert.equal('recoverability' in currentBlockedResult, false);
assert.equal('userActionRequired' in currentBlockedResult, false);
assert.equal('terminalStatusCandidate' in currentBlockedResult, false);

const blockedStopEvidenceFields = getAgentSessionV3RuntimeStopEvidenceFields('blocked-by-phase');
assert.deepEqual(
  blockedPayloadPromotionReadiness.map((row) => row.fieldName).sort(),
  blockedStopEvidenceFields.map((field) => field.name).sort(),
  'Blocked payload promotion-readiness audit should cover every blocked stop-evidence field exactly once.',
);

for (const row of blockedPayloadPromotionReadiness) {
  const contractField = blockedStopEvidenceFields.find((field) => field.name === row.fieldName);
  assert.ok(contractField, `${row.fieldName} should exist in the blocked stop evidence contract.`);
  assert.equal(row.productionReady, false);
  assert.equal(row.decision, 'keep-smoke-only');
  assert.ok(row.blockers.length > 0);

  if (row.fieldName === 'blockerSource') {
    assert.equal(contractField.source, 'future-production-adapter');
    assert.equal(row.currentSource, 'AgentSessionV3RuntimePhasePortResult.blocked.reason');
    assert.ok(row.blockers.includes('diagnostic-only-current-source'));
    assert.ok(row.blockers.includes('requires-structured-blocked-semantics'));
    assert.ok(row.blockers.includes('requires-future-production-adapter'));
  }

  if (row.fieldName === 'recoverability' || row.fieldName === 'userActionRequired') {
    assert.equal(contractField.source, 'future-production-adapter');
    assert.equal(row.currentSource, null);
    assert.ok(row.blockers.includes('requires-structured-blocked-semantics'));
    assert.ok(row.blockers.includes('requires-future-production-adapter'));
  }

  if (row.fieldName === 'terminalStatusCandidate') {
    assert.equal(contractField.source, 'future-controller-policy');
    assert.equal(row.currentSource, null);
    assert.ok(row.blockers.includes('requires-future-controller-policy'));
  }
}

assert.deepEqual(
  blockedPayloadPromotionReadiness
    .filter((row) => row.decision === 'formal-contract-ready'),
  [],
  'No structured blocked payload field should be promoted into the formal boundary type yet.',
);
assert.deepEqual(
  blockedPayloadPromotionReadiness
    .filter((row) => row.currentSource === 'AgentSessionV3RuntimePhasePortResult.blocked.reason')
    .map((row) => row.fieldName),
  ['blockerSource'],
  'Current blocked.reason may only inform future blockerSource, and only as diagnostic input.',
);
assert.deepEqual(
  blockedPayloadPromotionReadiness
    .filter((row) => row.blockers.includes('requires-future-production-adapter'))
    .map((row) => row.fieldName)
    .sort(),
  ['blockerSource', 'recoverability', 'userActionRequired'],
);
assert.deepEqual(
  blockedPayloadPromotionReadiness
    .filter((row) => row.blockers.includes('requires-future-controller-policy'))
    .map((row) => row.fieldName),
  ['terminalStatusCandidate'],
);

assert.match(blockedPayloadBlockerReviewSmokeSource, /diagnostic-only/u);
assert.match(blockedPayloadBlockerReviewSmokeSource, /future-production-adapter-required/u);
assert.match(adapterPromotionReadinessSmokeSource, /blocked-by-phase/u);
assert.match(adapterPromotionReadinessSmokeSource, /blockerSource/u);
assert.match(sourceMappingSmokeSource, /blocked-by-phase[\s\S]*missing-future-production-adapter/u);
assert.match(sourceMappingSmokeSource, /blocked-by-phase[\s\S]*future-controller-policy-owned/u);
assert.match(blockerMapSmokeSource, /blocked-by-phase[\s\S]*decision-blocking/u);

const serializedPromotionReadiness = JSON.stringify(blockedPayloadPromotionReadiness);
assert.doesNotMatch(
  serializedPromotionReadiness,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction/u,
  'Blocked payload promotion-readiness should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedPromotionReadiness,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Blocked payload promotion-readiness should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedPromotionReadiness,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain/iu,
  'Blocked payload promotion-readiness should not define fixed workflows or fallback chains.',
);
assert.doesNotMatch(
  serializedPromotionReadiness,
  /productionReady":true|runtimeAuthority|experimental-adapter/u,
  'Blocked payload promotion-readiness should not grant runtime authority.',
);

assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Blocked payload promotion-readiness audit must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  blockedPayloadPromotionReadinessSmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Blocked payload promotion-readiness audit should not call production v2 modules.',
);

assert.match(preflightAuditText, /Blocked Payload Promotion-Readiness Audit Status/u);
assert.match(
  preflightAuditText,
  /agent-session-v3-runtime-boundary-blocked-payload-promotion-readiness-smoke\.ts/u,
);
assert.match(preflightAuditText, /No structured blocked payload field is formal-contract-ready/u);
assert.match(preflightAuditText, /not production wiring/u);
assert.match(statusText, /V3 runtime boundary blocked-payload promotion-readiness audit.*Completed/u);
assert.match(
  statusText,
  /agent-session-v3-runtime-boundary-blocked-payload-promotion-readiness-smoke\.ts/u,
);

console.log('agent session v3 runtime boundary blocked payload promotion-readiness smoke ok');
