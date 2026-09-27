import assert from 'node:assert/strict';
import {
  createAgentSessionV3RuntimeBoundaryContract,
  getAgentSessionV3RuntimeStopEvidenceFields,
  type AgentSessionV3RuntimeBoundaryStopReason,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

type ProductionAdapterEvidenceFamily =
  | 'blocked'
  | 'failure';

type ProductionAdapterEvidenceSourceKind =
  | 'adapter-observed-classification'
  | 'adapter-observed-safety-signal'
  | 'adapter-observed-user-facing-signal';

type ProductionAdapterEvidenceTraceRequirement =
  | 'real-or-production-like-trace-required'
  | 'real-or-production-like-trace-plus-failure-kind-required';

interface ProductionAdapterEvidenceSourceMapRow {
  adapterContractPromotionAllowed: false;
  evidenceSourceKind: ProductionAdapterEvidenceSourceKind;
  family: ProductionAdapterEvidenceFamily;
  fieldName: string;
  formalContractReady: false;
  productionReady: false;
  reason: Extract<AgentSessionV3RuntimeBoundaryStopReason, 'blocked-by-phase' | 'runtime-failed'>;
  requiredFutureEvidence: string;
  traceRequirement: ProductionAdapterEvidenceTraceRequirement;
}

interface ProductionAdapterEvidenceSourceMap {
  adapterContractPromotionAllowed: false;
  formalContractReady: false;
  gate: 'production-adapter-evidence-source-map';
  productionReady: false;
  rows: readonly ProductionAdapterEvidenceSourceMapRow[];
}

const productionAdapterEvidenceSourceMap = {
  adapterContractPromotionAllowed: false,
  formalContractReady: false,
  gate: 'production-adapter-evidence-source-map',
  productionReady: false,
  rows: [
    {
      adapterContractPromotionAllowed: false,
      evidenceSourceKind: 'adapter-observed-classification',
      family: 'blocked',
      fieldName: 'blockerSource',
      formalContractReady: false,
      productionReady: false,
      reason: 'blocked-by-phase',
      requiredFutureEvidence: 'structured blocker source classification emitted by a future production adapter',
      traceRequirement: 'real-or-production-like-trace-required',
    },
    {
      adapterContractPromotionAllowed: false,
      evidenceSourceKind: 'adapter-observed-safety-signal',
      family: 'blocked',
      fieldName: 'recoverability',
      formalContractReady: false,
      productionReady: false,
      reason: 'blocked-by-phase',
      requiredFutureEvidence: 'structured recoverability signal emitted by a future production adapter',
      traceRequirement: 'real-or-production-like-trace-required',
    },
    {
      adapterContractPromotionAllowed: false,
      evidenceSourceKind: 'adapter-observed-user-facing-signal',
      family: 'blocked',
      fieldName: 'userActionRequired',
      formalContractReady: false,
      productionReady: false,
      reason: 'blocked-by-phase',
      requiredFutureEvidence: 'structured user-action-required signal emitted by a future production adapter',
      traceRequirement: 'real-or-production-like-trace-required',
    },
    {
      adapterContractPromotionAllowed: false,
      evidenceSourceKind: 'adapter-observed-classification',
      family: 'failure',
      fieldName: 'errorClass',
      formalContractReady: false,
      productionReady: false,
      reason: 'runtime-failed',
      requiredFutureEvidence: 'normalized error class emitted by a future failure-capable production adapter',
      traceRequirement: 'real-or-production-like-trace-plus-failure-kind-required',
    },
    {
      adapterContractPromotionAllowed: false,
      evidenceSourceKind: 'adapter-observed-classification',
      family: 'failure',
      fieldName: 'failureOrigin',
      formalContractReady: false,
      productionReady: false,
      reason: 'runtime-failed',
      requiredFutureEvidence: 'structured failure origin emitted by a future failure-capable production adapter',
      traceRequirement: 'real-or-production-like-trace-plus-failure-kind-required',
    },
    {
      adapterContractPromotionAllowed: false,
      evidenceSourceKind: 'adapter-observed-safety-signal',
      family: 'failure',
      fieldName: 'retryability',
      formalContractReady: false,
      productionReady: false,
      reason: 'runtime-failed',
      requiredFutureEvidence: 'structured retryability signal emitted by a future failure-capable production adapter',
      traceRequirement: 'real-or-production-like-trace-plus-failure-kind-required',
    },
    {
      adapterContractPromotionAllowed: false,
      evidenceSourceKind: 'adapter-observed-safety-signal',
      family: 'failure',
      fieldName: 'sideEffectCommitted',
      formalContractReady: false,
      productionReady: false,
      reason: 'runtime-failed',
      requiredFutureEvidence: 'structured side-effect commit signal emitted by a future failure-capable production adapter',
      traceRequirement: 'real-or-production-like-trace-plus-failure-kind-required',
    },
    {
      adapterContractPromotionAllowed: false,
      evidenceSourceKind: 'adapter-observed-user-facing-signal',
      family: 'failure',
      fieldName: 'userVisibleFailureReason',
      formalContractReady: false,
      productionReady: false,
      reason: 'runtime-failed',
      requiredFutureEvidence: 'user-visible failure reason emitted by a future failure-capable production adapter',
      traceRequirement: 'real-or-production-like-trace-plus-failure-kind-required',
    },
  ],
} as const satisfies ProductionAdapterEvidenceSourceMap;

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

function rowsForReason(reason: ProductionAdapterEvidenceSourceMapRow['reason']) {
  return productionAdapterEvidenceSourceMap.rows.filter((row) => row.reason === reason);
}

const {
  blockedBlockerReviewSmokeSource,
  boundarySource,
  evidenceSourceMapSmokeSource,
  failureBlockerReviewSmokeSource,
  finalGateSmokeSource,
  preflightAuditText,
  readinessPreflightSmokeSource,
  statusText,
  stopPayloadSourceMappingSmokeSource,
} = readProjectSources({
  blockedBlockerReviewSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-blocked-payload-blocker-review-smoke.ts',
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  evidenceSourceMapSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-production-adapter-evidence-source-map-smoke.ts',
  failureBlockerReviewSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-failure-payload-blocker-review-smoke.ts',
  finalGateSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-payload-closeout-final-preflight-gate-smoke.ts',
  preflightAuditText: 'PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md',
  readinessPreflightSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-production-adapter-contract-readiness-preflight-smoke.ts',
  statusText: 'PROJECT_AGENT_V2_STATUS.md',
  stopPayloadSourceMappingSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-stop-payload-source-mapping-smoke.ts',
});

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');

assert.equal(productionAdapterEvidenceSourceMap.adapterContractPromotionAllowed, false);
assert.equal(productionAdapterEvidenceSourceMap.formalContractReady, false);
assert.equal(productionAdapterEvidenceSourceMap.productionReady, false);

assert.deepEqual(
  rowsForReason('blocked-by-phase').map((row) => row.fieldName).sort(),
  [
    'blockerSource',
    'recoverability',
    'userActionRequired',
  ],
  'Blocked production-adapter evidence map should include only adapter-owned blocked fields.',
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
  'Failure production-adapter evidence map should include only adapter-owned failure fields.',
);

for (const row of productionAdapterEvidenceSourceMap.rows) {
  const contractField = getAgentSessionV3RuntimeStopEvidenceFields(row.reason)
    .find((field) => field.name === row.fieldName);

  assert.ok(contractField, `${row.reason}.${row.fieldName} should exist in the stop evidence contract.`);
  assert.equal(contractField.source, 'future-production-adapter');
  assert.equal(row.adapterContractPromotionAllowed, false);
  assert.equal(row.formalContractReady, false);
  assert.equal(row.productionReady, false);
  assert.ok(row.requiredFutureEvidence.includes('future'));
  assert.ok(row.traceRequirement.includes('real-or-production-like-trace'));

  if (row.reason === 'blocked-by-phase') {
    assert.equal(row.traceRequirement, 'real-or-production-like-trace-required');
  }

  if (row.reason === 'runtime-failed') {
    assert.equal(row.traceRequirement, 'real-or-production-like-trace-plus-failure-kind-required');
  }
}

assert.deepEqual(
  productionAdapterEvidenceSourceMap.rows
    .filter((row) => row.evidenceSourceKind === 'adapter-observed-classification')
    .map((row) => createFieldKey(row.reason, row.fieldName))
    .sort(),
  [
    'blocked-by-phase.blockerSource',
    'runtime-failed.errorClass',
    'runtime-failed.failureOrigin',
  ],
);
assert.deepEqual(
  productionAdapterEvidenceSourceMap.rows
    .filter((row) => row.evidenceSourceKind === 'adapter-observed-safety-signal')
    .map((row) => createFieldKey(row.reason, row.fieldName))
    .sort(),
  [
    'blocked-by-phase.recoverability',
    'runtime-failed.retryability',
    'runtime-failed.sideEffectCommitted',
  ],
);
assert.deepEqual(
  productionAdapterEvidenceSourceMap.rows
    .filter((row) => row.evidenceSourceKind === 'adapter-observed-user-facing-signal')
    .map((row) => createFieldKey(row.reason, row.fieldName))
    .sort(),
  [
    'blocked-by-phase.userActionRequired',
    'runtime-failed.userVisibleFailureReason',
  ],
);

for (const excludedReason of excludedReasons) {
  assert.equal(
    productionAdapterEvidenceSourceMap.rows.some((row) => row.reason === excludedReason),
    false,
    `${excludedReason} should stay outside the payload-derived production-adapter evidence source map.`,
  );
}

assert.match(readinessPreflightSmokeSource, /production-adapter-contract-deferred/u);
assert.match(readinessPreflightSmokeSource, /not-production-adapter-owned/u);
assert.match(stopPayloadSourceMappingSmokeSource, /missing-future-production-adapter/u);
assert.match(blockedBlockerReviewSmokeSource, /future-production-adapter-required/u);
assert.match(failureBlockerReviewSmokeSource, /future-production-adapter-required/u);
assert.match(finalGateSmokeSource, /payload-contract promotion is not allowed now/u);

const serializedMap = JSON.stringify(productionAdapterEvidenceSourceMap);
assert.doesNotMatch(
  serializedMap,
  /adapterContractPromotionAllowed":true|productionReady":true|formalContractReady":true/u,
  'Production-adapter evidence source map must not promote an adapter contract.',
);
assert.doesNotMatch(
  serializedMap,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Production-adapter evidence source map should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedMap,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Production-adapter evidence source map should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedMap,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain/iu,
  'Production-adapter evidence source map should not define fixed workflows or fallback chains.',
);
assert.doesNotMatch(
  serializedMap,
  /implementationQueue|orderedSteps|runtimeAuthority|experimental-adapter/u,
  'Production-adapter evidence source map should remain a pre-contract audit map.',
);

assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(PhasePort|Adapter).*(Payload|Contract)|type AgentSessionV3Runtime(PhasePort|Adapter).*Payload/u,
  'Production-adapter evidence source map should not add formal phase-port or adapter payload types.',
);
assert.doesNotMatch(
  boundarySource,
  /kind:\s*'failure'/u,
  'Production-adapter evidence source map should not add a phase-port failure result kind.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Production-adapter evidence source map must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  evidenceSourceMapSmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Production-adapter evidence source map should not call production v2 modules.',
);

assert.match(preflightAuditText, /Production-Adapter Evidence Source Map Status/u);
assert.match(
  preflightAuditText,
  /agent-session-v3-runtime-boundary-production-adapter-evidence-source-map-smoke\.ts/u,
);
assert.match(preflightAuditText, /production-adapter evidence source map does not promote an adapter contract/u);
assert.match(preflightAuditText, /not production wiring/u);
assert.match(statusText, /V3 runtime boundary production-adapter evidence source map.*Completed/u);
assert.match(
  statusText,
  /agent-session-v3-runtime-boundary-production-adapter-evidence-source-map-smoke\.ts/u,
);

console.log('agent session v3 runtime boundary production-adapter evidence source map smoke ok');
