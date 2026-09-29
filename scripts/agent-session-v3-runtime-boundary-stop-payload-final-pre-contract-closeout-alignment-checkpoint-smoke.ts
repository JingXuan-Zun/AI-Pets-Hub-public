import assert from 'node:assert/strict';
import {
  AGENT_SESSION_V3_RUNTIME_STOP_EVIDENCE_CONTRACT,
  createAgentSessionV3RuntimeBoundaryContract,
  type AgentSessionV3RuntimeBoundaryStopReason,
  type AgentSessionV3RuntimeStopEvidenceSource,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

type StopPayloadFinalCloseoutInput =
  | 'controller-policy-pre-contract-closeout'
  | 'payload-closeout-final-preflight-gate'
  | 'phase-port-payload-pre-contract-closeout'
  | 'production-adapter-evidence-pre-contract-closeout'
  | 'stop-payload-audit-rollup';

type StopPayloadFinalCloseoutDecision =
  | 'existing-runner-derived-contract-only'
  | 'keep-smoke-only';

type StopPayloadFinalCloseoutBlocker =
  | 'missing-real-or-production-like-traces'
  | 'requires-controller-policy-contract'
  | 'requires-formal-payload-contract'
  | 'requires-future-phase-port-or-adapter-evidence'
  | 'runner-derived-contract-already-scoped';

interface StopPayloadFinalPreContractCloseoutAlignmentRow {
  blockers: readonly StopPayloadFinalCloseoutBlocker[];
  decision: StopPayloadFinalCloseoutDecision;
  fieldKey: string;
  fieldName: string;
  formalPayloadContractReady: boolean;
  inputs: readonly StopPayloadFinalCloseoutInput[];
  productionReady: false;
  reason: AgentSessionV3RuntimeBoundaryStopReason;
  source: AgentSessionV3RuntimeStopEvidenceSource;
}

interface StopPayloadFinalPreContractCloseoutAlignmentCheckpoint {
  formalPayloadContractPromotionAllowed: false;
  gate: 'stop-payload-final-pre-contract-closeout-alignment';
  productionReady: false;
  rows: readonly StopPayloadFinalPreContractCloseoutAlignmentRow[];
}

function createFieldKey(reason: AgentSessionV3RuntimeBoundaryStopReason, fieldName: string) {
  return `${reason}.${fieldName}`;
}

function classifyInputs(source: AgentSessionV3RuntimeStopEvidenceSource): readonly StopPayloadFinalCloseoutInput[] {
  if (source === 'phase-port-result') {
    return [
      'stop-payload-audit-rollup',
      'phase-port-payload-pre-contract-closeout',
      'payload-closeout-final-preflight-gate',
    ];
  }

  if (source === 'future-production-adapter') {
    return [
      'stop-payload-audit-rollup',
      'production-adapter-evidence-pre-contract-closeout',
      'payload-closeout-final-preflight-gate',
    ];
  }

  if (source === 'future-controller-policy') {
    return [
      'stop-payload-audit-rollup',
      'controller-policy-pre-contract-closeout',
      'payload-closeout-final-preflight-gate',
    ];
  }

  return [
    'stop-payload-audit-rollup',
  ];
}

function classifyDecision(source: AgentSessionV3RuntimeStopEvidenceSource): StopPayloadFinalCloseoutDecision {
  if (source === 'pilot-runner-state') {
    return 'existing-runner-derived-contract-only';
  }

  return 'keep-smoke-only';
}

function classifyBlockers(source: AgentSessionV3RuntimeStopEvidenceSource): readonly StopPayloadFinalCloseoutBlocker[] {
  if (source === 'pilot-runner-state') {
    return [
      'runner-derived-contract-already-scoped',
    ];
  }

  const blockers: StopPayloadFinalCloseoutBlocker[] = [
    'requires-formal-payload-contract',
    'requires-future-phase-port-or-adapter-evidence',
    'missing-real-or-production-like-traces',
  ];

  if (source === 'future-controller-policy') {
    blockers.splice(1, 0, 'requires-controller-policy-contract');
  }

  return blockers;
}

const stopPayloadFinalPreContractCloseoutAlignmentCheckpoint = {
  formalPayloadContractPromotionAllowed: false,
  gate: 'stop-payload-final-pre-contract-closeout-alignment',
  productionReady: false,
  rows: Object.entries(AGENT_SESSION_V3_RUNTIME_STOP_EVIDENCE_CONTRACT)
    .flatMap(([reason, fields]) => (fields ?? []).map((field) => {
      const typedReason = reason as AgentSessionV3RuntimeBoundaryStopReason;
      const fieldKey = createFieldKey(typedReason, field.name);
      const decision = classifyDecision(field.source);

      return {
        blockers: classifyBlockers(field.source),
        decision,
        fieldKey,
        fieldName: field.name,
        formalPayloadContractReady: decision === 'existing-runner-derived-contract-only',
        inputs: classifyInputs(field.source),
        productionReady: false,
        reason: typedReason,
        source: field.source,
      };
    })),
} as const satisfies StopPayloadFinalPreContractCloseoutAlignmentCheckpoint;

function fieldKeysByDecision(decision: StopPayloadFinalCloseoutDecision) {
  return stopPayloadFinalPreContractCloseoutAlignmentCheckpoint.rows
    .filter((row) => row.decision === decision)
    .map((row) => row.fieldKey)
    .sort();
}

function fieldKeysBySource(source: AgentSessionV3RuntimeStopEvidenceSource) {
  return stopPayloadFinalPreContractCloseoutAlignmentCheckpoint.rows
    .filter((row) => row.source === source)
    .map((row) => row.fieldKey)
    .sort();
}

const {
  boundarySource,
  finalCloseoutSmokeSource,
  stopPayloadRollupSmokeSource,
  phasePortPayloadCloseoutSmokeSource,
  productionAdapterEvidenceCloseoutSmokeSource,
  controllerPolicyCloseoutSmokeSource,
  payloadFinalGateSmokeSource,
  runnerDerivedContractSmokeSource,
  preflightAuditText,
  statusText,
} = readProjectSources({
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  finalCloseoutSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-stop-payload-final-pre-contract-closeout-alignment-checkpoint-smoke.ts',
  stopPayloadRollupSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-stop-payload-audit-rollup-checkpoint-smoke.ts',
  phasePortPayloadCloseoutSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-phase-port-payload-pre-contract-closeout-checkpoint-smoke.ts',
  productionAdapterEvidenceCloseoutSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-production-adapter-evidence-pre-contract-closeout-checkpoint-smoke.ts',
  controllerPolicyCloseoutSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-controller-policy-pre-contract-closeout-checkpoint-smoke.ts',
  payloadFinalGateSmokeSource: 'scripts/agent-session-v3-runtime-boundary-payload-closeout-final-preflight-gate-smoke.ts',
  runnerDerivedContractSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-runner-derived-stop-metadata-contract-smoke.ts',
  preflightAuditText: 'PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md',
  statusText: 'PROJECT_AGENT_V2_STATUS.md',
});

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');
assert.equal(stopPayloadFinalPreContractCloseoutAlignmentCheckpoint.formalPayloadContractPromotionAllowed, false);
assert.equal(stopPayloadFinalPreContractCloseoutAlignmentCheckpoint.productionReady, false);

const contractFieldRows = Object.entries(AGENT_SESSION_V3_RUNTIME_STOP_EVIDENCE_CONTRACT)
  .flatMap(([reason, fields]) => (fields ?? []).map((field) => ({
    fieldKey: createFieldKey(reason as AgentSessionV3RuntimeBoundaryStopReason, field.name),
    fieldName: field.name,
    reason: reason as AgentSessionV3RuntimeBoundaryStopReason,
    source: field.source,
  })));

assert.deepEqual(
  stopPayloadFinalPreContractCloseoutAlignmentCheckpoint.rows.map((row) => row.fieldKey).sort(),
  contractFieldRows.map((row) => row.fieldKey).sort(),
  'Stop-payload final closeout alignment should cover every stop evidence contract field exactly once.',
);

for (const row of stopPayloadFinalPreContractCloseoutAlignmentCheckpoint.rows) {
  const contractField = contractFieldRows.find((field) => field.fieldKey === row.fieldKey);

  assert.ok(contractField, `${row.fieldKey} should exist in the stop evidence contract.`);
  assert.equal(row.fieldName, contractField.fieldName);
  assert.equal(row.reason, contractField.reason);
  assert.equal(row.source, contractField.source);
  assert.equal(row.productionReady, false);
  assert.ok(row.inputs.includes('stop-payload-audit-rollup'));

  if (row.source === 'pilot-runner-state') {
    assert.equal(row.decision, 'existing-runner-derived-contract-only');
    assert.equal(row.formalPayloadContractReady, true);
    assert.deepEqual(row.inputs, ['stop-payload-audit-rollup']);
    assert.deepEqual(row.blockers, ['runner-derived-contract-already-scoped']);
  } else {
    assert.equal(row.decision, 'keep-smoke-only');
    assert.equal(row.formalPayloadContractReady, false);
    assert.ok(row.inputs.includes('payload-closeout-final-preflight-gate'));
    assert.ok(row.blockers.includes('requires-formal-payload-contract'));
    assert.ok(row.blockers.includes('requires-future-phase-port-or-adapter-evidence'));
    assert.ok(row.blockers.includes('missing-real-or-production-like-traces'));
  }

  if (row.source === 'phase-port-result') {
    assert.ok(row.inputs.includes('phase-port-payload-pre-contract-closeout'));
  }

  if (row.source === 'future-production-adapter') {
    assert.ok(row.inputs.includes('production-adapter-evidence-pre-contract-closeout'));
  }

  if (row.source === 'future-controller-policy') {
    assert.ok(row.inputs.includes('controller-policy-pre-contract-closeout'));
    assert.ok(row.blockers.includes('requires-controller-policy-contract'));
  }
}

assert.deepEqual(
  fieldKeysByDecision('existing-runner-derived-contract-only'),
  [
    'invalid-transition.eventType',
    'invalid-transition.phase',
    'transition-budget-exhausted.recoveryCount',
    'transition-budget-exhausted.transitionCount',
  ],
);
assert.deepEqual(
  fieldKeysBySource('phase-port-result'),
  [
    'waiting-for-phase-event.pauseReason',
    'waiting-for-phase-event.waitSource',
  ],
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
assert.ok(
  fieldKeysByDecision('keep-smoke-only').length > fieldKeysByDecision('existing-runner-derived-contract-only').length,
  'Most stop-payload fields should remain smoke-only after final closeout alignment.',
);

assert.match(stopPayloadRollupSmokeSource, /Only runner-derived fields should have an existing formal metadata contract/u);
assert.match(phasePortPayloadCloseoutSmokeSource, /phase-port payload side is internally covered but still pre-contract only/u);
assert.match(productionAdapterEvidenceCloseoutSmokeSource, /adapter contracts remain deferred/u);
assert.match(controllerPolicyCloseoutSmokeSource, /Controller-policy pre-contract closeout must not allow policy-contract promotion/u);
assert.match(payloadFinalGateSmokeSource, /payload-contract promotion is not allowed now/u);
assert.match(runnerDerivedContractSmokeSource, /promotedReasons/u);
assert.match(runnerDerivedContractSmokeSource, /invalid-transition/u);
assert.match(runnerDerivedContractSmokeSource, /transition-budget-exhausted/u);
assert.match(runnerDerivedContractSmokeSource, /Runner-derived stop metadata contract should not promote adapter, phase-port, or controller-owned fields/u);

const serializedCloseout = JSON.stringify(stopPayloadFinalPreContractCloseoutAlignmentCheckpoint);
assert.doesNotMatch(
  serializedCloseout,
  /formalPayloadContractPromotionAllowed":true|productionReady":true/u,
  'Stop-payload final closeout alignment must not allow broad payload-contract promotion.',
);
assert.doesNotMatch(
  serializedCloseout,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Stop-payload final closeout alignment should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedCloseout,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Stop-payload final closeout alignment should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedCloseout,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain/iu,
  'Stop-payload final closeout alignment should not define fixed workflows or fallback chains.',
);
assert.doesNotMatch(
  serializedCloseout,
  /implementationQueue|orderedSteps|runtimeAuthority|experimental-adapter/u,
  'Stop-payload final closeout alignment should remain a pre-contract audit checkpoint.',
);

assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(PhasePort|Adapter).*(Payload|Contract)|type AgentSessionV3Runtime(PhasePort|Adapter).*Payload/u,
  'Stop-payload final closeout alignment should not add formal phase-port or adapter payload types.',
);
assert.doesNotMatch(
  boundarySource,
  /kind:\s*'failure'/u,
  'Stop-payload final closeout alignment should not add a phase-port failure result kind.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Stop-payload final closeout alignment must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  finalCloseoutSmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Stop-payload final closeout alignment should not call production v2 modules.',
);

assert.match(preflightAuditText, /Stop-Payload Final Pre-Contract Closeout Alignment Checkpoint Status/u);
assert.match(
  preflightAuditText,
  /agent-session-v3-runtime-boundary-stop-payload-final-pre-contract-closeout-alignment-checkpoint-smoke\.ts/u,
);
assert.match(preflightAuditText, /broad stop-payload contract promotion remains blocked/u);
assert.match(preflightAuditText, /not production wiring/u);
assert.match(statusText, /V3 runtime boundary stop-payload final pre-contract closeout alignment checkpoint.*Completed/u);
assert.match(
  statusText,
  /agent-session-v3-runtime-boundary-stop-payload-final-pre-contract-closeout-alignment-checkpoint-smoke\.ts/u,
);

console.log('agent session v3 runtime boundary stop-payload final pre-contract closeout alignment checkpoint smoke ok');
