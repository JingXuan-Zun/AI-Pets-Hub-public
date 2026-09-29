import assert from 'node:assert/strict';
import {
  AGENT_SESSION_V3_RUNTIME_BOUNDARY_PHASE_LIMITS,
  createAgentSessionV3RuntimeBoundaryContract,
  getAgentSessionV3RuntimeStopEvidenceFields,
  type AgentSessionV3RuntimeBoundaryStopReason,
  type AgentSessionV3RuntimeDrivenPhase,
  type AgentSessionV3RuntimePhasePortResultKind,
  type AgentSessionV3RuntimeStopEvidenceSource,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

type RuntimeAdapterPayloadKind = 'success' | 'waiting' | 'blocked' | 'failure';
type RuntimeAdapterPayloadSupport = 'current-phase-port-result' | 'future-stop-payload-only';

interface RuntimeAdapterPayloadShapeRow {
  adapterMayPopulateFields: readonly string[];
  controllerOwnedFields: readonly string[];
  currentPortResultKind: AgentSessionV3RuntimePhasePortResultKind | 'not-supported-yet';
  describesOnlyEvidence: true;
  doesNotDefineRequiredOrder: true;
  kind: RuntimeAdapterPayloadKind;
  phaseApplicability: readonly AgentSessionV3RuntimeDrivenPhase[];
  productionReady: false;
  runnerDerivedFields: readonly string[];
  stopReason: AgentSessionV3RuntimeBoundaryStopReason;
  support: RuntimeAdapterPayloadSupport;
}

const allRuntimeDrivenPhases = Object.keys(
  AGENT_SESSION_V3_RUNTIME_BOUNDARY_PHASE_LIMITS,
) as AgentSessionV3RuntimeDrivenPhase[];

const adapterPayloadShapePreContractAudit = [
  {
    adapterMayPopulateFields: [
      'eventType',
      'phaseSummary',
      'sideEffectScopesUsed',
      'confidence',
      'evidenceNotes',
    ],
    controllerOwnedFields: [],
    currentPortResultKind: 'event',
    describesOnlyEvidence: true,
    doesNotDefineRequiredOrder: true,
    kind: 'success',
    phaseApplicability: allRuntimeDrivenPhases,
    productionReady: false,
    runnerDerivedFields: [],
    stopReason: 'continue-with-event',
    support: 'current-phase-port-result',
  },
  {
    adapterMayPopulateFields: [
      'pauseReason',
      'waitSource',
    ],
    controllerOwnedFields: [
      'resumeTriggerOwner',
      'waitBudget',
    ],
    currentPortResultKind: 'waiting',
    describesOnlyEvidence: true,
    doesNotDefineRequiredOrder: true,
    kind: 'waiting',
    phaseApplicability: allRuntimeDrivenPhases,
    productionReady: false,
    runnerDerivedFields: [],
    stopReason: 'waiting-for-phase-event',
    support: 'current-phase-port-result',
  },
  {
    adapterMayPopulateFields: [
      'blockerSource',
      'recoverability',
      'userActionRequired',
    ],
    controllerOwnedFields: [
      'terminalStatusCandidate',
    ],
    currentPortResultKind: 'blocked',
    describesOnlyEvidence: true,
    doesNotDefineRequiredOrder: true,
    kind: 'blocked',
    phaseApplicability: allRuntimeDrivenPhases,
    productionReady: false,
    runnerDerivedFields: [],
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
    controllerOwnedFields: [],
    currentPortResultKind: 'not-supported-yet',
    describesOnlyEvidence: true,
    doesNotDefineRequiredOrder: true,
    kind: 'failure',
    phaseApplicability: allRuntimeDrivenPhases,
    productionReady: false,
    runnerDerivedFields: [],
    stopReason: 'runtime-failed',
    support: 'future-stop-payload-only',
  },
] as const satisfies readonly RuntimeAdapterPayloadShapeRow[];

const stopReasonsExcludedFromAdapterPayloadShape = [
  'cancelled',
  'invalid-transition',
  'transition-budget-exhausted',
] as const satisfies readonly AgentSessionV3RuntimeBoundaryStopReason[];

function assertStopEvidenceFieldsMatchSource(options: {
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

const {
  boundarySource,
  payloadShapeSmokeSource,
  preflightAuditText,
  statusText,
} = readProjectSources({
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  payloadShapeSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-payload-shape-pre-contract-smoke.ts',
  preflightAuditText: 'PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md',
  statusText: 'PROJECT_AGENT_V2_STATUS.md',
});

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');

assert.deepEqual(
  adapterPayloadShapePreContractAudit.map((row) => row.kind).sort(),
  ['blocked', 'failure', 'success', 'waiting'],
  'Payload-shape pre-contract audit should cover the four future adapter result families.',
);

for (const row of adapterPayloadShapePreContractAudit) {
  assert.equal(row.productionReady, false);
  assert.equal(row.describesOnlyEvidence, true);
  assert.equal(row.doesNotDefineRequiredOrder, true);
  assert.deepEqual([...row.phaseApplicability].sort(), [...allRuntimeDrivenPhases].sort());
  assert.ok(row.adapterMayPopulateFields.length >= 2);

  const adapterFields = new Set(row.adapterMayPopulateFields);
  for (const controllerField of row.controllerOwnedFields) {
    assert.equal(
      adapterFields.has(controllerField),
      false,
      `${row.kind} should not let phase adapters populate controller-owned field ${controllerField}.`,
    );
  }

  if (row.stopReason === 'continue-with-event') {
    assert.deepEqual(getAgentSessionV3RuntimeStopEvidenceFields(row.stopReason), []);
    assert.equal(row.currentPortResultKind, 'event');
    assert.equal(row.support, 'current-phase-port-result');
    continue;
  }

  assertStopEvidenceFieldsMatchSource({
    expectedSources: ['future-production-adapter', 'phase-port-result'],
    fieldNames: row.adapterMayPopulateFields,
    reason: row.stopReason,
  });
  assertStopEvidenceFieldsMatchSource({
    expectedSources: ['future-controller-policy'],
    fieldNames: row.controllerOwnedFields,
    reason: row.stopReason,
  });
  assertStopEvidenceFieldsMatchSource({
    expectedSources: ['pilot-runner-state'],
    fieldNames: row.runnerDerivedFields,
    reason: row.stopReason,
  });
}

assert.equal(
  adapterPayloadShapePreContractAudit.find((row) => row.kind === 'failure')?.currentPortResultKind,
  'not-supported-yet',
  'Failure is intentionally not part of the current event/waiting/blocked phase-port result union.',
);
assert.equal(
  adapterPayloadShapePreContractAudit.find((row) => row.kind === 'failure')?.support,
  'future-stop-payload-only',
);
assert.deepEqual(
  adapterPayloadShapePreContractAudit.find((row) => row.kind === 'waiting')?.controllerOwnedFields,
  ['resumeTriggerOwner', 'waitBudget'],
);
assert.deepEqual(
  adapterPayloadShapePreContractAudit.find((row) => row.kind === 'blocked')?.controllerOwnedFields,
  ['terminalStatusCandidate'],
);

for (const excludedReason of stopReasonsExcludedFromAdapterPayloadShape) {
  assert.equal(
    adapterPayloadShapePreContractAudit.some((row) => row.stopReason === excludedReason),
    false,
    `${excludedReason} should remain outside the adapter payload-shape audit for now.`,
  );
}

assert.deepEqual(
  getAgentSessionV3RuntimeStopEvidenceFields('invalid-transition')
    .filter((field) => field.source === 'pilot-runner-state')
    .map((field) => field.name)
    .sort(),
  ['eventType', 'phase'],
  'Invalid-transition evidence is runner-derived and should not be modeled as a phase adapter payload yet.',
);
assert.deepEqual(
  getAgentSessionV3RuntimeStopEvidenceFields('transition-budget-exhausted')
    .filter((field) => field.source === 'pilot-runner-state')
    .map((field) => field.name)
    .sort(),
  ['recoveryCount', 'transitionCount'],
  'Transition-budget evidence still depends on runner/controller stop policy.',
);

assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Payload-shape audit must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  payloadShapeSmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Payload-shape pre-contract audit should not call production v2 modules.',
);

const serializedPayloadShapeAudit = JSON.stringify(adapterPayloadShapePreContractAudit);
assert.doesNotMatch(
  serializedPayloadShapeAudit,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Payload-shape pre-contract audit should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedPayloadShapeAudit,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain|nextTool|nextArgs/iu,
  'Payload-shape pre-contract audit should not define fixed workflows or fallback chains.',
);
assert.doesNotMatch(
  serializedPayloadShapeAudit,
  /productionReady":true|runtimeAuthority|experimental-adapter/u,
  'Payload-shape pre-contract audit should not grant runtime authority.',
);

assert.match(preflightAuditText, /Runtime Adapter Payload-Shape Pre-Contract Audit Status/u);
assert.match(preflightAuditText, /agent-session-v3-runtime-boundary-adapter-payload-shape-pre-contract-smoke\.ts/u);
assert.match(preflightAuditText, /- success;/u);
assert.match(preflightAuditText, /- waiting;/u);
assert.match(preflightAuditText, /- blocked;/u);
assert.match(preflightAuditText, /- failure\./u);
assert.match(preflightAuditText, /future-stop-payload-only/u);
assert.match(preflightAuditText, /not production wiring/u);
assert.match(statusText, /V3 runtime boundary adapter payload-shape pre-contract audit.*Completed/u);
assert.match(statusText, /agent-session-v3-runtime-boundary-adapter-payload-shape-pre-contract-smoke\.ts/u);

console.log('agent session v3 runtime boundary adapter payload-shape pre-contract smoke ok');
