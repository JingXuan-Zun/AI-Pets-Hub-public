import assert from 'node:assert/strict';
import {
  AGENT_SESSION_V3_RUNTIME_STOP_EVIDENCE_CONTRACT,
  createAgentSessionV3RuntimeBoundaryContract,
  type AgentSessionV3RuntimeBoundaryStopReason,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

type StopPayloadAuditCoverageMode =
  | 'complete-contract'
  | 'phase-port-payload-subset';

type StopPayloadAuditPromotionMode =
  | 'no-new-payload-contract'
  | 'no-structured-fields-ready'
  | 'runner-derived-fields-covered-by-existing-contract';

interface StopPayloadAuditConsistencyRow {
  blockerCoverageMode: StopPayloadAuditCoverageMode;
  blockerFields: readonly string[];
  blockerScript: string;
  promotionFields: readonly string[];
  promotionMode: StopPayloadAuditPromotionMode;
  promotionScript: string;
  reason: Extract<
    AgentSessionV3RuntimeBoundaryStopReason,
    | 'blocked-by-phase'
    | 'invalid-transition'
    | 'runtime-failed'
    | 'transition-budget-exhausted'
    | 'waiting-for-phase-event'
  >;
}

const stopPayloadAuditConsistency = [
  {
    blockerCoverageMode: 'phase-port-payload-subset',
    blockerFields: ['waitSource', 'pauseReason'],
    blockerScript: 'scripts/agent-session-v3-runtime-boundary-phase-port-waiting-payload-blocker-review-smoke.ts',
    promotionFields: ['waitSource', 'pauseReason', 'resumeTriggerOwner', 'waitBudget'],
    promotionMode: 'no-structured-fields-ready',
    promotionScript: 'scripts/agent-session-v3-runtime-boundary-waiting-payload-promotion-readiness-smoke.ts',
    reason: 'waiting-for-phase-event',
  },
  {
    blockerCoverageMode: 'complete-contract',
    blockerFields: ['blockerSource', 'recoverability', 'userActionRequired', 'terminalStatusCandidate'],
    blockerScript: 'scripts/agent-session-v3-runtime-boundary-blocked-payload-blocker-review-smoke.ts',
    promotionFields: ['blockerSource', 'recoverability', 'userActionRequired', 'terminalStatusCandidate'],
    promotionMode: 'no-structured-fields-ready',
    promotionScript: 'scripts/agent-session-v3-runtime-boundary-blocked-payload-promotion-readiness-smoke.ts',
    reason: 'blocked-by-phase',
  },
  {
    blockerCoverageMode: 'complete-contract',
    blockerFields: ['failureOrigin', 'retryability', 'sideEffectCommitted', 'userVisibleFailureReason', 'errorClass'],
    promotionFields: ['failureOrigin', 'retryability', 'sideEffectCommitted', 'userVisibleFailureReason', 'errorClass'],
    blockerScript: 'scripts/agent-session-v3-runtime-boundary-failure-payload-blocker-review-smoke.ts',
    promotionMode: 'no-structured-fields-ready',
    promotionScript: 'scripts/agent-session-v3-runtime-boundary-failure-payload-promotion-readiness-smoke.ts',
    reason: 'runtime-failed',
  },
  {
    blockerCoverageMode: 'complete-contract',
    blockerFields: ['budgetOwner', 'transitionCount', 'modelBudgetState', 'toolBudgetState', 'taskProgress', 'recoveryCount'],
    promotionFields: ['budgetOwner', 'transitionCount', 'modelBudgetState', 'toolBudgetState', 'taskProgress', 'recoveryCount'],
    blockerScript: 'scripts/agent-session-v3-runtime-boundary-transition-budget-payload-blocker-review-smoke.ts',
    promotionMode: 'runner-derived-fields-covered-by-existing-contract',
    promotionScript: 'scripts/agent-session-v3-runtime-boundary-transition-budget-payload-promotion-readiness-smoke.ts',
    reason: 'transition-budget-exhausted',
  },
  {
    blockerCoverageMode: 'complete-contract',
    blockerFields: ['phase', 'eventType', 'adapterSource', 'invalidTransitionKind', 'retrySafety'],
    promotionFields: ['phase', 'eventType', 'adapterSource', 'invalidTransitionKind', 'retrySafety'],
    blockerScript: 'scripts/agent-session-v3-runtime-boundary-invalid-transition-payload-blocker-review-smoke.ts',
    promotionMode: 'runner-derived-fields-covered-by-existing-contract',
    promotionScript: 'scripts/agent-session-v3-runtime-boundary-invalid-transition-payload-promotion-readiness-smoke.ts',
    reason: 'invalid-transition',
  },
] as const satisfies readonly StopPayloadAuditConsistencyRow[];

function contractFieldNamesFor(reason: AgentSessionV3RuntimeBoundaryStopReason) {
  return (AGENT_SESSION_V3_RUNTIME_STOP_EVIDENCE_CONTRACT[reason] ?? []).map((field) => field.name);
}

function phasePortContractFieldNamesFor(reason: AgentSessionV3RuntimeBoundaryStopReason) {
  return (AGENT_SESSION_V3_RUNTIME_STOP_EVIDENCE_CONTRACT[reason] ?? [])
    .filter((field) => field.source === 'phase-port-result')
    .map((field) => field.name);
}

function assertSourceContainsFields(source: string, fields: readonly string[], label: string) {
  for (const field of fields) {
    assert.match(source, new RegExp(field, 'u'), `${label} should mention ${field}.`);
  }
}

const {
  boundarySource,
  consistencyReviewSmokeSource,
  sourceMappingSmokeSource,
  blockerMapSmokeSource,
  adapterPromotionReadinessSmokeSource,
  preflightAuditText,
  statusText,
} = readProjectSources({
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  consistencyReviewSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-stop-payload-audit-consistency-review-smoke.ts',
  sourceMappingSmokeSource: 'scripts/agent-session-v3-runtime-boundary-stop-payload-source-mapping-smoke.ts',
  blockerMapSmokeSource: 'scripts/agent-session-v3-runtime-boundary-stop-evidence-blocker-map-smoke.ts',
  adapterPromotionReadinessSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-promotion-readiness-smoke.ts',
  preflightAuditText: 'PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md',
  statusText: 'PROJECT_AGENT_V2_STATUS.md',
});

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');

assert.deepEqual(
  Object.keys(AGENT_SESSION_V3_RUNTIME_STOP_EVIDENCE_CONTRACT).sort(),
  [
    'blocked-by-phase',
    'invalid-transition',
    'runtime-failed',
    'transition-budget-exhausted',
    'waiting-for-phase-event',
  ],
  'Stop-payload audits should cover exactly the stop reasons with evidence contracts.',
);

assert.deepEqual(
  stopPayloadAuditConsistency.map((row) => row.reason).sort(),
  Object.keys(AGENT_SESSION_V3_RUNTIME_STOP_EVIDENCE_CONTRACT).sort(),
  'Consistency review should have exactly one row for every stop-evidence contract reason.',
);

for (const row of stopPayloadAuditConsistency) {
  const contractFields = contractFieldNamesFor(row.reason);
  const { blockerSource, promotionSource } = readProjectSources({
    blockerSource: row.blockerScript,
    promotionSource: row.promotionScript,
  });

  assert.deepEqual(
    [...row.promotionFields].sort(),
    [...contractFields].sort(),
    `${row.reason} promotion audit should cover the full stop-evidence contract.`,
  );
  assertSourceContainsFields(promotionSource, row.promotionFields, `${row.reason} promotion audit`);

  if (row.blockerCoverageMode === 'complete-contract') {
    assert.deepEqual(
      [...row.blockerFields].sort(),
      [...contractFields].sort(),
      `${row.reason} blocker audit should cover the full stop-evidence contract.`,
    );
  }

  if (row.blockerCoverageMode === 'phase-port-payload-subset') {
    assert.deepEqual(
      [...row.blockerFields].sort(),
      phasePortContractFieldNamesFor(row.reason).sort(),
      `${row.reason} blocker audit should intentionally cover only phase-port payload fields.`,
    );
    assert.notDeepEqual(
      [...row.blockerFields].sort(),
      [...contractFields].sort(),
      `${row.reason} blocker audit should not pretend to cover controller-policy fields.`,
    );
  }

  assertSourceContainsFields(blockerSource, row.blockerFields, `${row.reason} blocker audit`);

  if (row.promotionMode === 'no-structured-fields-ready') {
    assert.match(
      promotionSource,
      /No structured .* payload field is formal-contract-ready/u,
      `${row.reason} promotion audit should state that no structured payload field is ready.`,
    );
  }

  if (row.promotionMode === 'no-new-payload-contract') {
    assert.match(
      promotionSource,
      /No new structured .* payload field is formal-contract-ready/u,
      `${row.reason} promotion audit should state that no new payload contract is ready.`,
    );
  }

  if (row.promotionMode === 'runner-derived-fields-covered-by-existing-contract') {
    assert.match(
      promotionSource,
      /already-covered-by-runner-derived-contract|already covered by the existing runner-derived stop metadata contract/u,
      `${row.reason} promotion audit should keep runner-derived fields in the existing metadata contract.`,
    );
  }
}

assert.deepEqual(
  stopPayloadAuditConsistency
    .filter((row) => row.blockerCoverageMode === 'phase-port-payload-subset')
    .map((row) => row.reason),
  ['waiting-for-phase-event'],
  'Only waiting blocker review should be a phase-port payload subset.',
);
assert.deepEqual(
  stopPayloadAuditConsistency
    .filter((row) => row.promotionMode === 'runner-derived-fields-covered-by-existing-contract')
    .map((row) => row.reason)
    .sort(),
  ['invalid-transition', 'transition-budget-exhausted'],
  'Only runner-derived stop reasons should reuse the existing metadata contract.',
);
assert.deepEqual(
  stopPayloadAuditConsistency
    .flatMap((row) => row.promotionFields.map((field) => `${row.reason}.${field}`))
    .sort(),
  Object.entries(AGENT_SESSION_V3_RUNTIME_STOP_EVIDENCE_CONTRACT)
    .flatMap(([reason, fields]) => (fields ?? []).map((field) => `${reason}.${field.name}`))
    .sort(),
  'Promotion audits should cover every stop-evidence field exactly once across all stop reasons.',
);

assert.match(sourceMappingSmokeSource, /StopPayloadSourceMappingRow/u);
assert.match(blockerMapSmokeSource, /StopEvidenceBlockerMapRow/u);
assert.match(adapterPromotionReadinessSmokeSource, /AdapterPromotionReadinessRow/u);

const serializedConsistencyRows = JSON.stringify(stopPayloadAuditConsistency);
assert.doesNotMatch(
  serializedConsistencyRows,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction/u,
  'Stop-payload consistency review should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedConsistencyRows,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Stop-payload consistency review should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedConsistencyRows,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain/iu,
  'Stop-payload consistency review should not define fixed workflows or fallback chains.',
);
assert.doesNotMatch(
  serializedConsistencyRows,
  /productionReady":true|runtimeAuthority|experimental-adapter/u,
  'Stop-payload consistency review should not grant runtime authority.',
);

assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Stop-payload consistency review must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  consistencyReviewSmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Stop-payload consistency review should not call production v2 modules.',
);

assert.match(preflightAuditText, /Stop-Payload Audit Consistency Review Status/u);
assert.match(
  preflightAuditText,
  /agent-session-v3-runtime-boundary-stop-payload-audit-consistency-review-smoke\.ts/u,
);
assert.match(preflightAuditText, /without gaps, duplicate ownership, or naming drift/u);
assert.match(preflightAuditText, /not production wiring/u);
assert.match(statusText, /V3 runtime boundary stop-payload audit consistency review.*Completed/u);
assert.match(
  statusText,
  /agent-session-v3-runtime-boundary-stop-payload-audit-consistency-review-smoke\.ts/u,
);

console.log('agent session v3 runtime boundary stop-payload audit consistency review smoke ok');
