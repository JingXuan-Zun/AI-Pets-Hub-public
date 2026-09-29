import assert from 'node:assert/strict';
import {
  AGENT_SESSION_V3_RUNTIME_STOP_EVIDENCE_CONTRACT,
  createAgentSessionV3RuntimeBoundaryContract,
  getAgentSessionV3RuntimeStopEvidenceFields,
  type AgentSessionV3RuntimeBoundaryStopReason,
  type AgentSessionV3RuntimePhasePortResult,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

type PhasePortPayloadField =
  | 'pauseReason'
  | 'waitSource';

type PhasePortPayloadContractReadinessDecision =
  | 'formal-contract-ready'
  | 'keep-smoke-only';

type PhasePortPayloadCurrentSupport =
  | 'missing'
  | 'partial-diagnostic-only';

type PhasePortPayloadContractBlocker =
  | 'no-structured-phase-payload'
  | 'requires-future-phase-payload'
  | 'requires-real-production-like-traces'
  | 'requires-user-visible-semantics';

interface PhasePortPayloadContractReadinessRow {
  blockers: readonly PhasePortPayloadContractBlocker[];
  currentSource: string | null;
  currentSupport: PhasePortPayloadCurrentSupport;
  decision: PhasePortPayloadContractReadinessDecision;
  fieldName: PhasePortPayloadField;
  productionReady: false;
  reason: Extract<AgentSessionV3RuntimeBoundaryStopReason, 'waiting-for-phase-event'>;
}

const phasePortPayloadContractReadiness = [
  {
    blockers: [
      'no-structured-phase-payload',
      'requires-future-phase-payload',
      'requires-real-production-like-traces',
    ],
    currentSource: null,
    currentSupport: 'missing',
    decision: 'keep-smoke-only',
    fieldName: 'waitSource',
    productionReady: false,
    reason: 'waiting-for-phase-event',
  },
  {
    blockers: [
      'no-structured-phase-payload',
      'requires-user-visible-semantics',
      'requires-real-production-like-traces',
    ],
    currentSource: 'AgentSessionV3RuntimePhasePortResult.waiting.reason',
    currentSupport: 'partial-diagnostic-only',
    decision: 'keep-smoke-only',
    fieldName: 'pauseReason',
    productionReady: false,
    reason: 'waiting-for-phase-event',
  },
] as const satisfies readonly PhasePortPayloadContractReadinessRow[];

function createFieldKey(reason: AgentSessionV3RuntimeBoundaryStopReason, fieldName: string) {
  return `${reason}.${fieldName}`;
}

const {
  blockerMapSmokeSource,
  boundarySource,
  phasePortPayloadContractReadinessSmokeSource,
  preflightAuditText,
  readoutSummarySmokeSource,
  sourceMappingSmokeSource,
  statusText,
  stopPayloadRollupCheckpointSmokeSource,
  waitingPayloadBlockerReviewSmokeSource,
  waitingPayloadPromotionReadinessSmokeSource,
} = readProjectSources({
  blockerMapSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-stop-evidence-blocker-map-smoke.ts',
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  phasePortPayloadContractReadinessSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-phase-port-payload-contract-readiness-rollup-smoke.ts',
  preflightAuditText: 'PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md',
  readoutSummarySmokeSource:
    'scripts/agent-session-v3-runtime-boundary-stop-payload-readout-summary-audit-smoke.ts',
  sourceMappingSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-stop-payload-source-mapping-smoke.ts',
  statusText: 'PROJECT_AGENT_V2_STATUS.md',
  stopPayloadRollupCheckpointSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-stop-payload-audit-rollup-checkpoint-smoke.ts',
  waitingPayloadBlockerReviewSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-phase-port-waiting-payload-blocker-review-smoke.ts',
  waitingPayloadPromotionReadinessSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-waiting-payload-promotion-readiness-smoke.ts',
});

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');

const currentWaitingResult: AgentSessionV3RuntimePhasePortResult = {
  kind: 'waiting',
  reason: 'phase-port payload contract-readiness diagnostic only',
};
assert.deepEqual(Object.keys(currentWaitingResult).sort(), ['kind', 'reason']);
assert.equal('waitSource' in currentWaitingResult, false);
assert.equal('pauseReason' in currentWaitingResult, false);
assert.equal('resumeTriggerOwner' in currentWaitingResult, false);
assert.equal('waitBudget' in currentWaitingResult, false);

const phasePortContractFields = Object.entries(AGENT_SESSION_V3_RUNTIME_STOP_EVIDENCE_CONTRACT)
  .flatMap(([reason, fields]) => (fields ?? [])
    .filter((field) => field.source === 'phase-port-result')
    .map((field) => ({
      fieldKey: createFieldKey(reason as AgentSessionV3RuntimeBoundaryStopReason, field.name),
      fieldName: field.name,
      reason: reason as AgentSessionV3RuntimeBoundaryStopReason,
    })));

assert.deepEqual(
  phasePortPayloadContractReadiness
    .map((row) => createFieldKey(row.reason, row.fieldName))
    .sort(),
  phasePortContractFields.map((field) => field.fieldKey).sort(),
  'Phase-port contract-readiness rollup should cover every phase-port-owned stop-payload field exactly once.',
);

assert.deepEqual(
  phasePortContractFields.map((field) => field.fieldKey).sort(),
  ['waiting-for-phase-event.pauseReason', 'waiting-for-phase-event.waitSource'],
  'Only waiting phase-port fields should be phase-port-owned for now.',
);

const waitingStopEvidenceFields = getAgentSessionV3RuntimeStopEvidenceFields('waiting-for-phase-event');
for (const row of phasePortPayloadContractReadiness) {
  const contractField = waitingStopEvidenceFields.find((field) => field.name === row.fieldName);
  assert.ok(contractField, `${row.fieldName} should exist in waiting stop evidence contract.`);
  assert.equal(contractField.source, 'phase-port-result');
  assert.equal(row.productionReady, false);
  assert.equal(row.decision, 'keep-smoke-only');
  assert.ok(row.blockers.includes('no-structured-phase-payload'));
  assert.ok(row.blockers.includes('requires-real-production-like-traces'));

  if (row.fieldName === 'waitSource') {
    assert.equal(row.currentSource, null);
    assert.equal(row.currentSupport, 'missing');
    assert.ok(row.blockers.includes('requires-future-phase-payload'));
  }

  if (row.fieldName === 'pauseReason') {
    assert.equal(row.currentSource, 'AgentSessionV3RuntimePhasePortResult.waiting.reason');
    assert.equal(row.currentSupport, 'partial-diagnostic-only');
    assert.ok(row.blockers.includes('requires-user-visible-semantics'));
  }
}

assert.deepEqual(
  phasePortPayloadContractReadiness
    .filter((row) => row.decision === 'formal-contract-ready'),
  [],
  'No phase-port-owned stop-payload field should be promoted into a formal payload contract yet.',
);
assert.deepEqual(
  phasePortPayloadContractReadiness
    .filter((row) => row.currentSupport === 'partial-diagnostic-only')
    .map((row) => row.fieldName),
  ['pauseReason'],
);
assert.deepEqual(
  phasePortPayloadContractReadiness
    .filter((row) => row.currentSupport === 'missing')
    .map((row) => row.fieldName),
  ['waitSource'],
);

assert.match(waitingPayloadBlockerReviewSmokeSource, /partial-diagnostic-only/u);
assert.match(waitingPayloadBlockerReviewSmokeSource, /future-phase-payload-required/u);
assert.match(waitingPayloadPromotionReadinessSmokeSource, /No structured waiting payload field is formal-contract-ready/u);
assert.match(sourceMappingSmokeSource, /missing-future-phase-port-payload/u);
assert.match(sourceMappingSmokeSource, /partial-from-current-phase-port-result/u);
assert.match(blockerMapSmokeSource, /future-phase-adapter/u);
assert.match(readoutSummarySmokeSource, /phase-port-partial-or-future-payload/u);
assert.match(stopPayloadRollupCheckpointSmokeSource, /phase-port-result/u);

const serializedReadiness = JSON.stringify(phasePortPayloadContractReadiness);
assert.doesNotMatch(
  serializedReadiness,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Phase-port payload contract-readiness rollup should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedReadiness,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Phase-port payload contract-readiness rollup should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedReadiness,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain/iu,
  'Phase-port payload contract-readiness rollup should not define fixed workflows or fallback chains.',
);
assert.doesNotMatch(
  serializedReadiness,
  /productionReady":true|runtimeAuthority|experimental-adapter/u,
  'Phase-port payload contract-readiness rollup should not grant runtime authority.',
);

assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Phase-port payload contract-readiness rollup must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  phasePortPayloadContractReadinessSmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Phase-port payload contract-readiness rollup should not call production v2 modules.',
);

assert.match(preflightAuditText, /Phase-Port Payload Contract-Readiness Rollup Status/u);
assert.match(
  preflightAuditText,
  /agent-session-v3-runtime-boundary-phase-port-payload-contract-readiness-rollup-smoke\.ts/u,
);
assert.match(preflightAuditText, /waitSource/u);
assert.match(preflightAuditText, /pauseReason/u);
assert.match(preflightAuditText, /too shallow for a formal payload contract/u);
assert.match(preflightAuditText, /not production wiring/u);
assert.match(statusText, /V3 runtime boundary phase-port payload contract-readiness rollup.*Completed/u);
assert.match(
  statusText,
  /agent-session-v3-runtime-boundary-phase-port-payload-contract-readiness-rollup-smoke\.ts/u,
);

console.log('agent session v3 runtime boundary phase-port payload contract-readiness rollup smoke ok');
