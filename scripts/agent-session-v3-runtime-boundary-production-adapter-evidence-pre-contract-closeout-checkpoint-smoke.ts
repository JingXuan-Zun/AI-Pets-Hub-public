import assert from 'node:assert/strict';
import {
  createAgentSessionV3RuntimeBoundaryContract,
  getAgentSessionV3RuntimeStopEvidenceFields,
  type AgentSessionV3RuntimeBoundaryStopReason,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

type ProductionAdapterEvidencePreContractCloseoutFamily =
  | 'blocked'
  | 'failure';

type ProductionAdapterEvidencePreContractCloseoutCoverage =
  | 'contract-readiness-preflight'
  | 'evidence-source-map'
  | 'trace-requirement-consistency';

type ProductionAdapterEvidencePreContractCloseoutBlocker =
  | 'future-production-adapter-evidence-missing'
  | 'missing-real-or-production-like-traces'
  | 'phase-port-failure-result-kind-missing';

interface ProductionAdapterEvidencePreContractCloseoutRow {
  adapterContractPromotionAllowed: false;
  blockers: readonly ProductionAdapterEvidencePreContractCloseoutBlocker[];
  coverage: readonly ProductionAdapterEvidencePreContractCloseoutCoverage[];
  family: ProductionAdapterEvidencePreContractCloseoutFamily;
  fieldName: string;
  formalContractReady: false;
  productionReady: false;
  reason: Extract<AgentSessionV3RuntimeBoundaryStopReason, 'blocked-by-phase' | 'runtime-failed'>;
  remainsPreContractAuditOnly: true;
}

interface ProductionAdapterEvidencePreContractCloseoutCheckpoint {
  adapterContractPromotionAllowed: false;
  formalContractReady: false;
  gate: 'production-adapter-evidence-pre-contract-closeout';
  productionReady: false;
  rows: readonly ProductionAdapterEvidencePreContractCloseoutRow[];
}

const productionAdapterEvidencePreContractCloseoutCheckpoint = {
  adapterContractPromotionAllowed: false,
  formalContractReady: false,
  gate: 'production-adapter-evidence-pre-contract-closeout',
  productionReady: false,
  rows: [
    {
      adapterContractPromotionAllowed: false,
      blockers: [
        'future-production-adapter-evidence-missing',
        'missing-real-or-production-like-traces',
      ],
      coverage: [
        'contract-readiness-preflight',
        'evidence-source-map',
        'trace-requirement-consistency',
      ],
      family: 'blocked',
      fieldName: 'blockerSource',
      formalContractReady: false,
      productionReady: false,
      reason: 'blocked-by-phase',
      remainsPreContractAuditOnly: true,
    },
    {
      adapterContractPromotionAllowed: false,
      blockers: [
        'future-production-adapter-evidence-missing',
        'missing-real-or-production-like-traces',
      ],
      coverage: [
        'contract-readiness-preflight',
        'evidence-source-map',
        'trace-requirement-consistency',
      ],
      family: 'blocked',
      fieldName: 'recoverability',
      formalContractReady: false,
      productionReady: false,
      reason: 'blocked-by-phase',
      remainsPreContractAuditOnly: true,
    },
    {
      adapterContractPromotionAllowed: false,
      blockers: [
        'future-production-adapter-evidence-missing',
        'missing-real-or-production-like-traces',
      ],
      coverage: [
        'contract-readiness-preflight',
        'evidence-source-map',
        'trace-requirement-consistency',
      ],
      family: 'blocked',
      fieldName: 'userActionRequired',
      formalContractReady: false,
      productionReady: false,
      reason: 'blocked-by-phase',
      remainsPreContractAuditOnly: true,
    },
    {
      adapterContractPromotionAllowed: false,
      blockers: [
        'phase-port-failure-result-kind-missing',
        'future-production-adapter-evidence-missing',
        'missing-real-or-production-like-traces',
      ],
      coverage: [
        'contract-readiness-preflight',
        'evidence-source-map',
        'trace-requirement-consistency',
      ],
      family: 'failure',
      fieldName: 'errorClass',
      formalContractReady: false,
      productionReady: false,
      reason: 'runtime-failed',
      remainsPreContractAuditOnly: true,
    },
    {
      adapterContractPromotionAllowed: false,
      blockers: [
        'phase-port-failure-result-kind-missing',
        'future-production-adapter-evidence-missing',
        'missing-real-or-production-like-traces',
      ],
      coverage: [
        'contract-readiness-preflight',
        'evidence-source-map',
        'trace-requirement-consistency',
      ],
      family: 'failure',
      fieldName: 'failureOrigin',
      formalContractReady: false,
      productionReady: false,
      reason: 'runtime-failed',
      remainsPreContractAuditOnly: true,
    },
    {
      adapterContractPromotionAllowed: false,
      blockers: [
        'phase-port-failure-result-kind-missing',
        'future-production-adapter-evidence-missing',
        'missing-real-or-production-like-traces',
      ],
      coverage: [
        'contract-readiness-preflight',
        'evidence-source-map',
        'trace-requirement-consistency',
      ],
      family: 'failure',
      fieldName: 'retryability',
      formalContractReady: false,
      productionReady: false,
      reason: 'runtime-failed',
      remainsPreContractAuditOnly: true,
    },
    {
      adapterContractPromotionAllowed: false,
      blockers: [
        'phase-port-failure-result-kind-missing',
        'future-production-adapter-evidence-missing',
        'missing-real-or-production-like-traces',
      ],
      coverage: [
        'contract-readiness-preflight',
        'evidence-source-map',
        'trace-requirement-consistency',
      ],
      family: 'failure',
      fieldName: 'sideEffectCommitted',
      formalContractReady: false,
      productionReady: false,
      reason: 'runtime-failed',
      remainsPreContractAuditOnly: true,
    },
    {
      adapterContractPromotionAllowed: false,
      blockers: [
        'phase-port-failure-result-kind-missing',
        'future-production-adapter-evidence-missing',
        'missing-real-or-production-like-traces',
      ],
      coverage: [
        'contract-readiness-preflight',
        'evidence-source-map',
        'trace-requirement-consistency',
      ],
      family: 'failure',
      fieldName: 'userVisibleFailureReason',
      formalContractReady: false,
      productionReady: false,
      reason: 'runtime-failed',
      remainsPreContractAuditOnly: true,
    },
  ],
} as const satisfies ProductionAdapterEvidencePreContractCloseoutCheckpoint;

const excludedReasons = [
  'cancelled',
  'continue-with-event',
  'invalid-transition',
  'transition-budget-exhausted',
  'waiting-for-phase-event',
] as const satisfies readonly AgentSessionV3RuntimeBoundaryStopReason[];

function rowsForReason(reason: ProductionAdapterEvidencePreContractCloseoutRow['reason']) {
  return productionAdapterEvidencePreContractCloseoutCheckpoint.rows.filter((row) => row.reason === reason);
}

const {
  boundarySource,
  closeoutSmokeSource,
  evidenceSourceMapSmokeSource,
  finalGateSmokeSource,
  preflightAuditText,
  readinessPreflightSmokeSource,
  statusText,
  traceRequirementConsistencySmokeSource,
} = readProjectSources({
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  closeoutSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-production-adapter-evidence-pre-contract-closeout-checkpoint-smoke.ts',
  evidenceSourceMapSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-production-adapter-evidence-source-map-smoke.ts',
  finalGateSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-payload-closeout-final-preflight-gate-smoke.ts',
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

assert.equal(productionAdapterEvidencePreContractCloseoutCheckpoint.adapterContractPromotionAllowed, false);
assert.equal(productionAdapterEvidencePreContractCloseoutCheckpoint.formalContractReady, false);
assert.equal(productionAdapterEvidencePreContractCloseoutCheckpoint.productionReady, false);

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

for (const row of productionAdapterEvidencePreContractCloseoutCheckpoint.rows) {
  const contractField = getAgentSessionV3RuntimeStopEvidenceFields(row.reason)
    .find((field) => field.name === row.fieldName);

  assert.ok(contractField, `${row.reason}.${row.fieldName} should exist in the stop evidence contract.`);
  assert.equal(contractField.source, 'future-production-adapter');
  assert.equal(row.adapterContractPromotionAllowed, false);
  assert.equal(row.formalContractReady, false);
  assert.equal(row.productionReady, false);
  assert.equal(row.remainsPreContractAuditOnly, true);
  assert.deepEqual(row.coverage, [
    'contract-readiness-preflight',
    'evidence-source-map',
    'trace-requirement-consistency',
  ]);
  assert.ok(row.blockers.includes('future-production-adapter-evidence-missing'));
  assert.ok(row.blockers.includes('missing-real-or-production-like-traces'));

  if (row.reason === 'blocked-by-phase') {
    assert.deepEqual(row.blockers, [
      'future-production-adapter-evidence-missing',
      'missing-real-or-production-like-traces',
    ]);
  }

  if (row.reason === 'runtime-failed') {
    assert.ok(row.blockers.includes('phase-port-failure-result-kind-missing'));
  }
}

for (const excludedReason of excludedReasons) {
  assert.equal(
    productionAdapterEvidencePreContractCloseoutCheckpoint.rows.some((row) => row.reason === excludedReason),
    false,
    `${excludedReason} should stay outside the production-adapter evidence pre-contract closeout checkpoint.`,
  );
}

assert.match(readinessPreflightSmokeSource, /production-adapter-contract-deferred/u);
assert.match(readinessPreflightSmokeSource, /not-production-adapter-owned/u);
assert.match(evidenceSourceMapSmokeSource, /production-adapter evidence source map does not promote an adapter contract/u);
assert.match(evidenceSourceMapSmokeSource, /real-or-production-like-trace-plus-failure-kind-required/u);
assert.match(traceRequirementConsistencySmokeSource, /Trace requirements must not become promotion rules/u);
assert.match(traceRequirementConsistencySmokeSource, /real-or-production-like-trace-plus-failure-kind-required/u);
assert.match(finalGateSmokeSource, /payload-contract promotion is not allowed now/u);

const serializedCloseout = JSON.stringify(productionAdapterEvidencePreContractCloseoutCheckpoint);
assert.doesNotMatch(
  serializedCloseout,
  /adapterContractPromotionAllowed":true|productionReady":true|formalContractReady":true/u,
  'Production-adapter evidence pre-contract closeout must not allow adapter-contract promotion.',
);
assert.doesNotMatch(
  serializedCloseout,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Production-adapter evidence pre-contract closeout should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedCloseout,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Production-adapter evidence pre-contract closeout should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedCloseout,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain/iu,
  'Production-adapter evidence pre-contract closeout should not define fixed workflows or fallback chains.',
);
assert.doesNotMatch(
  serializedCloseout,
  /implementationQueue|orderedSteps|runtimeAuthority|experimental-adapter/u,
  'Production-adapter evidence pre-contract closeout should remain a pre-contract audit checkpoint.',
);

assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(PhasePort|Adapter).*(Payload|Contract)|type AgentSessionV3Runtime(PhasePort|Adapter).*Payload/u,
  'Production-adapter evidence pre-contract closeout should not add formal phase-port or adapter payload types.',
);
assert.doesNotMatch(
  boundarySource,
  /kind:\s*'failure'/u,
  'Production-adapter evidence pre-contract closeout should not add a phase-port failure result kind.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Production-adapter evidence pre-contract closeout must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  closeoutSmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Production-adapter evidence pre-contract closeout should not call production v2 modules.',
);

assert.match(preflightAuditText, /Production-Adapter Evidence Pre-Contract Closeout Checkpoint Status/u);
assert.match(
  preflightAuditText,
  /agent-session-v3-runtime-boundary-production-adapter-evidence-pre-contract-closeout-checkpoint-smoke\.ts/u,
);
assert.match(preflightAuditText, /adapter contracts remain deferred/u);
assert.match(preflightAuditText, /not production wiring/u);
assert.match(statusText, /V3 runtime boundary production-adapter evidence pre-contract closeout checkpoint.*Completed/u);
assert.match(
  statusText,
  /agent-session-v3-runtime-boundary-production-adapter-evidence-pre-contract-closeout-checkpoint-smoke\.ts/u,
);

console.log('agent session v3 runtime boundary production-adapter evidence pre-contract closeout checkpoint smoke ok');
