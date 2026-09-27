import assert from 'node:assert/strict';
import {
  createAgentSessionV3RuntimeBoundaryContract,
  getAgentSessionV3RuntimeStopEvidenceFields,
  type AgentSessionV3RuntimeBoundaryStopReason,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

type PayloadCloseoutFinalGateFamily =
  | 'blocked'
  | 'failure'
  | 'success'
  | 'waiting';

type PayloadCloseoutFinalGateInput =
  | 'adapter-payload-pre-contract-closeout'
  | 'payload-closeout-alignment'
  | 'phase-port-payload-pre-contract-closeout';

type PayloadCloseoutFinalGateDecision =
  | 'contract-promotion-blocked'
  | 'not-applicable';

type PayloadCloseoutFinalGateBlocker =
  | 'controller-policy-fields-not-formalized'
  | 'failure-result-kind-missing'
  | 'future-production-adapter-evidence-missing'
  | 'missing-real-or-production-like-traces'
  | 'no-stop-payload-fields'
  | 'phase-port-payload-still-shallow-or-partial';

interface PayloadCloseoutFinalGateRow {
  blockers: readonly PayloadCloseoutFinalGateBlocker[];
  decision: PayloadCloseoutFinalGateDecision;
  family: PayloadCloseoutFinalGateFamily;
  formalContractReady: false;
  inputs: readonly PayloadCloseoutFinalGateInput[];
  payloadContractPromotionAllowed: false;
  productionReady: false;
  reason: AgentSessionV3RuntimeBoundaryStopReason;
  remainsPreContractAuditOnly: true;
}

interface PayloadCloseoutFinalPreflightGate {
  formalContractReady: false;
  gate: 'payload-closeout-final-preflight';
  payloadContractPromotionAllowed: false;
  productionReady: false;
  reviewedInputs: readonly PayloadCloseoutFinalGateInput[];
  rows: readonly PayloadCloseoutFinalGateRow[];
}

const payloadCloseoutFinalPreflightGate = {
  formalContractReady: false,
  gate: 'payload-closeout-final-preflight',
  payloadContractPromotionAllowed: false,
  productionReady: false,
  reviewedInputs: [
    'adapter-payload-pre-contract-closeout',
    'phase-port-payload-pre-contract-closeout',
    'payload-closeout-alignment',
  ],
  rows: [
    {
      blockers: ['no-stop-payload-fields'],
      decision: 'not-applicable',
      family: 'success',
      formalContractReady: false,
      inputs: [
        'adapter-payload-pre-contract-closeout',
        'payload-closeout-alignment',
      ],
      payloadContractPromotionAllowed: false,
      productionReady: false,
      reason: 'continue-with-event',
      remainsPreContractAuditOnly: true,
    },
    {
      blockers: [
        'phase-port-payload-still-shallow-or-partial',
        'controller-policy-fields-not-formalized',
        'missing-real-or-production-like-traces',
      ],
      decision: 'contract-promotion-blocked',
      family: 'waiting',
      formalContractReady: false,
      inputs: [
        'adapter-payload-pre-contract-closeout',
        'phase-port-payload-pre-contract-closeout',
        'payload-closeout-alignment',
      ],
      payloadContractPromotionAllowed: false,
      productionReady: false,
      reason: 'waiting-for-phase-event',
      remainsPreContractAuditOnly: true,
    },
    {
      blockers: [
        'future-production-adapter-evidence-missing',
        'controller-policy-fields-not-formalized',
        'missing-real-or-production-like-traces',
      ],
      decision: 'contract-promotion-blocked',
      family: 'blocked',
      formalContractReady: false,
      inputs: [
        'adapter-payload-pre-contract-closeout',
        'phase-port-payload-pre-contract-closeout',
        'payload-closeout-alignment',
      ],
      payloadContractPromotionAllowed: false,
      productionReady: false,
      reason: 'blocked-by-phase',
      remainsPreContractAuditOnly: true,
    },
    {
      blockers: [
        'failure-result-kind-missing',
        'future-production-adapter-evidence-missing',
        'missing-real-or-production-like-traces',
      ],
      decision: 'contract-promotion-blocked',
      family: 'failure',
      formalContractReady: false,
      inputs: [
        'adapter-payload-pre-contract-closeout',
        'phase-port-payload-pre-contract-closeout',
        'payload-closeout-alignment',
      ],
      payloadContractPromotionAllowed: false,
      productionReady: false,
      reason: 'runtime-failed',
      remainsPreContractAuditOnly: true,
    },
  ],
} as const satisfies PayloadCloseoutFinalPreflightGate;

const excludedReasons = [
  'cancelled',
  'invalid-transition',
  'transition-budget-exhausted',
] as const satisfies readonly AgentSessionV3RuntimeBoundaryStopReason[];

function rowForFamily(family: PayloadCloseoutFinalGateFamily) {
  return payloadCloseoutFinalPreflightGate.rows.find((row) => row.family === family);
}

const {
  boundarySource,
  finalGateSmokeSource,
  adapterCloseoutSmokeSource,
  phasePortCloseoutSmokeSource,
  alignmentSmokeSource,
  formalGateSmokeSource,
  deferredRationaleSmokeSource,
  evidenceCriteriaConsistencySmokeSource,
  sourceReadinessMatrixSmokeSource,
  phasePortExpansionReviewSmokeSource,
  preflightAuditText,
  statusText,
} = readProjectSources({
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  finalGateSmokeSource: 'scripts/agent-session-v3-runtime-boundary-payload-closeout-final-preflight-gate-smoke.ts',
  adapterCloseoutSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-payload-pre-contract-closeout-checkpoint-smoke.ts',
  phasePortCloseoutSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-phase-port-payload-pre-contract-closeout-checkpoint-smoke.ts',
  alignmentSmokeSource: 'scripts/agent-session-v3-runtime-boundary-payload-closeout-alignment-checkpoint-smoke.ts',
  formalGateSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-payload-formal-contract-gate-checkpoint-smoke.ts',
  deferredRationaleSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-payload-deferred-contract-rationale-checkpoint-smoke.ts',
  evidenceCriteriaConsistencySmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-payload-evidence-criteria-consistency-checkpoint-smoke.ts',
  sourceReadinessMatrixSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-payload-source-readiness-matrix-checkpoint-smoke.ts',
  phasePortExpansionReviewSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-phase-port-payload-pre-contract-expansion-review-smoke.ts',
  preflightAuditText: 'PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md',
  statusText: 'PROJECT_AGENT_V2_STATUS.md',
});

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');

assert.deepEqual(payloadCloseoutFinalPreflightGate.reviewedInputs, [
  'adapter-payload-pre-contract-closeout',
  'phase-port-payload-pre-contract-closeout',
  'payload-closeout-alignment',
]);
assert.equal(payloadCloseoutFinalPreflightGate.payloadContractPromotionAllowed, false);
assert.equal(payloadCloseoutFinalPreflightGate.formalContractReady, false);
assert.equal(payloadCloseoutFinalPreflightGate.productionReady, false);

assert.deepEqual(
  payloadCloseoutFinalPreflightGate.rows.map((row) => row.family).sort(),
  ['blocked', 'failure', 'success', 'waiting'],
  'Payload closeout final preflight gate should cover all closeout families exactly once.',
);
assert.deepEqual(
  payloadCloseoutFinalPreflightGate.rows
    .filter((row) => row.decision === 'contract-promotion-blocked')
    .map((row) => row.family)
    .sort(),
  ['blocked', 'failure', 'waiting'],
);
assert.deepEqual(
  payloadCloseoutFinalPreflightGate.rows
    .filter((row) => row.decision === 'not-applicable')
    .map((row) => row.family),
  ['success'],
);

for (const row of payloadCloseoutFinalPreflightGate.rows) {
  assert.equal(row.payloadContractPromotionAllowed, false);
  assert.equal(row.formalContractReady, false);
  assert.equal(row.productionReady, false);
  assert.equal(row.remainsPreContractAuditOnly, true);
  assert.ok(row.inputs.includes('adapter-payload-pre-contract-closeout'));
  assert.ok(row.inputs.includes('payload-closeout-alignment'));

  if (row.decision === 'not-applicable') {
    assert.equal(row.reason, 'continue-with-event');
    assert.deepEqual(row.blockers, ['no-stop-payload-fields']);
    assert.equal(row.inputs.includes('phase-port-payload-pre-contract-closeout'), false);
    assert.equal(getAgentSessionV3RuntimeStopEvidenceFields(row.reason).length, 0);
  }

  if (row.decision === 'contract-promotion-blocked') {
    assert.ok(row.inputs.includes('phase-port-payload-pre-contract-closeout'));
    assert.ok(row.blockers.includes('missing-real-or-production-like-traces'));
    assert.ok(getAgentSessionV3RuntimeStopEvidenceFields(row.reason).length > 0);
  }
}

assert.ok(rowForFamily('waiting')?.blockers.includes('phase-port-payload-still-shallow-or-partial'));
assert.ok(rowForFamily('waiting')?.blockers.includes('controller-policy-fields-not-formalized'));
assert.ok(rowForFamily('blocked')?.blockers.includes('future-production-adapter-evidence-missing'));
assert.ok(rowForFamily('blocked')?.blockers.includes('controller-policy-fields-not-formalized'));
assert.ok(rowForFamily('failure')?.blockers.includes('failure-result-kind-missing'));
assert.ok(rowForFamily('failure')?.blockers.includes('future-production-adapter-evidence-missing'));

for (const excludedReason of excludedReasons) {
  assert.equal(
    payloadCloseoutFinalPreflightGate.rows.some((row) => row.reason === excludedReason),
    false,
    `${excludedReason} should stay outside payload closeout final preflight promotion.`
  );
}

assert.match(adapterCloseoutSmokeSource, /pre-contract audit coverage only/u);
assert.match(phasePortCloseoutSmokeSource, /phase-port payload side is internally covered but still pre-contract only/u);
assert.match(alignmentSmokeSource, /adapter-payload and phase-port payload closeouts agree/u);
assert.match(formalGateSmokeSource, /not sufficient to introduce a formal adapter-payload TypeScript contract/u);
assert.match(deferredRationaleSmokeSource, /evidence criteria, not an implementation queue/u);
assert.match(evidenceCriteriaConsistencySmokeSource, /staysEvidenceOnly: true/u);
assert.match(sourceReadinessMatrixSmokeSource, /promotionReady: false/u);
assert.match(phasePortExpansionReviewSmokeSource, /requires-future-result-kind/u);

const serializedGate = JSON.stringify(payloadCloseoutFinalPreflightGate);
assert.doesNotMatch(
  serializedGate,
  /payloadContractPromotionAllowed":true|productionReady":true|formalContractReady":true/u,
  'Payload closeout final preflight gate must not allow payload-contract promotion.',
);
assert.doesNotMatch(
  serializedGate,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Payload closeout final preflight gate should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedGate,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Payload closeout final preflight gate should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedGate,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain/iu,
  'Payload closeout final preflight gate should not define fixed workflows or fallback chains.',
);
assert.doesNotMatch(
  serializedGate,
  /implementationQueue|orderedSteps|runtimeAuthority|experimental-adapter/u,
  'Payload closeout final preflight gate should remain a pre-contract audit gate.',
);

assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(PhasePort|Adapter).*(Payload|Contract)|type AgentSessionV3Runtime(PhasePort|Adapter).*Payload/u,
  'Payload closeout final preflight gate should not add formal phase-port or adapter payload types.',
);
assert.doesNotMatch(
  boundarySource,
  /kind:\s*'failure'/u,
  'Payload closeout final preflight gate should not add a phase-port failure result kind.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Payload closeout final preflight gate must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  finalGateSmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Payload closeout final preflight gate should not call production v2 modules.',
);

assert.match(preflightAuditText, /Payload Closeout Final Preflight Gate Status/u);
assert.match(
  preflightAuditText,
  /agent-session-v3-runtime-boundary-payload-closeout-final-preflight-gate-smoke\.ts/u,
);
assert.match(preflightAuditText, /payload-contract promotion is not allowed now/u);
assert.match(preflightAuditText, /not production wiring/u);
assert.match(statusText, /V3 runtime boundary payload closeout final preflight gate.*Completed/u);
assert.match(
  statusText,
  /agent-session-v3-runtime-boundary-payload-closeout-final-preflight-gate-smoke\.ts/u,
);

console.log('agent session v3 runtime boundary payload closeout final preflight gate smoke ok');
