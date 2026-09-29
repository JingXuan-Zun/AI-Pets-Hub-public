import assert from 'node:assert/strict';
import {
  AGENT_SESSION_V3_RUNTIME_STOP_EVIDENCE_CONTRACT,
  createAgentSessionV3RuntimeBoundaryContract,
  type AgentSessionV3RuntimeBoundaryStopReason,
  type AgentSessionV3RuntimeStopEvidenceSource,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

type StopPayloadRollupReadiness =
  | 'available-now'
  | 'partial-now'
  | 'missing';

type StopPayloadRollupPromotionStatus =
  | 'existing-runner-derived-contract-only'
  | 'keep-smoke-only';

interface StopPayloadAuditRollupRow {
  fieldKey: string;
  fieldName: string;
  promotionStatus: StopPayloadRollupPromotionStatus;
  readiness: StopPayloadRollupReadiness;
  reason: AgentSessionV3RuntimeBoundaryStopReason;
  source: AgentSessionV3RuntimeStopEvidenceSource;
}

interface StopPayloadAuditRollupCheckpoint {
  auditSources: readonly string[];
  fieldRows: readonly StopPayloadAuditRollupRow[];
  guardrails: readonly string[];
  productionAuthority: false;
}

function createFieldKey(reason: AgentSessionV3RuntimeBoundaryStopReason, fieldName: string) {
  return `${reason}.${fieldName}`;
}

function classifyReadiness(fieldKey: string, source: AgentSessionV3RuntimeStopEvidenceSource): StopPayloadRollupReadiness {
  if (source === 'pilot-runner-state') {
    return 'available-now';
  }

  if (fieldKey === 'waiting-for-phase-event.pauseReason') {
    return 'partial-now';
  }

  return 'missing';
}

function classifyPromotionStatus(source: AgentSessionV3RuntimeStopEvidenceSource): StopPayloadRollupPromotionStatus {
  if (source === 'pilot-runner-state') {
    return 'existing-runner-derived-contract-only';
  }

  return 'keep-smoke-only';
}

const checkpointAuditSources = [
  'scripts/agent-session-v3-runtime-boundary-production-stop-evidence-contract-smoke.ts',
  'scripts/agent-session-v3-runtime-boundary-stop-payload-source-mapping-smoke.ts',
  'scripts/agent-session-v3-runtime-boundary-stop-evidence-blocker-map-smoke.ts',
  'scripts/agent-session-v3-runtime-boundary-adapter-promotion-readiness-smoke.ts',
  'scripts/agent-session-v3-runtime-boundary-stop-payload-audit-consistency-review-smoke.ts',
  'scripts/agent-session-v3-runtime-boundary-stop-payload-readout-summary-audit-smoke.ts',
  'scripts/agent-session-v3-runtime-boundary-controller-policy-payload-ownership-pre-contract-smoke.ts',
  'scripts/agent-session-v3-runtime-boundary-controller-policy-payload-promotion-readiness-smoke.ts',
] as const;

const stopPayloadAuditRollupCheckpoint = {
  auditSources: checkpointAuditSources,
  fieldRows: Object.entries(AGENT_SESSION_V3_RUNTIME_STOP_EVIDENCE_CONTRACT)
    .flatMap(([reason, fields]) => (fields ?? []).map((field) => {
      const typedReason = reason as AgentSessionV3RuntimeBoundaryStopReason;
      const fieldKey = createFieldKey(typedReason, field.name);

      return {
        fieldKey,
        fieldName: field.name,
        promotionStatus: classifyPromotionStatus(field.source),
        readiness: classifyReadiness(fieldKey, field.source),
        reason: typedReason,
        source: field.source,
      };
    })),
  guardrails: [
    'checkpoint-only',
    'productionAuthority=false',
    'no payload promotion',
    'no controller policy implementation',
    'no production adapter implementation',
    'no fixed tool workflow',
  ],
  productionAuthority: false,
} as const satisfies StopPayloadAuditRollupCheckpoint;

function fieldKeysBySource(source: AgentSessionV3RuntimeStopEvidenceSource) {
  return stopPayloadAuditRollupCheckpoint.fieldRows
    .filter((row) => row.source === source)
    .map((row) => row.fieldKey)
    .sort();
}

function fieldKeysByReadiness(readiness: StopPayloadRollupReadiness) {
  return stopPayloadAuditRollupCheckpoint.fieldRows
    .filter((row) => row.readiness === readiness)
    .map((row) => row.fieldKey)
    .sort();
}

const {
  boundarySource,
  rollupCheckpointSmokeSource,
  preflightAuditText,
  statusText,
} = readProjectSources({
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  rollupCheckpointSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-stop-payload-audit-rollup-checkpoint-smoke.ts',
  preflightAuditText: 'PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md',
  statusText: 'PROJECT_AGENT_V2_STATUS.md',
});

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');
assert.equal(stopPayloadAuditRollupCheckpoint.productionAuthority, false);

for (const script of checkpointAuditSources) {
  const { source } = readProjectSources({ source: script });
  assert.ok(source.length > 0, `${script} should exist and be non-empty.`);
}

const contractFieldRows = Object.entries(AGENT_SESSION_V3_RUNTIME_STOP_EVIDENCE_CONTRACT)
  .flatMap(([reason, fields]) => (fields ?? []).map((field) => ({
    fieldKey: createFieldKey(reason as AgentSessionV3RuntimeBoundaryStopReason, field.name),
    fieldName: field.name,
    reason: reason as AgentSessionV3RuntimeBoundaryStopReason,
    source: field.source,
  })));

assert.deepEqual(
  stopPayloadAuditRollupCheckpoint.fieldRows.map((row) => row.fieldKey).sort(),
  contractFieldRows.map((row) => row.fieldKey).sort(),
  'Rollup checkpoint should cover every stop evidence contract field exactly once.',
);

for (const row of stopPayloadAuditRollupCheckpoint.fieldRows) {
  const contractField = contractFieldRows.find((field) => field.fieldKey === row.fieldKey);
  assert.ok(contractField, `${row.fieldKey} should exist in the stop evidence contract.`);
  assert.equal(row.fieldName, contractField.fieldName);
  assert.equal(row.reason, contractField.reason);
  assert.equal(row.source, contractField.source);

  if (row.source === 'pilot-runner-state') {
    assert.equal(row.readiness, 'available-now');
    assert.equal(row.promotionStatus, 'existing-runner-derived-contract-only');
  } else {
    assert.notEqual(row.promotionStatus, 'existing-runner-derived-contract-only');
    assert.equal(row.promotionStatus, 'keep-smoke-only');
  }

  if (row.source !== 'pilot-runner-state' && row.fieldKey !== 'waiting-for-phase-event.pauseReason') {
    assert.equal(row.readiness, 'missing');
  }
}

assert.deepEqual(
  Object.keys(AGENT_SESSION_V3_RUNTIME_STOP_EVIDENCE_CONTRACT).sort(),
  [
    'blocked-by-phase',
    'invalid-transition',
    'runtime-failed',
    'transition-budget-exhausted',
    'waiting-for-phase-event',
  ],
);

assert.deepEqual(
  fieldKeysBySource('pilot-runner-state'),
  [
    'invalid-transition.eventType',
    'invalid-transition.phase',
    'transition-budget-exhausted.recoveryCount',
    'transition-budget-exhausted.transitionCount',
  ],
);
assert.deepEqual(
  fieldKeysBySource('phase-port-result'),
  ['waiting-for-phase-event.pauseReason', 'waiting-for-phase-event.waitSource'],
);
assert.deepEqual(
  fieldKeysBySource('future-controller-policy'),
  [
    'blocked-by-phase.terminalStatusCandidate',
    'invalid-transition.invalidTransitionKind',
    'transition-budget-exhausted.budgetOwner',
    'waiting-for-phase-event.resumeTriggerOwner',
    'waiting-for-phase-event.waitBudget',
  ],
);
assert.deepEqual(
  fieldKeysByReadiness('available-now'),
  [
    'invalid-transition.eventType',
    'invalid-transition.phase',
    'transition-budget-exhausted.recoveryCount',
    'transition-budget-exhausted.transitionCount',
  ],
);
assert.deepEqual(fieldKeysByReadiness('partial-now'), ['waiting-for-phase-event.pauseReason']);
assert.ok(
  fieldKeysByReadiness('missing').length > fieldKeysByReadiness('available-now').length,
  'Most stop-payload fields should remain missing until future adapters or controller policy exist.',
);
assert.ok(
  fieldKeysBySource('future-production-adapter').length > fieldKeysBySource('future-controller-policy').length,
  'Future production adapters should still own most missing evidence fields.',
);

assert.deepEqual(
  stopPayloadAuditRollupCheckpoint.fieldRows
    .filter((row) => row.promotionStatus !== 'keep-smoke-only')
    .map((row) => row.fieldKey)
    .sort(),
  [
    'invalid-transition.eventType',
    'invalid-transition.phase',
    'transition-budget-exhausted.recoveryCount',
    'transition-budget-exhausted.transitionCount',
  ],
  'Only runner-derived fields should have an existing formal metadata contract.',
);

const serializedRollup = JSON.stringify(stopPayloadAuditRollupCheckpoint);
assert.doesNotMatch(
  serializedRollup,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Stop-payload rollup checkpoint should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedRollup,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Stop-payload rollup checkpoint should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedRollup,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain/iu,
  'Stop-payload rollup checkpoint should not define fixed workflows or fallback chains.',
);
assert.doesNotMatch(
  serializedRollup,
  /productionReady":true|runtimeAuthority|experimental-adapter/u,
  'Stop-payload rollup checkpoint should not grant runtime authority.',
);

assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Stop-payload rollup checkpoint must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  rollupCheckpointSmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Stop-payload rollup checkpoint should not call production v2 modules.',
);

assert.match(preflightAuditText, /Stop-Payload Audit Rollup Checkpoint Status/u);
assert.match(
  preflightAuditText,
  /agent-session-v3-runtime-boundary-stop-payload-audit-rollup-checkpoint-smoke\.ts/u,
);
assert.match(preflightAuditText, /runner-derived fields/u);
assert.match(preflightAuditText, /phase-port payload fields/u);
assert.match(preflightAuditText, /future production adapter fields/u);
assert.match(preflightAuditText, /future controller-policy fields/u);
assert.match(preflightAuditText, /not production wiring/u);
assert.match(statusText, /V3 runtime boundary stop-payload audit rollup checkpoint.*Completed/u);
assert.match(
  statusText,
  /agent-session-v3-runtime-boundary-stop-payload-audit-rollup-checkpoint-smoke\.ts/u,
);

console.log('agent session v3 runtime boundary stop-payload audit rollup checkpoint smoke ok');
