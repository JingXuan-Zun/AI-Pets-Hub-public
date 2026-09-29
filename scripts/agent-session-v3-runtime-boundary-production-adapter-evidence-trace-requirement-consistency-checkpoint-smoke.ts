import assert from 'node:assert/strict';
import {
  createAgentSessionV3RuntimeBoundaryContract,
  getAgentSessionV3RuntimeStopEvidenceFields,
  type AgentSessionV3RuntimeBoundaryStopReason,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

type ProductionAdapterTraceRequirementFamily =
  | 'blocked'
  | 'failure';

type ProductionAdapterTraceRequirement =
  | 'real-or-production-like-trace-required'
  | 'real-or-production-like-trace-plus-failure-kind-required';

type ProductionAdapterTraceRequirementSource =
  | 'contract-readiness-preflight'
  | 'evidence-source-map'
  | 'payload-final-gate';

interface ProductionAdapterTraceRequirementConsistencyRow {
  adapterContractPromotionAllowed: false;
  evidenceOnly: true;
  family: ProductionAdapterTraceRequirementFamily;
  fieldName: string;
  formalContractReady: false;
  productionReady: false;
  reason: Extract<AgentSessionV3RuntimeBoundaryStopReason, 'blocked-by-phase' | 'runtime-failed'>;
  requiredSources: readonly ProductionAdapterTraceRequirementSource[];
  traceRequirement: ProductionAdapterTraceRequirement;
}

interface ProductionAdapterTraceRequirementConsistencyCheckpoint {
  adapterContractPromotionAllowed: false;
  formalContractReady: false;
  gate: 'production-adapter-evidence-trace-requirement-consistency';
  productionReady: false;
  rows: readonly ProductionAdapterTraceRequirementConsistencyRow[];
}

const productionAdapterTraceRequirementConsistencyCheckpoint = {
  adapterContractPromotionAllowed: false,
  formalContractReady: false,
  gate: 'production-adapter-evidence-trace-requirement-consistency',
  productionReady: false,
  rows: [
    {
      adapterContractPromotionAllowed: false,
      evidenceOnly: true,
      family: 'blocked',
      fieldName: 'blockerSource',
      formalContractReady: false,
      productionReady: false,
      reason: 'blocked-by-phase',
      requiredSources: [
        'payload-final-gate',
        'contract-readiness-preflight',
        'evidence-source-map',
      ],
      traceRequirement: 'real-or-production-like-trace-required',
    },
    {
      adapterContractPromotionAllowed: false,
      evidenceOnly: true,
      family: 'blocked',
      fieldName: 'recoverability',
      formalContractReady: false,
      productionReady: false,
      reason: 'blocked-by-phase',
      requiredSources: [
        'payload-final-gate',
        'contract-readiness-preflight',
        'evidence-source-map',
      ],
      traceRequirement: 'real-or-production-like-trace-required',
    },
    {
      adapterContractPromotionAllowed: false,
      evidenceOnly: true,
      family: 'blocked',
      fieldName: 'userActionRequired',
      formalContractReady: false,
      productionReady: false,
      reason: 'blocked-by-phase',
      requiredSources: [
        'payload-final-gate',
        'contract-readiness-preflight',
        'evidence-source-map',
      ],
      traceRequirement: 'real-or-production-like-trace-required',
    },
    {
      adapterContractPromotionAllowed: false,
      evidenceOnly: true,
      family: 'failure',
      fieldName: 'errorClass',
      formalContractReady: false,
      productionReady: false,
      reason: 'runtime-failed',
      requiredSources: [
        'payload-final-gate',
        'contract-readiness-preflight',
        'evidence-source-map',
      ],
      traceRequirement: 'real-or-production-like-trace-plus-failure-kind-required',
    },
    {
      adapterContractPromotionAllowed: false,
      evidenceOnly: true,
      family: 'failure',
      fieldName: 'failureOrigin',
      formalContractReady: false,
      productionReady: false,
      reason: 'runtime-failed',
      requiredSources: [
        'payload-final-gate',
        'contract-readiness-preflight',
        'evidence-source-map',
      ],
      traceRequirement: 'real-or-production-like-trace-plus-failure-kind-required',
    },
    {
      adapterContractPromotionAllowed: false,
      evidenceOnly: true,
      family: 'failure',
      fieldName: 'retryability',
      formalContractReady: false,
      productionReady: false,
      reason: 'runtime-failed',
      requiredSources: [
        'payload-final-gate',
        'contract-readiness-preflight',
        'evidence-source-map',
      ],
      traceRequirement: 'real-or-production-like-trace-plus-failure-kind-required',
    },
    {
      adapterContractPromotionAllowed: false,
      evidenceOnly: true,
      family: 'failure',
      fieldName: 'sideEffectCommitted',
      formalContractReady: false,
      productionReady: false,
      reason: 'runtime-failed',
      requiredSources: [
        'payload-final-gate',
        'contract-readiness-preflight',
        'evidence-source-map',
      ],
      traceRequirement: 'real-or-production-like-trace-plus-failure-kind-required',
    },
    {
      adapterContractPromotionAllowed: false,
      evidenceOnly: true,
      family: 'failure',
      fieldName: 'userVisibleFailureReason',
      formalContractReady: false,
      productionReady: false,
      reason: 'runtime-failed',
      requiredSources: [
        'payload-final-gate',
        'contract-readiness-preflight',
        'evidence-source-map',
      ],
      traceRequirement: 'real-or-production-like-trace-plus-failure-kind-required',
    },
  ],
} as const satisfies ProductionAdapterTraceRequirementConsistencyCheckpoint;

const excludedReasons = [
  'cancelled',
  'continue-with-event',
  'invalid-transition',
  'transition-budget-exhausted',
  'waiting-for-phase-event',
] as const satisfies readonly AgentSessionV3RuntimeBoundaryStopReason[];

function createFieldKey(reason: AgentSessionV3RuntimeBoundaryStopReason, fieldName: string) {
  return `${reason}.${fieldName}`;
}

function rowsForReason(reason: ProductionAdapterTraceRequirementConsistencyRow['reason']) {
  return productionAdapterTraceRequirementConsistencyCheckpoint.rows.filter((row) => row.reason === reason);
}

const {
  boundarySource,
  evidenceSourceMapSmokeSource,
  finalGateSmokeSource,
  formalGateSmokeSource,
  preflightAuditText,
  readinessPreflightSmokeSource,
  statusText,
  traceRequirementConsistencySmokeSource,
} = readProjectSources({
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  evidenceSourceMapSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-production-adapter-evidence-source-map-smoke.ts',
  finalGateSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-payload-closeout-final-preflight-gate-smoke.ts',
  formalGateSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-payload-formal-contract-gate-checkpoint-smoke.ts',
  preflightAuditText: 'PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md',
  readinessPreflightSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-production-adapter-contract-readiness-preflight-smoke.ts',
  statusText: 'PROJECT_AGENT_V2_STATUS.md',
  traceRequirementConsistencySmokeSource:
    'scripts/agent-session-v3-runtime-boundary-production-adapter-evidence-trace-requirement-consistency-checkpoint-smoke.ts',
});

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');

assert.equal(productionAdapterTraceRequirementConsistencyCheckpoint.adapterContractPromotionAllowed, false);
assert.equal(productionAdapterTraceRequirementConsistencyCheckpoint.formalContractReady, false);
assert.equal(productionAdapterTraceRequirementConsistencyCheckpoint.productionReady, false);

assert.deepEqual(
  rowsForReason('blocked-by-phase').map((row) => row.fieldName).sort(),
  [
    'blockerSource',
    'recoverability',
    'userActionRequired',
  ],
);
assert.deepEqual(
  rowsForReason('runtime-failed').map((row) => row.fieldName).sort(),
  [
    'errorClass',
    'failureOrigin',
    'retryability',
    'sideEffectCommitted',
    'userVisibleFailureReason',
  ],
);

for (const row of productionAdapterTraceRequirementConsistencyCheckpoint.rows) {
  const contractField = getAgentSessionV3RuntimeStopEvidenceFields(row.reason)
    .find((field) => field.name === row.fieldName);

  assert.ok(contractField, `${row.reason}.${row.fieldName} should exist in the stop evidence contract.`);
  assert.equal(contractField.source, 'future-production-adapter');
  assert.equal(row.adapterContractPromotionAllowed, false);
  assert.equal(row.evidenceOnly, true);
  assert.equal(row.formalContractReady, false);
  assert.equal(row.productionReady, false);
  assert.deepEqual(row.requiredSources, [
    'payload-final-gate',
    'contract-readiness-preflight',
    'evidence-source-map',
  ]);

  if (row.reason === 'blocked-by-phase') {
    assert.equal(row.traceRequirement, 'real-or-production-like-trace-required');
  }

  if (row.reason === 'runtime-failed') {
    assert.equal(row.traceRequirement, 'real-or-production-like-trace-plus-failure-kind-required');
  }
}

assert.deepEqual(
  productionAdapterTraceRequirementConsistencyCheckpoint.rows
    .filter((row) => row.traceRequirement === 'real-or-production-like-trace-required')
    .map((row) => createFieldKey(row.reason, row.fieldName))
    .sort(),
  [
    'blocked-by-phase.blockerSource',
    'blocked-by-phase.recoverability',
    'blocked-by-phase.userActionRequired',
  ],
);
assert.deepEqual(
  productionAdapterTraceRequirementConsistencyCheckpoint.rows
    .filter((row) => row.traceRequirement === 'real-or-production-like-trace-plus-failure-kind-required')
    .map((row) => createFieldKey(row.reason, row.fieldName))
    .sort(),
  [
    'runtime-failed.errorClass',
    'runtime-failed.failureOrigin',
    'runtime-failed.retryability',
    'runtime-failed.sideEffectCommitted',
    'runtime-failed.userVisibleFailureReason',
  ],
);

for (const excludedReason of excludedReasons) {
  assert.equal(
    productionAdapterTraceRequirementConsistencyCheckpoint.rows.some((row) => row.reason === excludedReason),
    false,
    `${excludedReason} should stay outside the production-adapter trace requirement consistency checkpoint.`,
  );
}

assert.match(evidenceSourceMapSmokeSource, /real-or-production-like-trace-required/u);
assert.match(evidenceSourceMapSmokeSource, /real-or-production-like-trace-plus-failure-kind-required/u);
assert.match(evidenceSourceMapSmokeSource, /must not promote an adapter contract/u);
assert.match(readinessPreflightSmokeSource, /missing-real-or-production-like-traces/u);
assert.match(readinessPreflightSmokeSource, /failure-result-kind-missing/u);
assert.match(finalGateSmokeSource, /payload-contract promotion is not allowed now/u);
assert.match(finalGateSmokeSource, /missing-real-or-production-like-traces/u);
assert.match(formalGateSmokeSource, /not sufficient to introduce a formal adapter-payload TypeScript contract/u);

const serializedCheckpoint = JSON.stringify(productionAdapterTraceRequirementConsistencyCheckpoint);
assert.doesNotMatch(
  serializedCheckpoint,
  /adapterContractPromotionAllowed":true|productionReady":true|formalContractReady":true/u,
  'Trace requirements must not become promotion rules.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Trace requirement consistency should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Trace requirement consistency should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain/iu,
  'Trace requirement consistency should not define fixed workflows or fallback chains.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /implementationQueue|orderedSteps|runtimeAuthority|experimental-adapter/u,
  'Trace requirement consistency should remain a pre-contract audit checkpoint.',
);

assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(PhasePort|Adapter).*(Payload|Contract)|type AgentSessionV3Runtime(PhasePort|Adapter).*Payload/u,
  'Trace requirement consistency should not add formal phase-port or adapter payload types.',
);
assert.doesNotMatch(
  boundarySource,
  /kind:\s*'failure'/u,
  'Trace requirement consistency should not add a phase-port failure result kind.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Trace requirement consistency must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  traceRequirementConsistencySmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Trace requirement consistency should not call production v2 modules.',
);

assert.match(preflightAuditText, /Production-Adapter Evidence Trace Requirement Consistency Checkpoint Status/u);
assert.match(
  preflightAuditText,
  /agent-session-v3-runtime-boundary-production-adapter-evidence-trace-requirement-consistency-checkpoint-smoke\.ts/u,
);
assert.match(preflightAuditText, /trace requirements remain evidence criteria/u);
assert.match(preflightAuditText, /not production wiring/u);
assert.match(statusText, /V3 runtime boundary production-adapter evidence trace requirement consistency checkpoint.*Completed/u);
assert.match(
  statusText,
  /agent-session-v3-runtime-boundary-production-adapter-evidence-trace-requirement-consistency-checkpoint-smoke\.ts/u,
);

console.log('agent session v3 runtime boundary production-adapter evidence trace requirement consistency checkpoint smoke ok');
