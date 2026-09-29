import assert from 'node:assert/strict';
import {
  createAgentSessionV3RuntimeBoundaryContract,
  getAgentSessionV3RuntimeStopEvidenceFields,
  type AgentSessionV3RuntimeBoundaryStopReason,
  type AgentSessionV3RuntimeStopEvidenceSource,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

type ProductionAdapterContractReadinessFamily =
  | 'blocked'
  | 'failure'
  | 'success'
  | 'waiting';

type ProductionAdapterContractReadinessDecision =
  | 'not-applicable'
  | 'not-production-adapter-owned'
  | 'production-adapter-contract-deferred';

type ProductionAdapterContractReadinessBlocker =
  | 'controller-policy-fields-not-formalized'
  | 'failure-result-kind-missing'
  | 'missing-production-adapter-evidence'
  | 'missing-real-or-production-like-traces'
  | 'no-stop-payload-fields'
  | 'phase-port-owned-fields-not-ready';

interface ProductionAdapterContractReadinessRow {
  adapterContractPromotionAllowed: false;
  blockers: readonly ProductionAdapterContractReadinessBlocker[];
  controllerPolicyFieldsExcluded: readonly string[];
  decision: ProductionAdapterContractReadinessDecision;
  family: ProductionAdapterContractReadinessFamily;
  formalContractReady: false;
  phasePortFieldsExcluded: readonly string[];
  productionAdapterCandidateFields: readonly string[];
  productionReady: false;
  reason: AgentSessionV3RuntimeBoundaryStopReason;
  remainsPreContractAuditOnly: true;
}

interface ProductionAdapterContractReadinessPreflight {
  adapterContractPromotionAllowed: false;
  formalContractReady: false;
  gate: 'production-adapter-contract-readiness-preflight';
  productionReady: false;
  rows: readonly ProductionAdapterContractReadinessRow[];
}

const productionAdapterContractReadinessPreflight = {
  adapterContractPromotionAllowed: false,
  formalContractReady: false,
  gate: 'production-adapter-contract-readiness-preflight',
  productionReady: false,
  rows: [
    {
      adapterContractPromotionAllowed: false,
      blockers: ['no-stop-payload-fields'],
      controllerPolicyFieldsExcluded: [],
      decision: 'not-applicable',
      family: 'success',
      formalContractReady: false,
      phasePortFieldsExcluded: [],
      productionAdapterCandidateFields: [],
      productionReady: false,
      reason: 'continue-with-event',
      remainsPreContractAuditOnly: true,
    },
    {
      adapterContractPromotionAllowed: false,
      blockers: [
        'phase-port-owned-fields-not-ready',
        'controller-policy-fields-not-formalized',
        'missing-real-or-production-like-traces',
      ],
      controllerPolicyFieldsExcluded: [
        'resumeTriggerOwner',
        'waitBudget',
      ],
      decision: 'not-production-adapter-owned',
      family: 'waiting',
      formalContractReady: false,
      phasePortFieldsExcluded: [
        'pauseReason',
        'waitSource',
      ],
      productionAdapterCandidateFields: [],
      productionReady: false,
      reason: 'waiting-for-phase-event',
      remainsPreContractAuditOnly: true,
    },
    {
      adapterContractPromotionAllowed: false,
      blockers: [
        'missing-production-adapter-evidence',
        'controller-policy-fields-not-formalized',
        'missing-real-or-production-like-traces',
      ],
      controllerPolicyFieldsExcluded: ['terminalStatusCandidate'],
      decision: 'production-adapter-contract-deferred',
      family: 'blocked',
      formalContractReady: false,
      phasePortFieldsExcluded: [],
      productionAdapterCandidateFields: [
        'blockerSource',
        'recoverability',
        'userActionRequired',
      ],
      productionReady: false,
      reason: 'blocked-by-phase',
      remainsPreContractAuditOnly: true,
    },
    {
      adapterContractPromotionAllowed: false,
      blockers: [
        'failure-result-kind-missing',
        'missing-production-adapter-evidence',
        'missing-real-or-production-like-traces',
      ],
      controllerPolicyFieldsExcluded: [],
      decision: 'production-adapter-contract-deferred',
      family: 'failure',
      formalContractReady: false,
      phasePortFieldsExcluded: [],
      productionAdapterCandidateFields: [
        'errorClass',
        'failureOrigin',
        'retryability',
        'sideEffectCommitted',
        'userVisibleFailureReason',
      ],
      productionReady: false,
      reason: 'runtime-failed',
      remainsPreContractAuditOnly: true,
    },
  ],
} as const satisfies ProductionAdapterContractReadinessPreflight;

const excludedReasons = [
  'cancelled',
  'invalid-transition',
  'transition-budget-exhausted',
] as const satisfies readonly AgentSessionV3RuntimeBoundaryStopReason[];

function fieldNamesForSource(
  reason: AgentSessionV3RuntimeBoundaryStopReason,
  source: AgentSessionV3RuntimeStopEvidenceSource,
) {
  return getAgentSessionV3RuntimeStopEvidenceFields(reason)
    .filter((field) => field.source === source)
    .map((field) => field.name)
    .sort();
}

function assertFieldsHaveSource(
  reason: AgentSessionV3RuntimeBoundaryStopReason,
  fieldNames: readonly string[],
  source: AgentSessionV3RuntimeStopEvidenceSource,
) {
  const fieldsByName = new Map(getAgentSessionV3RuntimeStopEvidenceFields(reason).map((field) => [field.name, field]));

  for (const fieldName of fieldNames) {
    const field = fieldsByName.get(fieldName);
    assert.ok(field, `${reason}.${fieldName} should exist in the stop evidence contract.`);
    assert.equal(field.source, source);
  }
}

function rowForFamily(family: ProductionAdapterContractReadinessFamily) {
  return productionAdapterContractReadinessPreflight.rows.find((row) => row.family === family);
}

const {
  adapterPreContractSmokeSource,
  boundarySource,
  finalGateSmokeSource,
  formalGateSmokeSource,
  phasePortExpansionReviewSmokeSource,
  preflightAuditText,
  readinessPreflightSmokeSource,
  sourceReadinessMatrixSmokeSource,
  statusText,
} = readProjectSources({
  adapterPreContractSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-pre-contract-smoke.ts',
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  finalGateSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-payload-closeout-final-preflight-gate-smoke.ts',
  formalGateSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-payload-formal-contract-gate-checkpoint-smoke.ts',
  phasePortExpansionReviewSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-phase-port-payload-pre-contract-expansion-review-smoke.ts',
  preflightAuditText: 'PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md',
  readinessPreflightSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-production-adapter-contract-readiness-preflight-smoke.ts',
  sourceReadinessMatrixSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-payload-source-readiness-matrix-checkpoint-smoke.ts',
  statusText: 'PROJECT_AGENT_V2_STATUS.md',
});

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');

assert.equal(productionAdapterContractReadinessPreflight.adapterContractPromotionAllowed, false);
assert.equal(productionAdapterContractReadinessPreflight.formalContractReady, false);
assert.equal(productionAdapterContractReadinessPreflight.productionReady, false);
assert.deepEqual(
  productionAdapterContractReadinessPreflight.rows.map((row) => row.family).sort(),
  ['blocked', 'failure', 'success', 'waiting'],
  'Production-adapter contract readiness preflight should cover the payload final-gate families exactly once.',
);
assert.deepEqual(
  productionAdapterContractReadinessPreflight.rows
    .filter((row) => row.decision === 'production-adapter-contract-deferred')
    .map((row) => row.family)
    .sort(),
  ['blocked', 'failure'],
);
assert.deepEqual(
  productionAdapterContractReadinessPreflight.rows
    .filter((row) => row.decision === 'not-production-adapter-owned')
    .map((row) => row.family),
  ['waiting'],
);
assert.deepEqual(
  productionAdapterContractReadinessPreflight.rows
    .filter((row) => row.decision === 'not-applicable')
    .map((row) => row.family),
  ['success'],
);

for (const row of productionAdapterContractReadinessPreflight.rows) {
  assert.equal(row.adapterContractPromotionAllowed, false);
  assert.equal(row.formalContractReady, false);
  assert.equal(row.productionReady, false);
  assert.equal(row.remainsPreContractAuditOnly, true);

  assertFieldsHaveSource(row.reason, row.productionAdapterCandidateFields, 'future-production-adapter');
  assertFieldsHaveSource(row.reason, row.phasePortFieldsExcluded, 'phase-port-result');
  assertFieldsHaveSource(row.reason, row.controllerPolicyFieldsExcluded, 'future-controller-policy');

  if (row.decision === 'not-applicable') {
    assert.equal(row.reason, 'continue-with-event');
    assert.deepEqual(row.productionAdapterCandidateFields, []);
    assert.deepEqual(row.phasePortFieldsExcluded, []);
    assert.deepEqual(row.controllerPolicyFieldsExcluded, []);
    assert.equal(getAgentSessionV3RuntimeStopEvidenceFields(row.reason).length, 0);
  }

  if (row.decision === 'not-production-adapter-owned') {
    assert.deepEqual(row.productionAdapterCandidateFields, []);
    assert.ok(row.phasePortFieldsExcluded.length > 0);
    assert.ok(row.controllerPolicyFieldsExcluded.length > 0);
  }

  if (row.decision === 'production-adapter-contract-deferred') {
    assert.ok(row.productionAdapterCandidateFields.length > 0);
    assert.ok(row.blockers.includes('missing-production-adapter-evidence'));
    assert.ok(row.blockers.includes('missing-real-or-production-like-traces'));
  }
}

assert.deepEqual(rowForFamily('waiting')?.phasePortFieldsExcluded, [
  'pauseReason',
  'waitSource',
]);
assert.deepEqual(rowForFamily('waiting')?.controllerPolicyFieldsExcluded, [
  'resumeTriggerOwner',
  'waitBudget',
]);
assert.deepEqual(rowForFamily('blocked')?.productionAdapterCandidateFields, [
  'blockerSource',
  'recoverability',
  'userActionRequired',
]);
assert.deepEqual(rowForFamily('blocked')?.controllerPolicyFieldsExcluded, ['terminalStatusCandidate']);
assert.deepEqual(rowForFamily('failure')?.productionAdapterCandidateFields, [
  'errorClass',
  'failureOrigin',
  'retryability',
  'sideEffectCommitted',
  'userVisibleFailureReason',
]);

assert.deepEqual(fieldNamesForSource('waiting-for-phase-event', 'future-production-adapter'), []);
assert.deepEqual(fieldNamesForSource('waiting-for-phase-event', 'phase-port-result'), ['pauseReason', 'waitSource']);
assert.deepEqual(fieldNamesForSource('waiting-for-phase-event', 'future-controller-policy'), [
  'resumeTriggerOwner',
  'waitBudget',
]);
assert.deepEqual(fieldNamesForSource('blocked-by-phase', 'future-production-adapter'), [
  'blockerSource',
  'recoverability',
  'userActionRequired',
]);
assert.deepEqual(fieldNamesForSource('blocked-by-phase', 'future-controller-policy'), ['terminalStatusCandidate']);
assert.deepEqual(fieldNamesForSource('runtime-failed', 'future-production-adapter'), [
  'errorClass',
  'failureOrigin',
  'retryability',
  'sideEffectCommitted',
  'userVisibleFailureReason',
]);

for (const excludedReason of excludedReasons) {
  assert.equal(
    productionAdapterContractReadinessPreflight.rows.some((row) => row.reason === excludedReason),
    false,
    `${excludedReason} should stay outside this payload-derived production-adapter readiness preflight.`,
  );
}

assert.match(finalGateSmokeSource, /payload-contract promotion is not allowed now/u);
assert.match(finalGateSmokeSource, /future-production-adapter-evidence-missing/u);
assert.match(sourceReadinessMatrixSmokeSource, /owner: 'future-production-adapter'/u);
assert.match(sourceReadinessMatrixSmokeSource, /owner: 'future-phase-adapter'/u);
assert.match(sourceReadinessMatrixSmokeSource, /owner: 'future-controller-policy'/u);
assert.match(adapterPreContractSmokeSource, /AgentSessionV2 remains production owner/u);
assert.match(adapterPreContractSmokeSource, /doesNotDefineRequiredOrder: true/u);
assert.match(formalGateSmokeSource, /not sufficient to introduce a formal adapter-payload TypeScript contract/u);
assert.match(phasePortExpansionReviewSmokeSource, /requires-future-result-kind/u);

const serializedPreflight = JSON.stringify(productionAdapterContractReadinessPreflight);
assert.doesNotMatch(
  serializedPreflight,
  /adapterContractPromotionAllowed":true|productionReady":true|formalContractReady":true/u,
  'Production-adapter contract readiness preflight must not promote an adapter contract.',
);
assert.doesNotMatch(
  serializedPreflight,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Production-adapter contract readiness preflight should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedPreflight,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Production-adapter contract readiness preflight should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedPreflight,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain/iu,
  'Production-adapter contract readiness preflight should not define fixed workflows or fallback chains.',
);
assert.doesNotMatch(
  serializedPreflight,
  /implementationQueue|orderedSteps|runtimeAuthority|experimental-adapter/u,
  'Production-adapter contract readiness preflight should remain a pre-contract audit gate.',
);

assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(PhasePort|Adapter).*(Payload|Contract)|type AgentSessionV3Runtime(PhasePort|Adapter).*Payload/u,
  'Production-adapter contract readiness preflight should not add formal phase-port or adapter payload types.',
);
assert.doesNotMatch(
  boundarySource,
  /kind:\s*'failure'/u,
  'Production-adapter contract readiness preflight should not add a phase-port failure result kind.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Production-adapter contract readiness preflight must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  readinessPreflightSmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Production-adapter contract readiness preflight should not call production v2 modules.',
);

assert.match(preflightAuditText, /Production-Adapter Contract Readiness Preflight Status/u);
assert.match(
  preflightAuditText,
  /agent-session-v3-runtime-boundary-production-adapter-contract-readiness-preflight-smoke\.ts/u,
);
assert.match(preflightAuditText, /production-adapter contract promotion is not allowed now/u);
assert.match(preflightAuditText, /not production wiring/u);
assert.match(statusText, /V3 runtime boundary production-adapter contract readiness preflight.*Completed/u);
assert.match(
  statusText,
  /agent-session-v3-runtime-boundary-production-adapter-contract-readiness-preflight-smoke\.ts/u,
);

console.log('agent session v3 runtime boundary production-adapter contract readiness preflight smoke ok');
