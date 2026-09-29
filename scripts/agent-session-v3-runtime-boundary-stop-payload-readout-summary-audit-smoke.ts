import assert from 'node:assert/strict';
import {
  AGENT_SESSION_V3_RUNTIME_STOP_EVIDENCE_CONTRACT,
  createAgentSessionV3RuntimeBoundaryContract,
  type AgentSessionV3RuntimeBoundaryStopReason,
  type AgentSessionV3RuntimeStopEvidenceSource,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

type StopPayloadReadoutGroup =
  | 'runner-derived-existing-metadata'
  | 'phase-port-partial-or-future-payload'
  | 'future-production-adapter'
  | 'future-controller-policy';

type StopPayloadReadoutReadiness =
  | 'available-now'
  | 'partial-now'
  | 'missing';

type StopPayloadReadoutRuntimeUse =
  | 'reporting-classification-context-only'
  | 'future-evidence-only'
  | 'future-policy-only';

type StopPayloadReadoutPromotionReadiness =
  | 'covered-by-existing-runner-derived-stop-metadata-contract'
  | 'keep-smoke-only-future-phase-payload'
  | 'keep-smoke-only-future-production-adapter'
  | 'keep-smoke-only-future-controller-policy';

interface StopPayloadReadoutSummaryRow {
  contractSource: AgentSessionV3RuntimeStopEvidenceSource;
  fieldKey: string;
  fieldName: string;
  promotionReadiness: StopPayloadReadoutPromotionReadiness;
  readiness: StopPayloadReadoutReadiness;
  readoutGroup: StopPayloadReadoutGroup;
  reason: AgentSessionV3RuntimeBoundaryStopReason;
  runtimeUse: StopPayloadReadoutRuntimeUse;
}

const phasePortPartialCurrentFieldKeys = new Set([
  'waiting-for-phase-event.pauseReason',
]);

function createFieldKey(reason: AgentSessionV3RuntimeBoundaryStopReason, fieldName: string) {
  return `${reason}.${fieldName}`;
}

function classifyReadoutField(options: {
  fieldKey: string;
  source: AgentSessionV3RuntimeStopEvidenceSource;
}): Pick<
  StopPayloadReadoutSummaryRow,
  'promotionReadiness' | 'readiness' | 'readoutGroup' | 'runtimeUse'
> {
  if (options.source === 'pilot-runner-state') {
    return {
      promotionReadiness: 'covered-by-existing-runner-derived-stop-metadata-contract',
      readiness: 'available-now',
      readoutGroup: 'runner-derived-existing-metadata',
      runtimeUse: 'reporting-classification-context-only',
    };
  }

  if (options.source === 'phase-port-result') {
    return {
      promotionReadiness: 'keep-smoke-only-future-phase-payload',
      readiness: phasePortPartialCurrentFieldKeys.has(options.fieldKey) ? 'partial-now' : 'missing',
      readoutGroup: 'phase-port-partial-or-future-payload',
      runtimeUse: 'future-evidence-only',
    };
  }

  if (options.source === 'future-production-adapter') {
    return {
      promotionReadiness: 'keep-smoke-only-future-production-adapter',
      readiness: 'missing',
      readoutGroup: 'future-production-adapter',
      runtimeUse: 'future-evidence-only',
    };
  }

  if (options.source === 'future-controller-policy') {
    return {
      promotionReadiness: 'keep-smoke-only-future-controller-policy',
      readiness: 'missing',
      readoutGroup: 'future-controller-policy',
      runtimeUse: 'future-policy-only',
    };
  }

  const exhaustiveSource: never = options.source;
  throw new Error(`Unhandled stop-payload source: ${exhaustiveSource}`);
}

const stopPayloadReadoutSummary = Object.entries(AGENT_SESSION_V3_RUNTIME_STOP_EVIDENCE_CONTRACT)
  .flatMap(([reason, fields]) => (fields ?? []).map((field) => {
    const typedReason = reason as AgentSessionV3RuntimeBoundaryStopReason;
    const fieldKey = createFieldKey(typedReason, field.name);

    return {
      contractSource: field.source,
      fieldKey,
      fieldName: field.name,
      reason: typedReason,
      ...classifyReadoutField({
        fieldKey,
        source: field.source,
      }),
    };
  })) satisfies readonly StopPayloadReadoutSummaryRow[];

function fieldKeysByGroup(group: StopPayloadReadoutGroup) {
  return stopPayloadReadoutSummary
    .filter((row) => row.readoutGroup === group)
    .map((row) => row.fieldKey)
    .sort();
}

function fieldKeysByReadiness(readiness: StopPayloadReadoutReadiness) {
  return stopPayloadReadoutSummary
    .filter((row) => row.readiness === readiness)
    .map((row) => row.fieldKey)
    .sort();
}

const {
  boundarySource,
  readoutSummarySmokeSource,
  sourceMappingSmokeSource,
  blockerMapSmokeSource,
  adapterPromotionReadinessSmokeSource,
  consistencyReviewSmokeSource,
  preflightAuditText,
  statusText,
} = readProjectSources({
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  readoutSummarySmokeSource:
    'scripts/agent-session-v3-runtime-boundary-stop-payload-readout-summary-audit-smoke.ts',
  sourceMappingSmokeSource: 'scripts/agent-session-v3-runtime-boundary-stop-payload-source-mapping-smoke.ts',
  blockerMapSmokeSource: 'scripts/agent-session-v3-runtime-boundary-stop-evidence-blocker-map-smoke.ts',
  adapterPromotionReadinessSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-promotion-readiness-smoke.ts',
  consistencyReviewSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-stop-payload-audit-consistency-review-smoke.ts',
  preflightAuditText: 'PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md',
  statusText: 'PROJECT_AGENT_V2_STATUS.md',
});

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');

const contractFieldRows = Object.entries(AGENT_SESSION_V3_RUNTIME_STOP_EVIDENCE_CONTRACT)
  .flatMap(([reason, fields]) => (fields ?? []).map((field) => ({
    fieldKey: createFieldKey(reason as AgentSessionV3RuntimeBoundaryStopReason, field.name),
    fieldName: field.name,
    reason: reason as AgentSessionV3RuntimeBoundaryStopReason,
    source: field.source,
  })));

assert.deepEqual(
  stopPayloadReadoutSummary.map((row) => row.fieldKey).sort(),
  contractFieldRows.map((row) => row.fieldKey).sort(),
  'Readout summary should cover every stop evidence contract field exactly once.',
);

for (const row of stopPayloadReadoutSummary) {
  const contractField = contractFieldRows.find((field) => field.fieldKey === row.fieldKey);

  assert.ok(contractField, `${row.fieldKey} should exist in the stop evidence contract.`);
  assert.equal(row.contractSource, contractField.source);
  assert.equal(row.fieldName, contractField.fieldName);
  assert.equal(row.reason, contractField.reason);

  if (row.readoutGroup === 'runner-derived-existing-metadata') {
    assert.equal(row.contractSource, 'pilot-runner-state');
    assert.equal(row.readiness, 'available-now');
    assert.equal(row.runtimeUse, 'reporting-classification-context-only');
    assert.equal(row.promotionReadiness, 'covered-by-existing-runner-derived-stop-metadata-contract');
  }

  if (row.readoutGroup === 'phase-port-partial-or-future-payload') {
    assert.equal(row.contractSource, 'phase-port-result');
    assert.equal(row.runtimeUse, 'future-evidence-only');
    assert.equal(row.promotionReadiness, 'keep-smoke-only-future-phase-payload');
  }

  if (row.readoutGroup === 'future-production-adapter') {
    assert.equal(row.contractSource, 'future-production-adapter');
    assert.equal(row.readiness, 'missing');
    assert.equal(row.runtimeUse, 'future-evidence-only');
    assert.equal(row.promotionReadiness, 'keep-smoke-only-future-production-adapter');
  }

  if (row.readoutGroup === 'future-controller-policy') {
    assert.equal(row.contractSource, 'future-controller-policy');
    assert.equal(row.readiness, 'missing');
    assert.equal(row.runtimeUse, 'future-policy-only');
    assert.equal(row.promotionReadiness, 'keep-smoke-only-future-controller-policy');
  }
}

assert.deepEqual(
  fieldKeysByGroup('runner-derived-existing-metadata'),
  [
    'invalid-transition.eventType',
    'invalid-transition.phase',
    'transition-budget-exhausted.recoveryCount',
    'transition-budget-exhausted.transitionCount',
  ],
);

assert.deepEqual(
  fieldKeysByGroup('phase-port-partial-or-future-payload'),
  ['waiting-for-phase-event.pauseReason', 'waiting-for-phase-event.waitSource'],
);

assert.deepEqual(
  fieldKeysByGroup('future-production-adapter'),
  [
    'blocked-by-phase.blockerSource',
    'blocked-by-phase.recoverability',
    'blocked-by-phase.userActionRequired',
    'invalid-transition.adapterSource',
    'invalid-transition.retrySafety',
    'runtime-failed.errorClass',
    'runtime-failed.failureOrigin',
    'runtime-failed.retryability',
    'runtime-failed.sideEffectCommitted',
    'runtime-failed.userVisibleFailureReason',
    'transition-budget-exhausted.modelBudgetState',
    'transition-budget-exhausted.taskProgress',
    'transition-budget-exhausted.toolBudgetState',
  ],
);

assert.deepEqual(
  fieldKeysByGroup('future-controller-policy'),
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

assert.deepEqual(
  fieldKeysByReadiness('partial-now'),
  ['waiting-for-phase-event.pauseReason'],
);

assert.ok(
  fieldKeysByReadiness('missing').length > fieldKeysByReadiness('available-now').length,
  'Most stop-payload fields should still be missing until future adapters or controller policy exist.',
);

assert.match(sourceMappingSmokeSource, /StopPayloadSourceMappingRow/u);
assert.match(blockerMapSmokeSource, /StopEvidenceBlockerMapRow/u);
assert.match(adapterPromotionReadinessSmokeSource, /AdapterPromotionReadinessRow/u);
assert.match(consistencyReviewSmokeSource, /StopPayloadAuditConsistencyRow/u);

const serializedReadout = JSON.stringify(stopPayloadReadoutSummary);
assert.doesNotMatch(
  serializedReadout,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction/u,
  'Stop-payload readout summary should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedReadout,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Stop-payload readout summary should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedReadout,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain/iu,
  'Stop-payload readout summary should not define fixed workflows or fallback chains.',
);
assert.doesNotMatch(
  serializedReadout,
  /productionReady":true|runtimeAuthority|experimental-adapter/u,
  'Stop-payload readout summary should not grant runtime authority.',
);

assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Stop-payload readout summary audit must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  readoutSummarySmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Stop-payload readout summary audit should not call production v2 modules.',
);

assert.match(preflightAuditText, /Stop-Payload Readout Summary Audit Status/u);
assert.match(
  preflightAuditText,
  /agent-session-v3-runtime-boundary-stop-payload-readout-summary-audit-smoke\.ts/u,
);
assert.match(preflightAuditText, /runner-derived existing metadata/u);
assert.match(preflightAuditText, /phase-port partial or future payload/u);
assert.match(preflightAuditText, /future production adapters/u);
assert.match(preflightAuditText, /future controller policy/u);
assert.match(preflightAuditText, /not production wiring/u);
assert.match(statusText, /V3 runtime boundary stop-payload readout summary audit.*Completed/u);
assert.match(
  statusText,
  /agent-session-v3-runtime-boundary-stop-payload-readout-summary-audit-smoke\.ts/u,
);

console.log('agent session v3 runtime boundary stop-payload readout summary audit smoke ok');
