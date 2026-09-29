import assert from 'node:assert/strict';
import {
  createAgentSessionV3RuntimeBoundaryContract,
  getAgentSessionV3RuntimeStopEvidenceFields,
  type AgentSessionV3RuntimeBoundaryStopReason,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

type PhasePortPayloadCloseoutFamily =
  | 'blocked'
  | 'failure'
  | 'waiting';

type PhasePortPayloadCloseoutCoverage =
  | 'contract-readiness-rollup'
  | 'expansion-consistency'
  | 'pre-contract-expansion-review';

type PhasePortPayloadCloseoutDecision =
  | 'pre-contract-deferred';

interface PhasePortPayloadPreContractCloseoutRow {
  coverage: readonly PhasePortPayloadCloseoutCoverage[];
  decision: PhasePortPayloadCloseoutDecision;
  family: PhasePortPayloadCloseoutFamily;
  formalContractReady: false;
  productionReady: false;
  reason: Extract<
    AgentSessionV3RuntimeBoundaryStopReason,
    'blocked-by-phase' | 'runtime-failed' | 'waiting-for-phase-event'
  >;
  remainsPreContractAuditOnly: true;
}

const phasePortPayloadPreContractCloseoutRows = [
  {
    coverage: [
      'contract-readiness-rollup',
      'pre-contract-expansion-review',
      'expansion-consistency',
    ],
    decision: 'pre-contract-deferred',
    family: 'waiting',
    formalContractReady: false,
    productionReady: false,
    reason: 'waiting-for-phase-event',
    remainsPreContractAuditOnly: true,
  },
  {
    coverage: [
      'pre-contract-expansion-review',
      'expansion-consistency',
    ],
    decision: 'pre-contract-deferred',
    family: 'blocked',
    formalContractReady: false,
    productionReady: false,
    reason: 'blocked-by-phase',
    remainsPreContractAuditOnly: true,
  },
  {
    coverage: [
      'pre-contract-expansion-review',
      'expansion-consistency',
    ],
    decision: 'pre-contract-deferred',
    family: 'failure',
    formalContractReady: false,
    productionReady: false,
    reason: 'runtime-failed',
    remainsPreContractAuditOnly: true,
  },
] as const satisfies readonly PhasePortPayloadPreContractCloseoutRow[];

const excludedReasons = [
  'cancelled',
  'continue-with-event',
  'invalid-transition',
  'transition-budget-exhausted',
] as const satisfies readonly AgentSessionV3RuntimeBoundaryStopReason[];

function rowForFamily(family: PhasePortPayloadCloseoutFamily) {
  return phasePortPayloadPreContractCloseoutRows.find((row) => row.family === family);
}

const {
  adapterPayloadCloseoutSmokeSource,
  boundarySource,
  closeoutSmokeSource,
  contractReadinessRollupSmokeSource,
  expansionConsistencySmokeSource,
  expansionReviewSmokeSource,
  formalGateSmokeSource,
  preflightAuditText,
  statusText,
} = readProjectSources({
  adapterPayloadCloseoutSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-payload-pre-contract-closeout-checkpoint-smoke.ts',
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  closeoutSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-phase-port-payload-pre-contract-closeout-checkpoint-smoke.ts',
  contractReadinessRollupSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-phase-port-payload-contract-readiness-rollup-smoke.ts',
  expansionConsistencySmokeSource:
    'scripts/agent-session-v3-runtime-boundary-phase-port-payload-expansion-consistency-checkpoint-smoke.ts',
  expansionReviewSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-phase-port-payload-pre-contract-expansion-review-smoke.ts',
  formalGateSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-payload-formal-contract-gate-checkpoint-smoke.ts',
  preflightAuditText: 'PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md',
  statusText: 'PROJECT_AGENT_V2_STATUS.md',
});

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');

assert.deepEqual(
  phasePortPayloadPreContractCloseoutRows.map((row) => row.family).sort(),
  ['blocked', 'failure', 'waiting'],
  'Phase-port payload closeout should cover waiting, blocked, and failure exactly once.',
);
assert.deepEqual(
  phasePortPayloadPreContractCloseoutRows.map((row) => row.decision),
  [
    'pre-contract-deferred',
    'pre-contract-deferred',
    'pre-contract-deferred',
  ],
);

for (const row of phasePortPayloadPreContractCloseoutRows) {
  assert.equal(row.productionReady, false);
  assert.equal(row.formalContractReady, false);
  assert.equal(row.remainsPreContractAuditOnly, true);
  assert.ok(getAgentSessionV3RuntimeStopEvidenceFields(row.reason).length > 0);
  assert.ok(row.coverage.includes('pre-contract-expansion-review'));
  assert.ok(row.coverage.includes('expansion-consistency'));

  if (row.family === 'waiting') {
    assert.ok(row.coverage.includes('contract-readiness-rollup'));
  } else {
    assert.equal(row.coverage.includes('contract-readiness-rollup'), false);
  }
}

assert.deepEqual(rowForFamily('waiting')?.coverage, [
  'contract-readiness-rollup',
  'pre-contract-expansion-review',
  'expansion-consistency',
]);
assert.deepEqual(rowForFamily('blocked')?.coverage, [
  'pre-contract-expansion-review',
  'expansion-consistency',
]);
assert.deepEqual(rowForFamily('failure')?.coverage, rowForFamily('blocked')?.coverage);

for (const excludedReason of excludedReasons) {
  assert.equal(
    phasePortPayloadPreContractCloseoutRows.some((row) => row.reason === excludedReason),
    false,
    `${excludedReason} should stay outside phase-port payload pre-contract closeout.`,
  );
}

assert.match(contractReadinessRollupSmokeSource, /No phase-port-owned stop-payload field should be promoted into a formal payload contract yet/u);
assert.match(contractReadinessRollupSmokeSource, /Only waiting phase-port fields should be phase-port-owned for now/u);
assert.match(expansionReviewSmokeSource, /Phase-port payload expansion review should not promote fields into a formal contract/u);
assert.match(expansionReviewSmokeSource, /requires-future-result-kind/u);
assert.match(expansionConsistencySmokeSource, /no expansion row becomes formal-contract-ready or production-ready/u);
assert.match(expansionConsistencySmokeSource, /candidate-field/u);
assert.match(adapterPayloadCloseoutSmokeSource, /pre-contract audit coverage only/u);
assert.match(formalGateSmokeSource, /not sufficient to introduce a formal adapter-payload TypeScript contract/u);

const serializedCloseout = JSON.stringify(phasePortPayloadPreContractCloseoutRows);
assert.doesNotMatch(
  serializedCloseout,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Phase-port payload closeout should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedCloseout,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Phase-port payload closeout should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedCloseout,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain/iu,
  'Phase-port payload closeout should not define fixed workflows or fallback chains.',
);
assert.doesNotMatch(
  serializedCloseout,
  /implementationQueue|orderedSteps|runtimeAuthority|productionReady":true|formalContractReady":true|experimental-adapter/u,
  'Phase-port payload closeout should remain pre-contract audit coverage only.',
);

assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(PhasePort|Adapter).*(Payload|Contract)|type AgentSessionV3Runtime(PhasePort|Adapter).*Payload/u,
  'Phase-port payload closeout should not add formal payload types to the production boundary.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Phase-port payload closeout must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  closeoutSmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Phase-port payload closeout should not call production v2 modules.',
);

assert.match(preflightAuditText, /Phase-Port Payload Pre-Contract Closeout Checkpoint Status/u);
assert.match(
  preflightAuditText,
  /agent-session-v3-runtime-boundary-phase-port-payload-pre-contract-closeout-checkpoint-smoke\.ts/u,
);
assert.match(preflightAuditText, /phase-port payload side is internally covered but still pre-contract only/u);
assert.match(preflightAuditText, /not production wiring/u);
assert.match(statusText, /V3 runtime boundary phase-port payload pre-contract closeout checkpoint.*Completed/u);
assert.match(
  statusText,
  /agent-session-v3-runtime-boundary-phase-port-payload-pre-contract-closeout-checkpoint-smoke\.ts/u,
);

console.log('agent session v3 runtime boundary phase-port payload pre-contract closeout checkpoint smoke ok');
