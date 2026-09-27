import assert from 'node:assert/strict';
import {
  AGENT_SESSION_V3_RUNTIME_STOP_EVIDENCE_CONTRACT,
  createAgentSessionV3RuntimeBoundaryContract,
  getAgentSessionV3RuntimeStopEvidenceFields,
  type AgentSessionV3RuntimeBoundaryStopReason,
  type AgentSessionV3RuntimePhasePortResultKind,
  type AgentSessionV3RuntimeStopEvidenceSource,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

type AdapterPayloadFamily =
  | 'blocked'
  | 'failure'
  | 'success'
  | 'waiting';

type AdapterPayloadFamilySupport =
  | 'current-phase-port-result'
  | 'future-stop-payload-only';

type AdapterPayloadFamilyReadiness =
  | 'descriptive-only-no-stop-payload'
  | 'missing-future-production-adapter'
  | 'not-supported-by-current-phase-port'
  | 'phase-port-payload-too-shallow';

type AdapterPayloadFamilyContractDecision =
  | 'keep-smoke-only';

type AdapterPayloadFamilyBlocker =
  | 'current-phase-port-union-has-no-failure-kind'
  | 'no-stop-payload-fields'
  | 'requires-future-production-adapter'
  | 'requires-future-structured-phase-payload'
  | 'requires-real-production-like-traces';

interface AdapterPayloadFamilyRollupRow {
  adapterMayPopulateFields: readonly string[];
  blockers: readonly AdapterPayloadFamilyBlocker[];
  controllerOwnedFields: readonly string[];
  currentPortResultKind: AgentSessionV3RuntimePhasePortResultKind | 'not-supported-yet';
  describesOnlyEvidence: true;
  doesNotDefineRequiredOrder: true;
  family: AdapterPayloadFamily;
  readiness: AdapterPayloadFamilyReadiness;
  runnerDerivedFields: readonly string[];
  contractDecision: AdapterPayloadFamilyContractDecision;
  productionReady: false;
  stopReason: AgentSessionV3RuntimeBoundaryStopReason;
  support: AdapterPayloadFamilySupport;
}

const adapterPayloadFamilyRollupCheckpoint = [
  {
    adapterMayPopulateFields: [
      'confidence',
      'eventType',
      'evidenceNotes',
      'phaseSummary',
      'sideEffectScopesUsed',
    ],
    blockers: ['no-stop-payload-fields'],
    controllerOwnedFields: [],
    currentPortResultKind: 'event',
    describesOnlyEvidence: true,
    doesNotDefineRequiredOrder: true,
    family: 'success',
    readiness: 'descriptive-only-no-stop-payload',
    runnerDerivedFields: [],
    contractDecision: 'keep-smoke-only',
    productionReady: false,
    stopReason: 'continue-with-event',
    support: 'current-phase-port-result',
  },
  {
    adapterMayPopulateFields: [
      'pauseReason',
      'waitSource',
    ],
    blockers: [
      'requires-future-structured-phase-payload',
      'requires-real-production-like-traces',
    ],
    controllerOwnedFields: [
      'resumeTriggerOwner',
      'waitBudget',
    ],
    currentPortResultKind: 'waiting',
    describesOnlyEvidence: true,
    doesNotDefineRequiredOrder: true,
    family: 'waiting',
    readiness: 'phase-port-payload-too-shallow',
    runnerDerivedFields: [],
    contractDecision: 'keep-smoke-only',
    productionReady: false,
    stopReason: 'waiting-for-phase-event',
    support: 'current-phase-port-result',
  },
  {
    adapterMayPopulateFields: [
      'blockerSource',
      'recoverability',
      'userActionRequired',
    ],
    blockers: [
      'requires-future-production-adapter',
      'requires-real-production-like-traces',
    ],
    controllerOwnedFields: [
      'terminalStatusCandidate',
    ],
    currentPortResultKind: 'blocked',
    describesOnlyEvidence: true,
    doesNotDefineRequiredOrder: true,
    family: 'blocked',
    readiness: 'missing-future-production-adapter',
    runnerDerivedFields: [],
    contractDecision: 'keep-smoke-only',
    productionReady: false,
    stopReason: 'blocked-by-phase',
    support: 'current-phase-port-result',
  },
  {
    adapterMayPopulateFields: [
      'errorClass',
      'failureOrigin',
      'retryability',
      'sideEffectCommitted',
      'userVisibleFailureReason',
    ],
    blockers: [
      'current-phase-port-union-has-no-failure-kind',
      'requires-future-production-adapter',
      'requires-real-production-like-traces',
    ],
    controllerOwnedFields: [],
    currentPortResultKind: 'not-supported-yet',
    describesOnlyEvidence: true,
    doesNotDefineRequiredOrder: true,
    family: 'failure',
    readiness: 'not-supported-by-current-phase-port',
    runnerDerivedFields: [],
    contractDecision: 'keep-smoke-only',
    productionReady: false,
    stopReason: 'runtime-failed',
    support: 'future-stop-payload-only',
  },
] as const satisfies readonly AdapterPayloadFamilyRollupRow[];

const reasonsExcludedFromAdapterPayloadFamilies = [
  'cancelled',
  'invalid-transition',
  'transition-budget-exhausted',
] as const satisfies readonly AgentSessionV3RuntimeBoundaryStopReason[];

function createFieldKey(reason: AgentSessionV3RuntimeBoundaryStopReason, fieldName: string) {
  return `${reason}.${fieldName}`;
}

function assertFieldSources(options: {
  expectedSources: readonly AgentSessionV3RuntimeStopEvidenceSource[];
  fieldNames: readonly string[];
  reason: AgentSessionV3RuntimeBoundaryStopReason;
}) {
  const contractFields = new Map(
    getAgentSessionV3RuntimeStopEvidenceFields(options.reason).map((field) => [field.name, field]),
  );

  for (const fieldName of options.fieldNames) {
    const field = contractFields.get(fieldName);
    assert.ok(field, `${options.reason}.${fieldName} should exist in the stop evidence contract.`);
    assert.ok(
      options.expectedSources.includes(field.source),
      `${options.reason}.${fieldName} should come from ${options.expectedSources.join(' or ')}, got ${field.source}.`,
    );
  }
}

function stopPayloadReadiness(fieldKey: string, source: AgentSessionV3RuntimeStopEvidenceSource) {
  if (source === 'pilot-runner-state') {
    return 'available-now';
  }

  if (fieldKey === 'waiting-for-phase-event.pauseReason') {
    return 'partial-now';
  }

  return 'missing';
}

const {
  adapterPayloadShapeSmokeSource,
  blockedPayloadPromotionReadinessSmokeSource,
  boundarySource,
  failurePayloadPromotionReadinessSmokeSource,
  familyRollupSmokeSource,
  phasePortPayloadReadinessSmokeSource,
  preflightAuditText,
  statusText,
  stopPayloadRollupCheckpointSmokeSource,
} = readProjectSources({
  adapterPayloadShapeSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-payload-shape-pre-contract-smoke.ts',
  blockedPayloadPromotionReadinessSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-blocked-payload-promotion-readiness-smoke.ts',
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  failurePayloadPromotionReadinessSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-failure-payload-promotion-readiness-smoke.ts',
  familyRollupSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-payload-family-rollup-checkpoint-smoke.ts',
  phasePortPayloadReadinessSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-phase-port-payload-contract-readiness-rollup-smoke.ts',
  preflightAuditText: 'PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md',
  statusText: 'PROJECT_AGENT_V2_STATUS.md',
  stopPayloadRollupCheckpointSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-stop-payload-audit-rollup-checkpoint-smoke.ts',
});

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');

assert.deepEqual(
  adapterPayloadFamilyRollupCheckpoint.map((row) => row.family).sort(),
  ['blocked', 'failure', 'success', 'waiting'],
  'Adapter-payload family rollup should cover success, waiting, blocked, and failure exactly once.',
);

for (const row of adapterPayloadFamilyRollupCheckpoint) {
  assert.equal(row.productionReady, false);
  assert.equal(row.contractDecision, 'keep-smoke-only');
  assert.equal(row.describesOnlyEvidence, true);
  assert.equal(row.doesNotDefineRequiredOrder, true);

  const adapterFields = new Set(row.adapterMayPopulateFields);
  for (const controllerField of row.controllerOwnedFields) {
    assert.equal(
      adapterFields.has(controllerField),
      false,
      `${row.family} should keep controller-owned field ${controllerField} out of adapter payload ownership.`,
    );
  }

  if (row.stopReason === 'continue-with-event') {
    assert.deepEqual(getAgentSessionV3RuntimeStopEvidenceFields(row.stopReason), []);
    assert.equal(row.currentPortResultKind, 'event');
    assert.equal(row.support, 'current-phase-port-result');
    assert.equal(row.readiness, 'descriptive-only-no-stop-payload');
    assert.ok(row.blockers.includes('no-stop-payload-fields'));
    continue;
  }

  assertFieldSources({
    expectedSources: ['phase-port-result', 'future-production-adapter'],
    fieldNames: row.adapterMayPopulateFields,
    reason: row.stopReason,
  });
  assertFieldSources({
    expectedSources: ['future-controller-policy'],
    fieldNames: row.controllerOwnedFields,
    reason: row.stopReason,
  });
  assertFieldSources({
    expectedSources: ['pilot-runner-state'],
    fieldNames: row.runnerDerivedFields,
    reason: row.stopReason,
  });
}

const stopPayloadFieldRows = Object.entries(AGENT_SESSION_V3_RUNTIME_STOP_EVIDENCE_CONTRACT)
  .flatMap(([reason, fields]) => (fields ?? []).map((field) => {
    const typedReason = reason as AgentSessionV3RuntimeBoundaryStopReason;

    return {
      fieldKey: createFieldKey(typedReason, field.name),
      reason: typedReason,
      source: field.source,
      readiness: stopPayloadReadiness(createFieldKey(typedReason, field.name), field.source),
    };
  }));

assert.deepEqual(
  stopPayloadFieldRows
    .filter((row) => row.readiness === 'available-now')
    .map((row) => row.fieldKey)
    .sort(),
  [
    'invalid-transition.eventType',
    'invalid-transition.phase',
    'transition-budget-exhausted.recoveryCount',
    'transition-budget-exhausted.transitionCount',
  ],
  'Only runner-derived stop metadata should be available now.',
);
assert.deepEqual(
  stopPayloadFieldRows
    .filter((row) => row.readiness === 'partial-now')
    .map((row) => row.fieldKey),
  ['waiting-for-phase-event.pauseReason'],
  'Only waiting pauseReason is partially informed by current phase-port diagnostics.',
);

assert.deepEqual(
  getAgentSessionV3RuntimeStopEvidenceFields('waiting-for-phase-event')
    .filter((field) => field.source === 'phase-port-result')
    .map((field) => field.name)
    .sort(),
  ['pauseReason', 'waitSource'],
);
assert.deepEqual(
  getAgentSessionV3RuntimeStopEvidenceFields('blocked-by-phase')
    .filter((field) => field.source === 'future-production-adapter')
    .map((field) => field.name)
    .sort(),
  ['blockerSource', 'recoverability', 'userActionRequired'],
);
assert.deepEqual(
  getAgentSessionV3RuntimeStopEvidenceFields('runtime-failed')
    .filter((field) => field.source === 'future-production-adapter')
    .map((field) => field.name)
    .sort(),
  [
    'errorClass',
    'failureOrigin',
    'retryability',
    'sideEffectCommitted',
    'userVisibleFailureReason',
  ],
);

assert.equal(
  adapterPayloadFamilyRollupCheckpoint.find((row) => row.family === 'failure')?.currentPortResultKind,
  'not-supported-yet',
  'Failure should remain outside the current event/waiting/blocked phase-port result union.',
);
assert.equal(
  adapterPayloadFamilyRollupCheckpoint.find((row) => row.family === 'failure')?.support,
  'future-stop-payload-only',
);
assert.equal(
  adapterPayloadFamilyRollupCheckpoint.some((row) => row.contractDecision !== 'keep-smoke-only'),
  false,
  'No adapter-payload family should be promoted into a formal payload contract yet.',
);

for (const excludedReason of reasonsExcludedFromAdapterPayloadFamilies) {
  assert.equal(
    adapterPayloadFamilyRollupCheckpoint.some((row) => row.stopReason === excludedReason),
    false,
    `${excludedReason} should remain outside the adapter-payload family rollup for now.`,
  );
}

assert.match(adapterPayloadShapeSmokeSource, /success/u);
assert.match(adapterPayloadShapeSmokeSource, /future-stop-payload-only/u);
assert.match(phasePortPayloadReadinessSmokeSource, /too shallow for a formal payload contract/u);
assert.match(stopPayloadRollupCheckpointSmokeSource, /existing-runner-derived-contract-only/u);
assert.match(stopPayloadRollupCheckpointSmokeSource, /keep-smoke-only/u);
assert.match(stopPayloadRollupCheckpointSmokeSource, /future-production-adapter/u);
assert.match(blockedPayloadPromotionReadinessSmokeSource, /No structured blocked payload field is formal-contract-ready/u);
assert.match(failurePayloadPromotionReadinessSmokeSource, /No structured failure payload field is formal-contract-ready/u);

const serializedFamilyRollup = JSON.stringify(adapterPayloadFamilyRollupCheckpoint);
assert.doesNotMatch(
  serializedFamilyRollup,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Adapter-payload family rollup should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedFamilyRollup,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Adapter-payload family rollup should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedFamilyRollup,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain/iu,
  'Adapter-payload family rollup should not define fixed workflows or fallback chains.',
);
assert.doesNotMatch(
  serializedFamilyRollup,
  /productionReady":true|runtimeAuthority|experimental-adapter/u,
  'Adapter-payload family rollup should not grant runtime authority.',
);

assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Adapter-payload family rollup must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  familyRollupSmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Adapter-payload family rollup should not call production v2 modules.',
);

assert.match(preflightAuditText, /Adapter-Payload Family Rollup Checkpoint Status/u);
assert.match(
  preflightAuditText,
  /agent-session-v3-runtime-boundary-adapter-payload-family-rollup-checkpoint-smoke\.ts/u,
);
assert.match(preflightAuditText, /success, waiting, blocked, and failure/u);
assert.match(preflightAuditText, /No adapter-payload family is formal-contract-ready/u);
assert.match(preflightAuditText, /not production wiring/u);
assert.match(statusText, /V3 runtime boundary adapter-payload family rollup checkpoint.*Completed/u);
assert.match(
  statusText,
  /agent-session-v3-runtime-boundary-adapter-payload-family-rollup-checkpoint-smoke\.ts/u,
);

console.log('agent session v3 runtime boundary adapter-payload family rollup checkpoint smoke ok');
