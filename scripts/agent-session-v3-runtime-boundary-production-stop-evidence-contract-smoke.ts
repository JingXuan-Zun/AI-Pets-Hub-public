import assert from 'node:assert/strict';
import {
  AGENT_SESSION_V3_RUNTIME_STOP_EVIDENCE_CONTRACT,
  createAgentSessionV3RuntimeBoundaryContract,
  getAgentSessionV3RuntimeStopEvidenceFields,
  type AgentSessionV3RuntimeBoundaryStopReason,
  type AgentSessionV3RuntimeStopEvidenceSource,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const evidenceBlockedReasons = [
  'blocked-by-phase',
  'invalid-transition',
  'runtime-failed',
  'transition-budget-exhausted',
  'waiting-for-phase-event',
] as const satisfies readonly AgentSessionV3RuntimeBoundaryStopReason[];

const expectedSources = [
  'future-controller-policy',
  'future-production-adapter',
  'phase-port-result',
  'pilot-runner-state',
] as const satisfies readonly AgentSessionV3RuntimeStopEvidenceSource[];

const expectedFieldNamesByReason = {
  'blocked-by-phase': [
    'blockerSource',
    'recoverability',
    'terminalStatusCandidate',
    'userActionRequired',
  ],
  'invalid-transition': [
    'adapterSource',
    'eventType',
    'invalidTransitionKind',
    'phase',
    'retrySafety',
  ],
  'runtime-failed': [
    'errorClass',
    'failureOrigin',
    'retryability',
    'sideEffectCommitted',
    'userVisibleFailureReason',
  ],
  'transition-budget-exhausted': [
    'budgetOwner',
    'modelBudgetState',
    'recoveryCount',
    'taskProgress',
    'toolBudgetState',
    'transitionCount',
  ],
  'waiting-for-phase-event': [
    'pauseReason',
    'resumeTriggerOwner',
    'waitBudget',
    'waitSource',
  ],
} as const satisfies Record<typeof evidenceBlockedReasons[number], readonly string[]>;

const {
  boundarySource,
  gapSmokeSource,
  preflightAuditText,
  statusText,
} = readProjectSources({
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  gapSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-production-stop-policy-gap-smoke.ts',
  preflightAuditText: 'PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md',
  statusText: 'PROJECT_AGENT_V2_STATUS.md',
});

assert.match(boundarySource, /export interface AgentSessionV3RuntimeStopEvidenceField/u);
assert.match(boundarySource, /export type AgentSessionV3RuntimeStopEvidenceSource/u);
assert.match(boundarySource, /AGENT_SESSION_V3_RUNTIME_STOP_EVIDENCE_CONTRACT/u);
assert.match(boundarySource, /getAgentSessionV3RuntimeStopEvidenceFields/u);

assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Production stop evidence contract should not call production v2 runtime, permission, or execution modules.',
);
assert.doesNotMatch(
  boundarySource,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action/u,
  'Production stop evidence contract should not name concrete desktop tools.',
);

const contractReasons = Object.keys(AGENT_SESSION_V3_RUNTIME_STOP_EVIDENCE_CONTRACT).sort();
assert.deepEqual(contractReasons, [...evidenceBlockedReasons].sort());
assert.deepEqual(getAgentSessionV3RuntimeStopEvidenceFields('continue-with-event'), []);
assert.deepEqual(getAgentSessionV3RuntimeStopEvidenceFields('cancelled'), []);

for (const reason of evidenceBlockedReasons) {
  const fields = getAgentSessionV3RuntimeStopEvidenceFields(reason);
  assert.ok(fields.length >= 4, `${reason} should define minimal evidence fields.`);
  assert.deepEqual(
    fields.map((field) => field.name).sort(),
    [...expectedFieldNamesByReason[reason]].sort(),
  );

  for (const field of fields) {
    assert.equal(field.requiredForProductionPolicy, true);
    assert.ok(field.description.length > 20);
    assert.ok(expectedSources.includes(field.source));
  }
}

assert.deepEqual(
  getAgentSessionV3RuntimeStopEvidenceFields('waiting-for-phase-event')
    .filter((field) => field.source === 'phase-port-result')
    .map((field) => field.name)
    .sort(),
  ['pauseReason', 'waitSource'],
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
assert.ok(
  getAgentSessionV3RuntimeStopEvidenceFields('runtime-failed')
    .every((field) => field.source === 'future-production-adapter'),
);

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.deepEqual(boundaryContract.stopEvidenceContract, AGENT_SESSION_V3_RUNTIME_STOP_EVIDENCE_CONTRACT);

assert.match(gapSmokeSource, /wait source classification/u);
assert.match(gapSmokeSource, /blocker source classification/u);
assert.match(gapSmokeSource, /invalid phase\/event pair/u);
assert.match(gapSmokeSource, /budget owner/u);
assert.match(gapSmokeSource, /failure origin classification/u);

const serializedEvidenceContract = JSON.stringify(AGENT_SESSION_V3_RUNTIME_STOP_EVIDENCE_CONTRACT);
assert.doesNotMatch(
  serializedEvidenceContract,
  /execute_desktop|observe_windows_and_apps|locate_screen_elements|open_app|mouse_click|keyboard_hotkey/iu,
  'Production stop evidence contract should not prescribe concrete tools.',
);
assert.doesNotMatch(
  serializedEvidenceContract,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain/iu,
  'Production stop evidence contract should not define fixed workflows or fallback chains.',
);

assert.match(preflightAuditText, /Production Stop Evidence Contract Audit Status/u);
assert.match(preflightAuditText, /agent-session-v3-runtime-boundary-production-stop-evidence-contract-smoke\.ts/u);
assert.match(preflightAuditText, /pilot-runner-state/u);
assert.match(preflightAuditText, /future-production-adapter/u);
assert.match(preflightAuditText, /future-controller-policy/u);
assert.match(preflightAuditText, /not a controller/u);
assert.match(statusText, /V3 runtime boundary production-stop evidence contract audit.*Completed/u);
assert.match(statusText, /agent-session-v3-runtime-boundary-production-stop-evidence-contract-smoke\.ts/u);

console.log('agent session v3 runtime boundary production stop evidence contract smoke ok');
