import assert from 'node:assert/strict';
import {
  AGENT_SESSION_V3_RUNTIME_RUNNER_DERIVED_STOP_METADATA_CONTRACT,
  createAgentSessionV3RuntimeBoundaryContract,
  extractAgentSessionV3RuntimeRunnerDerivedStopMetadata,
  getAgentSessionV3RuntimeRunnerDerivedStopMetadataFields,
  getAgentSessionV3RuntimeStopEvidenceFields,
  runAgentSessionV3PilotRunner,
  type AgentSessionV3RuntimeInvalidTransitionStopMetadata,
  type AgentSessionV3RuntimeRunnerDerivedStopMetadata,
  type AgentSessionV3RuntimeTransitionBudgetStopMetadata,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const {
  boundarySource,
  indexSource,
  promotionReadinessSmokeSource,
  preflightAuditText,
  statusText,
} = readProjectSources({
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  indexSource: 'src/agent/legacy/index.ts',
  promotionReadinessSmokeSource: 'scripts/agent-session-v3-runtime-boundary-adapter-promotion-readiness-smoke.ts',
  preflightAuditText: 'PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md',
  statusText: 'PROJECT_AGENT_V2_STATUS.md',
});

assert.match(boundarySource, /export interface AgentSessionV3RuntimeInvalidTransitionStopMetadata/u);
assert.match(boundarySource, /export interface AgentSessionV3RuntimeTransitionBudgetStopMetadata/u);
assert.match(boundarySource, /export type AgentSessionV3RuntimeRunnerDerivedStopMetadata/u);
assert.match(boundarySource, /AGENT_SESSION_V3_RUNTIME_RUNNER_DERIVED_STOP_METADATA_CONTRACT/u);
assert.match(boundarySource, /getAgentSessionV3RuntimeRunnerDerivedStopMetadataFields/u);
assert.match(boundarySource, /export function extractAgentSessionV3RuntimeRunnerDerivedStopMetadata/u);
assert.match(indexSource, /export \* from '\.\.\/agentSessionV3RuntimeBoundary'/u);

assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Runner-derived stop metadata contract should not call production v2 runtime, permission, or execution modules.',
);
assert.doesNotMatch(
  boundarySource,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action/u,
  'Runner-derived stop metadata contract should not name concrete desktop tools.',
);

const contract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(contract.productionAuthority, false);
assert.deepEqual(
  contract.runnerDerivedStopMetadataContract,
  AGENT_SESSION_V3_RUNTIME_RUNNER_DERIVED_STOP_METADATA_CONTRACT,
);
assert.equal(AGENT_SESSION_V3_RUNTIME_RUNNER_DERIVED_STOP_METADATA_CONTRACT.version, 1);
assert.equal(AGENT_SESSION_V3_RUNTIME_RUNNER_DERIVED_STOP_METADATA_CONTRACT.productionAuthority, false);
assert.deepEqual(
  AGENT_SESSION_V3_RUNTIME_RUNNER_DERIVED_STOP_METADATA_CONTRACT.promotedReasons,
  ['invalid-transition', 'transition-budget-exhausted'],
);
assert.ok(
  AGENT_SESSION_V3_RUNTIME_RUNNER_DERIVED_STOP_METADATA_CONTRACT.guardrails.includes(
    'no adapter-owned stop-payload fields',
  ),
);
assert.ok(
  AGENT_SESSION_V3_RUNTIME_RUNNER_DERIVED_STOP_METADATA_CONTRACT.guardrails.includes(
    'no controller-policy fields',
  ),
);
assert.ok(
  AGENT_SESSION_V3_RUNTIME_RUNNER_DERIVED_STOP_METADATA_CONTRACT.guardrails.includes(
    'no required ordered tool workflow',
  ),
);

assert.deepEqual(
  getAgentSessionV3RuntimeRunnerDerivedStopMetadataFields('invalid-transition'),
  ['reason', 'phase', 'eventType'],
);
assert.deepEqual(
  getAgentSessionV3RuntimeRunnerDerivedStopMetadataFields('transition-budget-exhausted'),
  ['reason', 'transitionCount', 'recoveryCount'],
);

assert.deepEqual(
  getAgentSessionV3RuntimeStopEvidenceFields('invalid-transition')
    .filter((field) => field.source === 'pilot-runner-state')
    .map((field) => field.name)
    .sort(),
  ['eventType', 'phase'],
);
assert.deepEqual(
  getAgentSessionV3RuntimeStopEvidenceFields('transition-budget-exhausted')
    .filter((field) => field.source === 'pilot-runner-state')
    .map((field) => field.name)
    .sort(),
  ['recoveryCount', 'transitionCount'],
);

const invalidTransitionMetadata: AgentSessionV3RuntimeInvalidTransitionStopMetadata = {
  eventType: 'model-output-invalid',
  phase: 'model_decision',
  reason: 'invalid-transition',
};
const transitionBudgetMetadata: AgentSessionV3RuntimeTransitionBudgetStopMetadata = {
  reason: 'transition-budget-exhausted',
  recoveryCount: 2,
  transitionCount: 24,
};
const metadataUnion: AgentSessionV3RuntimeRunnerDerivedStopMetadata[] = [
  invalidTransitionMetadata,
  transitionBudgetMetadata,
];
assert.deepEqual(metadataUnion.map((metadata) => metadata.reason), [
  'invalid-transition',
  'transition-budget-exhausted',
]);

const invalidTransitionRunnerResult = await runAgentSessionV3PilotRunner({
  driver: () => ({
    type: 'model-output-invalid',
  }),
});
assert.deepEqual(extractAgentSessionV3RuntimeRunnerDerivedStopMetadata(invalidTransitionRunnerResult), {
  eventType: 'model-output-invalid',
  phase: 'init',
  reason: 'invalid-transition',
});

const transitionBudgetRunnerResult = await runAgentSessionV3PilotRunner({
  driver: ({ state }) => {
    if (state.phase === 'init') {
      return { type: 'start' };
    }

    return {
      route: 'terminal',
      terminalStatus: 'completed',
      type: 'model-decision-accepted',
    };
  },
  maxTransitions: 1,
});
assert.deepEqual(extractAgentSessionV3RuntimeRunnerDerivedStopMetadata(transitionBudgetRunnerResult), {
  reason: 'transition-budget-exhausted',
  recoveryCount: 0,
  transitionCount: 1,
});

const serializedContract = JSON.stringify(AGENT_SESSION_V3_RUNTIME_RUNNER_DERIVED_STOP_METADATA_CONTRACT);
assert.doesNotMatch(
  serializedContract,
  /blockerSource|recoverability|userActionRequired|adapterSource|retrySafety|failureOrigin|retryability|sideEffectCommitted|userVisibleFailureReason|errorClass|modelBudgetState|toolBudgetState|taskProgress|waitSource|pauseReason|resumeTriggerOwner|waitBudget|budgetOwner|terminalStatusCandidate|invalidTransitionKind/u,
  'Runner-derived stop metadata contract should not promote adapter, phase-port, or controller-owned fields.',
);
assert.doesNotMatch(
  serializedContract,
  /execute_desktop|observe_windows_and_apps|locate_screen_elements|open_app|mouse_click|keyboard_hotkey/iu,
  'Runner-derived stop metadata contract should not prescribe concrete tools.',
);
assert.doesNotMatch(
  serializedContract,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain/iu,
  'Runner-derived stop metadata contract should not define fixed workflows or fallback chains.',
);

assert.match(promotionReadinessSmokeSource, /formal-contract-ready/u);
assert.match(promotionReadinessSmokeSource, /No adapter-owned stop-payload field should be promoted/u);
assert.match(preflightAuditText, /Runner-Derived Stop Metadata Contract Status/u);
assert.match(preflightAuditText, /agent-session-v3-runtime-boundary-runner-derived-stop-metadata-contract-smoke\.ts/u);
assert.match(preflightAuditText, /invalid-transition\.phase/u);
assert.match(preflightAuditText, /transition-budget-exhausted\.recoveryCount/u);
assert.match(preflightAuditText, /not production wiring/u);
assert.match(statusText, /V3 runtime boundary runner-derived stop-metadata contract.*Completed/u);
assert.match(statusText, /agent-session-v3-runtime-boundary-runner-derived-stop-metadata-contract-smoke\.ts/u);

console.log('agent session v3 runtime boundary runner-derived stop metadata contract smoke ok');
