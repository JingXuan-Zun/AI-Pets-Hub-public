import assert from 'node:assert/strict';
import {
  createAgentSessionV3RuntimeBoundaryContract,
  extractAgentSessionV3RuntimeRunnerDerivedStopMetadata,
  getAgentSessionV3RuntimeRunnerDerivedStopMetadataFields,
  getAgentSessionV3RuntimeStopEvidenceFields,
  runAgentSessionV3PilotRunner,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

type TransitionBudgetPayloadCandidateField =
  | 'budgetOwner'
  | 'modelBudgetState'
  | 'recoveryCount'
  | 'taskProgress'
  | 'toolBudgetState'
  | 'transitionCount';

type TransitionBudgetPayloadPromotionDecision =
  | 'already-covered-by-runner-derived-contract'
  | 'keep-smoke-only';

type TransitionBudgetPayloadPromotionBlocker =
  | 'not-new-payload-contract'
  | 'requires-future-controller-policy'
  | 'requires-future-production-adapter'
  | 'requires-real-production-like-traces';

type TransitionBudgetPayloadPromotionTarget =
  | 'existing-runner-derived-stop-metadata-contract'
  | 'future-controller-policy-contract'
  | 'future-production-adapter-payload-contract';

interface TransitionBudgetPayloadPromotionReadinessRow {
  blockers: readonly TransitionBudgetPayloadPromotionBlocker[];
  currentSource: string | null;
  decision: TransitionBudgetPayloadPromotionDecision;
  fieldName: TransitionBudgetPayloadCandidateField;
  mayPromoteNewPayloadContract: false;
  productionReady: false;
  promotionTarget: TransitionBudgetPayloadPromotionTarget;
  reason: 'transition-budget-exhausted';
}

const transitionBudgetPayloadPromotionReadiness = [
  {
    blockers: [
      'requires-future-controller-policy',
      'requires-real-production-like-traces',
    ],
    currentSource: null,
    decision: 'keep-smoke-only',
    fieldName: 'budgetOwner',
    mayPromoteNewPayloadContract: false,
    productionReady: false,
    promotionTarget: 'future-controller-policy-contract',
    reason: 'transition-budget-exhausted',
  },
  {
    blockers: [
      'not-new-payload-contract',
    ],
    currentSource: 'AgentSessionV3PilotRunnerResult.transitions.length',
    decision: 'already-covered-by-runner-derived-contract',
    fieldName: 'transitionCount',
    mayPromoteNewPayloadContract: false,
    productionReady: false,
    promotionTarget: 'existing-runner-derived-stop-metadata-contract',
    reason: 'transition-budget-exhausted',
  },
  {
    blockers: [
      'requires-future-production-adapter',
      'requires-real-production-like-traces',
    ],
    currentSource: null,
    decision: 'keep-smoke-only',
    fieldName: 'modelBudgetState',
    mayPromoteNewPayloadContract: false,
    productionReady: false,
    promotionTarget: 'future-production-adapter-payload-contract',
    reason: 'transition-budget-exhausted',
  },
  {
    blockers: [
      'requires-future-production-adapter',
      'requires-real-production-like-traces',
    ],
    currentSource: null,
    decision: 'keep-smoke-only',
    fieldName: 'toolBudgetState',
    mayPromoteNewPayloadContract: false,
    productionReady: false,
    promotionTarget: 'future-production-adapter-payload-contract',
    reason: 'transition-budget-exhausted',
  },
  {
    blockers: [
      'requires-future-production-adapter',
      'requires-real-production-like-traces',
    ],
    currentSource: null,
    decision: 'keep-smoke-only',
    fieldName: 'taskProgress',
    mayPromoteNewPayloadContract: false,
    productionReady: false,
    promotionTarget: 'future-production-adapter-payload-contract',
    reason: 'transition-budget-exhausted',
  },
  {
    blockers: [
      'not-new-payload-contract',
    ],
    currentSource: 'AgentSessionV3PilotState.recoveryCount',
    decision: 'already-covered-by-runner-derived-contract',
    fieldName: 'recoveryCount',
    mayPromoteNewPayloadContract: false,
    productionReady: false,
    promotionTarget: 'existing-runner-derived-stop-metadata-contract',
    reason: 'transition-budget-exhausted',
  },
] as const satisfies readonly TransitionBudgetPayloadPromotionReadinessRow[];

const {
  boundarySource,
  transitionBudgetPromotionReadinessSmokeSource,
  transitionBudgetBlockerReviewSmokeSource,
  adapterPromotionReadinessSmokeSource,
  extractionSmokeSource,
  controllerConsumptionSmokeSource,
  preflightAuditText,
  statusText,
} = readProjectSources({
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  transitionBudgetPromotionReadinessSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-transition-budget-payload-promotion-readiness-smoke.ts',
  transitionBudgetBlockerReviewSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-transition-budget-payload-blocker-review-smoke.ts',
  adapterPromotionReadinessSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-promotion-readiness-smoke.ts',
  extractionSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-runner-derived-stop-metadata-extraction-audit-smoke.ts',
  controllerConsumptionSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-runner-derived-stop-metadata-controller-consumption-preflight-smoke.ts',
  preflightAuditText: 'PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md',
  statusText: 'PROJECT_AGENT_V2_STATUS.md',
});

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');

const transitionBudgetEvents = [
  { type: 'start' },
  {
    route: 'prepare-command',
    type: 'model-decision-accepted',
  },
  {
    route: 'execute',
    type: 'command-prepared',
  },
  {
    ok: false,
    type: 'transaction-finished',
  },
  {
    reason: 'transition-budget promotion-readiness needs recovery before budget stop',
    type: 'evaluation-needs-recovery',
  },
] as const;

const transitionLimitResult = await runAgentSessionV3PilotRunner({
  driver: ({ transitionCount }) => transitionBudgetEvents[transitionCount] ?? null,
  maxTransitions: transitionBudgetEvents.length,
});
assert.equal(transitionLimitResult.status, 'transition-limit');
assert.equal(transitionLimitResult.state.phase, 'recover');
assert.equal(transitionLimitResult.state.recoveryCount, 1);
assert.equal(transitionLimitResult.transitions.length, transitionBudgetEvents.length);

const transitionBudgetMetadata = extractAgentSessionV3RuntimeRunnerDerivedStopMetadata(transitionLimitResult);
assert.ok(transitionBudgetMetadata);
assert.deepEqual(transitionBudgetMetadata, {
  reason: 'transition-budget-exhausted',
  recoveryCount: 1,
  transitionCount: transitionBudgetEvents.length,
});
assert.deepEqual(
  Object.keys(transitionBudgetMetadata).sort(),
  [...getAgentSessionV3RuntimeRunnerDerivedStopMetadataFields('transition-budget-exhausted')].sort(),
);
assert.equal('budgetOwner' in transitionBudgetMetadata, false);
assert.equal('modelBudgetState' in transitionBudgetMetadata, false);
assert.equal('toolBudgetState' in transitionBudgetMetadata, false);
assert.equal('taskProgress' in transitionBudgetMetadata, false);

const transitionBudgetStopEvidenceFields = getAgentSessionV3RuntimeStopEvidenceFields(
  'transition-budget-exhausted',
);
assert.deepEqual(
  transitionBudgetPayloadPromotionReadiness.map((row) => row.fieldName).sort(),
  transitionBudgetStopEvidenceFields.map((field) => field.name).sort(),
  'Transition-budget payload promotion-readiness audit should cover every transition-budget stop-evidence field exactly once.',
);

for (const row of transitionBudgetPayloadPromotionReadiness) {
  const contractField = transitionBudgetStopEvidenceFields.find((field) => field.name === row.fieldName);
  assert.ok(contractField, `${row.fieldName} should exist in transition-budget stop evidence contract.`);
  assert.equal(row.productionReady, false);
  assert.equal(row.mayPromoteNewPayloadContract, false);

  if (row.decision === 'already-covered-by-runner-derived-contract') {
    assert.equal(contractField.source, 'pilot-runner-state');
    assert.equal(row.promotionTarget, 'existing-runner-derived-stop-metadata-contract');
    assert.ok(row.currentSource);
    assert.deepEqual(row.blockers, ['not-new-payload-contract']);
  }

  if (row.fieldName === 'budgetOwner') {
    assert.equal(contractField.source, 'future-controller-policy');
    assert.equal(row.currentSource, null);
    assert.equal(row.decision, 'keep-smoke-only');
    assert.equal(row.promotionTarget, 'future-controller-policy-contract');
    assert.ok(row.blockers.includes('requires-future-controller-policy'));
    assert.ok(row.blockers.includes('requires-real-production-like-traces'));
  }

  if (
    row.fieldName === 'modelBudgetState'
    || row.fieldName === 'toolBudgetState'
    || row.fieldName === 'taskProgress'
  ) {
    assert.equal(contractField.source, 'future-production-adapter');
    assert.equal(row.currentSource, null);
    assert.equal(row.decision, 'keep-smoke-only');
    assert.equal(row.promotionTarget, 'future-production-adapter-payload-contract');
    assert.ok(row.blockers.includes('requires-future-production-adapter'));
    assert.ok(row.blockers.includes('requires-real-production-like-traces'));
  }
}

assert.deepEqual(
  transitionBudgetPayloadPromotionReadiness
    .filter((row) => row.decision === 'already-covered-by-runner-derived-contract')
    .map((row) => row.fieldName)
    .sort(),
  ['recoveryCount', 'transitionCount'],
  'Runner-derived transition-budget fields should stay in the existing metadata contract.',
);
assert.deepEqual(
  transitionBudgetPayloadPromotionReadiness
    .filter((row) => row.mayPromoteNewPayloadContract),
  [],
  'No transition-budget payload field should be promoted into a new payload contract yet.',
);
assert.deepEqual(
  transitionBudgetPayloadPromotionReadiness
    .filter((row) => row.promotionTarget === 'future-production-adapter-payload-contract')
    .map((row) => row.fieldName)
    .sort(),
  ['modelBudgetState', 'taskProgress', 'toolBudgetState'],
);
assert.deepEqual(
  transitionBudgetPayloadPromotionReadiness
    .filter((row) => row.promotionTarget === 'future-controller-policy-contract')
    .map((row) => row.fieldName),
  ['budgetOwner'],
);

assert.match(transitionBudgetBlockerReviewSmokeSource, /runner-derived reporting and classification context/u);
assert.match(transitionBudgetBlockerReviewSmokeSource, /future-production-adapter-required/u);
assert.match(adapterPromotionReadinessSmokeSource, /transition-budget-exhausted/u);
assert.match(adapterPromotionReadinessSmokeSource, /runner-derived-stop-metadata-contract/u);
assert.match(extractionSmokeSource, /transition-budget-exhausted/u);
assert.match(controllerConsumptionSmokeSource, /must not decide/u);
assert.match(controllerConsumptionSmokeSource, /budgetOwner/u);
assert.match(controllerConsumptionSmokeSource, /taskProgress/u);

const serializedPromotionReadiness = JSON.stringify(transitionBudgetPayloadPromotionReadiness);
assert.doesNotMatch(
  serializedPromotionReadiness,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|terminalStatusCandidate/u,
  'Transition-budget payload promotion-readiness should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedPromotionReadiness,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Transition-budget payload promotion-readiness should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedPromotionReadiness,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain/iu,
  'Transition-budget payload promotion-readiness should not define fixed workflows or fallback chains.',
);
assert.doesNotMatch(
  serializedPromotionReadiness,
  /productionReady":true|runtimeAuthority|experimental-adapter/u,
  'Transition-budget payload promotion-readiness should not grant runtime authority.',
);

assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Transition-budget payload promotion-readiness audit must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  transitionBudgetPromotionReadinessSmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Transition-budget payload promotion-readiness audit should not call production v2 modules.',
);

assert.match(preflightAuditText, /Transition-Budget Payload Promotion-Readiness Audit Status/u);
assert.match(
  preflightAuditText,
  /agent-session-v3-runtime-boundary-transition-budget-payload-promotion-readiness-smoke\.ts/u,
);
assert.match(preflightAuditText, /No new structured transition-budget payload field is formal-contract-ready/u);
assert.match(preflightAuditText, /not production wiring/u);
assert.match(statusText, /V3 runtime boundary transition-budget payload promotion-readiness audit.*Completed/u);
assert.match(
  statusText,
  /agent-session-v3-runtime-boundary-transition-budget-payload-promotion-readiness-smoke\.ts/u,
);

console.log('agent session v3 runtime boundary transition-budget payload promotion-readiness smoke ok');
