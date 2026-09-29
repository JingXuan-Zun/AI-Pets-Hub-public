import assert from 'node:assert/strict';
import {
  createAgentSessionV3RuntimeBoundaryContract,
  getAgentSessionV3RuntimeStopEvidenceFields,
  type AgentSessionV3RuntimeBoundaryStopReason,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

type AdapterPayloadFamily =
  | 'blocked'
  | 'failure'
  | 'success'
  | 'waiting';

type DeferredContractDecision =
  | 'deferred'
  | 'not-applicable';

type EvidenceCriterion =
  | 'current-phase-port-result-has-structured-payload'
  | 'failure-kind-exists-in-phase-port-result-union'
  | 'future-production-adapter-emits-owned-fields'
  | 'real-or-production-like-traces-cover-field'
  | 'user-visible-semantics-defined';

type SourceReadiness =
  | 'missing'
  | 'partial'
  | 'policy-blocked';

type BacklogOwner =
  | 'future-controller-policy-fields'
  | 'future-production-adapter-evidence'
  | 'phase-port-payload-shape'
  | 'real-or-production-like-trace-evidence';

interface EvidenceCriteriaConsistencyRow {
  backlogOwners: readonly BacklogOwner[];
  criteria: readonly EvidenceCriterion[];
  decision: DeferredContractDecision;
  family: AdapterPayloadFamily;
  productionReady: false;
  readiness: readonly SourceReadiness[];
  reason: AgentSessionV3RuntimeBoundaryStopReason;
  staysEvidenceOnly: true;
}

const adapterPayloadEvidenceCriteriaConsistencyRows = [
  {
    backlogOwners: [],
    criteria: [],
    decision: 'not-applicable',
    family: 'success',
    productionReady: false,
    readiness: [],
    reason: 'continue-with-event',
    staysEvidenceOnly: true,
  },
  {
    backlogOwners: [
      'future-controller-policy-fields',
      'phase-port-payload-shape',
      'real-or-production-like-trace-evidence',
    ],
    criteria: [
      'current-phase-port-result-has-structured-payload',
      'user-visible-semantics-defined',
      'real-or-production-like-traces-cover-field',
    ],
    decision: 'deferred',
    family: 'waiting',
    productionReady: false,
    readiness: [
      'missing',
      'partial',
      'policy-blocked',
    ],
    reason: 'waiting-for-phase-event',
    staysEvidenceOnly: true,
  },
  {
    backlogOwners: [
      'future-controller-policy-fields',
      'future-production-adapter-evidence',
      'real-or-production-like-trace-evidence',
    ],
    criteria: [
      'future-production-adapter-emits-owned-fields',
      'real-or-production-like-traces-cover-field',
      'user-visible-semantics-defined',
    ],
    decision: 'deferred',
    family: 'blocked',
    productionReady: false,
    readiness: [
      'missing',
      'policy-blocked',
    ],
    reason: 'blocked-by-phase',
    staysEvidenceOnly: true,
  },
  {
    backlogOwners: [
      'future-production-adapter-evidence',
      'phase-port-payload-shape',
      'real-or-production-like-trace-evidence',
    ],
    criteria: [
      'failure-kind-exists-in-phase-port-result-union',
      'future-production-adapter-emits-owned-fields',
      'real-or-production-like-traces-cover-field',
      'user-visible-semantics-defined',
    ],
    decision: 'deferred',
    family: 'failure',
    productionReady: false,
    readiness: ['missing'],
    reason: 'runtime-failed',
    staysEvidenceOnly: true,
  },
] as const satisfies readonly EvidenceCriteriaConsistencyRow[];

const excludedReasons = [
  'cancelled',
  'invalid-transition',
  'transition-budget-exhausted',
] as const satisfies readonly AgentSessionV3RuntimeBoundaryStopReason[];

function rowForFamily(family: AdapterPayloadFamily) {
  return adapterPayloadEvidenceCriteriaConsistencyRows.find((row) => row.family === family);
}

function fieldNames(reason: AgentSessionV3RuntimeBoundaryStopReason) {
  return getAgentSessionV3RuntimeStopEvidenceFields(reason).map((field) => field.name).sort();
}

const {
  boundarySource,
  deferredRationaleSmokeSource,
  evidenceCriteriaConsistencySmokeSource,
  formalGateSmokeSource,
  preflightAuditText,
  promotionBacklogSmokeSource,
  sourceReadinessMatrixSmokeSource,
  statusText,
} = readProjectSources({
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  deferredRationaleSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-payload-deferred-contract-rationale-checkpoint-smoke.ts',
  evidenceCriteriaConsistencySmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-payload-evidence-criteria-consistency-checkpoint-smoke.ts',
  formalGateSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-payload-formal-contract-gate-checkpoint-smoke.ts',
  preflightAuditText: 'PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md',
  promotionBacklogSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-payload-promotion-blocker-backlog-checkpoint-smoke.ts',
  sourceReadinessMatrixSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-payload-source-readiness-matrix-checkpoint-smoke.ts',
  statusText: 'PROJECT_AGENT_V2_STATUS.md',
});

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');

assert.deepEqual(
  adapterPayloadEvidenceCriteriaConsistencyRows.map((row) => row.family).sort(),
  ['blocked', 'failure', 'success', 'waiting'],
  'Evidence-criteria consistency should cover every adapter-payload family exactly once.',
);
assert.deepEqual(rowForFamily('success')?.decision, 'not-applicable');
assert.deepEqual(
  adapterPayloadEvidenceCriteriaConsistencyRows
    .filter((row) => row.decision === 'deferred')
    .map((row) => row.family)
    .sort(),
  ['blocked', 'failure', 'waiting'],
);

for (const row of adapterPayloadEvidenceCriteriaConsistencyRows) {
  assert.equal(row.productionReady, false);
  assert.equal(row.staysEvidenceOnly, true);

  if (row.decision === 'not-applicable') {
    assert.deepEqual(row.criteria, []);
    assert.deepEqual(row.backlogOwners, []);
    assert.deepEqual(row.readiness, []);
    assert.equal(getAgentSessionV3RuntimeStopEvidenceFields(row.reason).length, 0);
  }

  if (row.decision === 'deferred') {
    assert.ok(row.criteria.includes('real-or-production-like-traces-cover-field'));
    assert.ok(row.backlogOwners.includes('real-or-production-like-trace-evidence'));
    assert.ok(row.readiness.includes('missing') || row.readiness.includes('partial'));
  }
}

assert.deepEqual(rowForFamily('waiting')?.criteria, [
  'current-phase-port-result-has-structured-payload',
  'user-visible-semantics-defined',
  'real-or-production-like-traces-cover-field',
]);
assert.deepEqual(rowForFamily('waiting')?.readiness, [
  'missing',
  'partial',
  'policy-blocked',
]);
assert.deepEqual(rowForFamily('waiting')?.backlogOwners, [
  'future-controller-policy-fields',
  'phase-port-payload-shape',
  'real-or-production-like-trace-evidence',
]);

assert.deepEqual(rowForFamily('blocked')?.criteria, [
  'future-production-adapter-emits-owned-fields',
  'real-or-production-like-traces-cover-field',
  'user-visible-semantics-defined',
]);
assert.deepEqual(rowForFamily('blocked')?.backlogOwners, [
  'future-controller-policy-fields',
  'future-production-adapter-evidence',
  'real-or-production-like-trace-evidence',
]);

assert.deepEqual(rowForFamily('failure')?.criteria, [
  'failure-kind-exists-in-phase-port-result-union',
  'future-production-adapter-emits-owned-fields',
  'real-or-production-like-traces-cover-field',
  'user-visible-semantics-defined',
]);
assert.deepEqual(rowForFamily('failure')?.backlogOwners, [
  'future-production-adapter-evidence',
  'phase-port-payload-shape',
  'real-or-production-like-trace-evidence',
]);

assert.deepEqual(fieldNames('waiting-for-phase-event'), [
  'pauseReason',
  'resumeTriggerOwner',
  'waitBudget',
  'waitSource',
]);
assert.deepEqual(fieldNames('blocked-by-phase'), [
  'blockerSource',
  'recoverability',
  'terminalStatusCandidate',
  'userActionRequired',
]);
assert.deepEqual(fieldNames('runtime-failed'), [
  'errorClass',
  'failureOrigin',
  'retryability',
  'sideEffectCommitted',
  'userVisibleFailureReason',
]);

for (const excludedReason of excludedReasons) {
  assert.equal(
    adapterPayloadEvidenceCriteriaConsistencyRows.some((row) => row.reason === excludedReason),
    false,
    `${excludedReason} should stay outside adapter-payload evidence-criteria consistency.`,
  );
}

assert.match(deferredRationaleSmokeSource, /staysOutsideImplementationQueue: true/u);
assert.match(deferredRationaleSmokeSource, /real-or-production-like-traces-cover-field/u);
assert.match(formalGateSmokeSource, /defer-formal-contract/u);
assert.match(formalGateSmokeSource, /not-applicable-no-stop-payload/u);
assert.match(sourceReadinessMatrixSmokeSource, /readiness: 'policy-blocked'/u);
assert.match(sourceReadinessMatrixSmokeSource, /readiness: 'partial'/u);
assert.match(promotionBacklogSmokeSource, /doesNotDefineRequiredOrder: true/u);
assert.match(promotionBacklogSmokeSource, /real-or-production-like-trace-evidence/u);

const serializedConsistency = JSON.stringify(adapterPayloadEvidenceCriteriaConsistencyRows);
assert.doesNotMatch(
  serializedConsistency,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Evidence-criteria consistency should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedConsistency,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Evidence-criteria consistency should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedConsistency,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain/u,
  'Evidence-criteria consistency should not define fixed workflows or fallback chains.',
);
assert.doesNotMatch(
  serializedConsistency,
  /implementationQueue|orderedSteps|runtimeAuthority|productionReady":true|experimental-adapter/u,
  'Evidence-criteria consistency should not become an implementation queue or runtime authority.',
);

assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Adapter|PhasePort).*(Payload|Contract)|type AgentSessionV3Runtime(Adapter|PhasePort).*Payload/u,
  'Evidence-criteria consistency should not add formal adapter payload types to the production boundary.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Evidence-criteria consistency must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  evidenceCriteriaConsistencySmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Evidence-criteria consistency should not call production v2 modules.',
);

assert.match(preflightAuditText, /Adapter-Payload Evidence-Criteria Consistency Checkpoint Status/u);
assert.match(
  preflightAuditText,
  /agent-session-v3-runtime-boundary-adapter-payload-evidence-criteria-consistency-checkpoint-smoke\.ts/u,
);
assert.match(preflightAuditText, /criteria stay evidence-only/u);
assert.match(preflightAuditText, /not production wiring/u);
assert.match(statusText, /V3 runtime boundary adapter-payload evidence-criteria consistency checkpoint.*Completed/u);
assert.match(
  statusText,
  /agent-session-v3-runtime-boundary-adapter-payload-evidence-criteria-consistency-checkpoint-smoke\.ts/u,
);

console.log('agent session v3 runtime boundary adapter-payload evidence-criteria consistency checkpoint smoke ok');
