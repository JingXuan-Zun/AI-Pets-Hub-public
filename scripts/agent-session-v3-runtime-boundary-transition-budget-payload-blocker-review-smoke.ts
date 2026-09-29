import assert from 'node:assert/strict';
import {
  createAgentSessionV3RuntimeBoundaryContract,
  extractAgentSessionV3RuntimeRunnerDerivedStopMetadata,
  getAgentSessionV3RuntimeRunnerDerivedStopMetadataFields,
  getAgentSessionV3RuntimeStopEvidenceFields,
  runAgentSessionV3PilotRunner,
  type AgentSessionV3RuntimeTransitionBudgetStopMetadata,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

type TransitionBudgetPayloadField =
  | 'budgetOwner'
  | 'modelBudgetState'
  | 'recoveryCount'
  | 'taskProgress'
  | 'toolBudgetState'
  | 'transitionCount';

type TransitionBudgetPayloadCurrentSupport =
  | 'available-runner-derived'
  | 'missing';

type TransitionBudgetPayloadPromotionReadiness =
  | 'future-controller-policy-required'
  | 'future-production-adapter-required'
  | 'runner-derived-only';

interface TransitionBudgetPayloadBlockerReviewRow {
  currentSource: string | null;
  currentSupport: TransitionBudgetPayloadCurrentSupport;
  fieldName: TransitionBudgetPayloadField;
  futureOwner: 'current-pilot-runner' | 'future-controller-policy' | 'future-production-adapter';
  isControllerDecisionInput: boolean;
  promotionReadiness: TransitionBudgetPayloadPromotionReadiness;
  reason: 'transition-budget-exhausted';
  reportingContext: boolean;
}

const transitionBudgetPayloadBlockerReview = [
  {
    currentSource: null,
    currentSupport: 'missing',
    fieldName: 'budgetOwner',
    futureOwner: 'future-controller-policy',
    isControllerDecisionInput: true,
    promotionReadiness: 'future-controller-policy-required',
    reason: 'transition-budget-exhausted',
    reportingContext: false,
  },
  {
    currentSource: 'AgentSessionV3PilotRunnerResult.transitions.length',
    currentSupport: 'available-runner-derived',
    fieldName: 'transitionCount',
    futureOwner: 'current-pilot-runner',
    isControllerDecisionInput: false,
    promotionReadiness: 'runner-derived-only',
    reason: 'transition-budget-exhausted',
    reportingContext: true,
  },
  {
    currentSource: null,
    currentSupport: 'missing',
    fieldName: 'modelBudgetState',
    futureOwner: 'future-production-adapter',
    isControllerDecisionInput: true,
    promotionReadiness: 'future-production-adapter-required',
    reason: 'transition-budget-exhausted',
    reportingContext: false,
  },
  {
    currentSource: null,
    currentSupport: 'missing',
    fieldName: 'toolBudgetState',
    futureOwner: 'future-production-adapter',
    isControllerDecisionInput: true,
    promotionReadiness: 'future-production-adapter-required',
    reason: 'transition-budget-exhausted',
    reportingContext: false,
  },
  {
    currentSource: null,
    currentSupport: 'missing',
    fieldName: 'taskProgress',
    futureOwner: 'future-production-adapter',
    isControllerDecisionInput: true,
    promotionReadiness: 'future-production-adapter-required',
    reason: 'transition-budget-exhausted',
    reportingContext: false,
  },
  {
    currentSource: 'AgentSessionV3PilotState.recoveryCount',
    currentSupport: 'available-runner-derived',
    fieldName: 'recoveryCount',
    futureOwner: 'current-pilot-runner',
    isControllerDecisionInput: false,
    promotionReadiness: 'runner-derived-only',
    reason: 'transition-budget-exhausted',
    reportingContext: true,
  },
] as const satisfies readonly TransitionBudgetPayloadBlockerReviewRow[];

function assertTransitionBudgetMetadataShape(
  metadata: AgentSessionV3RuntimeTransitionBudgetStopMetadata,
) {
  assert.deepEqual(
    Object.keys(metadata).sort(),
    [...getAgentSessionV3RuntimeRunnerDerivedStopMetadataFields(metadata.reason)].sort(),
  );
  assert.deepEqual(Object.keys(metadata).sort(), ['reason', 'recoveryCount', 'transitionCount']);
}

const {
  boundarySource,
  transitionBudgetPayloadReviewSmokeSource,
  extractionSmokeSource,
  controllerConsumptionSmokeSource,
  sourceMappingSmokeSource,
  blockerMapSmokeSource,
  preflightAuditText,
  statusText,
} = readProjectSources({
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  transitionBudgetPayloadReviewSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-transition-budget-payload-blocker-review-smoke.ts',
  extractionSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-runner-derived-stop-metadata-extraction-audit-smoke.ts',
  controllerConsumptionSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-runner-derived-stop-metadata-controller-consumption-preflight-smoke.ts',
  sourceMappingSmokeSource: 'scripts/agent-session-v3-runtime-boundary-stop-payload-source-mapping-smoke.ts',
  blockerMapSmokeSource: 'scripts/agent-session-v3-runtime-boundary-stop-evidence-blocker-map-smoke.ts',
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
    reason: 'transition-budget blocker review needs recovery before the budget stop',
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
assert.equal(transitionBudgetMetadata.reason, 'transition-budget-exhausted');
assert.deepEqual(transitionBudgetMetadata, {
  reason: 'transition-budget-exhausted',
  recoveryCount: 1,
  transitionCount: transitionBudgetEvents.length,
});
assertTransitionBudgetMetadataShape(transitionBudgetMetadata);
assert.equal('budgetOwner' in transitionBudgetMetadata, false);
assert.equal('modelBudgetState' in transitionBudgetMetadata, false);
assert.equal('toolBudgetState' in transitionBudgetMetadata, false);
assert.equal('taskProgress' in transitionBudgetMetadata, false);

const transitionBudgetStopEvidenceFields = getAgentSessionV3RuntimeStopEvidenceFields(
  'transition-budget-exhausted',
);
assert.deepEqual(
  transitionBudgetPayloadBlockerReview.map((row) => row.fieldName).sort(),
  transitionBudgetStopEvidenceFields.map((field) => field.name).sort(),
  'Transition-budget payload blocker review should cover every transition-budget stop-evidence field exactly once.',
);

for (const row of transitionBudgetPayloadBlockerReview) {
  const contractField = transitionBudgetStopEvidenceFields.find((field) => field.name === row.fieldName);
  assert.ok(contractField, `${row.fieldName} should exist in transition-budget stop evidence contract.`);
  assert.equal(row.reason, 'transition-budget-exhausted');

  if (row.fieldName === 'transitionCount') {
    assert.equal(contractField.source, 'pilot-runner-state');
    assert.equal(row.currentSource, 'AgentSessionV3PilotRunnerResult.transitions.length');
    assert.equal(row.currentSupport, 'available-runner-derived');
    assert.equal(row.futureOwner, 'current-pilot-runner');
    assert.equal(row.promotionReadiness, 'runner-derived-only');
    assert.equal(row.isControllerDecisionInput, false);
    assert.equal(row.reportingContext, true);
  }

  if (row.fieldName === 'recoveryCount') {
    assert.equal(contractField.source, 'pilot-runner-state');
    assert.equal(row.currentSource, 'AgentSessionV3PilotState.recoveryCount');
    assert.equal(row.currentSupport, 'available-runner-derived');
    assert.equal(row.futureOwner, 'current-pilot-runner');
    assert.equal(row.promotionReadiness, 'runner-derived-only');
    assert.equal(row.isControllerDecisionInput, false);
    assert.equal(row.reportingContext, true);
  }

  if (row.fieldName === 'budgetOwner') {
    assert.equal(contractField.source, 'future-controller-policy');
    assert.equal(row.currentSource, null);
    assert.equal(row.currentSupport, 'missing');
    assert.equal(row.futureOwner, 'future-controller-policy');
    assert.equal(row.promotionReadiness, 'future-controller-policy-required');
    assert.equal(row.isControllerDecisionInput, true);
  }

  if (
    row.fieldName === 'modelBudgetState'
    || row.fieldName === 'toolBudgetState'
    || row.fieldName === 'taskProgress'
  ) {
    assert.equal(contractField.source, 'future-production-adapter');
    assert.equal(row.currentSource, null);
    assert.equal(row.currentSupport, 'missing');
    assert.equal(row.futureOwner, 'future-production-adapter');
    assert.equal(row.promotionReadiness, 'future-production-adapter-required');
    assert.equal(row.isControllerDecisionInput, true);
  }
}

assert.deepEqual(
  transitionBudgetPayloadBlockerReview
    .filter((row) => row.currentSupport === 'available-runner-derived')
    .map((row) => row.fieldName)
    .sort(),
  ['recoveryCount', 'transitionCount'],
);
assert.deepEqual(
  transitionBudgetPayloadBlockerReview
    .filter((row) => row.isControllerDecisionInput)
    .map((row) => row.fieldName)
    .sort(),
  ['budgetOwner', 'modelBudgetState', 'taskProgress', 'toolBudgetState'],
);
assert.deepEqual(
  transitionBudgetPayloadBlockerReview
    .filter((row) => row.futureOwner === 'future-production-adapter')
    .map((row) => row.fieldName)
    .sort(),
  ['modelBudgetState', 'taskProgress', 'toolBudgetState'],
);
assert.deepEqual(
  transitionBudgetPayloadBlockerReview
    .filter((row) => row.futureOwner === 'future-controller-policy')
    .map((row) => row.fieldName),
  ['budgetOwner'],
);

assert.match(extractionSmokeSource, /transition-budget-exhausted/u);
assert.match(controllerConsumptionSmokeSource, /budgetOwner/u);
assert.match(controllerConsumptionSmokeSource, /modelBudgetState/u);
assert.match(controllerConsumptionSmokeSource, /toolBudgetState/u);
assert.match(controllerConsumptionSmokeSource, /taskProgress/u);
assert.match(sourceMappingSmokeSource, /transition-budget-exhausted[\s\S]*available-from-current-pilot-runner/u);
assert.match(sourceMappingSmokeSource, /transition-budget-exhausted[\s\S]*future-controller-policy-owned/u);
assert.match(sourceMappingSmokeSource, /transition-budget-exhausted[\s\S]*missing-future-production-adapter/u);
assert.match(blockerMapSmokeSource, /transition-budget-exhausted[\s\S]*reporting-enrichment/u);
assert.match(blockerMapSmokeSource, /transition-budget-exhausted[\s\S]*decision-blocking/u);

const serializedReview = JSON.stringify(transitionBudgetPayloadBlockerReview);
assert.doesNotMatch(
  serializedReview,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|terminalStatusCandidate/u,
  'Transition-budget payload blocker review should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedReview,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Transition-budget payload blocker review should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedReview,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain/iu,
  'Transition-budget payload blocker review should not define fixed workflows or fallback chains.',
);
assert.doesNotMatch(
  serializedReview,
  /productionReady":true|runtimeAuthority|experimental-adapter/u,
  'Transition-budget payload blocker review should not grant runtime authority.',
);

assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Transition-budget payload blocker review must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  transitionBudgetPayloadReviewSmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Transition-budget payload blocker review should not call production v2 modules.',
);

assert.match(preflightAuditText, /Transition-Budget Payload Blocker Review Status/u);
assert.match(
  preflightAuditText,
  /agent-session-v3-runtime-boundary-transition-budget-payload-blocker-review-smoke\.ts/u,
);
assert.match(preflightAuditText, /runner-derived reporting and classification context/u);
assert.match(preflightAuditText, /not production wiring/u);
assert.match(statusText, /V3 runtime boundary transition-budget payload blocker review.*Completed/u);
assert.match(
  statusText,
  /agent-session-v3-runtime-boundary-transition-budget-payload-blocker-review-smoke\.ts/u,
);

console.log('agent session v3 runtime boundary transition-budget payload blocker review smoke ok');
