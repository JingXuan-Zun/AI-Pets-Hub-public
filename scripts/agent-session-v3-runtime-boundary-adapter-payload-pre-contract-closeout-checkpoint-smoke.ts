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

type AdapterPayloadCloseoutDecision =
  | 'not-applicable'
  | 'pre-contract-deferred';

type AdapterPayloadCloseoutCoverage =
  | 'backlog-consistency'
  | 'deferred-contract-rationale'
  | 'evidence-criteria-consistency'
  | 'family-rollup'
  | 'formal-contract-gate'
  | 'matrix-consistency'
  | 'promotion-blocker-backlog'
  | 'source-readiness-matrix';

interface AdapterPayloadPreContractCloseoutRow {
  coverage: readonly AdapterPayloadCloseoutCoverage[];
  decision: AdapterPayloadCloseoutDecision;
  family: AdapterPayloadFamily;
  formalContractReady: false;
  productionReady: false;
  reason: AgentSessionV3RuntimeBoundaryStopReason;
  remainsPreContractAuditOnly: true;
}

const adapterPayloadPreContractCloseoutRows = [
  {
    coverage: [
      'family-rollup',
      'promotion-blocker-backlog',
      'backlog-consistency',
      'formal-contract-gate',
      'deferred-contract-rationale',
      'evidence-criteria-consistency',
    ],
    decision: 'not-applicable',
    family: 'success',
    formalContractReady: false,
    productionReady: false,
    reason: 'continue-with-event',
    remainsPreContractAuditOnly: true,
  },
  {
    coverage: [
      'family-rollup',
      'promotion-blocker-backlog',
      'backlog-consistency',
      'source-readiness-matrix',
      'matrix-consistency',
      'formal-contract-gate',
      'deferred-contract-rationale',
      'evidence-criteria-consistency',
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
      'family-rollup',
      'promotion-blocker-backlog',
      'backlog-consistency',
      'source-readiness-matrix',
      'matrix-consistency',
      'formal-contract-gate',
      'deferred-contract-rationale',
      'evidence-criteria-consistency',
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
      'family-rollup',
      'promotion-blocker-backlog',
      'backlog-consistency',
      'source-readiness-matrix',
      'matrix-consistency',
      'formal-contract-gate',
      'deferred-contract-rationale',
      'evidence-criteria-consistency',
    ],
    decision: 'pre-contract-deferred',
    family: 'failure',
    formalContractReady: false,
    productionReady: false,
    reason: 'runtime-failed',
    remainsPreContractAuditOnly: true,
  },
] as const satisfies readonly AdapterPayloadPreContractCloseoutRow[];

const excludedReasons = [
  'cancelled',
  'invalid-transition',
  'transition-budget-exhausted',
] as const satisfies readonly AgentSessionV3RuntimeBoundaryStopReason[];

function rowForFamily(family: AdapterPayloadFamily) {
  return adapterPayloadPreContractCloseoutRows.find((row) => row.family === family);
}

const {
  backlogConsistencySmokeSource,
  boundarySource,
  closeoutSmokeSource,
  deferredRationaleSmokeSource,
  evidenceCriteriaConsistencySmokeSource,
  familyRollupSmokeSource,
  formalGateSmokeSource,
  matrixConsistencySmokeSource,
  preflightAuditText,
  promotionBacklogSmokeSource,
  sourceReadinessMatrixSmokeSource,
  statusText,
} = readProjectSources({
  backlogConsistencySmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-payload-backlog-consistency-checkpoint-smoke.ts',
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  closeoutSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-payload-pre-contract-closeout-checkpoint-smoke.ts',
  deferredRationaleSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-payload-deferred-contract-rationale-checkpoint-smoke.ts',
  evidenceCriteriaConsistencySmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-payload-evidence-criteria-consistency-checkpoint-smoke.ts',
  familyRollupSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-payload-family-rollup-checkpoint-smoke.ts',
  formalGateSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-payload-formal-contract-gate-checkpoint-smoke.ts',
  matrixConsistencySmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-payload-matrix-consistency-checkpoint-smoke.ts',
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
  adapterPayloadPreContractCloseoutRows.map((row) => row.family).sort(),
  ['blocked', 'failure', 'success', 'waiting'],
  'Adapter-payload closeout should cover every adapter-payload family exactly once.',
);
assert.deepEqual(rowForFamily('success')?.decision, 'not-applicable');
assert.deepEqual(
  adapterPayloadPreContractCloseoutRows
    .filter((row) => row.decision === 'pre-contract-deferred')
    .map((row) => row.family)
    .sort(),
  ['blocked', 'failure', 'waiting'],
);

for (const row of adapterPayloadPreContractCloseoutRows) {
  assert.equal(row.productionReady, false);
  assert.equal(row.formalContractReady, false);
  assert.equal(row.remainsPreContractAuditOnly, true);
  assert.ok(row.coverage.includes('family-rollup'));
  assert.ok(row.coverage.includes('formal-contract-gate'));
  assert.ok(row.coverage.includes('evidence-criteria-consistency'));

  if (row.decision === 'not-applicable') {
    assert.equal(getAgentSessionV3RuntimeStopEvidenceFields(row.reason).length, 0);
    assert.equal(row.coverage.includes('source-readiness-matrix'), false);
    assert.equal(row.coverage.includes('matrix-consistency'), false);
  }

  if (row.decision === 'pre-contract-deferred') {
    assert.ok(getAgentSessionV3RuntimeStopEvidenceFields(row.reason).length > 0);
    assert.ok(row.coverage.includes('source-readiness-matrix'));
    assert.ok(row.coverage.includes('matrix-consistency'));
  }
}

assert.deepEqual(rowForFamily('waiting')?.coverage, [
  'family-rollup',
  'promotion-blocker-backlog',
  'backlog-consistency',
  'source-readiness-matrix',
  'matrix-consistency',
  'formal-contract-gate',
  'deferred-contract-rationale',
  'evidence-criteria-consistency',
]);
assert.deepEqual(rowForFamily('blocked')?.coverage, rowForFamily('waiting')?.coverage);
assert.deepEqual(rowForFamily('failure')?.coverage, rowForFamily('waiting')?.coverage);

for (const excludedReason of excludedReasons) {
  assert.equal(
    adapterPayloadPreContractCloseoutRows.some((row) => row.reason === excludedReason),
    false,
    `${excludedReason} should stay outside adapter-payload pre-contract closeout.`,
  );
}

assert.match(familyRollupSmokeSource, /No adapter-payload family should be promoted into a formal payload contract yet/u);
assert.match(promotionBacklogSmokeSource, /blocked-until-owner-evidence-exists/u);
assert.match(
  backlogConsistencySmokeSource,
  /Adapter-payload backlog should only cover waiting, blocked, and runtime-failed stop reasons/u,
);
assert.match(sourceReadinessMatrixSmokeSource, /promotionReady: false/u);
assert.match(matrixConsistencySmokeSource, /no field, readiness, source, or owner drift/u);
assert.match(formalGateSmokeSource, /not sufficient to introduce a formal adapter-payload TypeScript contract/u);
assert.match(deferredRationaleSmokeSource, /evidence criteria, not an implementation queue/u);
assert.match(evidenceCriteriaConsistencySmokeSource, /staysEvidenceOnly: true/u);

const serializedCloseout = JSON.stringify(adapterPayloadPreContractCloseoutRows);
assert.doesNotMatch(
  serializedCloseout,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Adapter-payload closeout should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedCloseout,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Adapter-payload closeout should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedCloseout,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain/u,
  'Adapter-payload closeout should not define fixed workflows or fallback chains.',
);
assert.doesNotMatch(
  serializedCloseout,
  /implementationQueue|orderedSteps|runtimeAuthority|productionReady":true|formalContractReady":true|experimental-adapter/u,
  'Adapter-payload closeout should remain pre-contract audit coverage only.',
);

assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Adapter|PhasePort).*(Payload|Contract)|type AgentSessionV3Runtime(Adapter|PhasePort).*Payload/u,
  'Adapter-payload closeout should not add formal adapter payload types to the production boundary.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Adapter-payload closeout must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  closeoutSmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Adapter-payload closeout should not call production v2 modules.',
);

assert.match(preflightAuditText, /Adapter-Payload Pre-Contract Closeout Checkpoint Status/u);
assert.match(
  preflightAuditText,
  /agent-session-v3-runtime-boundary-adapter-payload-pre-contract-closeout-checkpoint-smoke\.ts/u,
);
assert.match(preflightAuditText, /pre-contract audit coverage only/u);
assert.match(preflightAuditText, /not production wiring/u);
assert.match(statusText, /V3 runtime boundary adapter-payload pre-contract closeout checkpoint.*Completed/u);
assert.match(
  statusText,
  /agent-session-v3-runtime-boundary-adapter-payload-pre-contract-closeout-checkpoint-smoke\.ts/u,
);

console.log('agent session v3 runtime boundary adapter-payload pre-contract closeout checkpoint smoke ok');
